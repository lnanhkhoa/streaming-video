# Phase 4C: RabbitMQ Consumer

**Timeline**: Day 3
**Priority**: High (Core job processing)
**Estimated Time**: 6-8 hours
**Dependencies**: Phase 4A (Storage), Phase 4B (Transcoder)

## Overview

Implement RabbitMQ consumer to process video transcode jobs from queue. Worker listens to job queue, downloads videos, transcodes them, uploads outputs, and updates database.

## File

`apps/worker/src/consumer.ts`

## Dependencies

**Services**:

- RabbitMQ running on `localhost:5672` or `localhost:5672`
- PostgreSQL (for database updates)
- MinIO (for file operations)

**Environment Variables**:

```env
RABBITMQ_URL=amqp://admin:password@localhost:5672
DATABASE_URL=postgresql://postgres:password@localhost:5445/streaming_video
```

**NPM Packages** (already installed):

- `amqplib@^0.10.5`
- `@repo/database` (Prisma client)

## Queue Configuration

**Queue Name**: `video-transcode`
**Queue Options**:

- Durable: `true` (survive broker restart)
- Prefetch: `1` (process one job at a time)
- Auto-ack: `false` (manual acknowledgment)

## Job Message Format

```typescript
interface TranscodeJob {
  videoId: string // Video ID from database
  inputKey: string // MinIO key for uploaded video
}
```

**Example**:

```json
{
  "videoId": "cmhf4lv7p0000ow861yu438k7",
  "inputKey": "uploads/1698765432-video.mp4"
}
```

## Implementation Tasks

### 1. RabbitMQ Connection

**Function**: `connectRabbitMQ()`

```typescript
interface RabbitMQConnection {
  connection: amqp.Connection
  channel: amqp.Channel
}

async function connectRabbitMQ(): Promise<RabbitMQConnection> {
  // Connect to RabbitMQ
  // Create channel
  // Assert queue exists
  // Set prefetch
  // Return connection & channel
}
```

**Tasks**:

- [ ] Connect to RabbitMQ server
- [ ] Create durable channel
- [ ] Assert `video-transcode` queue
- [ ] Set prefetch count to 1
- [ ] Handle connection errors
- [ ] Implement reconnection logic

### 2. Job Consumer

**Function**: `startWorker()`

```typescript
export async function startWorker(): Promise<void> {
  const { connection, channel } = await connectRabbitMQ()

  console.log('✅ Connected to RabbitMQ')
  console.log('🎧 Listening for transcode jobs...')

  channel.consume('video-transcode', async (msg) => {
    if (!msg) return

    try {
      const job: TranscodeJob = JSON.parse(msg.content.toString())
      console.log(`📥 Received job: ${job.videoId}`)

      await processTranscodeJob(job)

      channel.ack(msg)
      console.log(`✅ Completed job: ${job.videoId}`)
    } catch (error) {
      console.error(`❌ Job failed: ${error}`)

      // Update video status to FAILED
      await updateVideoStatus(job.videoId, 'FAILED')

      channel.nack(msg, false, false) // Don't requeue
    }
  })

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await channel.close()
    await connection.close()
  })
}
```

**Tasks**:

- [ ] Listen to queue messages
- [ ] Parse job JSON
- [ ] Process job (call processTranscodeJob)
- [ ] Ack on success
- [ ] Nack on failure (don't requeue)
- [ ] Handle channel errors

### 3. Job Processing Pipeline

**Function**: `processTranscodeJob(job: TranscodeJob)`

**Pipeline Steps**:

1. Update video status to `PROCESSING`
2. Download video from MinIO
3. Transcode video to HLS
4. Upload outputs to MinIO
5. Create VideoVariant database records
6. Update video status to `READY`
7. Cleanup temp files

```typescript
async function processTranscodeJob(job: TranscodeJob): Promise<void> {
  const { videoId, inputKey } = job
  const tempDir = path.join(os.tmpdir(), `transcode-${videoId}`)
  const inputPath = path.join(tempDir, 'input')
  const outputDir = path.join(tempDir, 'output')

  try {
    // 1. Update status to PROCESSING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'PROCESSING' }
    })

    // 2. Create temp directories
    await fs.mkdir(tempDir, { recursive: true })
    await fs.mkdir(outputDir, { recursive: true })

    // 3. Download from MinIO
    console.log(`⬇️  Downloading: ${inputKey}`)
    await storageService.downloadFile(inputKey, inputPath)

    // 4. Transcode
    console.log(`🎬 Transcoding: ${videoId}`)
    await transcodeVideo(inputPath, outputDir, videoId)

    // 5. Upload outputs to MinIO
    console.log(`⬆️  Uploading outputs...`)
    const uploadedFiles = await storageService.uploadDirectory(outputDir, `videos/${videoId}`)

    // 6. Create VideoVariant records
    console.log(`💾 Creating variant records...`)
    await createVariantRecords(videoId, uploadedFiles)

    // 7. Update video to READY
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        hlsManifestKey: `videos/${videoId}/master.m3u8`,
        thumbnailUrl: uploadedFiles.find((f) => f.includes('thumbnail'))
      }
    })

    console.log(`✅ Video ${videoId} ready!`)
  } catch (error) {
    console.error(`❌ Transcode failed: ${error}`)

    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'FAILED' }
    })

    throw error
  } finally {
    // Cleanup temp files
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}
```

**Tasks**:

- [ ] Create temp directory structure
- [ ] Download video from MinIO
- [ ] Call transcoder
- [ ] Upload all outputs (variants, thumbnails, playlists)
- [ ] Create VideoVariant DB records
- [ ] Update Video status
- [ ] Always cleanup temp files

### 4. Variant Record Creation

**Function**: `createVariantRecords(videoId: string, uploadedFiles: string[])`

```typescript
async function createVariantRecords(videoId: string, uploadedFiles: string[]): Promise<void> {
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
}

function getVariantBitrate(resolution: string): number {
  const bitrateMap: Record<string, number> = {
    '1080p': 5000,
    '720p': 2800,
    '480p': 1400
  }
  return bitrateMap[resolution] || 1400
}
```

**Tasks**:

- [ ] Parse uploaded files
- [ ] Find playlist for each variant
- [ ] Create VideoVariant record
- [ ] Handle missing variants gracefully

## Error Handling

### Error Scenarios

1. **RabbitMQ Connection Lost**:
   - Implement reconnection logic
   - Retry 5x with exponential backoff
   - Log connection errors
   - Alert on persistent failures

2. **Download Failed**:
   - Retry 3x
   - Update status to FAILED
   - Clean up partial downloads

3. **Transcode Failed**:
   - Capture FFmpeg error
   - Update status to FAILED
   - Save error message to DB

4. **Upload Failed**:
   - Retry each file 3x
   - If all fail, mark as FAILED
   - Clean up partial uploads

5. **Database Update Failed**:
   - Log error details
   - Don't ack message
   - Let RabbitMQ requeue

### Retry Strategy

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}
```

## Code Structure

```typescript
import amqp from 'amqplib'
import { prisma } from '@repo/database'
import { storageService } from './services/storage'
import { transcodeVideo } from './transcoder'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'

interface TranscodeJob {
  videoId: string
  inputKey: string
}

interface RabbitMQConnection {
  connection: amqp.Connection
  channel: amqp.Channel
}

const QUEUE_NAME = 'video-transcode'

async function connectRabbitMQ(): Promise<RabbitMQConnection>
async function processTranscodeJob(job: TranscodeJob): Promise<void>
async function createVariantRecords(videoId: string, uploadedFiles: string[]): Promise<void>

export async function startWorker(): Promise<void>
```

## Testing

### Unit Tests

```typescript
describe('Consumer', () => {
  it('connects to RabbitMQ', async () => {
    const { connection, channel } = await connectRabbitMQ()
    expect(connection).toBeDefined()
    expect(channel).toBeDefined()
    await channel.close()
    await connection.close()
  })

  it('processes transcode job', async () => {
    const job: TranscodeJob = {
      videoId: 'test-video-id',
      inputKey: 'test/video.mp4'
    }

    await processTranscodeJob(job)

    const video = await prisma.video.findUnique({
      where: { id: job.videoId },
      include: { variants: true }
    })

    expect(video?.status).toBe('READY')
    expect(video?.variants.length).toBeGreaterThan(0)
  })
})
```

### Integration Testing

```bash
# Terminal 1: Start RabbitMQ
docker-compose -f docker-compose.dev.yml up -d rabbitmq

# Terminal 2: Start worker
cd apps/worker
bun run dev
# Should log: ✅ Connected to RabbitMQ
#             🎧 Listening for transcode jobs...

# Terminal 3: Publish test job (via API or CLI)
# Upload video via API endpoint
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.mp4", "fileSize": 1000000, "contentType": "video/mp4"}'

# Worker should process automatically
```

### Monitor RabbitMQ

```bash
# Open management UI
open http://localhost:15672
# Login: admin/password

# Check queue status
# - Queue: video-transcode
# - Messages ready: 0
# - Consumers: 1
```

## Success Criteria

- [x] Connects to RabbitMQ successfully
- [x] Queue 'video-transcode' exists and is durable
- [x] Consumer picks up jobs
- [x] Downloads video from MinIO
- [x] Transcodes video successfully
- [x] Uploads outputs to MinIO
- [x] Creates VideoVariant records
- [x] Updates video status correctly
- [x] Handles errors gracefully
- [x] Cleans up temp files
- [x] No memory leaks

## Verification Checklist

```bash
# 1. RabbitMQ is running
curl http://localhost:15672/api/overview
# Should return JSON with broker info

# 2. Worker connects
cd apps/worker
bun run dev
# Should log: ✅ Connected to RabbitMQ

# 3. Test end-to-end flow
# Upload video via API
# Worker should process
# Check database for READY status
# Check MinIO for outputs
```

## Performance Considerations

- **Prefetch Count**: Set to 1 to process one job at a time
- **Concurrent Workers**: Deploy multiple workers for parallel processing
- **Memory**: Monitor worker memory usage (< 2GB per job)
- **Timeout**: Set job timeout (30 min for long videos)
- **Dead Letter Queue**: Configure DLQ for failed jobs

## Next Steps

Once consumer is complete:

- ✅ Proceed to Phase 4D (Integration & E2E Testing)
- Worker should process real jobs end-to-end

## Notes

- Use manual acknowledgment (auto-ack: false)
- Don't requeue failed jobs (nack without requeue)
- Log all job events for monitoring
- Consider adding job progress updates
- Implement graceful shutdown handling
- Test with various video sizes and formats
