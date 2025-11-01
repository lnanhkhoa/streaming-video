# Live Streaming Routes Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed (MVP - Metadata Only)
**Context Tokens**: Implement live streaming lifecycle management (create/start/stop) without WebRTC

## Executive Summary

**Phase 3 MVP Implementation**: Simplified live streaming routes managing stream lifecycle and metadata only (no actual WebRTC/RTMP streaming). Defers complex streaming infrastructure to Phase 5 following YAGNI principle.

**Implemented**: Stream creation, start/stop lifecycle, active streams list, visibility management, placeholder RTMP URLs.

**Future**: Full RTMP/WebRTC implementation documented in `08-live-routes-rtmp-future.md`.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 3.1-3.4 (Core, Storage, Cache, Queue), Phase 2 (Database)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3.8)

## Requirements

### Functional Requirements

- [ ] POST /api/live/create - Create live stream session
- [ ] POST /api/live/:id/start - Start streaming
- [ ] POST /api/live/:id/stop - Stop streaming
- [ ] POST /api/live/:id/signal - WebRTC signaling
- [ ] Generate unique stream keys
- [ ] Update isLiveNow status
- [ ] Optional: Convert to VOD on stop

### Non-Functional Requirements

- [ ] Low-latency signaling (< 500ms)
- [ ] Support WebRTC peer connections
- [ ] Handle concurrent streams
- [ ] Graceful stream termination

## Architecture Overview

```
apps/api/src/
├── routes/
│   └── live.ts
└── services/
    └── live.service.ts
```

### Key Components

- **Live Routes**: Stream lifecycle, WebRTC signaling
- **Live Service**: Business logic, stream management
- **WebRTC**: Peer-to-peer signaling (offer/answer/ICE)
- **Stream Storage**: Recording to MinIO (optional)

### Data Flow

```
POST /create
     ↓
Generate streamKey
     ↓
Create Video (type: LIVE, status: PENDING)
     ↓
Return { videoId, streamKey, webrtcUrl }

POST /start
     ↓
Update status: LIVE, isLiveNow: true
     ↓
Return success

POST /signal
     ↓
Handle WebRTC signaling (offer/answer/ICE candidates)
     ↓
Forward to peer
     ↓
Return signaling response

POST /stop
     ↓
Update status: READY, isLiveNow: false
     ↓
Optional: Trigger VOD conversion
     ↓
Return success
```

## Implementation Phases

### Phase 1: Live Service (Est: 1 day)

**Scope**: Create live streaming service layer

**Tasks**:

1. [ ] Create live service - file: `apps/api/src/services/live.service.ts`
2. [ ] Implement createStream
3. [ ] Implement startStream
4. [ ] Implement stopStream
5. [ ] Implement WebRTC signaling

**Files to Create**:

`apps/api/src/services/live.service.ts`:

```typescript
import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { queueService } from './queue.service'

interface CreateStreamResult {
  videoId: string
  streamKey: string
  webrtcUrl: string
}

interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate'
  data: any
}

class LiveService {
  // Store active WebRTC connections in-memory
  // TODO: Use Redis for multi-instance deployments
  private activeConnections = new Map<string, any>()

  /**
   * Create new live stream session
   */
  async createStream(title: string, description?: string): Promise<CreateStreamResult> {
    try {
      const videoId = nanoid()
      const streamKey = nanoid(32) // Long secret key

      // Create video record
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

      // WebRTC URL (for browser-based streaming)
      const webrtcUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/live/${videoId}/signal`

      return {
        videoId,
        streamKey,
        webrtcUrl
      }
    } catch (error) {
      console.error('Create stream error:', error)
      throw new Error('Failed to create stream')
    }
  }

  /**
   * Start live streaming
   */
  async startStream(videoId: string, streamKey: string): Promise<void> {
    try {
      // Verify stream key
      const video = await prisma.video.findUnique({
        where: { id: videoId }
      })

      if (!video) {
        throw new Error('Video not found')
      }

      if (video.streamKey !== streamKey) {
        throw new Error('Invalid stream key')
      }

      // Update status
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'LIVE',
          isLiveNow: true
        }
      })

      console.log(`✅ Stream started: ${videoId}`)
    } catch (error) {
      console.error('Start stream error:', error)
      throw error
    }
  }

  /**
   * Stop live streaming
   */
  async stopStream(videoId: string, convertToVOD: boolean = false): Promise<void> {
    try {
      // Update status
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: convertToVOD ? 'PENDING' : 'READY',
          isLiveNow: false
        }
      })

      // Clean up WebRTC connection
      this.activeConnections.delete(videoId)

      // Optional: Convert to VOD
      if (convertToVOD) {
        // TODO: Implement recording to MinIO during stream
        // Then trigger transcode job for recorded file
        console.log(`📼 Converting stream ${videoId} to VOD`)
        // await queueService.publishTranscodeJob({
        //   videoId,
        //   originalKey: `${videoId}/live-recording.mp4`
        // })
      }

      console.log(`✅ Stream stopped: ${videoId}`)
    } catch (error) {
      console.error('Stop stream error:', error)
      throw error
    }
  }

  /**
   * Handle WebRTC signaling
   */
  async handleWebRTCSignal(videoId: string, signal: WebRTCSignal): Promise<any> {
    try {
      const { type, data } = signal

      switch (type) {
        case 'offer':
          // Store offer and create answer
          this.activeConnections.set(videoId, { offer: data })
          console.log(`📡 Received WebRTC offer for ${videoId}`)

          // TODO: Create peer connection and generate answer
          // This is simplified - actual implementation needs full WebRTC stack
          return {
            type: 'answer',
            data: { sdp: 'mock-answer-sdp', type: 'answer' }
          }

        case 'answer':
          // Store answer
          const conn = this.activeConnections.get(videoId)
          if (conn) {
            conn.answer = data
          }
          console.log(`📡 Received WebRTC answer for ${videoId}`)
          return { success: true }

        case 'ice-candidate':
          // Add ICE candidate
          console.log(`📡 Received ICE candidate for ${videoId}`)
          return { success: true }

        default:
          throw new Error('Invalid signal type')
      }
    } catch (error) {
      console.error('WebRTC signal error:', error)
      throw error
    }
  }

  /**
   * Get active streams
   */
  async getActiveStreams(): Promise<any[]> {
    return prisma.video.findMany({
      where: {
        isLiveNow: true,
        videoType: 'LIVE'
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }
}

export const liveService = new LiveService()
```

### Phase 2: Live Routes (Est: 0.5 days)

**Scope**: Create HTTP route handlers

**Tasks**:

1. [ ] Create routes file - file: `apps/api/src/routes/live.ts`
2. [ ] Implement POST /create
3. [ ] Implement POST /:id/start
4. [ ] Implement POST /:id/stop
5. [ ] Implement POST /:id/signal
6. [ ] Wire up to app.ts

**Files to Create**:

`apps/api/src/routes/live.ts`:

```typescript
import { Hono } from 'hono'
import { liveService } from '../services/live.service'
import { successResponse, errorResponse } from '../utils/response'
import { createLiveStreamSchema } from '../utils/validator'

const liveRoutes = new Hono()

/**
 * POST /api/live/create
 * Create new live stream session
 */
liveRoutes.post('/create', async (c) => {
  try {
    const body = await c.req.json()

    // Validate input
    const validated = createLiveStreamSchema.parse(body)
    const { title, description } = validated

    const result = await liveService.createStream(title, description)

    return successResponse(c, result, 201)
  } catch (error: any) {
    console.error('Create live stream error:', error)

    if (error.name === 'ZodError') {
      return errorResponse(c, 'Invalid input', 400)
    }

    return errorResponse(c, 'Failed to create stream', 500)
  }
})

/**
 * POST /api/live/:id/start
 * Start live streaming
 */
liveRoutes.post('/:id/start', async (c) => {
  try {
    const videoId = c.req.param('id')
    const body = await c.req.json()
    const { streamKey } = body

    if (!streamKey) {
      return errorResponse(c, 'Missing stream key', 400)
    }

    await liveService.startStream(videoId, streamKey)

    return successResponse(c, { message: 'Stream started successfully' })
  } catch (error: any) {
    console.error('Start stream error:', error)

    if (error.message === 'Invalid stream key') {
      return errorResponse(c, 'Invalid stream key', 401)
    }

    if (error.message === 'Video not found') {
      return errorResponse(c, 'Video not found', 404)
    }

    return errorResponse(c, 'Failed to start stream', 500)
  }
})

/**
 * POST /api/live/:id/stop
 * Stop live streaming
 */
liveRoutes.post('/:id/stop', async (c) => {
  try {
    const videoId = c.req.param('id')
    const body = await c.req.json()
    const { convertToVOD } = body

    await liveService.stopStream(videoId, convertToVOD || false)

    return successResponse(c, { message: 'Stream stopped successfully' })
  } catch (error) {
    console.error('Stop stream error:', error)
    return errorResponse(c, 'Failed to stop stream', 500)
  }
})

/**
 * POST /api/live/:id/signal
 * WebRTC signaling endpoint
 */
liveRoutes.post('/:id/signal', async (c) => {
  try {
    const videoId = c.req.param('id')
    const signal = await c.req.json()

    const response = await liveService.handleWebRTCSignal(videoId, signal)

    return successResponse(c, response)
  } catch (error: any) {
    console.error('WebRTC signal error:', error)
    return errorResponse(c, error.message || 'Failed to process signal', 500)
  }
})

/**
 * GET /api/live/active
 * Get all active live streams
 */
liveRoutes.get('/active', async (c) => {
  try {
    const streams = await liveService.getActiveStreams()
    return successResponse(c, { streams })
  } catch (error) {
    console.error('Get active streams error:', error)
    return errorResponse(c, 'Failed to get active streams', 500)
  }
})

export { liveRoutes }
```

Update `apps/api/src/app.ts`:

```typescript
import { liveRoutes } from './routes/live'

// Add after other routes
app.route('/api/live', liveRoutes)
```

## Testing Strategy

- **Unit Tests**:
  - createStream generates unique keys
  - startStream validates stream key
  - stopStream updates status
  - WebRTC signaling handles offer/answer
- **Integration Tests**:
  - Create stream flow
  - Start/stop stream lifecycle
  - WebRTC signaling exchange
  - Active streams list
  - VOD conversion trigger

## Security Considerations

- [ ] Stream keys are 32-char random (unguessable)
- [ ] Validate stream key on start
- [ ] Rate limit stream creation (prevent abuse)
- [ ] Authenticate signaling requests
- [ ] CORS configured for WebRTC

## Risk Assessment

| Risk               | Impact | Mitigation                           |
| ------------------ | ------ | ------------------------------------ |
| WebRTC complexity  | High   | Start with simple signaling, iterate |
| Concurrent streams | Medium | Test load, implement limits          |
| Recording failure  | Medium | Fallback to no-VOD conversion        |
| Connection state   | Medium | Use Redis for multi-instance sync    |

## Quick Reference

### API Endpoints

```bash
# Create live stream
POST /api/live/create
Body: {
  "title": "My Live Stream",
  "description": "Optional description"
}
Response: {
  "videoId": "abc123",
  "streamKey": "secret-32-char-key",
  "webrtcUrl": "http://localhost:3001/api/live/abc123/signal"
}

# Start stream
POST /api/live/:id/start
Body: { "streamKey": "secret-32-char-key" }

# Stop stream
POST /api/live/:id/stop
Body: { "convertToVOD": true }

# WebRTC signaling
POST /api/live/:id/signal
Body: {
  "type": "offer",
  "data": { "sdp": "...", "type": "offer" }
}

# Get active streams
GET /api/live/active
```

### WebRTC Flow (Client)

```javascript
// 1. Create stream
const { videoId, streamKey, webrtcUrl } = await createStream()

// 2. Create peer connection
const pc = new RTCPeerConnection()

// 3. Add media stream
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
stream.getTracks().forEach((track) => pc.addTrack(track, stream))

// 4. Create offer
const offer = await pc.createOffer()
await pc.setLocalDescription(offer)

// 5. Send offer to server
await fetch(webrtcUrl, {
  method: 'POST',
  body: JSON.stringify({ type: 'offer', data: offer })
})

// 6. Start stream
await fetch(`/api/live/${videoId}/start`, {
  method: 'POST',
  body: JSON.stringify({ streamKey })
})
```

## TODO Checklist

- [ ] Create live.service.ts
- [ ] Create routes/live.ts
- [ ] Wire up routes in app.ts
- [ ] Test create stream
- [ ] Test start stream (with valid/invalid key)
- [ ] Test stop stream
- [ ] Test WebRTC signaling
- [ ] Test active streams list
- [ ] Add CORS for WebRTC
- [ ] Document WebRTC client integration
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 3.1: API Core Setup
- Phase 3.2: Storage Service (for VOD recording)
- Phase 3.4: Queue Service (for VOD conversion)
- Phase 2: Database schema with Video model

**Required After**:

- Frontend WebRTC client
- Optional: RTMP server (OBS integration)
- Recording/VOD conversion worker

## Unresolved Questions

- Full WebRTC server implementation or use library (mediasoup, ion-sfu)?
- Support RTMP ingest for OBS/broadcast software?
- Record live streams automatically?
- Multi-bitrate live streaming (HLS/DASH)?
- Viewer count tracking for live streams?
