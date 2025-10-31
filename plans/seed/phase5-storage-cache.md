# Phase 5: Storage & Cache Services

**Date**: 2025-10-31
**Estimated Time**: 1-2 days
**Dependencies**: Phase 1 (Foundation)
**Can work in parallel with**: Phase 3 (Backend API)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 5)

## Overview

Set up MinIO (object storage) and Redis (caching). Create service wrappers for API and Worker to use.

## Tasks

### 1. MinIO Setup

Already in `docker-compose.dev.yml` from Phase 3.

**First time setup**:
```bash
# Start MinIO
docker-compose -f docker-compose.dev.yml up -d minio

# Open console
open http://localhost:9001

# Login with:
# Username: admin
# Password: password
```

**Create bucket**:
- Name: `streaming-video`
- Access: Private (use presigned URLs)

Or via code:
```typescript
import { Client } from 'minio'

const minioClient = new Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'admin',
  secretKey: 'password'
})

await minioClient.makeBucket('streaming-video', 'us-east-1')
```

### 2. Storage Service Implementation

**Location**: Both `apps/api/src/services/storage.service.ts` AND `apps/worker/src/services/storage.ts`

**Full implementation** (reference detailed plan section 5.1):

```typescript
import { Client } from 'minio'

class StorageService {
  private client: Client
  private bucket = 'streaming-video'

  constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!
    })

    this.ensureBucket()
  }

  private async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket)
    }
  }

  async getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
    return this.client.presignedPutObject(this.bucket, key, 3600, {
      'Content-Type': contentType
    })
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, 3600)
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key)
      return true
    } catch {
      return false
    }
  }

  async downloadFile(key: string, localPath: string): Promise<void> {
    return this.client.fGetObject(this.bucket, key, localPath)
  }

  async uploadFile(localPath: string, key: string): Promise<void> {
    return this.client.fPutObject(this.bucket, key, localPath)
  }

  async uploadDirectory(localDir: string, prefix: string): Promise<string[]> {
    const fs = require('fs')
    const path = require('path')
    const uploadedKeys: string[] = []

    async function walkDir(dir: string) {
      const files = await fs.promises.readdir(dir)

      for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = await fs.promises.stat(filePath)

        if (stat.isDirectory()) {
          await walkDir(filePath)
        } else {
          const relativePath = path.relative(localDir, filePath)
          const key = `${prefix}/${relativePath}`
          await this.uploadFile(filePath, key)
          uploadedKeys.push(key)
        }
      }
    }

    await walkDir(localDir)
    return uploadedKeys
  }
}

export const storageService = new StorageService()
```

### 3. Redis Setup

Already in `docker-compose.dev.yml` from Phase 3.

**Start Redis**:
```bash
docker-compose -f docker-compose.dev.yml up -d redis
```

**Test connection**:
```bash
redis-cli -h localhost -p 6379 -a password
> ping
PONG
> set test "hello"
OK
> get test
"hello"
```

### 4. Cache Service Implementation

**Location**: `apps/api/src/services/cache.service.ts`

**Full implementation** (reference detailed plan section 5.2):

```typescript
import Redis from 'ioredis'

class CacheService {
  private client: Redis

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    })

    this.client.on('connect', () => {
      console.log('✅ Redis connected')
    })

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err)
    })
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key)
    return data ? JSON.parse(data) : null
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    if (ttl) {
      await this.client.setex(key, ttl, serialized)
    } else {
      await this.client.set(key, serialized)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key)
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds)
  }
}

export const cacheService = new CacheService()
```

### 5. RabbitMQ Setup & Queue Service

Already in `docker-compose.dev.yml` from Phase 3.

**Start RabbitMQ**:
```bash
docker-compose -f docker-compose.dev.yml up -d rabbitmq

# Open management UI
open http://localhost:15672
# Login: admin / password
```

**Queue Service** (`apps/api/src/services/queue.service.ts`):

```typescript
import amqp from 'amqplib'

class QueueService {
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null

  async connect() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!)
    this.channel = await this.connection.createChannel()
    await this.channel.assertQueue('video-transcode', { durable: true })
    console.log('✅ RabbitMQ connected')
  }

  async publishTranscodeJob(job: { videoId: string; inputKey: string }) {
    if (!this.channel) await this.connect()

    const message = JSON.stringify(job)
    this.channel!.sendToQueue('video-transcode', Buffer.from(message), {
      persistent: true
    })

    console.log(`📤 Queued transcode job for video ${job.videoId}`)
  }
}

export const queueService = new QueueService()
```

Initialize in API startup:
```typescript
// apps/api/src/index.ts
import { queueService } from './services/queue.service'

await queueService.connect()
```

### 6. Testing

**Test MinIO**:
```typescript
import { storageService } from './services/storage.service'

// Upload test
await storageService.uploadFile('./test.txt', 'test/test.txt')

// Get presigned URL
const url = await storageService.getPresignedDownloadUrl('test/test.txt')
console.log('Download URL:', url)

// Check exists
const exists = await storageService.fileExists('test/test.txt')
console.log('Exists:', exists)
```

**Test Redis**:
```typescript
import { cacheService } from './services/cache.service'

await cacheService.set('test-key', { hello: 'world' }, 60)
const value = await cacheService.get('test-key')
console.log('Cached value:', value)
```

**Test RabbitMQ**:
```typescript
import { queueService } from './services/queue.service'

await queueService.publishTranscodeJob({
  videoId: 'test-123',
  inputKey: 'uploads/test.mp4'
})

// Check queue in management UI
// Should see 1 message in 'video-transcode' queue
```

## Verification

- ✅ MinIO accessible on :9000 and :9001
- ✅ Can upload/download files
- ✅ Presigned URLs work
- ✅ Redis accessible on :6379
- ✅ Can set/get cache values
- ✅ RabbitMQ accessible on :5672 and :15672
- ✅ Can publish messages to queue
- ✅ All services auto-reconnect on failure

## Success Criteria

- ✅ All 3 services running in Docker
- ✅ Storage service works (upload/download/presigned URLs)
- ✅ Cache service works (set/get/delete)
- ✅ Queue service works (publish messages)
- ✅ No connection errors in logs
- ✅ Services handle disconnections gracefully

## Notes

- All services must be running for API and Worker to function
- Use Docker volumes for data persistence
- Monitor resource usage (especially MinIO with large files)
- Implement reconnection logic for production
- Consider connection pooling for high traffic
