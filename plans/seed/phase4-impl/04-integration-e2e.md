# Phase 4D: Integration & End-to-End Testing

**Timeline**: Day 3-4
**Priority**: High (Validation)
**Estimated Time**: 4-6 hours
**Dependencies**: Phase 4A, 4B, 4C

## Overview

Integrate all components (storage, transcoder, consumer) and test complete video processing pipeline end-to-end. Ensure worker can process real jobs from upload to playback.

## Files to Update

- `apps/worker/src/index.ts` - Main entry point
- Test scripts and documentation

## Main Entry Point

### Update `src/index.ts`

```typescript
import { prisma } from '@repo/database'
import { startWorker } from './consumer'

async function main() {
  console.log('🎬 Video processing worker starting...')
  console.log('📦 Environment:', process.env.NODE_ENV || 'development')
  console.log('🌐 RabbitMQ:', process.env.RABBITMQ_URL)
  console.log('💾 Database:', process.env.DATABASE_URL?.split('@')[1])
  console.log('📦 MinIO:', `${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`)

  try {
    // Connect to database
    await prisma.$connect()
    console.log('✅ Database connected')

    // Start RabbitMQ consumer
    await startWorker()
    console.log('✅ Worker ready and listening for jobs')

    // Keep process alive
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Worker failed to start:', error)
    process.exit(1)
  }
}

// Graceful shutdown
let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

  try {
    // Close RabbitMQ connections
    // (Handled in consumer)

    // Disconnect database
    await prisma.$disconnect()
    console.log('✅ Database disconnected')

    console.log('✅ Worker shut down successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

main().catch(async (error) => {
  console.error('❌ Fatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
```

## End-to-End Test Flow

### Setup

```bash
# 1. Start all services
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps

# Should show:
# - postgres    (port 5445)
# - rabbitmq    (ports 5672, 15672)
# - minio       (ports 9000, 9001)
# - redis       (port 6379)

# 2. Check service health
curl http://localhost:9000/minio/health/live  # MinIO
curl http://localhost:15672/api/overview      # RabbitMQ
psql postgresql://postgres:password@localhost:5445/streaming_video -c "SELECT 1"  # PostgreSQL
```

### Test Video Upload

```bash
# Create test video (10 seconds, 1080p)
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -f lavfi -i sine=frequency=1000:duration=10 \
  -pix_fmt yuv420p -c:v libx264 -c:a aac \
  test-video.mp4

# Upload via API (requires Phase 3 backend)
# 1. Get presigned URL
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-video.mp4",
    "fileSize": 1000000,
    "contentType": "video/mp4"
  }'

# Response:
# {
#   "videoId": "cmhf...",
#   "uploadUrl": "http://localhost:9000/streaming-video/uploads/...",
#   "expiresIn": 3600
# }

# 2. Upload file to presigned URL
curl -X PUT "[PRESIGNED_URL]" \
  --upload-file test-video.mp4

# 3. Complete upload
curl -X POST http://localhost:3001/api/upload/[videoId]/complete

# This should trigger transcode job in queue
```

### Worker Processing

```bash
# Terminal 1: Start worker
cd apps/worker
bun run dev

# Expected output:
# 🎬 Video processing worker starting...
# ✅ Database connected
# ✅ Connected to RabbitMQ
# ✅ Worker ready and listening for jobs
# 🎧 Listening for transcode jobs...
# 📥 Received job: cmhf...
# ⬇️  Downloading: uploads/...
# 🎬 Transcoding: cmhf...
# ⬆️  Uploading outputs...
# 💾 Creating variant records...
# ✅ Video cmhf... ready!
# ✅ Completed job: cmhf...
```

### Verify Outputs

```bash
# 1. Check database
psql postgresql://postgres:password@localhost:5445/streaming_video \
  -c "SELECT id, title, status, hls_manifest_key FROM \"Video\" WHERE id = 'cmhf...';"

# Expected:
# status = 'READY'
# hls_manifest_key = 'videos/cmhf.../master.m3u8'

# 2. Check VideoVariant records
psql postgresql://postgres:password@localhost:5445/streaming_video \
  -c "SELECT resolution, bitrate, storage_key FROM \"VideoVariant\" WHERE video_id = 'cmhf...';"

# Expected: 3 rows (1080p, 720p, 480p)

# 3. Check MinIO
open http://localhost:9001
# Login: admin/password
# Navigate to bucket: streaming-video
# Check folder: videos/cmhf.../
# Should contain:
# - master.m3u8
# - thumbnail.jpg
# - 1080p/playlist.m3u8
# - 1080p/segment_*.ts
# - 720p/playlist.m3u8
# - 720p/segment_*.ts
# - 480p/playlist.m3u8
# - 480p/segment_*.ts
```

### Test Playback

```bash
# 1. Get video info via API
curl http://localhost:3001/api/videos/cmhf...

# 2. Get presigned URL for master playlist
curl http://localhost:3001/api/videos/cmhf.../play-url

# 3. Test in VLC or browser
vlc "http://localhost:9000/streaming-video/videos/cmhf.../master.m3u8"

# Or in browser with HLS.js
open http://localhost:3000/videos/cmhf...
```

## Test Scenarios

### 1. Happy Path

**Scenario**: Upload valid video, worker processes successfully

**Steps**:

1. Upload valid MP4 file
2. Worker processes job
3. All variants created
4. Database updated correctly
5. Files appear in MinIO
6. Video plays successfully

**Expected Result**: ✅ All steps complete without errors

### 2. Invalid Video File

**Scenario**: Upload corrupted/invalid file

**Steps**:

1. Upload invalid file (e.g., text file renamed to .mp4)
2. Worker attempts processing
3. FFmpeg fails on metadata extraction

**Expected Result**:

- Video status = FAILED
- Error logged
- Temp files cleaned up

### 3. Large Video File

**Scenario**: Upload 100MB+ video

**Steps**:

1. Create 5-minute 1080p video (~500MB)
2. Upload via presigned URL
3. Worker processes

**Expected Result**:

- Transcode takes longer
- Memory stays < 2GB
- All outputs created
- No timeout errors

### 4. Multiple Concurrent Jobs

**Scenario**: Queue 5 jobs simultaneously

**Steps**:

1. Upload 5 videos
2. All jobs queued in RabbitMQ
3. Worker processes one at a time (prefetch: 1)

**Expected Result**:

- Jobs processed sequentially
- Each job completes successfully
- No race conditions

### 5. Worker Restart During Job

**Scenario**: Worker crashes mid-processing

**Steps**:

1. Start processing job
2. Kill worker (Ctrl+C)
3. Restart worker

**Expected Result**:

- Job requeued by RabbitMQ
- Worker picks up job again
- Job completes successfully

### 6. Storage Failure

**Scenario**: MinIO unavailable

**Steps**:

1. Stop MinIO service
2. Attempt upload
3. Worker tries to download

**Expected Result**:

- Upload fails
- Worker logs error
- Video status = FAILED
- Job nack'd

## Performance Testing

### Metrics to Monitor

```typescript
// Add to worker
const metrics = {
  jobsProcessed: 0,
  jobsFailed: 0,
  averageProcessingTime: 0,
  peakMemoryUsage: 0,
  currentMemoryUsage: 0
}

// Log every 10 jobs
console.log('📊 Worker Stats:', metrics)
```

### Load Test

```bash
# Queue 10 jobs
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/upload/presign \
    -H "Content-Type: application/json" \
    -d "{\"fileName\": \"test-$i.mp4\", \"fileSize\": 1000000, \"contentType\": \"video/mp4\"}"
done

# Monitor worker
# - CPU usage
# - Memory usage
# - Processing time per job
# - Queue depth
```

### Expected Performance

| Metric           | Target    | Acceptable | Unacceptable |
| ---------------- | --------- | ---------- | ------------ |
| Transcode Speed  | 0.8-1.2x  | 0.5-1.5x   | < 0.5x       |
| Memory Usage     | < 1.5GB   | < 2GB      | > 2GB        |
| Queue Processing | 1 job/min | 1 job/2min | > 5min/job   |
| Error Rate       | 0%        | < 5%       | > 10%        |

## Integration Checklist

- [ ] Worker starts without errors
- [ ] Connects to all services (DB, RabbitMQ, MinIO)
- [ ] Processes test job successfully
- [ ] Creates all HLS variants
- [ ] Uploads outputs to MinIO
- [ ] Updates database correctly
- [ ] Handles errors gracefully
- [ ] Cleans up temp files
- [ ] Graceful shutdown works
- [ ] Can process multiple jobs
- [ ] Memory usage acceptable
- [ ] Processing speed acceptable
- [ ] Video playback works

## Troubleshooting

### Worker Won't Start

```bash
# Check environment variables
env | grep RABBITMQ_URL
env | grep DATABASE_URL
env | grep MINIO_ENDPOINT

# Check service connectivity
telnet localhost 5672  # RabbitMQ
telnet localhost 5445  # PostgreSQL
telnet localhost 9000  # MinIO
```

### Job Not Processing

```bash
# Check RabbitMQ queue
open http://localhost:15672
# Queue should have messages

# Check worker logs
cd apps/worker
bun run dev
# Look for errors

# Manually publish test job
# (Use RabbitMQ management UI)
```

### Transcode Fails

```bash
# Check FFmpeg installation
ffmpeg -version

# Check temp directory
ls -la /tmp/transcode-*

# Check logs
# Look for FFmpeg errors
```

## Success Criteria

- [x] Worker starts successfully
- [x] Processes real jobs end-to-end
- [x] All service connections work
- [x] Outputs valid HLS files
- [x] Database updated correctly
- [x] Error handling works
- [x] Memory usage acceptable
- [x] Processing speed acceptable
- [x] Video playback works

## Next Steps

Once integration is complete:

- ✅ Proceed to Phase 4E (Live Streaming)
- Or start Phase 3 (Backend API) if not done

## Notes

- Test with various video formats (MP4, AVI, MOV)
- Test with different resolutions (480p, 720p, 1080p, 4K)
- Monitor memory usage during testing
- Keep detailed logs for debugging
- Document any issues found
- Create regression tests
