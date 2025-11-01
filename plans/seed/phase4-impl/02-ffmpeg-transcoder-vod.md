# Phase 4B: FFmpeg Transcoder - VOD

**Timeline**: Day 2
**Priority**: High (Core functionality)
**Estimated Time**: 6-8 hours
**Dependencies**: Phase 4A (Storage Service)

## Overview

Implement video transcoding using FFmpeg to convert uploaded videos into HLS format with multiple quality variants (480p, 720p, 1080p).

## File

`apps/worker/src/transcoder.ts`

## Prerequisites

### Install FFmpeg

**macOS**:

```bash
brew install ffmpeg
ffmpeg -version  # Verify installation
```

**Ubuntu/Debian**:

```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Verify Installation**:

```bash
ffmpeg -version
# Should show: ffmpeg version 6.x or higher
# With libx264, libfdk_aac support
```

### Environment Variables

```env
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium        # veryfast|faster|fast|medium|slow
FFMPEG_CRF=23               # Quality: 18-28 (lower = better)
```

## HLS Variants Configuration

```typescript
const HLS_VARIANTS = [
  {
    resolution: '1080p',
    width: 1920,
    height: 1080,
    bitrate: 5000, // kbps
    audioBitrate: 192
  },
  {
    resolution: '720p',
    width: 1280,
    height: 720,
    bitrate: 2800,
    audioBitrate: 128
  },
  {
    resolution: '480p',
    width: 854,
    height: 480,
    bitrate: 1400,
    audioBitrate: 96
  }
]
```

## Implementation Tasks

### 1. Video Metadata Extraction

**Function**: `getVideoMetadata(inputPath: string)`

```typescript
interface VideoMetadata {
  duration: number // seconds
  width: number
  height: number
  bitrate: number
  fps: number
  codec: string
  hasAudio: boolean
}
```

**Tasks**:

- [ ] Use `fluent-ffmpeg` to probe video
- [ ] Extract duration, resolution, bitrate
- [ ] Detect video/audio codecs
- [ ] Handle corrupted files
- [ ] Return metadata object

**FFmpeg Command**:

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

### 2. Thumbnail Generation

**Function**: `generateThumbnail(inputPath: string, outputPath: string)`

**Tasks**:

- [ ] Extract frame at 1 second (or 10% of duration)
- [ ] Resize to 1280x720
- [ ] Save as JPEG (quality 80)
- [ ] Handle videos < 1 second
- [ ] Return thumbnail path

**FFmpeg Command**:

```bash
ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 -vf scale=1280:720 -q:v 2 thumbnail.jpg
```

### 3. HLS Transcoding

**Function**: `transcodeToHLS(options: TranscodeOptions)`

```typescript
interface TranscodeOptions {
  inputPath: string
  outputDir: string
  videoId: string
}
```

**Tasks**:

- [ ] Create output directory structure
- [ ] Detect source resolution
- [ ] Generate variants (skip if source < target resolution)
- [ ] Transcode each variant in parallel
- [ ] Monitor FFmpeg progress
- [ ] Handle encoding errors
- [ ] Return list of generated files

**Per-Variant FFmpeg Command**:

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -b:v 5000k \
  -maxrate 6000k \
  -bufsize 10000k \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -c:a aac \
  -b:a 192k \
  -ar 48000 \
  -ac 2 \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_segment_filename "1080p/segment_%03d.ts" \
  1080p/playlist.m3u8
```

**Output Structure**:

```
/tmp/transcode-{videoId}/
├── 1080p/
│   ├── segment_000.ts
│   ├── segment_001.ts
│   └── playlist.m3u8
├── 720p/
│   ├── segment_000.ts
│   └── playlist.m3u8
├── 480p/
│   ├── segment_000.ts
│   └── playlist.m3u8
├── thumbnail.jpg
└── master.m3u8
```

### 4. Master Playlist Generation

**Function**: `generateMasterPlaylist(outputDir: string, metadata: VideoMetadata)`

**Tasks**:

- [ ] Create master.m3u8 file
- [ ] List all available variants
- [ ] Include bandwidth and resolution info
- [ ] Handle missing variants

**Master Playlist Format**:

```m3u8
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p/playlist.m3u8
```

## Code Structure

```typescript
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

interface TranscodeOptions {
  inputPath: string
  outputDir: string
  videoId: string
}

interface VideoMetadata {
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
  codec: string
  hasAudio: boolean
}

interface HLSVariant {
  resolution: string
  width: number
  height: number
  bitrate: number
  audioBitrate: number
}

const HLS_VARIANTS: HLSVariant[] = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000, audioBitrate: 192 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800, audioBitrate: 128 },
  { resolution: '480p', width: 854, height: 480, bitrate: 1400, audioBitrate: 96 }
]

export async function getVideoMetadata(inputPath: string): Promise<VideoMetadata>
export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void>
export async function transcodeToHLS(options: TranscodeOptions): Promise<void>
export async function generateMasterPlaylist(
  outputDir: string,
  metadata: VideoMetadata
): Promise<void>

// Main entry
export async function transcodeVideo(
  inputPath: string,
  outputDir: string,
  videoId: string
): Promise<void> {
  const metadata = await getVideoMetadata(inputPath)
  await generateThumbnail(inputPath, path.join(outputDir, 'thumbnail.jpg'))
  await transcodeToHLS({ inputPath, outputDir, videoId })
  await generateMasterPlaylist(outputDir, metadata)
}
```

## Error Handling

### Scenarios

1. **Input file corrupted**:
   - Detect with ffprobe
   - Throw error with details
   - Don't attempt transcoding

2. **FFmpeg encoding fails**:
   - Capture stderr output
   - Log full error message
   - Clean up partial outputs
   - Rethrow with context

3. **Disk space full**:
   - Check available space before start
   - Monitor during encoding
   - Clean up on failure

4. **Out of memory**:
   - Set FFmpeg memory limits
   - Use lower preset if needed
   - Retry with reduced settings

## Testing

### Create Test Video

```bash
# Generate 10-second test video (1080p, 30fps)
ffmpeg -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 \
  -f lavfi -i sine=frequency=1000:duration=10 \
  -pix_fmt yuv420p -c:v libx264 -c:a aac \
  test-1080p.mp4

# Generate 720p test
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:duration=10 \
  -pix_fmt yuv420p -c:v libx264 -c:a aac \
  test-720p.mp4
```

### Unit Tests

```typescript
describe('Transcoder', () => {
  const testInput = '/tmp/test-1080p.mp4'
  const testOutput = '/tmp/transcode-test'

  beforeEach(async () => {
    await fs.mkdir(testOutput, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testOutput, { recursive: true, force: true })
  })

  it('extracts metadata', async () => {
    const metadata = await getVideoMetadata(testInput)
    expect(metadata.duration).toBeGreaterThan(0)
    expect(metadata.width).toBe(1920)
    expect(metadata.height).toBe(1080)
  })

  it('generates thumbnail', async () => {
    const thumbPath = path.join(testOutput, 'thumb.jpg')
    await generateThumbnail(testInput, thumbPath)
    expect(await fs.stat(thumbPath)).toBeTruthy()
  })

  it('transcodes to HLS', async () => {
    await transcodeToHLS({
      inputPath: testInput,
      outputDir: testOutput,
      videoId: 'test'
    })

    expect(await fs.stat(path.join(testOutput, 'master.m3u8'))).toBeTruthy()
    expect(await fs.stat(path.join(testOutput, '1080p/playlist.m3u8'))).toBeTruthy()
    expect(await fs.stat(path.join(testOutput, '720p/playlist.m3u8'))).toBeTruthy()
    expect(await fs.stat(path.join(testOutput, '480p/playlist.m3u8'))).toBeTruthy()
  })

  it('skips higher resolutions than source', async () => {
    await transcodeToHLS({
      inputPath: '/tmp/test-720p.mp4',
      outputDir: testOutput,
      videoId: 'test'
    })

    // Should only have 720p and 480p
    expect(await fs.stat(path.join(testOutput, '720p/playlist.m3u8'))).toBeTruthy()
    expect(await fs.stat(path.join(testOutput, '480p/playlist.m3u8'))).toBeTruthy()
    await expect(fs.stat(path.join(testOutput, '1080p/playlist.m3u8'))).rejects.toThrow()
  })
})
```

### Manual Testing

```bash
# Run transcoding on test video
cd apps/worker
bun run test:transcode

# Verify outputs
ls -lh /tmp/transcode-test/
# Should show:
# - master.m3u8
# - thumbnail.jpg
# - 1080p/ 720p/ 480p/ directories

# Test playback with VLC or Safari
open /tmp/transcode-test/master.m3u8
```

## Success Criteria

- [x] Extracts metadata correctly
- [x] Generates thumbnail (JPEG, 1280x720)
- [x] Creates 3 HLS variants
- [x] Generates valid master playlist
- [x] Output files playable in HLS player
- [x] Handles errors gracefully
- [x] Cleans up temp files
- [x] Transcode speed: 0.5-1x realtime
- [x] Memory usage < 2GB

## Performance Benchmarks

**Test video**: 10-second 1080p @ 30fps

| Preset   | Speed    | Quality   | File Size |
| -------- | -------- | --------- | --------- |
| veryfast | 2-3x     | Good      | 15MB      |
| faster   | 1.5-2x   | Better    | 12MB      |
| medium   | 0.8-1x   | Best      | 10MB      |
| slow     | 0.3-0.5x | Excellent | 8MB       |

**Recommended**: `medium` for balanced quality/speed

## Next Steps

Once transcoding is complete:

- ✅ Proceed to Phase 4C (RabbitMQ Consumer)
- Transcoder will be called by consumer to process queued jobs

## Notes

- Use `fluent-ffmpeg` wrapper for easier FFmpeg control
- Monitor FFmpeg progress events for long videos
- Keep temp directory clean
- Set reasonable timeouts (5 min for 10 min video)
- Test with various input formats (MP4, AVI, MOV, MKV)
- Consider GPU acceleration for production (NVENC)
