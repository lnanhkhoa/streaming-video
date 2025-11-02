# Video Processing Worker

Video transcoding worker for the streaming video platform. Handles VOD transcoding, live streaming, and storage operations.

## Features

### Phase 4A: Storage Service ✅

MinIO-backed storage service for uploading/downloading video files.

- **Bucket**: `streaming-video`
- **Methods**:
  - `downloadFile(key, localPath)` - Download from MinIO to local filesystem
  - `uploadFile(localPath, key)` - Upload from local filesystem to MinIO
  - `uploadDirectory(localDir, prefix)` - Recursive directory upload
  - `fileExists(key)` - Check if object exists
  - `deleteFiles(prefix)` - Batch delete by prefix
- **Features**:
  - Automatic retry (3x) with exponential backoff
  - Configurable timeouts (30s upload, 60s download)
  - Content-type detection
  - Comprehensive logging

### Phase 4B: FFmpeg Transcoder - VOD ✅

Converts uploaded videos to HLS format with multiple quality variants.

- **Variants**: 1080p, 720p, 480p (adaptive based on source resolution)
- **Output**: HLS playlists + segments + thumbnail + master playlist
- **Features**:
  - Metadata extraction (duration, resolution, codecs)
  - Thumbnail generation (1280x720 JPEG at 1s or 10% duration)
  - Adaptive bitrate streaming
  - Sequential transcoding to avoid resource exhaustion
  - Automatic cleanup on failure
  - Progress monitoring

### Phase 4C: RabbitMQ Consumer ✅

Processes video transcode jobs from queue with full pipeline integration.

- **Queue**: `video-transcode` (durable, prefetch=1)
- **Pipeline**:
  1. Update video status to PROCESSING
  2. Download video from MinIO
  3. Transcode to HLS variants
  4. Upload outputs to MinIO
  5. Create VideoVariant database records
  6. Update video status to READY
  7. Cleanup temp files
- **Features**:
  - Auto-reconnect with exponential backoff (5 retries)
  - Manual acknowledgment (no auto-ack)
  - Failed jobs not requeued
  - Graceful shutdown handling
  - Comprehensive error handling and logging

### Phase 4F: Performance & Optimization ✅

Production-ready performance enhancements and monitoring.

- **Metrics Collection**:
  - Jobs processed/failed tracking
  - Success rate calculation
  - Average processing time
  - Peak memory usage monitoring
  - Active job tracking
- **Health Monitoring**:
  - HTTP health check endpoint (`:3002/health`)
  - Metrics endpoint (`:3002/metrics`)
  - Memory usage alerts (>1.5GB warning)
  - Uptime tracking
- **Reliability**:
  - Retry logic with exponential backoff (3 retries)
  - Disk space validation before processing
  - Automatic temp file cleanup
  - Error recovery and logging
- **Optimizations**:
  - Sequential job processing (prefetch=1)
  - Memory monitoring every 60s
  - Stats logging every 10 jobs
  - Conservative disk space estimation (3x input size)

## Environment Variables

```env
# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5445/streaming_video

# MinIO Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password

# Worker Configuration
WORKER_TEMP_DIR=./tmp/transcode
FFMPEG_PRESET=medium        # veryfast|faster|fast|medium|slow
FFMPEG_CRF=23               # Quality: 18-28 (lower = better)
HEALTH_PORT=3002            # Health check HTTP server port
```

## Prerequisites

### FFmpeg Installation

**macOS**:

```bash
brew install ffmpeg
```

**Ubuntu/Debian**:

```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Verify**:

```bash
ffmpeg -version
# Should show version 6.x or higher with libx264, aac support
```

### Services

**Start all required services**:

```bash
# Start all services (PostgreSQL, Redis, RabbitMQ, MinIO)
docker-compose -f docker-compose.dev.yml up -d

# Or start individually
docker-compose -f docker-compose.dev.yml up -d postgres
docker-compose -f docker-compose.dev.yml up -d rabbitmq
docker-compose -f docker-compose.dev.yml up -d minio
```

**Verify services**:

```bash
# PostgreSQL
psql postgresql://postgres:password@localhost:5445/streaming_video -c "SELECT 1"

# RabbitMQ
curl http://localhost:15672/api/overview
# Management UI: http://localhost:15672 (admin/password)

# MinIO
curl http://localhost:9000/minio/health/live
# Console: http://localhost:9001 (admin/password)
```

## Usage

### Development

```bash
# Start worker
bun run dev:worker

# Expected output:
# 🎬 Video processing worker starting...
# 📦 Environment: development
# 🌐 RabbitMQ: amqp://admin:password@localhost:5672
# 💾 Database: localhost:5445/streaming_video
# 📦 MinIO: localhost:9000
#
# ✅ Database connected
# ✅ MinIO connected
# 🔌 Connecting to RabbitMQ...
# ✅ Connected to RabbitMQ
# 📋 Queue: video-transcode (durable, prefetch=1)
# 🎧 Listening for transcode jobs...
```

### Testing

#### Test Storage Service

```bash
cd apps/worker
bun run test:storage
```

Tests:

- Upload file to MinIO
- Check file existence
- Download file from MinIO
- Upload directory recursively
- Delete files by prefix

#### Test Transcoder

```bash
cd apps/worker
bun run test:transcode
```

Tests:

- Generate 10s test video (1080p)
- Extract metadata
- Transcode to HLS variants
- Generate thumbnail
- Create master playlist
- Verify all outputs

Output directory: `/tmp/transcode-test/`

```
/tmp/transcode-test/
├── master.m3u8
├── thumbnail.jpg
├── 1080p/
│   ├── playlist.m3u8
│   └── segment_*.ts
├── 720p/
│   ├── playlist.m3u8
│   └── segment_*.ts
└── 480p/
    ├── playlist.m3u8
    └── segment_*.ts
```

### Test Playback

```bash
# macOS (Safari/QuickTime)
open /tmp/transcode-test/master.m3u8

# VLC
vlc /tmp/transcode-test/master.m3u8
```

## Architecture

```
┌─────────────┐
│   RabbitMQ  │ (Phase 4C - TODO)
│   Consumer  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Transcoder │
│   Service   │
└──────┬──────┘
       │
       ├─────────────┐
       ▼             ▼
┌──────────┐   ┌──────────┐
│ Storage  │   │  FFmpeg  │
│ Service  │   │  Wrapper │
└────┬─────┘   └──────────┘
     │
     ▼
┌──────────┐
│  MinIO   │
│  Bucket  │
└──────────┘
```

## Performance

**Test video**: 10s, 1080p @ 30fps

| Preset   | Speed    | Quality   | File Size |
| -------- | -------- | --------- | --------- |
| veryfast | 2-3x     | Good      | 15MB      |
| faster   | 1.5-2x   | Better    | 12MB      |
| medium   | 0.8-1x   | Best      | 10MB      |
| slow     | 0.3-0.5x | Excellent | 8MB       |

**Recommended**: `medium` for balanced quality/speed

#### Test End-to-End Pipeline

Automated E2E test that simulates the complete workflow:

```bash
cd apps/worker
bun run test:e2e
```

This test:

1. Generates a 10s 1080p test video
2. Creates a video record in database
3. Uploads to MinIO
4. Processes the video (download → transcode → upload)
5. Verifies database updates (status, variants, manifest keys)
6. Verifies MinIO outputs (playlists, segments, thumbnail)
7. Tests playback readiness
8. Cleans up all test data

**Expected output**:

```
🎬 End-to-End Integration Test

✅ Database connected

▶️  1. Generate test video
✅ 1. Generate test video (2500ms)

▶️  2. Create video record
✅ 2. Create video record (45ms)

▶️  3. Upload to MinIO
✅ 3. Upload to MinIO (120ms)

▶️  4. Process video (download → transcode → upload)
✅ 4. Process video (download → transcode → upload) (15000ms)

▶️  5. Verify database updates
✅ 5. Verify database updates (35ms)

▶️  6. Verify MinIO outputs
✅ 6. Verify MinIO outputs (180ms)

▶️  7. Test playback readiness
✅ 7. Test playback readiness (25ms)

✅ All tests passed!
```

### Manual End-to-End Testing

Test the complete pipeline from upload to playback:

```bash
# Terminal 1: Start all services
docker-compose -f docker-compose.dev.yml up -d

# Terminal 2: Start API
cd apps/api
bun run dev

# Terminal 3: Start worker
cd apps/worker
bun run dev

# Terminal 4: Upload a video via API
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.mp4", "fileSize": 10000000, "contentType": "video/mp4"}'

# Use the presigned URL to upload your video
# Worker will automatically process the job

# Check video status
curl http://localhost:3001/api/videos/{videoId}
# Status should change: PENDING → PROCESSING → READY
```

**Monitor job processing**:

- Worker logs show real-time progress
- RabbitMQ UI: http://localhost:15672 (check queue depth)
- MinIO UI: http://localhost:9001 (check uploaded files)
- Health endpoint: http://localhost:3002/health
- Metrics endpoint: http://localhost:3002/metrics

## Monitoring & Health Checks

### Health Endpoint

Check worker health status:

```bash
curl http://localhost:3002/health
```

**Response**:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "memory": {
    "rss": "512MB",
    "heap": "256MB",
    "external": "32MB"
  },
  "metrics": {
    "uptime": 3600,
    "jobsProcessed": 42,
    "jobsFailed": 2,
    "totalJobs": 44,
    "successRate": "95.5%",
    "averageProcessingTime": "15.3s",
    "peakMemoryUsage": "1024MB",
    "activeJobs": 1
  }
}
```

### Metrics Endpoint

Get detailed metrics:

```bash
curl http://localhost:3002/metrics
```

**Response**:

```json
{
  "uptime": 3600,
  "jobsProcessed": 42,
  "jobsFailed": 2,
  "totalJobs": 44,
  "successRate": "95.5%",
  "averageProcessingTime": "15.3s",
  "peakMemoryUsage": "1024MB",
  "activeJobs": 1
}
```

### Worker Logs

The worker logs detailed information for each job:

```
🎬 Processing job: abc123
   Input: uploads/abc123/input.mp4
   📝 Status: PROCESSING
   ⬇️  Downloading from MinIO...
   💾 Input size: 45.23 MB
   ✅ Disk space check passed: 250.00GB available (need 0.13GB)
   📊 Duration: 120.5s, 1920x1080
   🎥 Transcoding to HLS...
   ⬆️  Uploading outputs to MinIO...
   ✅ Uploaded 156 files
   💾 Creating variant records...
   ✅ Created 1080p variant record
   ✅ Created 720p variant record
   ✅ Created 480p variant record
   ✅ Video abc123 is READY!
   🧹 Cleaned up temp files
✅ Job abc123 completed in 18.5s

📊 Worker Stats: {
  uptime: 3600,
  jobsProcessed: 10,
  jobsFailed: 0,
  totalJobs: 10,
  successRate: '100.0%',
  averageProcessingTime: '16.2s',
  peakMemoryUsage: '892MB',
  activeJobs: 0
}
```

## Next Steps

- **Phase 4D**: Integration E2E - Automated end-to-end testing
- **Phase 4E**: Live Streaming - Real-time HLS streaming
- **Phase 5**: Performance optimization and monitoring

## Troubleshooting

### MinIO Connection Failed

```bash
# Check MinIO is running
docker ps | grep minio

# Check MinIO health
curl http://localhost:9000/minio/health/live

# Restart MinIO
docker-compose -f docker-compose.dev.yml restart minio
```

### RabbitMQ Connection Failed

```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Check RabbitMQ health
curl http://localhost:15672/api/overview

# Restart RabbitMQ
docker-compose -f docker-compose.dev.yml restart rabbitmq

# Check logs
docker-compose -f docker-compose.dev.yml logs rabbitmq
```

### FFmpeg Not Found

```bash
# Check FFmpeg installation
which ffmpeg
ffmpeg -version

# Install if missing (macOS)
brew install ffmpeg
```

### Transcoding Fails

- Check input file is valid: `ffprobe input.mp4`
- Check disk space: `df -h /tmp`
- Check FFmpeg logs in console output
- Verify FFmpeg preset is valid: `veryfast|faster|fast|medium|slow`

### Job Stuck in Queue

```bash
# Check RabbitMQ queue status
curl http://localhost:15672/api/queues/%2F/video-transcode \
  -u admin:password

# Check worker is running and connected
# Worker logs should show: "🎧 Listening for transcode jobs..."

# Manually purge queue (if needed)
curl -X DELETE http://localhost:15672/api/queues/%2F/video-transcode/contents \
  -u admin:password
```

## License

Private - Internal use only
