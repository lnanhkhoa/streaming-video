# Phase 3: Backend API (Hono)

**Date**: 2025-10-31
**Estimated Time**: 3-4 days
**Dependencies**: Phase 2 (Database Layer), Phase 5 (Storage - can work in parallel)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 3)

## Overview

Build Hono API with 4 route modules: videos, upload, live, analytics. No authentication.

## Tasks

### 1. Project Structure

Create in `apps/api/src/`:

```
src/
├── index.ts              # Entry point
├── app.ts                # Hono app setup
├── middlewares/
│   ├── cors.ts
│   └── error.ts
├── routes/
│   ├── videos.ts         # CRUD + list
│   ├── upload.ts         # Presigned URLs
│   ├── live.ts           # Live streaming
│   └── analytics.ts      # View tracking
├── services/
│   ├── video.service.ts
│   ├── storage.service.ts
│   ├── queue.service.ts
│   ├── cache.service.ts
│   ├── live.service.ts
│   └── analytics.service.ts
├── utils/
│   ├── validator.ts      # Zod schemas
│   └── helpers.ts
└── types/
    └── index.ts
```

### 2. Update Dependencies

**`apps/api/package.json`**:

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "@repo/database": "workspace:*",
    "@repo/types": "workspace:*",
    "ioredis": "^5.3.0",
    "amqplib": "^0.10.0",
    "minio": "^7.1.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0"
  }
}
```

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

### 4. Implement Routes

Reference detailed plan section 3 for full implementations:

**Priority Order**:

1. `videos.ts` - GET /list, GET /:id, DELETE /:id
2. `upload.ts` - POST /presign, POST /:id/complete
3. `analytics.ts` - POST /view/:id, GET /stats/:id
4. `live.ts` - POST /create, POST /:id/start, POST /:id/stop, POST /:id/signal

### 5. Implement Services

**`services/storage.service.ts`** (MinIO):

- getPresignedUploadUrl()
- getPresignedDownloadUrl()
- fileExists()
- uploadFile()
- downloadFile()

**`services/queue.service.ts`** (RabbitMQ):

- publishTranscodeJob()

**`services/cache.service.ts`** (Redis):

- get(), set(), del(), exists()

**`services/analytics.service.ts`**:

- trackView()
- resetDailyViews()
- resetMonthlyViews()

**`services/live.service.ts`**:

- handleWebRTCSignal()
- startRTMPIngest() (optional)
- stopStream()
- convertToVOD()

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

### 7. Start Dependencies

Update `docker-compose.dev.yml`:

```yaml
services:
  postgres:
    # ... existing

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass password
    ports:
      - '6379:6379'

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password
    ports:
      - '5672:5672'
      - '15672:15672'

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password
    ports:
      - '9000:9000'
      - '9001:9001'
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

Start services:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 8. Testing

Test each route with curl or Postman:

```bash
# Health check
curl http://localhost:3001/health

# List videos
curl http://localhost:3001/api/videos/list

# Get presigned upload URL
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.mp4", "fileSize": 1000000, "contentType": "video/mp4"}'
```

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

## Notes

- Reference detailed plan section 3 for complete code
- Keep files < 500 lines
- Use Zod for validation
- Handle all errors properly
- Test with real services (no mocks)
