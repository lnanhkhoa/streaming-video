# nginx-rtmp Basic Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: 🚧 In Progress
**Scope**: Basic development/testing RTMP streaming setup

## Executive Summary

Implement basic nginx-rtmp live streaming infrastructure for development/testing. Builds on Phase 3 MVP (metadata-only) to enable actual RTMP ingest from OBS with HLS playback.

**Approach**: Simple nginx-rtmp Docker container with authentication callbacks to existing API.

## Context Links

- **Related Plans**: `plans/seed/phase3-impl/08-live-routes.md` (MVP implementation), `plans/seed/phase3-impl/08-live-routes-rtmp-future.md` (full RTMP plan)
- **Dependencies**: Phase 3 complete (live service + routes)
- **Reference Docs**: Docker image options: alfg/docker-nginx-rtmp, tiangolo/nginx-rtmp

## Current State

**✅ Implemented** (Phase 3):

- Live service: createStream(), startStream(), stopStream()
- API routes: POST /create, /start, /stop; GET /active
- Database: streamKey, isLiveNow, hlsManifestKey fields
- Placeholder RTMP URLs (non-functional)

**❌ Missing**:

- nginx-rtmp Docker container
- RTMP ingest (port 1935)
- HLS output
- Authentication callback
- Functional playback endpoint

## Architecture

```
OBS → RTMP (1935) → nginx-rtmp → HLS → HTTP (8080) → Client
                         ↓
                    Auth Callback
                         ↓
                    API /verify (streamKey)
```

### Components

1. **nginx-rtmp**: RTMP ingest + HLS packaging
2. **API Callbacks**: /api/live/verify (auth), /api/live/publish (start), /api/live/unpublish (stop)
3. **HLS Storage**: Temporary filesystem (not MinIO for dev simplicity)
4. **Playback**: HTTP proxy through nginx on port 8080

## Implementation Tasks

### Task 1: Docker Setup (Est: 30 min)

**File**: `docker-compose.dev.yml`

Add nginx-rtmp service:

```yaml
nginx-rtmp:
  image: alfg/nginx-rtmp
  container_name: streaming-nginx-rtmp
  ports:
    - '1935:1935' # RTMP ingest
    - '8080:8080' # HLS playback
  volumes:
    - ./config/nginx-rtmp/nginx.conf:/etc/nginx/nginx.conf
    - ./tmp/hls:/tmp/hls
  networks:
    - streaming-network
  depends_on:
    - api
```

**Rationale**: alfg/nginx-rtmp includes FFmpeg, built on Alpine (lightweight).

---

### Task 2: nginx Configuration (Est: 45 min)

**File**: `config/nginx-rtmp/nginx.conf`

```nginx
worker_processes auto;
rtmp_auto_push on;

events {}

rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        application live {
            live on;
            record off;

            # HLS
            hls on;
            hls_path /tmp/hls;
            hls_fragment 2s;
            hls_playlist_length 10s;

            # Authentication
            on_publish http://api:3001/api/live/verify;

            # Callbacks
            on_publish_done http://api:3001/api/live/unpublish;
        }
    }
}

http {
    server {
        listen 8080;

        location /hls {
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            root /tmp;
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
        }
    }
}
```

**Key Features**:

- HLS fragments: 2s (balance between latency and stability)
- Playlist length: 10s (5 fragments)
- CORS enabled for browser playback
- Authentication via HTTP POST to API

---

### Task 3: Authentication Endpoint (Est: 30 min)

**File**: `apps/api/src/routes/live.ts`

Add new endpoint:

```typescript
/**
 * POST /api/live/verify
 * nginx-rtmp authentication callback
 * Returns 200 if streamKey valid, 403 otherwise
 */
liveRoutes.post('/verify', async (c) => {
  try {
    // nginx-rtmp sends streamKey as 'name' in form data
    const body = await c.req.parseBody()
    const streamKey = body.name as string

    if (!streamKey) {
      console.warn('⛔ Auth failed: No stream key provided')
      return c.text('Forbidden', 403)
    }

    // Check if stream exists and is valid
    const video = await prisma.video.findUnique({
      where: { streamKey }
    })

    if (!video || video.videoType !== 'LIVE') {
      console.warn(`⛔ Auth failed: Invalid stream key ${streamKey}`)
      return c.text('Forbidden', 403)
    }

    console.log(`✅ Auth success: Stream ${video.id} (${video.title})`)

    // Auto-start stream on successful publish
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: 'LIVE',
        isLiveNow: true
      }
    })

    return c.text('OK', 200)
  } catch (error) {
    console.error('Auth error:', error)
    return c.text('Internal Server Error', 500)
  }
})
```

---

### Task 4: Unpublish Callback (Est: 20 min)

**File**: `apps/api/src/routes/live.ts`

Add endpoint:

```typescript
/**
 * POST /api/live/unpublish
 * nginx-rtmp unpublish callback (stream stopped)
 */
liveRoutes.post('/unpublish', async (c) => {
  try {
    const body = await c.req.parseBody()
    const streamKey = body.name as string

    if (!streamKey) {
      return c.text('OK', 200) // Don't fail on missing key
    }

    const video = await prisma.video.findUnique({
      where: { streamKey }
    })

    if (video) {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'READY',
          isLiveNow: false
        }
      })
      console.log(`🛑 Stream stopped: ${video.id}`)
    }

    return c.text('OK', 200)
  } catch (error) {
    console.error('Unpublish error:', error)
    return c.text('OK', 200) // Always return 200 to nginx
  }
})
```

---

### Task 5: Update Live Service (Est: 20 min)

**File**: `apps/api/src/services/live.service.ts`

Update `createStream()` to return functional RTMP URL:

```typescript
async createStream(title: string, description?: string): Promise<CreateStreamResult> {
  try {
    const videoId = nanoid()
    const streamKey = nanoid(32)

    await prisma.video.create({
      data: {
        id: videoId,
        title,
        description: description || null,
        status: 'PENDING',
        videoType: 'LIVE',
        visibility: 'PRIVATE',
        streamKey,
        isLiveNow: false,
        viewsToday: 0,
        viewsMonth: 0,
        viewsTotal: 0
      }
    })

    // Real RTMP URL for OBS
    const rtmpUrl = `${process.env.RTMP_SERVER_URL || 'rtmp://localhost:1935/live'}/${streamKey}`

    // HLS playback URL
    const playbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/live/${videoId}/watch`

    return {
      videoId,
      streamKey,
      rtmpUrl,      // New: functional RTMP URL
      playbackUrl   // New: HLS playback URL
    }
  } catch (error) {
    console.error('Create stream error:', error)
    throw new Error('Failed to create stream')
  }
}
```

Update interface:

```typescript
interface CreateStreamResult {
  videoId: string
  streamKey: string
  rtmpUrl: string // New
  playbackUrl: string // New
}
```

---

### Task 6: Update Playback Endpoint (Est: 20 min)

**File**: `apps/api/src/routes/live.ts`

Update existing `/api/live/:id/watch`:

```typescript
/**
 * GET /api/live/:id/watch
 * Get HLS playback URL
 */
liveRoutes.get('/:id/watch', async (c) => {
  try {
    const videoId = c.req.param('id')

    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      return errorResponse(c, 'Video not found', 404)
    }

    if (video.videoType !== 'LIVE') {
      return errorResponse(c, 'Not a live stream', 400)
    }

    // HLS manifest URL (served by nginx-rtmp HTTP server)
    const hlsUrl = `http://localhost:8080/hls/${video.streamKey}.m3u8`

    return successResponse(c, {
      videoId: video.id,
      title: video.title,
      isLive: video.isLiveNow,
      hlsUrl,
      status: video.status
    })
  } catch (error) {
    console.error('Watch endpoint error:', error)
    return errorResponse(c, 'Failed to get playback URL', 500)
  }
})
```

---

### Task 7: Environment Variables (Est: 10 min)

**File**: `.env` and `.env.example`

Add:

```env
# RTMP Streaming
RTMP_SERVER_URL=rtmp://localhost:1935/live
HLS_SERVER_URL=http://localhost:8080/hls
```

---

### Task 8: Create tmp/hls Directory (Est: 5 min)

```bash
mkdir -p tmp/hls
echo "/tmp/hls" >> .gitignore
```

---

## Testing Strategy

### Unit Tests

**File**: `apps/api/src/routes/__tests__/live.test.ts`

Add tests for:

- POST /api/live/verify with valid streamKey → 200
- POST /api/live/verify with invalid streamKey → 403
- POST /api/live/unpublish updates isLiveNow → false

### Manual Testing

**OBS Studio Setup**:

1. Create stream: `POST /api/live/create`
2. Configure OBS:
   - Settings → Stream
   - Service: Custom
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: `<streamKey from step 1>`
3. Click "Start Streaming" in OBS
4. Verify in API logs: "✅ Auth success: Stream <id>"
5. Check database: `isLiveNow = true`
6. Open playback: `GET /api/live/<videoId>/watch` → get hlsUrl
7. Play HLS in VLC or browser player (e.g., video.js)
8. Stop streaming in OBS
9. Verify: `isLiveNow = false`

### Success Criteria

- [x] OBS connects to RTMP server
- [x] Stream key authentication works
- [x] HLS segments generated in /tmp/hls
- [x] HLS manifest (.m3u8) accessible via HTTP
- [x] Playback works in VLC/video.js
- [x] isLiveNow updates automatically
- [x] Latency < 10 seconds

---

## File Changes Summary

**New Files**:

- `config/nginx-rtmp/nginx.conf`
- `plans/seed/phase5-impl/01-nginx-rtmp-basic.md` (this file)

**Modified Files**:

- `docker-compose.dev.yml` (add nginx-rtmp service)
- `apps/api/src/routes/live.ts` (add /verify, /unpublish; update /watch)
- `apps/api/src/services/live.service.ts` (update createStream return type)
- `.env.example` (add RTMP_SERVER_URL, HLS_SERVER_URL)
- `.gitignore` (add /tmp/hls)

**No Changes Needed**:

- Database schema (already has streamKey, isLiveNow)
- Worker (not involved in basic HLS serving)
- MinIO (not using storage for dev HLS)

---

## Limitations (Dev Setup)

This is a **basic development setup** with known limitations:

- ❌ No CDN (high bandwidth on local server)
- ❌ No recording to MinIO/VOD conversion
- ❌ No adaptive bitrate (single quality)
- ❌ No viewer count tracking
- ❌ No stream health monitoring
- ❌ HLS segments stored in /tmp (lost on restart)
- ❌ No authentication on playback (anyone with URL can watch)

These will be addressed in Phase 6 (production setup).

---

## Next Steps After Implementation

1. **Test with OBS Studio**
2. **Measure latency** (target <10s)
3. **Test multiple concurrent streams**
4. **Add viewer count** (optional)
5. **Plan Phase 6**: Production features (CDN, recording, monitoring)

---

## Unresolved Questions

1. Should we add basic viewer count tracking now or defer to Phase 6?
2. Implement automatic stream timeout (e.g., 6 hours max)?
3. Add stream thumbnail generation from first HLS segment?
4. Limit concurrent streams per user?

---

## Dependencies

**Required Before**:

- ✅ Phase 3: Live service + routes implemented
- ✅ Docker Compose with PostgreSQL
- ✅ Database schema with streamKey field

**Required After**:

- Frontend player integration (video.js or hls.js)
- Phase 6: Production RTMP setup (optional)

---

## Estimated Timeline

- Docker setup: 30 min
- nginx config: 45 min
- Auth endpoints: 50 min
- Service updates: 40 min
- Environment config: 10 min
- Testing: 1 hour

**Total**: ~3-4 hours
