# Phase 3: Backend API (Hono)

**Date**: 2025-10-31 (Updated: 2025-11-01)
**Estimated Time**: 3-4 days
**Status**: ✅ Completed
**Dependencies**: Phase 2 (Database Layer), Phase 5 (Storage - can work in parallel)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 3)
**Implementation Plans**: `plans/seed/phase3-impl/` (9 granular plans)

## Overview

Build Hono API with 4 route modules: videos, upload, live, analytics. No authentication.

**Implementation Status**: All core functionality implemented including API foundation, services layer, routes, and integration testing framework.

## Tasks

### 1. Project Structure ✅

Created in `apps/api/src/`:

```
src/
├── index.ts              # Entry point ✅
├── app.ts                # Hono app setup ✅
├── middlewares/
│   ├── error.ts          # Error handler ✅
│   └── validation.ts     # Zod validation middleware ✅
├── routes/
│   ├── videos.ts         # CRUD + list ✅
│   ├── upload.ts         # Presigned URLs ✅
│   ├── live.ts           # Live streaming ✅ (Enhanced with RTMP)
│   └── analytics.ts      # View tracking ✅
├── services/
│   ├── video.service.ts     # ✅
│   ├── storage.service.ts   # MinIO (planned, using direct client)
│   ├── queue.service.ts     # RabbitMQ ✅
│   ├── cache.service.ts     # Redis (planned, using direct client)
│   ├── live.service.ts      # ✅ (Enhanced with RTMP ingest)
│   └── analytics.service.ts # ✅
├── utils/
│   ├── response.ts       # Response helpers ✅
│   └── errors.ts         # Custom error classes ✅
└── types/
    ├── index.ts          # API types ✅
    ├── queue.ts          # Queue job types ✅
    └── rpc.ts            # RPC types (Hono RPC) ✅
```

**Note**: CORS middleware uses built-in `hono/cors` instead of custom implementation. Validator schemas moved to inline route definitions and validation.ts middleware.

### 2. Update Dependencies ✅

**`apps/api/package.json`** (Implemented with additions):

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "@repo/database": "workspace:*",
    "@repo/constants": "workspace:*",  // Added
    "@repo/utils": "workspace:*",       // Added
    "ioredis": "^5.3.0",
    "amqplib": "^0.10.0",
    "minio": "^7.1.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.5",      // Added
    "@types/node": "^20.10.0"         // Added
  }
}
```

**Additional Features**: Implemented Hono RPC for type-safe client-server communication (see `apps/api/src/types/rpc.ts`).

### 3. Core Setup

**`src/app.ts`**:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { videoRoutes } from './routes/videos'
import { uploadRoutes } from './routes/upload'
import { liveRoutes } from './routes/live'
import { analyticsRoutes } from './routes/analytics'
import { errorHandler } from './middlewares/error'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.route('/api/videos', videoRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/live', liveRoutes)
app.route('/api/analytics', analyticsRoutes)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.onError(errorHandler)

export { app }
```

### 4. Implement Routes ✅

Reference detailed plan section 3 for full implementations.

**Implemented Routes**:

1. ✅ `videos.ts` - GET /list, GET /:id, PATCH /:id, DELETE /:id
2. ✅ `upload.ts` - POST /presign, POST /:id/complete
3. ✅ `analytics.ts` - POST /view/:id, GET /stats/:id
4. ✅ `live.ts` - Enhanced implementation with:
   - POST /create, POST /:id/start, POST /:id/stop
   - POST /verify (RTMP auth), POST /unpublish (RTMP cleanup)
   - GET /active, GET /:id, GET /:id/watch
   - PATCH /:id/visibility

**See**: `plans/seed/phase3-impl/05-videos-routes.md`, `06-upload-routes.md`, `07-analytics-routes.md`, `08-live-routes.md`

### 5. Implement Services ✅

**`services/video.service.ts`** ✅:
- Video CRUD operations with database integration
- Cache invalidation on updates

**`services/queue.service.ts`** (RabbitMQ) ✅:
- publishTranscodeJob()
- publishLiveStreamJob()
- Connection management with auto-reconnect

**`services/analytics.service.ts`** ✅:
- trackView() - increments view counters
- getStats() - retrieves video statistics
- Daily/monthly view tracking with Redis

**`services/live.service.ts`** ✅ (Enhanced):
- handleRTMPAuth() - authenticates RTMP publishers
- handleRTMPPublish() - manages stream publishing
- handleRTMPUnpublish() - cleanup on stream end
- startStream() - initiates live streaming
- stopStream() - stops active streams
- convertToVOD() - archives live streams

**Storage & Cache**: Direct client usage instead of service layer (MinIO client, Redis IORedis client used directly in routes/services).

**See**: `plans/seed/phase3-impl/02-storage-service.md`, `03-cache-service.md`, `04-queue-service.md`

### 6. Environment Variables

Add to `.env`:

```env
# API
PORT=3001

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password

# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password
```

### 7. Start Dependencies ✅

Updated `docker-compose.dev.yml` with all required services:

```yaml
services:
  postgres:    # ✅ Database
  redis:       # ✅ Cache
  rabbitmq:    # ✅ Message queue
  minio:       # ✅ Object storage
  nginx-rtmp:  # ✅ Added for live streaming RTMP ingest
```

**Enhancement**: Added nginx-rtmp service with custom configuration (`config/nginx-rtmp/nginx.conf`) for RTMP stream ingestion, integrated with API callbacks for authentication and stream lifecycle management.

Start services:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Status**: All services operational and tested.

### 8. Testing ✅

Testing infrastructure implemented:

**Test Framework**: Setup files created (`apps/api/tests/setup.ts`)

**Test Coverage**:
- ✅ Integration tests for all routes planned
- ✅ E2E workflow tests designed
- ⏸️ Full test suite implementation pending

**Manual Testing** (all routes tested and working):

```bash
# Health check
curl http://localhost:3001/health

# List videos
curl http://localhost:3001/api/videos/list

# Get presigned upload URL
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.mp4", "fileSize": 1000000, "contentType": "video/mp4"}'

# Create live stream
curl -X POST http://localhost:3001/api/live/create \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Stream", "description": "Testing live streaming"}'
```

**See**: `plans/seed/phase3-impl/09-integration-testing.md` for complete test plan.

## Verification

- ✅ All 4 routes accessible
- ✅ Can create videos
- ✅ Can upload files to MinIO
- ✅ Can queue transcode jobs
- ✅ Can track views
- ✅ Can create live streams
- ✅ Error handling works

## Success Criteria

- ✅ API responds on port 3001
- ✅ All dependencies connected (Postgres, Redis, RabbitMQ, MinIO)
- ✅ CRUD operations work
- ✅ Upload flow complete
- ✅ Analytics tracking works
- ✅ No compilation errors

## Implementation Notes

### Completed
- ✅ All 4 route modules implemented and tested
- ✅ Enhanced live streaming with RTMP ingest via nginx-rtmp
- ✅ Hono RPC integration for type-safe client-server communication
- ✅ Custom error handling with error classes
- ✅ Zod validation middleware
- ✅ Response helpers for consistent API responses
- ✅ Queue service with auto-reconnect logic
- ✅ Redis caching for video lists and stats
- ✅ MinIO integration for file storage

### Architectural Decisions
- Used built-in `hono/cors` instead of custom CORS middleware
- Direct MinIO/Redis client usage in routes instead of service abstraction layer
- Inline Zod schemas in routes with validation middleware
- Enhanced live streaming beyond original plan with RTMP support
- Added Hono RPC types for frontend integration

### Deviations from Original Plan
1. **Live Routes**: Significantly enhanced with RTMP support, nginx-rtmp integration
2. **Service Layer**: Simplified - direct client usage for storage/cache instead of full service classes
3. **Type System**: Added RPC types for type-safe API consumption
4. **Error Handling**: Custom error classes in `utils/errors.ts` instead of generic error middleware

### Technical Debt / Future Work
- ⏸️ Complete comprehensive test suite (integration + E2E tests designed, not fully implemented)
- ⏸️ Add rate limiting middleware
- ⏸️ Implement request/response logging beyond basic Hono logger
- ⏸️ Add OpenAPI/Swagger documentation
- ⏸️ Implement graceful shutdown for services

**Reference**:
- Detailed implementation plans: `plans/seed/phase3-impl/` (9 granular plans)
- Keep files < 500 lines ✅
- Use Zod for validation ✅
- Handle all errors properly ✅
- Test with real services (no mocks) ✅
