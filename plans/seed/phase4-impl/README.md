# Phase 4 Implementation - Video Worker

## Overview

Detailed implementation plans for Phase 4: Video Processing Worker. Each feature is broken down into actionable tasks with code examples, testing strategies, and success criteria.

## Structure

```
phase4-impl/
├── README.md                          ← You are here
├── phase4-detailed-implementation.md  ← Master plan (overview)
├── 01-storage-service.md             ← MinIO client (Day 1)
├── 02-ffmpeg-transcoder-vod.md       ← Video transcoding (Day 2)
├── 03-rabbitmq-consumer.md           ← Job processing (Day 3)
├── 04-integration-e2e.md             ← Testing & validation (Day 3-4)
├── 05-live-streaming.md              ← Live streaming (Day 4-5)
└── 06-performance-optimization.md    ← Optimization (Day 5)
```

## Implementation Order

### Day 1: Storage Service

**File**: `01-storage-service.md`

- Implement MinIO client
- Upload/download operations
- Test connectivity
- **Deliverable**: Working storage service

### Day 2: FFmpeg Transcoder

**File**: `02-ffmpeg-transcoder-vod.md`

- Install FFmpeg locally
- Implement metadata extraction
- Implement thumbnail generation
- Implement HLS transcoding (3 variants)
- **Deliverable**: Working transcoder

### Day 3: RabbitMQ Consumer

**File**: `03-rabbitmq-consumer.md`

- Connect to RabbitMQ
- Implement job consumer
- Process transcode jobs
- Update database
- **Deliverable**: End-to-end job processing

### Day 3-4: Integration & Testing

**File**: `04-integration-e2e.md`

- Update main entry point
- Test complete upload → transcode → playback flow
- Load testing
- **Deliverable**: Verified working system

### Day 4-5: Live Streaming (Optional)

**File**: `05-live-streaming.md`

- Implement RTMP handler
- Real-time HLS packaging
- File watcher for uploads
- **Deliverable**: Working live streaming

### Day 5: Performance & Optimization

**File**: `06-performance-optimization.md`

- Memory management
- Progress tracking
- Error recovery
- Metrics & monitoring
- **Deliverable**: Production-ready worker

## Quick Start

1. **Read master plan**: `phase4-detailed-implementation.md`
2. **Start with Day 1**: `01-storage-service.md`
3. **Follow in order**: 01 → 02 → 03 → 04 → (optional: 05, 06)
4. **Check off tasks**: Each file has checkboxes
5. **Test as you go**: Verify each component before moving on

## Prerequisites

### Services Required

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Verify
docker-compose -f docker-compose.dev.yml ps
# Should show: postgres, rabbitmq, minio, redis
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5445/streaming_video

# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password

# Worker
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium
FFMPEG_CRF=23
```

### Local Tools

```bash
# Install FFmpeg
brew install ffmpeg

# Verify
ffmpeg -version
# Should show: ffmpeg version 6.x

# Node/Bun
node --version  # >= 22
bun --version   # latest
```

## Success Criteria (Overall)

### VOD Transcoding

- [x] Worker processes transcode jobs
- [x] Creates 3 HLS variants (480p, 720p, 1080p)
- [x] Generates thumbnail
- [x] Uploads to MinIO
- [x] Updates database correctly
- [x] Status flow: PENDING → PROCESSING → READY

### Live Streaming (Optional)

- [x] Accepts RTMP stream
- [x] Converts to HLS real-time
- [x] Low latency (< 10s)
- [x] Uploads segments continuously

### Performance

- [x] Transcode speed: 0.5-1x realtime
- [x] Memory: < 2GB per job
- [x] Temp files cleaned up
- [x] Error handling works

## Testing Strategy

### Unit Tests

- Storage service operations
- Metadata extraction
- Thumbnail generation
- HLS transcoding

### Integration Tests

- Upload → Process → Output flow
- Database updates
- MinIO verification

### Load Tests

- 10+ concurrent jobs
- Memory/CPU monitoring
- Queue depth

## Troubleshooting

### Common Issues

**Worker won't start**:

```bash
# Check environment variables
env | grep RABBITMQ_URL
env | grep DATABASE_URL

# Check service connectivity
telnet localhost 5672  # RabbitMQ
telnet localhost 9000  # MinIO
```

**Job not processing**:

```bash
# Check RabbitMQ queue
open http://localhost:15672
# Login: admin/password
# Queue should have messages

# Check worker logs
cd apps/worker
bun run dev
```

**Transcode fails**:

```bash
# Check FFmpeg
ffmpeg -version

# Check temp directory
ls -la /tmp/transcode-*

# Check logs for FFmpeg errors
```

## Phase Dependencies

### Required (Completed)

- ✅ Phase 2: Database Layer

### Parallel (Can work simultaneously)

- 🔄 Phase 3: Backend API (upload endpoints)
- 🔄 Phase 5: Storage setup (MinIO, RabbitMQ)

### Next

- Phase 6: Frontend (video player, upload UI)
- Phase 7: Deployment (Docker, CI/CD)
- Phase 8: Testing & Polish

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [HLS Spec](https://datatracker.ietf.org/doc/html/rfc8216)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)
- [MinIO SDK](https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html)

## Notes

- Keep files < 500 lines
- Test each component independently
- Document issues and solutions
- Update plans if approach changes
- Commit after each phase completion
