# Phase 4: Video Worker - Detailed Implementation Plan

**Date**: 2025-11-01
**Base**: Phase 2 (Database) ✅ Completed
**Dependencies**: Phase 3 (Backend API), Phase 5 (Storage - MinIO/RabbitMQ)
**Estimated Time**: 4-5 days

## Current Status

**Existing Structure**:

```
apps/worker/
├── src/
│   ├── index.ts           ✅ Placeholder (DB connection only)
│   ├── transcoder.ts      ✅ Placeholder (interface only)
│   ├── consumer.ts        ✅ Empty
│   ├── live-stream.ts     ✅ Empty
│   ├── types.ts           ✅ Empty
│   └── services/
│       └── storage.ts     ✅ Empty
├── package.json           ✅ Dependencies configured
└── tsconfig.json          ✅ Configured
```

**Dependencies Already Installed**:

- ✅ `amqplib` (RabbitMQ)
- ✅ `fluent-ffmpeg` (FFmpeg wrapper)
- ✅ `minio` (S3-compatible storage)
- ✅ `@repo/database` (Prisma client)

## Implementation Breakdown

### PHASE 01: Storage Service (Day 1)

**File**: `apps/worker/src/services/storage.ts`

**Tasks**:

1. Implement MinIO client initialization
2. Create methods:
   - `downloadFile(key, localPath)` - Download from MinIO
   - `uploadFile(localPath, key)` - Upload to MinIO
   - `uploadDirectory(localDir, prefix)` - Batch upload
   - `fileExists(key)` - Check file existence
   - `deleteFiles(prefix)` - Cleanup

**Dependencies**:

- MinIO running (docker-compose.dev.yml)
- Environment: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`

**Verification**:

```bash
# Test download/upload
bun run dev  # Should connect to MinIO
```

**Success Criteria**:

- ✅ MinIO client connects
- ✅ Can download test file
- ✅ Can upload test file
- ✅ File operations don't throw errors

---

### PHASE 02: FFmpeg Transcoder - VOD (Day 2)

**File**: `apps/worker/src/transcoder.ts`

**Tasks**:

1. Install FFmpeg locally

   ```bash
   # macOS
   brew install ffmpeg

   # Verify
   ffmpeg -version
   ```

2. Implement functions:
   - `getVideoMetadata(inputPath)` - Extract duration, resolution
   - `generateThumbnail(inputPath, outputPath)` - Create thumbnail at 1s
   - `transcodeToHLS(options)` - Main transcoding logic
   - `generateMasterPlaylist(outputDir)` - Create master.m3u8

3. HLS Variants Configuration:

   ```typescript
   const HLS_VARIANTS = [
     { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000 },
     { resolution: '720p', width: 1280, height: 720, bitrate: 2800 },
     { resolution: '480p', width: 854, height: 480, bitrate: 1400 }
   ]
   ```

4. FFmpeg Command Template:
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

**Environment Variables**:

```env
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium
FFMPEG_CRF=23
```

**Verification**:

```bash
# Create test video
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -pix_fmt yuv420p test.mp4

# Test transcoding
bun run test-transcode
```

**Success Criteria**:

- ✅ Can extract metadata
- ✅ Generates thumbnail (720p, JPG)
- ✅ Creates 3 HLS variants
- ✅ Generates master.m3u8
- ✅ Output files valid (playable)

---

### PHASE 03: RabbitMQ Consumer (Day 3)

**File**: `apps/worker/src/consumer.ts`

**Tasks**:

1. Implement RabbitMQ connection

   ```typescript
   async function connectRabbitMQ() {
     const conn = await amqp.connect(process.env.RABBITMQ_URL!)
     const channel = await conn.createChannel()
     await channel.assertQueue('video-transcode', { durable: true })
     return { conn, channel }
   }
   ```

2. Implement consumer:
   - Listen to 'video-transcode' queue
   - Parse job: `{ videoId, inputKey }`
   - Process with `processTranscodeJob()`
   - Ack on success / Nack on failure

3. Implement `processTranscodeJob()`:

   ```typescript
   async function processTranscodeJob(job: TranscodeJob) {
     // 1. Update video status to PROCESSING
     // 2. Download from MinIO
     // 3. Transcode with FFmpeg
     // 4. Upload outputs to MinIO
     // 5. Create VideoVariant records
     // 6. Update video status to READY
     // 7. Cleanup temp files
   }
   ```

4. Error Handling:
   - FFmpeg fails → status: FAILED
   - Upload fails → retry 3x → FAILED
   - Database fails → log error, Nack

**Dependencies**:

- RabbitMQ running (docker-compose.dev.yml)
- Environment: `RABBITMQ_URL`

**Verification**:

```bash
# Start worker
bun run dev

# Check RabbitMQ management
open http://localhost:15672
# Login: admin/password
# Queue should show consumer connected
```

**Success Criteria**:

- ✅ Connects to RabbitMQ
- ✅ Queue 'video-transcode' exists
- ✅ Consumer processes jobs
- ✅ Updates database correctly
- ✅ Handles errors gracefully

---

### PHASE 04: Integration & End-to-End (Day 3-4)

**File**: `apps/worker/src/index.ts`

**Tasks**:

1. Update main entry:

   ```typescript
   import { startWorker } from './consumer'
   import { prisma } from '@repo/database'

   async function main() {
     console.log('🎬 Video processing worker starting...')

     await prisma.$connect()
     console.log('✅ Database connected')

     await startWorker()
     console.log('✅ Worker listening for jobs')
   }
   ```

2. Add graceful shutdown:
   - SIGINT handler → close RabbitMQ, disconnect DB
   - SIGTERM handler → same
   - Process cleanup

3. Integration Testing:
   - Upload test video via API
   - Worker processes job
   - Verify outputs in MinIO
   - Verify database updated

**Test Flow**:

```bash
# Terminal 1: Start services
docker-compose -f docker-compose.dev.yml up

# Terminal 2: Start worker
cd apps/worker
bun run dev

# Terminal 3: Upload test video
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.mp4", "fileSize": 1000000, "contentType": "video/mp4"}'

# Upload file to presigned URL
curl -X PUT [PRESIGNED_URL] --upload-file test.mp4

# Complete upload
curl -X POST http://localhost:3001/api/upload/[videoId]/complete

# Check worker logs - should process
# Check MinIO - should have outputs
# Check DB - should be READY
```

**Success Criteria**:

- ✅ Worker starts without errors
- ✅ Processes real jobs end-to-end
- ✅ Outputs appear in MinIO
- ✅ Database reflects correct status
- ✅ No memory leaks

---

### PHASE 05: Live Streaming (Day 4-5)

**File**: `apps/worker/src/live-stream.ts`

**Tasks**:

1. Implement WebRTC → HLS conversion
   - Accept WebRTC stream
   - Pipe to FFmpeg
   - Output HLS segments (2s each)

2. Implement `startLiveStream()`:

   ```typescript
   async function startLiveStream(videoId: string, streamKey: string) {
     const outputDir = `/tmp/live-${videoId}`

     // FFmpeg for live HLS
     const ffmpeg = spawn('ffmpeg', [
       '-i',
       `rtmp://localhost/live/${streamKey}`,
       '-c:v',
       'libx264',
       '-preset',
       'veryfast',
       '-tune',
       'zerolatency',
       '-c:a',
       'aac',
       '-f',
       'hls',
       '-hls_time',
       '2',
       '-hls_list_size',
       '10',
       '-hls_flags',
       'delete_segments+append_list',
       `${outputDir}/index.m3u8`
     ])

     // Watch directory → upload segments to MinIO
   }
   ```

3. Implement file watcher:
   - Monitor output directory
   - Upload .ts and .m3u8 files to MinIO
   - Real-time sync for low latency

4. Implement `stopLiveStream()`:
   - Kill FFmpeg process
   - Cleanup temp directory
   - Optionally save recording

**File**: `apps/worker/src/hls-packager.ts`

**Tasks**:

- Real-time segment upload
- Manifest updates
- Cleanup old segments

**Verification**:

```bash
# Test RTMP ingest
ffmpeg -re -i test.mp4 -c copy -f flv rtmp://localhost/live/[streamKey]

# Check MinIO for segments
# Check HLS playback
```

**Success Criteria**:

- ✅ Accepts RTMP stream
- ✅ Converts to HLS in real-time
- ✅ Uploads segments to MinIO
- ✅ Latency < 10 seconds
- ✅ Can stop stream cleanly

---

### PHASE 06: Performance & Optimization (Day 5)

**Tasks**:

1. Memory Management:
   - Cleanup temp files after each job
   - Monitor memory usage
   - Set FFmpeg buffer limits

2. Concurrent Jobs:
   - Set RabbitMQ prefetch: 1
   - Handle multiple workers (scaling)

3. Progress Tracking:
   - FFmpeg progress events
   - Update database with %
   - WebSocket notifications (optional)

4. Error Recovery:
   - Retry failed uploads
   - Handle disk space errors
   - Graceful FFmpeg crashes

**Environment Tuning**:

```env
WORKER_CONCURRENCY=1        # Jobs per worker
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium        # veryfast/faster/fast/medium/slow
FFMPEG_CRF=23               # Quality (18-28)
MAX_CONCURRENT_TRANSCODES=2
```

**Success Criteria**:

- ✅ Memory < 2GB per job
- ✅ Disk cleanup automatic
- ✅ No zombie FFmpeg processes
- ✅ Handles failures gracefully

---

## File Checklist

### To Implement:

- [ ] `src/services/storage.ts` - MinIO operations
- [ ] `src/transcoder.ts` - FFmpeg VOD transcoding
- [ ] `src/consumer.ts` - RabbitMQ job processing
- [ ] `src/index.ts` - Main worker entry (update)
- [ ] `src/live-stream.ts` - Live streaming handler
- [ ] `src/hls-packager.ts` - Real-time HLS packaging
- [ ] `src/types.ts` - Job interfaces

### To Update:

- [ ] `.env` - Add worker env vars
- [ ] `docker-compose.dev.yml` - Ensure services running

---

## Testing Strategy

### Unit Tests:

```typescript
// test/transcoder.test.ts
describe('Transcoder', () => {
  it('generates thumbnail', async () => {
    const result = await generateThumbnail('test.mp4', 'thumb.jpg')
    expect(fs.existsSync('thumb.jpg')).toBe(true)
  })

  it('transcodes to HLS', async () => {
    await transcodeToHLS({ inputPath: 'test.mp4', outputDir: '/tmp/out', videoId: '123' })
    expect(fs.existsSync('/tmp/out/master.m3u8')).toBe(true)
  })
})
```

### Integration Tests:

1. Upload test video
2. Worker processes
3. Verify outputs in MinIO
4. Verify database records
5. Test playback in browser

### Load Tests:

- Queue 10 jobs simultaneously
- Monitor memory/CPU
- Verify all complete successfully

---

## Environment Variables

**Add to `.env`**:

```env
# Worker
WORKER_CONCURRENCY=1
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium
FFMPEG_CRF=23
MAX_CONCURRENT_TRANSCODES=1

# RabbitMQ (existing)
RABBITMQ_URL=amqp://admin:password@localhost:5672

# MinIO (existing)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password

# Database (existing)
DATABASE_URL=postgresql://postgres:password@localhost:5445/streaming_video
```

---

## Success Criteria (Overall)

### VOD Transcoding:

- ✅ Worker connects to RabbitMQ
- ✅ Processes transcode jobs
- ✅ Creates 3 HLS variants (480p, 720p, 1080p)
- ✅ Generates thumbnail
- ✅ Uploads to MinIO
- ✅ Updates database (VideoVariant records)
- ✅ Status: PENDING → PROCESSING → READY

### Live Streaming:

- ✅ Accepts RTMP/WebRTC stream
- ✅ Converts to HLS real-time
- ✅ Low latency (< 10s)
- ✅ Uploads segments continuously
- ✅ Can stop stream gracefully

### Performance:

- ✅ Transcode speed: 0.5-1x realtime
- ✅ Memory: < 2GB per job
- ✅ Temp files cleaned up
- ✅ No memory leaks

### Error Handling:

- ✅ FFmpeg errors → status FAILED
- ✅ Upload errors → retry → FAILED
- ✅ Queue errors handled
- ✅ Graceful shutdown

---

## Dependencies Checklist

### Services (docker-compose.dev.yml):

- [ ] PostgreSQL (port 5445)
- [ ] RabbitMQ (ports 5672, 15672)
- [ ] MinIO (ports 9000, 9001)
- [ ] Redis (port 6379) - optional for Phase 3

### Local Tools:

- [ ] FFmpeg installed (`ffmpeg -version`)
- [ ] Node.js >= 22
- [ ] Bun package manager

### Phase Dependencies:

- [ ] Phase 2 ✅ (Database schema)
- [ ] Phase 3 (Backend API - upload endpoints)
- [ ] Phase 5 (Storage - MinIO setup)

---

## Unresolved Questions

1. **Video Formats**: Support only MP4 or also AVI, MOV, MKV?
2. **Max File Size**: Limit upload size? (e.g., 2GB)
3. **Retention Policy**: How long keep temp files? Auto-delete after 24h?
4. **Concurrent Workers**: Deploy multiple workers for scaling?
5. **Progress Updates**: Real-time progress via WebSocket or polling?
6. **Live Recording**: Save live streams as VOD after completion?
7. **Audio-Only**: Support audio-only transcoding (podcast use case)?
8. **Subtitles**: Support VTT/SRT subtitle files in HLS?
9. **DRM**: Content protection needed for VOD?
10. **CDN**: Plan for CDN integration (Cloudflare, etc.)?

---

## Next Steps After Phase 4

**Phase 5**: Frontend - Video player, upload UI, live streaming UI
**Phase 6**: Deployment - Docker production builds, CI/CD
**Phase 7**: Testing & Polish - E2E tests, error handling, optimization
