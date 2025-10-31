# Phase 4: Video Processing Worker

**Date**: 2025-10-31
**Estimated Time**: 4-5 days
**Dependencies**: Phase 2 (Database), Phase 3 (Backend API), Phase 5 (Storage)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 4)

## Overview

Build FFmpeg transcoding worker with HLS output (3 variants: 480p, 720p, 1080p) + live streaming support.

## Tasks

### 1. Project Structure

Create in `apps/worker/src/`:

```
src/
├── index.ts              # Entry point
├── consumer.ts           # RabbitMQ consumer
├── transcoder.ts         # FFmpeg HLS transcoding
├── live-stream.ts        # Live stream handler
├── hls-packager.ts       # Real-time HLS packaging
├── services/
│   └── storage.ts        # MinIO operations
└── types.ts              # Job types
```

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

### 3. Implement VOD Transcoding

**`src/transcoder.ts`**:

Key features:

- Input: Video file from MinIO
- Output: HLS with 3 variants (480p, 720p, 1080p)
- Generate thumbnail
- Create master playlist
- Upload all to MinIO

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

### 4. Implement RabbitMQ Consumer

**`src/consumer.ts`**:

Flow:

1. Connect to RabbitMQ
2. Assert queue 'video-transcode'
3. Consume messages
4. Process transcode job
5. Update database status
6. Ack/Nack message

Job structure:

```typescript
interface TranscodeJob {
  videoId: string
  inputKey: string
}
```

### 5. Implement Live Streaming

**`src/live-stream.ts`**:

Features:

- Receive WebRTC stream
- Convert to HLS segments in real-time
- Upload segments to MinIO continuously
- Update manifest dynamically

**`src/hls-packager.ts`**:

FFmpeg for live:

```bash
ffmpeg -i rtmp://input \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -c:a aac \
  -f hls -hls_time 2 -hls_list_size 10 \
  -hls_flags delete_segments+append_list \
  output.m3u8
```

Watch directory and upload new segments to MinIO.

### 6. Storage Service

**`src/services/storage.ts`**:

```typescript
import { Client } from 'minio'

class StorageService {
  private client: Client

  async downloadFile(key: string, localPath: string): Promise<void>
  async uploadFile(localPath: string, key: string): Promise<void>
  async uploadDirectory(localDir: string, prefix: string): Promise<string[]>
  async deleteFiles(prefix: string): Promise<void>
}

export const storageService = new StorageService()
```

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

### 8. Error Handling

Important cases:

- FFmpeg process fails
- MinIO upload fails
- RabbitMQ disconnects
- Database update fails
- Disk space full

Update video status to 'FAILED' on error.

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

## Notes

- Reference detailed plan section 4 for complete code
- Use `fluent-ffmpeg` npm package for easier FFmpeg control
- Keep temp directory clean
- Handle concurrent jobs properly (prefetch: 1)
- Test with various video formats
- Monitor FFmpeg progress for long videos
