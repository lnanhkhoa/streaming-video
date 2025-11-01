# Phase 4E: Live Streaming

**Timeline**: Day 4-5
**Priority**: Medium (Advanced feature)
**Estimated Time**: 8-10 hours
**Dependencies**: Phase 4A (Storage), Phase 4B (Transcoder)

## Overview

Implement live video streaming capability. Accept RTMP or WebRTC stream from broadcaster, convert to HLS in real-time, and upload segments to MinIO for viewers to watch with minimal latency.

## Files

- `apps/worker/src/live-stream.ts` - Main live stream handler
- `apps/worker/src/hls-packager.ts` - Real-time HLS packaging

## Architecture

```
Broadcaster (Camera/OBS)
  → RTMP/WebRTC Stream
    → Worker (FFmpeg)
      → HLS Segments (2s each)
        → MinIO Upload
          → Viewers (HLS Player)
```

## Live Streaming Flow

1. **Create Live Stream** (via API):
   - Generate unique stream key
   - Create Video record (type: LIVE, status: PENDING)

2. **Start Streaming** (broadcaster):
   - Broadcaster sends RTMP stream with stream key
   - Worker detects stream, starts FFmpeg
   - FFmpeg outputs HLS segments to temp directory

3. **Real-time Upload**:
   - File watcher monitors output directory
   - New segments uploaded to MinIO immediately
   - Manifest (.m3u8) updated continuously

4. **Viewers Watch**:
   - Get live stream URL from API
   - HLS player fetches segments from MinIO
   - Low latency (5-10 seconds)

5. **Stop Streaming**:
   - Broadcaster stops stream
   - FFmpeg process terminated
   - Temp files cleaned up
   - Optionally save recording as VOD

## Implementation Tasks

### 1. RTMP Server Setup

**Option A: Use nginx-rtmp (Recommended for production)**

```yaml
# docker-compose.dev.yml
nginx-rtmp:
  image: tiangolo/nginx-rtmp
  ports:
    - '1935:1935' # RTMP port
  volumes:
    - ./nginx-rtmp.conf:/etc/nginx/nginx.conf
```

**nginx-rtmp.conf**:

```nginx
rtmp {
  server {
    listen 1935;
    chunk_size 4096;

    application live {
      live on;
      record off;

      # Forward to worker
      exec_push ffmpeg -i rtmp://localhost/live/$name
        -c:v libx264 -preset veryfast -tune zerolatency
        -c:a aac -b:a 128k
        -f hls -hls_time 2 -hls_list_size 5
        -hls_flags delete_segments+append_list
        /tmp/live-$name/index.m3u8;
    }
  }
}
```

**Option B: Simple FFmpeg (For MVP)**

```typescript
// Worker accepts RTMP directly
// Start FFmpeg process on stream detection
```

### 2. Live Stream Handler

**File**: `apps/worker/src/live-stream.ts`

```typescript
import { spawn, ChildProcess } from 'child_process'
import { watch } from 'chokidar'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { storageService } from './services/storage'
import { prisma } from '@repo/database'

interface LiveStreamConfig {
  videoId: string
  streamKey: string
  rtmpUrl: string
}

class LiveStreamManager {
  private activeStreams = new Map<string, ActiveStream>()

  async startLiveStream(config: LiveStreamConfig): Promise<void> {
    const { videoId, streamKey, rtmpUrl } = config
    const outputDir = path.join(os.tmpdir(), `live-${videoId}`)

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true })

    // Start FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', [
      '-i',
      rtmpUrl,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-b:v',
      '2500k',
      '-maxrate',
      '3000k',
      '-bufsize',
      '6000k',
      '-vf',
      'scale=1280:720',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '48000',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '5',
      '-hls_flags',
      'delete_segments+append_list',
      '-hls_segment_filename',
      `${outputDir}/segment_%03d.ts`,
      `${outputDir}/index.m3u8`
    ])

    // Handle FFmpeg events
    ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg error for ${videoId}:`, error)
      this.stopLiveStream(videoId)
    })

    ffmpegProcess.stderr.on('data', (data) => {
      // Log FFmpeg output
      console.log(`FFmpeg [${videoId}]:`, data.toString())
    })

    // Watch output directory for new files
    const watcher = this.watchDirectory(videoId, outputDir)

    // Store active stream
    this.activeStreams.set(videoId, {
      process: ffmpegProcess,
      watcher,
      outputDir
    })

    // Update database
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'LIVE',
        isLiveNow: true,
        hlsManifestKey: `live/${videoId}/index.m3u8`
      }
    })

    console.log(`✅ Live stream started: ${videoId}`)
  }

  private watchDirectory(videoId: string, outputDir: string) {
    const watcher = watch(outputDir, {
      persistent: true,
      ignoreInitial: true
    })

    watcher.on('add', async (filePath) => {
      const fileName = path.basename(filePath)

      // Upload .ts segments and .m3u8 manifest
      if (fileName.endsWith('.ts') || fileName.endsWith('.m3u8')) {
        const s3Key = `live/${videoId}/${fileName}`

        try {
          await storageService.uploadFile(filePath, s3Key)
          console.log(`⬆️  Uploaded: ${s3Key}`)
        } catch (error) {
          console.error(`Upload failed: ${s3Key}`, error)
        }
      }
    })

    watcher.on('change', async (filePath) => {
      // Manifest updated - re-upload
      if (filePath.endsWith('.m3u8')) {
        const fileName = path.basename(filePath)
        const s3Key = `live/${videoId}/${fileName}`

        try {
          await storageService.uploadFile(filePath, s3Key)
          console.log(`🔄 Updated: ${s3Key}`)
        } catch (error) {
          console.error(`Upload failed: ${s3Key}`, error)
        }
      }
    })

    return watcher
  }

  async stopLiveStream(videoId: string): Promise<void> {
    const stream = this.activeStreams.get(videoId)
    if (!stream) return

    // Kill FFmpeg
    stream.process.kill('SIGTERM')

    // Stop file watcher
    await stream.watcher.close()

    // Cleanup temp directory
    await fs.rm(stream.outputDir, { recursive: true, force: true })

    // Remove from active streams
    this.activeStreams.delete(videoId)

    // Update database
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        isLiveNow: false
      }
    })

    console.log(`🛑 Live stream stopped: ${videoId}`)
  }

  async convertToVOD(videoId: string): Promise<void> {
    // TODO: Concatenate all segments into MP4
    // Then run standard transcoding workflow
  }
}

export const liveStreamManager = new LiveStreamManager()
```

**Tasks**:

- [ ] Spawn FFmpeg process for RTMP → HLS
- [ ] Watch output directory for new files
- [ ] Upload segments to MinIO in real-time
- [ ] Update manifest continuously
- [ ] Handle stream start/stop
- [ ] Cleanup on shutdown

### 3. HLS Packager

**File**: `apps/worker/src/hls-packager.ts`

```typescript
import { storageService } from './services/storage'
import path from 'path'
import fs from 'fs/promises'

export class HLSPackager {
  async uploadSegment(segmentPath: string, videoId: string): Promise<void> {
    const fileName = path.basename(segmentPath)
    const s3Key = `live/${videoId}/${fileName}`

    await storageService.uploadFile(segmentPath, s3Key)
  }

  async uploadManifest(manifestPath: string, videoId: string): Promise<void> {
    const s3Key = `live/${videoId}/index.m3u8`
    await storageService.uploadFile(manifestPath, s3Key)
  }

  async cleanupOldSegments(videoId: string, maxSegments: number = 5): Promise<void> {
    // Keep only last N segments
    // Delete older ones from MinIO
  }
}

export const hlsPackager = new HLSPackager()
```

### 4. Integration with API

**Backend API endpoints** (Phase 3):

```typescript
// POST /api/live/create
// Creates Video record, generates stream key

// POST /api/live/:videoId/start
// Calls worker to start live stream

// POST /api/live/:videoId/stop
// Calls worker to stop live stream

// GET /api/live/:videoId/status
// Returns isLiveNow, viewer count, etc.
```

## Testing

### Test RTMP Stream with OBS

**OBS Setup**:

1. Open OBS Studio
2. Settings → Stream
3. Server: `rtmp://localhost:1935/live`
4. Stream Key: `[streamKey from API]`
5. Start Streaming

### Test RTMP Stream with FFmpeg

```bash
# Stream test video on loop
ffmpeg -re -stream_loop -1 -i test-video.mp4 \
  -c copy \
  -f flv \
  rtmp://localhost:1935/live/[streamKey]
```

### Verify HLS Output

```bash
# Check MinIO for segments
curl http://localhost:9000/streaming-video/live/[videoId]/index.m3u8

# Should return HLS manifest
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:123
#EXTINF:2.000000,
segment_000.ts
#EXTINF:2.000000,
segment_001.ts
...
```

### Test Playback

```bash
# VLC
vlc http://localhost:9000/streaming-video/live/[videoId]/index.m3u8

# Browser with HLS.js
open http://localhost:3000/live/[videoId]
```

### Measure Latency

```bash
# Start streaming
# Measure time from camera to playback

# Target: < 10 seconds
# Acceptable: < 15 seconds
# Unacceptable: > 20 seconds
```

## Performance Optimization

### Low Latency Settings

**FFmpeg Options**:

```bash
-preset veryfast        # Faster encoding
-tune zerolatency       # Optimize for low latency
-hls_time 2             # 2-second segments (shorter = lower latency)
-hls_list_size 5        # Keep only 5 segments
-g 60                   # Keyframe every 2 seconds (30fps)
```

### Upload Optimization

- Upload segments immediately when created
- Use MinIO SDK's stream upload
- Parallel uploads for segments
- CDN for distribution (future)

## Error Handling

### Stream Disconnected

```typescript
ffmpegProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Stream ended unexpectedly: ${code}`)

    // Update status
    await prisma.video.update({
      where: { id: videoId },
      data: { isLiveNow: false }
    })
  }
})
```

### Upload Failures

```typescript
// Retry uploads 3x
for (let i = 0; i < 3; i++) {
  try {
    await storageService.uploadFile(path, key)
    break
  } catch (error) {
    if (i === 2) throw error
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
  }
}
```

## Success Criteria

- [x] Accepts RTMP stream
- [x] Converts to HLS in real-time
- [x] Uploads segments to MinIO
- [x] Manifest updates continuously
- [x] Viewers can watch with low latency (< 10s)
- [x] Stream can be stopped cleanly
- [x] Temp files cleaned up
- [x] Multiple concurrent streams supported
- [x] Handles disconnections gracefully

## Optional Features

### Save Live Recording

```typescript
async function saveRecording(videoId: string): Promise<void> {
  // Concatenate all segments into MP4
  const segments = await getSegmentList(videoId)

  // Create concat file
  const concatList = segments.map((s) => `file '${s}'`).join('\n')

  // FFmpeg concat
  await exec(`ffmpeg -f concat -safe 0 -i concat.txt -c copy recording.mp4`)

  // Upload recording
  await storageService.uploadFile('recording.mp4', `recordings/${videoId}.mp4`)

  // Queue standard transcode job
  await queueTranscodeJob({ videoId, inputKey: `recordings/${videoId}.mp4` })
}
```

### Viewer Count

```typescript
// Track active viewers
const viewerCounts = new Map<string, Set<string>>()

// WebSocket connection
ws.on('watch', ({ videoId, viewerId }) => {
  if (!viewerCounts.has(videoId)) {
    viewerCounts.set(videoId, new Set())
  }
  viewerCounts.get(videoId)!.add(viewerId)
})

// Return count via API
app.get('/api/live/:videoId/viewers', (c) => {
  const count = viewerCounts.get(c.req.param('videoId'))?.size || 0
  return c.json({ viewers: count })
})
```

## Next Steps

Once live streaming is complete:

- ✅ Proceed to Phase 4F (Performance & Optimization)
- Consider adding recording save feature
- Test with multiple concurrent streams

## Notes

- RTMP latency: 3-5 seconds
- WebRTC latency: 1-2 seconds (future)
- HLS latency: 5-10 seconds (current)
- Use nginx-rtmp for production
- Consider LL-HLS for lower latency (< 3s)
- Monitor bandwidth usage
- Implement viewer limits if needed
