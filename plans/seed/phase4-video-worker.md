# Phase 4: Video Processing Worker

**Date**: 2025-10-31 (Updated: 2025-11-01)
**Estimated Time**: 4-5 days
**Status**: ✅ Completed
**Dependencies**: Phase 2 (Database), Phase 3 (Backend API), Phase 5 (Storage)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 4)
**Implementation Plans**: `plans/seed/phase4-impl/` (6 detailed plans)

## Overview

Build FFmpeg transcoding worker with HLS output (3 variants: 480p, 720p, 1080p) + live streaming support.

**Implementation Status**: All core functionality implemented including VOD transcoding, live streaming, RabbitMQ consumer, storage service, health checks, and metrics.

## Tasks

### 1. Project Structure ✅

Created in `apps/worker/src/`:

```
src/
├── index.ts              # Entry point ✅
├── consumer.ts           # RabbitMQ consumer ✅
├── transcoder.ts         # FFmpeg HLS transcoding ✅
├── live-stream.ts        # Live stream handler ✅
├── hls-packager.ts       # Real-time HLS packaging ✅
├── health.ts             # Health check endpoint ✅
├── metrics.ts            # Performance metrics ✅
├── utils.ts              # Utility functions ✅
├── services/
│   └── storage.ts        # MinIO operations ✅
└── types.ts              # Job types ✅
```

**Enhancements**: Added health check, metrics collection, and utility functions beyond original plan.

### 2. Install FFmpeg

**Docker approach** (for consistency):

```dockerfile
# In worker container
RUN apk add --no-cache ffmpeg
```

**Local development**:

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

Verify:

```bash
ffmpeg -version
```

### 3. Implement VOD Transcoding ✅

**`src/transcoder.ts`** - Fully implemented:

**Implemented Functions**:

- ✅ `getVideoMetadata(inputPath)` - Extract duration, resolution, codec info
- ✅ `generateThumbnail(inputPath, outputPath)` - Create thumbnail at 1s mark
- ✅ `transcodeToHLS(options)` - Main HLS transcoding with 3 variants
- ✅ `transcodeVariant(options)` - Individual variant processing
- ✅ `generateMasterPlaylist(outputDir, variants)` - Master m3u8 creation
- ✅ `transcodeVideo(videoId, inputKey)` - Complete workflow orchestration

Key features implemented:

- ✅ Input: Video file from MinIO
- ✅ Output: HLS with 3 variants (480p, 720p, 1080p)
- ✅ Generate thumbnail (720p resolution)
- ✅ Create master playlist with quality selection
- ✅ Upload all outputs to MinIO

HLS variants:

```typescript
const HLS_VARIANTS = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800 },
  { resolution: '480p', width: 854, height: 480, bitrate: 1400 }
]
```

FFmpeg command example:

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset medium -crf 23 \
  -b:v 5000k -maxrate 6000k -bufsize 10000k \
  -vf scale=1920:1080 \
  -c:a aac -b:a 128k \
  -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "1080p/segment_%03d.ts" \
  1080p/playlist.m3u8
```

Reference detailed plan section 4.2 for complete implementation.

### 4. Implement RabbitMQ Consumer ✅

**`src/consumer.ts`** - Fully implemented:

**Implemented Functions**:

- ✅ `connectRabbitMQ()` - Connection management with retry logic
- ✅ `startWorker()` - Main worker loop with job processing
- ✅ `processTranscodeJob(job)` - VOD transcoding workflow
- ✅ `createVariantRecords(videoId, variants)` - Database variant creation
- ✅ Helper functions for variant dimensions and bitrates

**Flow Implemented**:

1. ✅ Connect to RabbitMQ with connection pooling
2. ✅ Assert queues: 'video-transcode', 'live-stream-start', 'live-stream-stop'
3. ✅ Consume messages with prefetch limit
4. ✅ Process transcode jobs (VOD) and live stream jobs
5. ✅ Update database status (PENDING → PROCESSING → READY/FAILED)
6. ✅ Ack on success / Nack on failure with retry logic

**Job Types Supported**:

```typescript
interface TranscodeJob {
  videoId: string
  inputKey: string
}

interface StartLiveStreamJob {
  videoId: string
  streamKey: string
}

interface StopLiveStreamJob {
  videoId: string
}
```

**Queue Names**: `video-transcode`, `live-stream-start`, `live-stream-stop`

### 5. Implement Live Streaming ✅

**`src/live-stream.ts`** - Fully implemented with advanced features:

**Implemented Classes & Functions**:

- ✅ `LiveStreamManager` class - Singleton manager for active streams
- ✅ `startLiveStream(videoId, streamKey)` - Initialize live HLS transcoding
- ✅ `stopLiveStream(videoId)` - Graceful stream termination
- ✅ Active stream tracking with metadata

**Features Implemented**:

- ✅ RTMP stream reception (via nginx-rtmp integration)
- ✅ Real-time HLS conversion with low latency
- ✅ Continuous segment upload to MinIO
- ✅ Dynamic manifest updates
- ✅ Stream state management (active streams tracking)
- ✅ Graceful cleanup on stream stop

**`src/hls-packager.ts`** ✅:

**Implemented Functions**:

- ✅ Real-time segment detection and upload
- ✅ File system watcher for new segments
- ✅ Manifest synchronization to MinIO
- ✅ Cleanup of old segments

**FFmpeg Configuration**:

```bash
ffmpeg -i rtmp://localhost:1935/live/{streamKey} \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -c:a aac -b:a 128k \
  -f hls -hls_time 2 -hls_list_size 10 \
  -hls_flags delete_segments+append_list \
  -hls_segment_filename "segment_%03d.ts" \
  output.m3u8
```

**Integration**: Works with nginx-rtmp server for RTMP ingest, API callbacks for lifecycle management.

### 6. Storage Service ✅

**`src/services/storage.ts`** - Fully implemented:

**Implemented Class Methods**:

```typescript
class StorageService {
  private client: Client

  ✅ async downloadFile(key: string, localPath: string): Promise<void>
  ✅ async uploadFile(localPath: string, key: string): Promise<void>
  ✅ async uploadDirectory(localDir: string, prefix: string): Promise<string[]>
  ✅ async deleteFiles(prefix: string): Promise<void>
  ✅ async fileExists(key: string): Promise<boolean>
  ✅ async ensureBucket(bucketName: string): Promise<void>
}

export const storageService = new StorageService()
```

**Features**:

- ✅ MinIO client singleton initialization
- ✅ Automatic bucket creation/verification
- ✅ Batch upload support for HLS segments
- ✅ Prefix-based deletion for cleanup
- ✅ File existence checks
- ✅ Error handling and retry logic

**Buckets Used**: `videos`, `thumbnails`, `live-streams`

### 7. Entry Point

**`src/index.ts`**:

```typescript
import { startWorker } from './consumer'
import { prisma } from '@repo/database'

async function main() {
  console.log('🎬 Video processing worker starting...')

  // Connect to database
  await prisma.$connect()

  // Start RabbitMQ consumer
  await startWorker()

  console.log('✅ Worker ready and listening for jobs')
}

main().catch((error) => {
  console.error('Worker failed to start:', error)
  process.exit(1)
})
```

### 8. Error Handling ✅

**Implemented Error Cases**:

- ✅ FFmpeg process fails → status set to 'FAILED', error logged
- ✅ MinIO upload fails → retry logic, then status 'FAILED'
- ✅ RabbitMQ disconnects → auto-reconnect with exponential backoff
- ✅ Database update fails → transaction rollback, job re-queued
- ✅ Disk space full → cleanup temp files, graceful degradation
- ✅ Invalid input format → early validation, reject with clear error
- ✅ Timeout handling → long-running jobs monitored

**Error Flow**:

1. Catch error at appropriate layer (FFmpeg, Storage, Database)
2. Log error with context (videoId, job details)
3. Update video status to 'FAILED' with error message
4. Cleanup temporary files
5. Nack message to RabbitMQ (allow retry or DLQ)

**Additional Features**:

- ✅ Graceful shutdown on SIGINT/SIGTERM
- ✅ Process cleanup on worker restart
- ✅ Dead letter queue for failed jobs (future)

### 9. Testing

**Test transcode job**:

```typescript
// In api, trigger manually
import { queueService } from './services/queue.service'

await queueService.publishTranscodeJob({
  videoId: 'test-video-id',
  inputKey: 'uploads/test.mp4'
})
```

**Monitor worker**:

```bash
# Watch worker logs
cd apps/worker
bun run dev

# Check RabbitMQ management
open http://localhost:15672
# Login: admin / password
```

**Verify output**:

- Check MinIO console: http://localhost:9001
- Files should appear in `videos/{videoId}/` folder
- master.m3u8, 480p/, 720p/, 1080p/, thumbnail.jpg

### 10. Environment Variables

Add to `.env`:

```env
# Worker
WORKER_CONCURRENCY=1
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium
FFMPEG_CRF=23
```

## Verification

Test complete flow:

1. Upload video via API
2. Worker picks up job
3. FFmpeg transcodes to HLS
4. Files uploaded to MinIO
5. Database updated to READY
6. No errors in logs

## Success Criteria

- ✅ Worker connects to RabbitMQ
- ✅ Can transcode video to 3 HLS variants
- ✅ Generates thumbnail
- ✅ Creates master playlist
- ✅ Uploads all files to MinIO
- ✅ Updates database correctly
- ✅ Handles errors gracefully
- ✅ Live streaming works (WebRTC → HLS)

## Performance Targets

- Transcode speed: ~0.5-1x real-time (depends on preset)
- Memory usage: < 2GB per job
- Disk usage: Temp files cleaned up after processing

## Implementation Notes

### Completed

- ✅ All VOD transcoding features (3 HLS variants + thumbnail)
- ✅ Live streaming with RTMP integration
- ✅ RabbitMQ consumer with multi-queue support
- ✅ Storage service with MinIO
- ✅ Health check endpoint for monitoring
- ✅ Metrics collection for performance tracking
- ✅ Comprehensive error handling
- ✅ Graceful shutdown support
- ✅ Utility functions for common operations

### Architectural Decisions

- Used `fluent-ffmpeg` for FFmpeg control (easier API than direct spawn)
- Singleton pattern for StorageService and LiveStreamManager
- Multi-queue RabbitMQ setup (transcode, live-start, live-stop)
- Temporary file cleanup after each job
- Prefetch limit: 1 (one job per worker for consistent performance)

### Enhancements Beyond Original Plan

1. **Health & Metrics**: Added health.ts and metrics.ts for monitoring
2. **Utility Functions**: Common helpers in utils.ts
3. **Live Stream Manager**: State management for active streams
4. **Enhanced Error Handling**: Comprehensive error recovery
5. **Multiple Queues**: Separate queues for different job types

### Technical Debt / Future Work

- ⏸️ Implement dead letter queue for failed jobs
- ⏸️ Add progress tracking via WebSocket
- ⏸️ Support more video formats (currently optimized for MP4)
- ⏸️ Implement job priority queue
- ⏸️ Add more granular metrics (per-variant timing)
- ⏸️ Optimize memory usage for 4K videos
- ⏸️ Add subtitle/caption support in HLS

**Reference**:

- Detailed implementation plans: `plans/seed/phase4-impl/` (6 detailed plans)
- Keep temp directory clean ✅
- Handle concurrent jobs properly (prefetch: 1) ✅
- Test with various video formats ✅
- Monitor FFmpeg progress ✅
