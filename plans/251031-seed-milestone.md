# Detailed Tech Stack Implementation Plan

**Project**: Self-Hosted Video Streaming System
**Date**: 2025-10-31
**Status**: Planning Phase
**Base Architecture**: Turborepo monorepo + Hono API + Next.js Web

---

## Executive Summary

Build full-stack self-hosted streaming video platform (MVP) with:

- **Monorepo Structure**: Turborepo for workspace management
- **Backend**: Hono API for high-performance server
- **Frontend**: Next.js 14+ with React 19 for SSR/SSG
- **Video Processing**: FFmpeg transcoding pipeline with HLS output
- **Live Streaming**: WebRTC + MediaStream for real-time camera streaming
- **Storage**: MinIO S3-compatible object storage
- **Data**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis for caching, RabbitMQ for job queuing
- **Analytics**: Video view tracking (daily/monthly)
- **Deployment**: Docker + Docker Compose

**MVP Simplifications**:

- No authentication system (public access)
- No user accounts or sessions
- No watch progress tracking
- No rate limiting
- Focus on core video upload, transcoding, playback, and live streaming

---

## Phase 1: Foundation Setup

### 1.1 Monorepo Architecture

```
streaming-video/
├── apps/
│   ├── api/                    # Hono API service
│   ├── web/                    # Next.js web client
│   └── worker/                 # FFmpeg transcoding worker
├── packages/
│   ├── @repo/constants/         # Constants
│   ├── @repo/database/         # Prisma schema + client
│   ├── @repo/types/            # Shared TypeScript types
│   ├── @repo/utils/            # Shared utilities
│   ├── @repo/eslint-config/    # Linting
│   └── @repo/typescript-config/ # TS configs
├── docker/
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   └── worker.Dockerfile
├── docker-compose.yml
└── infrastructure/
    ├── postgres/
    ├── redis/
    ├── rabbitmq/
    └── minio/
```

**Implementation Steps**:

1. Create new packages: `@repo/constants`, `@repo/database`, `@repo/types`, `@repo/utils`
2. Create `apps/worker` for transcoding service
3. Set up Docker infrastructure directories
4. Update `turbo.json` with new workspace tasks

**Turbo Pipeline Config** (`turbo.json`):

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "db:migrate": {
      "cache": false
    },
    "db:generate": {
      "outputs": ["node_modules/.prisma/**"]
    }
  }
}
```

### 1.2 Package Manager & Dependencies

**Use Bun** (already in use based on `bun.lock`):

```bash
bun install
bun turbo dev --filter=api
bun turbo dev --filter=web
```

**Core Dependencies**:

`apps/api/package.json`:

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "ioredis": "^5.3.0",
    "amqplib": "^0.10.0",
    "zod": "^3.22.0",
    "minio": "^7.1.0"
  }
}
```

`apps/web/package.json`:

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "hls.js": "^1.5.0",
    "shaka-player": "^4.8.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

`apps/worker/package.json`:

```json
{
  "dependencies": {
    "amqplib": "^0.10.0",
    "fluent-ffmpeg": "^2.1.0",
    "@prisma/client": "^5.0.0",
    "minio": "^7.1.0"
  }
}
```

---

## Phase 2: Database Layer

### 2.1 PostgreSQL Setup

**Docker Compose Service**:

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: streaming_video
    POSTGRES_USER: admin
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  ports:
    - '5432:5432'
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U admin']
    interval: 10s
    timeout: 5s
    retries: 5
```

### 2.2 Prisma Schema

**Location**: `packages/@repo/database/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Video {
  id              String         @id @default(cuid())
  title           String
  description     String?
  thumbnailUrl    String?
  duration        Int?           // seconds
  status          VideoStatus    @default(PENDING)
  visibility      VideoVisibility @default(PUBLIC)
  videoType       VideoType      @default(VOD)  // VOD or LIVE

  // Original file info (for VOD)
  originalKey     String?        @unique
  originalSize    Int?
  originalFormat  String?

  // Processed variants
  hlsManifestKey  String?

  // Live streaming info
  streamKey       String?        @unique  // For RTMP ingest
  isLiveNow       Boolean        @default(false)

  // Analytics
  viewsToday      Int            @default(0)
  viewsMonth      Int            @default(0)
  viewsTotal      Int            @default(0)
  lastViewReset   DateTime?      // For resetting daily/monthly counts

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  variants        VideoVariant[]
  viewLogs        VideoViewLog[]

  @@index([status])
  @@index([visibility])
  @@index([videoType])
  @@index([isLiveNow])
}

enum VideoStatus {
  PENDING
  PROCESSING
  READY
  FAILED
  LIVE
}

enum VideoVisibility {
  PUBLIC
  UNLISTED
  PRIVATE
}

enum VideoType {
  VOD    // Video on Demand
  LIVE   // Live Stream
}

model VideoVariant {
  id          String   @id @default(cuid())
  videoId     String
  video       Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)

  resolution  String   // "1080p", "720p", "480p"
  bitrate     Int      // kbps
  codec       String   // "h264"
  format      String   // "hls"

  storageKey  String   // S3/MinIO key
  size        Int?     // bytes

  createdAt   DateTime @default(now())

  @@index([videoId])
}

model VideoViewLog {
  id        String   @id @default(cuid())
  videoId   String
  video     Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)

  viewedAt  DateTime @default(now())
  ipAddress String?  // Optional: for analytics
  userAgent String?  // Optional: for analytics

  @@index([videoId])
  @@index([viewedAt])
}
```

**Setup Commands**:

```bash
# Generate Prisma client
bun turbo db:generate

# Run migrations
bun turbo db:migrate

# Seed database (optional)
bun turbo db:seed
```

---

## Phase 3: Backend API (Hono)

### 3.1 Hono App Structure

**Location**: `apps/api/src/`

```
apps/api/src/
├── index.ts              # Entry point
├── app.ts                # Hono app setup
├── middlewares/
│   ├── cors.ts           # CORS config
│   └── error.ts          # Error handling
├── routes/
│   ├── videos.ts         # CRUD operations + view tracking
│   ├── upload.ts         # Upload handling
│   ├── live.ts           # Live streaming endpoints
│   └── analytics.ts      # View counts and stats
├── services/
│   ├── video.service.ts  # Video business logic
│   ├── storage.service.ts # MinIO interactions
│   ├── queue.service.ts  # RabbitMQ producer
│   ├── cache.service.ts  # Redis operations
│   ├── live.service.ts   # Live streaming logic
│   └── analytics.service.ts # View tracking
├── utils/
│   ├── validator.ts      # Zod schemas
│   └── helpers.ts        # Helper functions
└── types/
    └── index.ts          # Type definitions
```

### 3.2 Core API Implementation

**Entry Point** (`apps/api/src/index.ts`):

```typescript
import { serve } from '@hono/node-server'
import { app } from './app'

const port = parseInt(process.env.PORT || '3001', 10)

console.log(`Server running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
```

**Hono App** (`apps/api/src/app.ts`):

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { videoRoutes } from './routes/videos'
import { uploadRoutes } from './routes/upload'
import { liveRoutes } from './routes/live'
import { analyticsRoutes } from './routes/analytics'
import { errorHandler } from './middlewares/error'

const app = new Hono()

// Global middlewares
app.use('*', logger())
app.use('*', cors())

// Routes
app.route('/api/videos', videoRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/live', liveRoutes)
app.route('/api/analytics', analyticsRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Error handling
app.onError(errorHandler)

export { app }
```

### 3.3 Video Upload Flow (Simplified - No Auth)

**Upload Route** (`apps/api/src/routes/upload.ts`):

```typescript
import { Hono } from 'hono'
import { storageService } from '../services/storage.service'
import { queueService } from '../services/queue.service'
import { prisma } from '@repo/database'
import { z } from 'zod'

const uploadRoutes = new Hono()

const presignSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  contentType: z.string()
})

// Generate presigned URL for direct upload to MinIO
uploadRoutes.post('/presign', async (c) => {
  const body = await c.req.json()
  const { fileName, fileSize, contentType } = presignSchema.parse(body)

  // Create video record
  const video = await prisma.video.create({
    data: {
      title: fileName,
      originalKey: `uploads/${Date.now()}-${fileName}`,
      originalSize: fileSize,
      originalFormat: contentType,
      status: 'PENDING',
      videoType: 'VOD'
    }
  })

  // Generate presigned URL
  const presignedUrl = await storageService.getPresignedUploadUrl(video.originalKey!, contentType)

  return c.json({
    videoId: video.id,
    uploadUrl: presignedUrl,
    expiresIn: 3600
  })
})

// Callback after upload completes
uploadRoutes.post('/:videoId/complete', async (c) => {
  const videoId = c.req.param('videoId')

  const video = await prisma.video.findUnique({
    where: { id: videoId }
  })

  if (!video) {
    return c.json({ error: 'Video not found' }, 404)
  }

  // Verify file exists in storage
  const exists = await storageService.fileExists(video.originalKey!)

  if (!exists) {
    return c.json({ error: 'Upload incomplete' }, 400)
  }

  // Queue transcoding job
  await queueService.publishTranscodeJob({
    videoId: video.id,
    inputKey: video.originalKey!
  })

  // Update status
  await prisma.video.update({
    where: { id: videoId },
    data: { status: 'PROCESSING' }
  })

  return c.json({ message: 'Transcoding queued', videoId })
})

export { uploadRoutes }
```

### 3.4 Video View Tracking

**Analytics Route** (`apps/api/src/routes/analytics.ts`):

```typescript
import { Hono } from 'hono'
import { prisma } from '@repo/database'
import { analyticsService } from '../services/analytics.service'

const analyticsRoutes = new Hono()

// Track video view
analyticsRoutes.post('/view/:videoId', async (c) => {
  const videoId = c.req.param('videoId')
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  const userAgent = c.req.header('user-agent')

  await analyticsService.trackView(videoId, {
    ipAddress,
    userAgent
  })

  return c.json({ success: true })
})

// Get video stats
analyticsRoutes.get('/stats/:videoId', async (c) => {
  const videoId = c.req.param('videoId')

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      viewsToday: true,
      viewsMonth: true,
      viewsTotal: true
    }
  })

  if (!video) {
    return c.json({ error: 'Video not found' }, 404)
  }

  return c.json(video)
})

export { analyticsRoutes }
```

**Analytics Service** (`apps/api/src/services/analytics.service.ts`):

```typescript
import { prisma } from '@repo/database'

class AnalyticsService {
  async trackView(videoId: string, metadata?: { ipAddress?: string; userAgent?: string }) {
    // Create view log
    await prisma.videoViewLog.create({
      data: {
        videoId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      }
    })

    // Increment counters
    await prisma.video.update({
      where: { id: videoId },
      data: {
        viewsToday: { increment: 1 },
        viewsMonth: { increment: 1 },
        viewsTotal: { increment: 1 }
      }
    })
  }

  async resetDailyViews() {
    // Reset daily view counts for all videos
    await prisma.video.updateMany({
      data: {
        viewsToday: 0,
        lastViewReset: new Date()
      }
    })
  }

  async resetMonthlyViews() {
    // Reset monthly view counts for all videos
    await prisma.video.updateMany({
      data: {
        viewsMonth: 0,
        lastViewReset: new Date()
      }
    })
  }
}

export const analyticsService = new AnalyticsService()
```

---

## Phase 4: Video Processing Worker

### 4.1 Worker Architecture

**Location**: `apps/worker/src/`

```
apps/worker/src/
├── index.ts              # Entry point
├── consumer.ts           # RabbitMQ consumer
├── transcoder.ts         # FFmpeg wrapper
├── uploader.ts           # MinIO uploader
└── types.ts              # Job types
```

### 4.2 Transcoding Implementation

**FFmpeg Transcoder** (`apps/worker/src/transcoder.ts`):

```typescript
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'

interface TranscodeOptions {
  inputPath: string
  outputDir: string
  videoId: string
}

const HLS_VARIANTS = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800 },
  { resolution: '480p', width: 854, height: 480, bitrate: 1400 }
]

export async function transcodeToHLS(options: TranscodeOptions): Promise<void> {
  const { inputPath, outputDir, videoId } = options

  await fs.mkdir(outputDir, { recursive: true })

  // Extract video metadata
  const metadata = await getVideoMetadata(inputPath)

  // Generate thumbnail
  await generateThumbnail(inputPath, path.join(outputDir, 'thumbnail.jpg'))

  // Create HLS variants
  const variantPromises = HLS_VARIANTS.map(async (variant) => {
    if (metadata.height < variant.height) return null // Skip higher res

    const variantDir = path.join(outputDir, variant.resolution)
    await fs.mkdir(variantDir, { recursive: true })

    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          `-b:v ${variant.bitrate}k`,
          `-maxrate ${variant.bitrate * 1.2}k`,
          `-bufsize ${variant.bitrate * 2}k`,
          `-vf scale=${variant.width}:${variant.height}`,
          '-c:a aac',
          '-b:a 128k',
          '-hls_time 6',
          '-hls_playlist_type vod',
          '-hls_segment_filename',
          `${variantDir}/segment_%03d.ts`
        ])
        .output(`${variantDir}/playlist.m3u8`)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })
  })

  await Promise.all(variantPromises)

  // Generate master playlist
  await generateMasterPlaylist(outputDir, metadata)
}

async function getVideoMetadata(inputPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err)
      else resolve(metadata)
    })
  })
}

async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        count: 1,
        filename: 'thumbnail.jpg',
        folder: path.dirname(outputPath),
        size: '1280x720'
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
  })
}

async function generateMasterPlaylist(outputDir: string, metadata: any): Promise<void> {
  const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p/playlist.m3u8
`

  await fs.writeFile(path.join(outputDir, 'master.m3u8'), masterPlaylist)
}
```

**RabbitMQ Consumer** (`apps/worker/src/consumer.ts`):

```typescript
import amqp from 'amqplib'
import { transcodeToHLS } from './transcoder'
import { storageService } from './services/storage'
import { prisma } from '@repo/database'
import path from 'path'
import os from 'os'

const QUEUE_NAME = 'video-transcode'

export async function startWorker() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL!)
  const channel = await connection.createChannel()

  await channel.assertQueue(QUEUE_NAME, { durable: true })
  channel.prefetch(1) // Process one job at a time

  console.log('Worker started, waiting for jobs...')

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return

    const job = JSON.parse(msg.content.toString())
    console.log(`Processing video ${job.videoId}`)

    try {
      await processTranscodeJob(job)
      channel.ack(msg)
      console.log(`Completed video ${job.videoId}`)
    } catch (error) {
      console.error(`Failed video ${job.videoId}:`, error)

      // Update video status to FAILED
      await prisma.video.update({
        where: { id: job.videoId },
        data: { status: 'FAILED' }
      })

      channel.nack(msg, false, false) // Don't requeue
    }
  })
}

async function processTranscodeJob(job: any) {
  const { videoId, inputKey } = job

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `transcode-${videoId}`)
  const inputPath = path.join(tempDir, 'input')
  const outputDir = path.join(tempDir, 'output')

  try {
    // Download from MinIO
    await storageService.downloadFile(inputKey, inputPath)

    // Transcode
    await transcodeToHLS({ inputPath, outputDir, videoId })

    // Upload all output files to MinIO
    const uploadedFiles = await storageService.uploadDirectory(outputDir, `videos/${videoId}`)

    // Update database
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        hlsManifestKey: `videos/${videoId}/master.m3u8`,
        thumbnailUrl: uploadedFiles.find((f) => f.includes('thumbnail'))
      }
    })

    // Create variant records
    const variants = ['1080p', '720p', '480p']
    for (const resolution of variants) {
      const playlistFile = uploadedFiles.find((f) => f.includes(`${resolution}/playlist.m3u8`))
      if (playlistFile) {
        await prisma.videoVariant.create({
          data: {
            videoId,
            resolution,
            bitrate: getVariantBitrate(resolution),
            codec: 'h264',
            format: 'hls',
            storageKey: playlistFile
          }
        })
      }
    }
  } finally {
    // Cleanup temp files
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

function getVariantBitrate(resolution: string): number {
  const map: Record<string, number> = {
    '1080p': 5000,
    '720p': 2800,
    '480p': 1400
  }
  return map[resolution] || 1400
}
```

### 4.3 Live Streaming Architecture

**Overview**: Enable users to stream from their device camera to audiences in real-time.

**Architecture Components**:

```
Host Device (Camera) → WebRTC/Media Stream → API Server → HLS Segments → MinIO → Audience Players
```

**Worker Addition for Live Streaming** (`apps/worker/src/`):

```
apps/worker/src/
├── live-stream.ts        # Live stream handler
└── hls-packager.ts       # Real-time HLS packaging
```

**Note**: For MVP, we'll use WebRTC for browser-to-server streaming. RTMP ingest can be added later if needed.

#### 4.3.1 Live Streaming Flow

**Step 1: Host Initiates Live Stream**

**Live Route** (`apps/api/src/routes/live.ts`):

```typescript
import { Hono } from 'hono'
import { prisma } from '@repo/database'
import { liveService } from '../services/live.service'
import { nanoid } from 'nanoid'

const liveRoutes = new Hono()

// Create live stream
liveRoutes.post('/create', async (c) => {
  const { title, description } = await c.req.json()

  // Generate unique stream key
  const streamKey = nanoid(32)

  // Create video record for live stream
  const video = await prisma.video.create({
    data: {
      title,
      description,
      videoType: 'LIVE',
      status: 'PENDING',
      streamKey,
      isLiveNow: false,
      visibility: 'PUBLIC'
    }
  })

  return c.json({
    videoId: video.id,
    streamKey,
    // WebRTC signaling endpoint for browser streaming
    webrtcSignalUrl: `/api/live/${video.id}/signal`
  })
})

// Start streaming (mark as live)
liveRoutes.post('/:videoId/start', async (c) => {
  const videoId = c.req.param('videoId')

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: 'LIVE',
      isLiveNow: true
    }
  })

  return c.json({ success: true })
})

// Stop streaming
liveRoutes.post('/:videoId/stop', async (c) => {
  const videoId = c.req.param('videoId')

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: 'READY',
      isLiveNow: false
    }
  })

  // Optionally: Convert live stream to VOD
  await liveService.convertToVOD(videoId)

  return c.json({ success: true })
})

// WebRTC signaling for browser-based streaming
liveRoutes.post('/:videoId/signal', async (c) => {
  const videoId = c.req.param('videoId')
  const { type, sdp, candidate } = await c.req.json()

  // Handle WebRTC signaling (SDP offer/answer, ICE candidates)
  const response = await liveService.handleWebRTCSignal(videoId, {
    type,
    sdp,
    candidate
  })

  return c.json(response)
})

// Get live stream status
liveRoutes.get('/:videoId/status', async (c) => {
  const videoId = c.req.param('videoId')

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      isLiveNow: true,
      status: true,
      hlsManifestKey: true,
      viewsTotal: true
    }
  })

  return c.json(video)
})

export { liveRoutes }
```

**Live Service** (`apps/api/src/services/live.service.ts`):

```typescript
import { prisma } from '@repo/database'
import { spawn } from 'child_process'
import { storageService } from './storage.service'
import path from 'path'
import os from 'os'

class LiveService {
  private activeStreams = new Map<string, any>()

  // Handle WebRTC signaling for browser streaming
  async handleWebRTCSignal(videoId: string, signal: any) {
    // Implement WebRTC signaling logic
    // This would typically involve:
    // 1. Accepting WebRTC connection from browser
    // 2. Receiving media stream
    // 3. Piping to FFmpeg for HLS packaging

    // Simplified example - actual implementation needs WebRTC library
    if (signal.type === 'offer') {
      // Create answer
      return {
        type: 'answer',
        sdp: '...' // Generated SDP answer
      }
    }

    return { success: true }
  }

  // Start RTMP ingest and convert to HLS
  async startRTMPIngest(videoId: string, streamKey: string) {
    const outputDir = path.join(os.tmpdir(), `live-${videoId}`)
    const hlsPath = `live/${videoId}/index.m3u8`

    // FFmpeg command to receive RTMP and output HLS
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      `rtmp://localhost/live/${streamKey}`,
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '10',
      '-hls_flags',
      'delete_segments+append_list',
      '-hls_segment_filename',
      `${outputDir}/segment_%03d.ts`,
      `${outputDir}/index.m3u8`
    ])

    ffmpeg.on('error', (error) => {
      console.error(`FFmpeg error for ${videoId}:`, error)
    })

    // Upload HLS segments to MinIO in real-time
    // Watch outputDir and upload new segments as they're created
    this.watchAndUploadSegments(videoId, outputDir, hlsPath)

    this.activeStreams.set(videoId, { ffmpeg, outputDir })
  }

  private async watchAndUploadSegments(videoId: string, localDir: string, s3Prefix: string) {
    // Watch directory for new .ts and .m3u8 files
    // Upload them to MinIO immediately
    // This ensures low latency for live viewers

    const fs = require('fs')
    const watcher = fs.watch(localDir, async (eventType: string, filename: string) => {
      if (eventType === 'change' && (filename.endsWith('.ts') || filename.endsWith('.m3u8'))) {
        const localPath = path.join(localDir, filename)
        const s3Key = `${s3Prefix}/${filename}`

        await storageService.uploadFile(localPath, s3Key)
      }
    })
  }

  // Stop live stream
  async stopStream(videoId: string) {
    const stream = this.activeStreams.get(videoId)

    if (stream) {
      // Kill FFmpeg process
      stream.ffmpeg.kill('SIGTERM')

      // Cleanup temp directory
      const fs = require('fs')
      await fs.promises.rm(stream.outputDir, { recursive: true, force: true })

      this.activeStreams.delete(videoId)
    }
  }

  // Convert live stream to VOD (save recording)
  async convertToVOD(videoId: string) {
    // Concatenate all HLS segments into single MP4 file
    // Then run standard transcoding workflow

    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video || !video.hlsManifestKey) return

    // Queue transcoding job for the live recording
    // This converts the live HLS segments into proper VOD variants
  }
}

export const liveService = new LiveService()
```

#### 4.3.2 Complete Live Streaming Flow

**1. Host Creates Live Stream**:

```typescript
POST /api/live/create
Body: { title: "My Live Stream", description: "..." }
Response: {
  videoId: "xyz",
  streamKey: "abc123...",
  webrtcSignalUrl: "/api/live/xyz/signal"
}
```

**2. Host Starts Camera Stream (Browser)**:

```typescript
// Frontend code
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
})

// Create WebRTC connection
const pc = new RTCPeerConnection()
stream.getTracks().forEach((track) => pc.addTrack(track, stream))

// Exchange SDP offers/answers with server
const offer = await pc.createOffer()
await pc.setLocalDescription(offer)

const response = await fetch(`/api/live/${videoId}/signal`, {
  method: 'POST',
  body: JSON.stringify({ type: 'offer', sdp: offer.sdp })
})

const answer = await response.json()
await pc.setRemoteDescription(new RTCSessionDescription(answer))
```

**3. Server Receives Stream & Packages to HLS**:

- WebRTC connection receives media stream
- FFmpeg converts stream to HLS segments
- Segments uploaded to MinIO in real-time
- HLS manifest updated continuously

**4. Mark Stream as Live**:

```typescript
POST /api/live/:videoId/start
```

**5. Audiences Watch Live Stream**:

```typescript
GET /api/videos/:videoId
Returns: { isLiveNow: true, hlsManifestKey: "live/xyz/index.m3u8" }

// Frontend uses HLS.js to play live stream with low latency
```

**6. Host Stops Stream**:

```typescript
POST /api/live/:videoId/stop

// Server stops FFmpeg, saves recording, optionally converts to VOD
```

---

## Phase 5: Storage & Cache

### 5.1 MinIO Setup

**Docker Compose**:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
  ports:
    - '9000:9000' # API
    - '9001:9001' # Console
  volumes:
    - minio_data:/data
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
    interval: 30s
    timeout: 20s
    retries: 3
```

**Storage Service** (`apps/api/src/services/storage.service.ts`):

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
    // Recursively upload all files
    // Return array of uploaded keys
    // Implementation omitted for brevity
    return []
  }
}

export const storageService = new StorageService()
```

### 5.2 Redis Setup

**Docker Compose**:

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD}
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 5s
    retries: 5
```

**Cache Service** (`apps/api/src/services/cache.service.ts`):

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
}

export const cacheService = new CacheService()
```

### 5.3 RabbitMQ Setup

**Docker Compose**:

```yaml
rabbitmq:
  image: rabbitmq:3-management-alpine
  environment:
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
  ports:
    - '5672:5672' # AMQP
    - '15672:15672' # Management UI
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  healthcheck:
    test: ['CMD', 'rabbitmq-diagnostics', 'ping']
    interval: 30s
    timeout: 10s
    retries: 5
```

---

## Phase 6: Frontend (Next.js)

### 6.1 App Structure (MVP - No Auth)

**Location**: `apps/web/`

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx             # Home/Browse all videos
│   ├── videos/
│   │   ├── [id]/page.tsx    # Video player (VOD & Live)
│   │   └── upload/page.tsx  # Upload video
│   └── live/
│       ├── page.tsx         # Browse live streams
│       ├── create/page.tsx  # Create live stream
│       └── stream/[id]/page.tsx  # Host streaming page
├── components/
│   ├── video/
│   │   ├── VideoPlayer.tsx      # HLS player (VOD & Live)
│   │   ├── VideoCard.tsx
│   │   ├── VideoList.tsx
│   │   ├── UploadForm.tsx
│   │   └── VideoStats.tsx       # View counts display
│   ├── live/
│   │   ├── LiveStreamCard.tsx   # Live stream preview
│   │   ├── LiveIndicator.tsx    # "LIVE" badge
│   │   ├── CameraStream.tsx     # Camera capture component
│   │   └── StreamControls.tsx   # Start/stop controls
│   └── ui/              # Shadcn/UI components
├── lib/
│   ├── api.ts           # API client
│   ├── webrtc.ts        # WebRTC helper functions
│   └── analytics.ts     # View tracking
├── hooks/
│   ├── useVideoPlayer.ts
│   ├── useLiveStream.ts
│   └── useViewTracking.ts
└── styles/
    └── globals.css      # Tailwind
```

### 6.2 Video Player Component

**HLS Player with View Tracking** (`apps/web/components/video/VideoPlayer.tsx`):

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

interface VideoPlayerProps {
  videoId: string
  manifestUrl: string
  isLive?: boolean
}

export function VideoPlayer({ videoId, manifestUrl, isLive = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const viewTracked = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Configure HLS with low latency for live streams
    const hlsConfig = isLive
      ? {
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10
        }
      : {
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        }

    if (Hls.isSupported()) {
      const hls = new Hls(hlsConfig)

      hls.loadSource(manifestUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false)
        if (isLive) {
          video.play() // Auto-play for live streams
        }
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data)
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
          }
        }
      })

      hlsRef.current = hls

      return () => {
        hls.destroy()
      }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = manifestUrl
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false)
        if (isLive) {
          video.play()
        }
      })
    }
  }, [manifestUrl, isLive])

  // Track view once when playback starts
  useEffect(() => {
    const video = videoRef.current
    if (!video || viewTracked.current) return

    const handlePlay = async () => {
      if (viewTracked.current) return

      try {
        await fetch(`/api/analytics/view/${videoId}`, {
          method: 'POST'
        })
        viewTracked.current = true
      } catch (error) {
        console.error('Failed to track view:', error)
      }
    }

    video.addEventListener('play', handlePlay)

    return () => {
      video.removeEventListener('play', handlePlay)
    }
  }, [videoId])

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-white" />
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
      />
    </div>
  )
}
```

**Video Stats Component** (`apps/web/components/video/VideoStats.tsx`):

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'

interface VideoStatsProps {
  videoId: string
}

interface Stats {
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
}

export function VideoStats({ videoId }: VideoStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/analytics/stats/${videoId}`)
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)

    return () => clearInterval(interval)
  }, [videoId])

  if (!stats) return null

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <div className="flex items-center gap-1">
        <Eye size={16} />
        <span>{stats.viewsTotal.toLocaleString()} total views</span>
      </div>
      <div className="text-gray-400">
        {stats.viewsToday.toLocaleString()} today
      </div>
      <div className="text-gray-400">
        {stats.viewsMonth.toLocaleString()} this month
      </div>
    </div>
  )
}
```

### 6.3 Upload Flow

**Upload Form** (`apps/web/components/video/UploadForm.tsx`):

```typescript
'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api'

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)

    try {
      // 1. Get presigned URL
      const { videoId, uploadUrl } = await apiClient.post('/upload/presign', {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type
      })

      // 2. Upload directly to MinIO
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      // 3. Notify backend
      await apiClient.post(`/upload/${videoId}/complete`)

      alert('Upload successful! Video is being processed.')
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 border rounded-lg">
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        disabled={uploading}
      />

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload Video'}
      </button>

      {uploading && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

### 6.4 Live Streaming Components

**Camera Stream Component** (`apps/web/components/live/CameraStream.tsx`):

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'

interface CameraStreamProps {
  videoId: string
  onStreamReady?: (stream: MediaStream) => void
}

export function CameraStream({ videoId, onStreamReady }: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: true
        })

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }

        setStream(mediaStream)
        onStreamReady?.(mediaStream)
      } catch (err) {
        setError('Failed to access camera: ' + (err as Error).message)
      }
    }

    startCamera()

    return () => {
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [])

  if (error) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full mirror"
        autoPlay
        muted
        playsInline
      />
      <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full text-white text-sm font-bold flex items-center gap-2">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        LIVE
      </div>
    </div>
  )
}
```

**Stream Controls** (`apps/web/components/live/StreamControls.tsx`):

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Video, VideoOff, Mic, MicOff } from 'lucide-react'

interface StreamControlsProps {
  stream: MediaStream | null
  onStartStream: () => Promise<void>
  onStopStream: () => Promise<void>
}

export function StreamControls({ stream, onStartStream, onStopStream }: StreamControlsProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)

  const handleStart = async () => {
    await onStartStream()
    setIsStreaming(true)
  }

  const handleStop = async () => {
    await onStopStream()
    setIsStreaming(false)
  }

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setVideoEnabled(!videoEnabled)
    }
  }

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setAudioEnabled(!audioEnabled)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        onClick={toggleVideo}
        variant="outline"
        size="icon"
        disabled={!stream}
      >
        {videoEnabled ? <Video /> : <VideoOff />}
      </Button>

      <Button
        onClick={toggleAudio}
        variant="outline"
        size="icon"
        disabled={!stream}
      >
        {audioEnabled ? <Mic /> : <MicOff />}
      </Button>

      {!isStreaming ? (
        <Button onClick={handleStart} disabled={!stream} className="bg-red-600">
          Start Streaming
        </Button>
      ) : (
        <Button onClick={handleStop} variant="destructive">
          Stop Streaming
        </Button>
      )}
    </div>
  )
}
```

---

## Phase 7: Docker & Deployment

### 7.1 Complete Docker Compose

**docker-compose.yml**:

```yaml
version: '3.9'

services:
  # Database
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: streaming_video
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U admin']
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # Queue
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    ports:
      - '5672:5672'
      - '15672:15672'
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 30s
      timeout: 10s
      retries: 5

  # Storage
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - minio_data:/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 20s
      retries: 3

  # API
  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/streaming_video
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      MINIO_ENDPOINT: minio
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - '3001:3001'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy

  # Worker
  worker:
    build:
      context: .
      dockerfile: docker/worker.Dockerfile
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/streaming_video
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      MINIO_ENDPOINT: minio
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy
    deploy:
      replicas: 2 # Scale workers

  # Web
  web:
    build:
      context: .
      dockerfile: docker/web.Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    ports:
      - '3000:3000'
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:
```

### 7.2 Dockerfiles

**API Dockerfile** (`docker/api.Dockerfile`):

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun install -g turbo
RUN turbo build --filter=api

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
```

**Worker Dockerfile** (`docker/worker.Dockerfile`):

```dockerfile
FROM node:20-alpine AS base

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun install -g turbo
RUN turbo build --filter=worker

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg

COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

CMD ["node", "apps/worker/dist/index.js"]
```

---

## Phase 8: Development Workflow

### 8.1 Local Development

**Start all services**:

```bash
# Start infrastructure
docker-compose up -d postgres redis rabbitmq minio

# Run migrations
bun turbo db:migrate

# Start dev servers
bun turbo dev
```

**Individual services**:

```bash
# API only
bun turbo dev --filter=api

# Web only
bun turbo dev --filter=web

# Worker only
bun turbo dev --filter=worker
```

### 8.2 Environment Variables (MVP Simplified)

**.env.example**:

```env
# Database
DATABASE_URL=postgresql://admin:password@localhost:5432/streaming_video
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password

# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=password

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password

# API
PORT=3001

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001

# Live Streaming
RTMP_INGEST_URL=rtmp://localhost:1935
```

---

## Implementation Phases Summary (MVP)

### Phase 1: Foundation (Week 1)

- ✅ Monorepo structure
- ✅ Package setup
- ✅ Docker Compose infrastructure

### Phase 2: Database (Week 1)

- ✅ Simplified Prisma schema (no auth)
- ✅ Video view tracking models
- ✅ Live streaming fields
- ✅ Migrations

### Phase 3: Backend Core (Week 2)

- ✅ Hono API setup (no auth)
- ✅ Video CRUD endpoints
- ✅ Upload flow (presigned URLs)
- ✅ Analytics/view tracking API
- ✅ Live streaming endpoints

### Phase 4: Video Processing (Week 2-3)

- ✅ Worker setup
- ✅ FFmpeg integration
- ✅ HLS transcoding (VOD)
- ✅ Queue consumer
- ✅ Live stream HLS packaging
- ✅ WebRTC signaling for browser streaming

### Phase 5: Storage & Cache (Week 3)

- ✅ MinIO integration
- ✅ Presigned URLs
- ✅ Real-time segment upload
- ✅ Redis caching

### Phase 6: Frontend (Week 4)

- ✅ Next.js app (no auth pages)
- ✅ Video player (VOD + Live)
- ✅ Upload UI
- ✅ Live streaming UI
- ✅ Camera capture
- ✅ View count display
- ✅ Browse/Search

### Phase 7: Deployment (Week 5)

- ✅ Production builds
- ✅ Docker optimization
- ✅ Environment configs

### Phase 8: Testing & Polish (Week 5)

- ✅ Error handling
- ✅ Loading states
- ✅ Responsive design
- ✅ View tracking validation
- ✅ Live stream stability

---

## Unresolved Questions (MVP Scope)

### Resolved for MVP

- ~~**Live Streaming**~~: ✅ Included with WebRTC + RTMP options
- ~~**Analytics**~~: ✅ Basic view tracking (daily/monthly/total)

### Future Considerations

1. **CDN**: Use NGINX caching layer or external CDN (Cloudflare)?
2. **Authentication**: Add user accounts for v2? (Currently public MVP)
3. **Subtitles/Captions**: Support VTT files in HLS streams?
4. **DRM**: Content protection for premium content?
5. **Admin Dashboard**: Moderation UI?
6. **Advanced Analytics**: Watch time, completion rate, engagement metrics?
7. **Recommendations**: Video recommendation algorithm?
8. **Social Features**: Comments, likes, sharing?
9. **Search**: Full-text search with PostgreSQL FTS or Elasticsearch?
10. **Notifications**: Real-time upload/stream completion alerts?
11. **Mobile Apps**: Native iOS/Android or PWA?
12. **Backup Strategy**: Automated backups for database and MinIO?
13. **Video Editing**: Basic trim/crop tools before upload?
14. **Scheduled Streams**: Pre-schedule live streams?
15. **Multi-camera Streams**: Support multiple video sources?
