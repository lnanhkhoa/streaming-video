import { Client } from 'minio'
import { Readable } from 'stream'
import { env } from '../env'
import { BUCKET_PROCESSED, BUCKET_RAW, BUCKET_THUMBNAILS } from '@repo/constants'

class StorageService {
  private client: Client
  private buckets = {
    raw: BUCKET_RAW,
    processed: BUCKET_PROCESSED,
    thumbnails: BUCKET_THUMBNAILS
  }

  constructor() {
    this.client = new Client({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY
    })

    this.initBuckets()
  }

  private async initBuckets() {
    for (const [bucketType, bucket] of Object.entries(this.buckets)) {
      try {
        const exists = await this.client.bucketExists(bucket)
        if (!exists) {
          await this.client.makeBucket(bucket)
          console.log(`✅ Created bucket: ${bucket}`)
        }

        // Set processed and thumbnails buckets as public
        if (bucketType === 'processed' || bucketType === 'thumbnails') {
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`]
              }
            ]
          }
          await this.client.setBucketPolicy(bucket, JSON.stringify(policy))
          console.log(`🔓 Set ${bucket} as public`)
        }
      } catch (error) {
        console.error(`Failed to initialize bucket ${bucket}:`, error)
      }
    }
  }

  /**
   * Generate presigned URL for client upload
   * @param key - Object key (path)
   * @param expirySeconds - URL expiry (default: 3600)
   */
  async getPresignedUploadUrl(key: string, expirySeconds = 3600): Promise<string> {
    try {
      const url = await this.client.presignedPutObject(this.buckets.raw, key, expirySeconds)
      return url
    } catch (error) {
      console.error('Failed to generate upload URL:', error)
      throw new Error('Failed to generate upload URL')
    }
  }

  /**
   * Generate presigned URL for client download
   * @param bucket - Bucket type (raw/processed/thumbnails)
   * @param key - Object key
   * @param expirySeconds - URL expiry (default: 3600)
   */
  async getPresignedDownloadUrl(
    bucket: 'raw' | 'processed' | 'thumbnails',
    key: string,
    expirySeconds = 3600
  ): Promise<string> {
    try {
      const bucketName = this.buckets[bucket]
      const url = await this.client.presignedGetObject(bucketName, key, expirySeconds)
      return url
    } catch (error) {
      console.error('Failed to generate download URL:', error)
      throw new Error('Failed to generate download URL')
    }
  }

  /**
   * Upload file directly (server-side)
   * @param bucket - Bucket type
   * @param key - Object key
   * @param data - File buffer or stream
   * @param contentType - MIME type
   */
  async uploadFile(
    bucket: 'raw' | 'processed' | 'thumbnails',
    key: string,
    data: Buffer | Readable,
    contentType?: string
  ): Promise<void> {
    try {
      const bucketName = this.buckets[bucket]
      await this.client.putObject(bucketName, key, data, undefined, {
        'Content-Type': contentType || 'application/octet-stream'
      })
    } catch (error) {
      console.error('Failed to upload file:', error)
      throw new Error('Failed to upload file')
    }
  }

  /**
   * Download file directly (server-side)
   * @param bucket - Bucket type
   * @param key - Object key
   * @returns ReadableStream
   */
  async downloadFile(bucket: 'raw' | 'processed' | 'thumbnails', key: string): Promise<Readable> {
    try {
      const bucketName = this.buckets[bucket]
      return await this.client.getObject(bucketName, key)
    } catch (error) {
      console.error('Failed to download file:', error)
      throw new Error('Failed to download file')
    }
  }

  /**
   * Check if file exists
   * @param bucket - Bucket type
   * @param key - Object key
   */
  async fileExists(bucket: 'raw' | 'processed' | 'thumbnails', key: string): Promise<boolean> {
    try {
      const bucketName = this.buckets[bucket]
      await this.client.statObject(bucketName, key)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Delete file
   * @param bucket - Bucket type
   * @param key - Object key
   */
  async deleteFile(bucket: 'raw' | 'processed' | 'thumbnails', key: string): Promise<void> {
    try {
      const bucketName = this.buckets[bucket]
      await this.client.removeObject(bucketName, key)
    } catch (error) {
      console.error('Failed to delete file:', error)
      throw new Error('Failed to delete file')
    }
  }
}

export const storageService = new StorageService()
