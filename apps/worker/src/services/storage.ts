/**
 * MinIO Storage Service
 *
 * TODO (Phase 4):
 * - Initialize MinIO client
 * - downloadFile(key, localPath)
 * - uploadFile(localPath, key)
 * - uploadDirectory(localDir, prefix)
 * - deleteFiles(prefix)
 * - fileExists(key)
 */
import { Client } from 'minio'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'

export interface StorageConfig {
  endpoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
  uploadTimeoutMs?: number
  downloadTimeoutMs?: number
  retries?: number
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/mp2t',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.txt': 'text/plain'
  }
  return map[ext] || 'application/octet-stream'
}

export class StorageService {
  private client: Client
  private bucket: string
  private uploadTimeoutMs: number
  private downloadTimeoutMs: number
  private retries: number

  constructor(config: StorageConfig) {
    this.client = new Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    })
    this.bucket = config.bucket
    this.uploadTimeoutMs = config.uploadTimeoutMs ?? 30_000
    this.downloadTimeoutMs = config.downloadTimeoutMs ?? 60_000
    this.retries = config.retries ?? 3

    // Initialize bucket on startup
    this.ensureBucket().then(
      () => console.log('✅ MinIO connected'),
      (err) => console.error('❌ MinIO initialization failed:', err)
    )
  }

  private async ensureBucket(): Promise<void> {
    await this.withRetry(async () => {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        await this.client.makeBucket(this.bucket)
        console.log(`✅ Created bucket: ${this.bucket}`)
      }
    }, 'ensureBucket')
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err
        const isLast = attempt === this.retries
        console.warn(`⚠️ ${label} failed (attempt ${attempt}/${this.retries}):`, err)
        if (isLast) break
        await sleep(200 * attempt)
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  async downloadFile(key: string, localPath: string): Promise<void> {
    const op = async () => {
      // Ensure directory exists
      const dir = path.dirname(localPath)
      await fsp.mkdir(dir, { recursive: true })
      await withTimeout(
        this.client.fGetObject(this.bucket, key, localPath),
        this.downloadTimeoutMs,
        'downloadFile'
      )
      // Verify
      const ok = fs.existsSync(localPath) && fs.statSync(localPath).size > 0
      if (!ok) throw new Error(`Downloaded file verification failed for ${localPath}`)
    }
    await this.withRetry(op, `downloadFile:${key}`)
    console.log(`⬇️  Downloaded s3://${this.bucket}/${key} -> ${localPath}`)
  }

  async uploadFile(localPath: string, key: string): Promise<void> {
    const contentType = guessContentType(localPath)
    const op = async () => {
      await withTimeout(
        this.client.fPutObject(this.bucket, key, localPath, {
          'Content-Type': contentType
        }),
        this.uploadTimeoutMs,
        'uploadFile'
      )
    }
    await this.withRetry(op, `uploadFile:${key}`)
    console.log(`⬆️  Uploaded ${localPath} -> s3://${this.bucket}/${key} (${contentType})`)
  }

  async uploadDirectory(localDir: string, prefix: string): Promise<string[]> {
    const uploaded: string[] = []
    const errors: { file: string; error: unknown }[] = []

    const walk = async (dir: string) => {
      const entries = await fsp.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.isFile()) {
          const rel = path.relative(localDir, fullPath).split(path.sep).join('/')
          const key = `${prefix.replace(/\/$/, '')}/${rel}`
          try {
            await this.uploadFile(fullPath, key)
            uploaded.push(key)
          } catch (error) {
            console.error(`Failed to upload ${fullPath} -> ${key}:`, error)
            errors.push({ file: fullPath, error })
          }
        }
      }
    }

    await walk(localDir)

    if (errors.length > 0) {
      console.warn(`⚠️ uploadDirectory completed with ${errors.length} errors`)
    }

    return uploaded
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.withRetry(() => this.client.statObject(this.bucket, key), `fileExists:${key}`)
      return true
    } catch {
      return false
    }
  }

  async deleteFiles(prefix: string): Promise<void> {
    const keys: string[] = []
    await this.withRetry(async () => {
      const stream = this.client.listObjectsV2(this.bucket, prefix, true)
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) keys.push(obj.name)
        })
        stream.on('error', reject)
        stream.on('end', resolve)
      })
      if (keys.length === 0) return
      // MinIO removeObjects accepts up to 1000 per call; batch just in case
      const chunkSize = 1000
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize)
        await this.client.removeObjects(this.bucket, chunk)
      }
    }, `deleteFiles:${prefix}`)
    console.log(`🧹 Deleted ${keys.length} object(s) with prefix ${prefix} in ${this.bucket}`)
  }
}

export const storageService = new StorageService({
  endpoint: env.MINIO_ENDPOINT || 'localhost',
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  bucket: 'streaming-video',
  uploadTimeoutMs: 30_000,
  downloadTimeoutMs: 60_000,
  retries: 3
})
