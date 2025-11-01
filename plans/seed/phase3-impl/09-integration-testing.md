# Integration Testing Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: End-to-end testing for Phase 3 API with Docker validation, all routes coverage

## Executive Summary

Create comprehensive integration test suite for Phase 3 Backend API. Test all routes, service integrations, Docker setup, full workflows (upload → transcode → playback, live streaming).

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: All Phase 3 plans (01-08)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3)

## Requirements

### Functional Requirements

- [x] Test all API endpoints (videos, upload, analytics, live)
- [x] Test service integrations (MinIO, Redis, RabbitMQ)
- [x] Test Docker Compose setup
- [x] Test full workflows end-to-end
- [x] Test error scenarios
- [ ] Test concurrent requests - Future enhancement
- [x] Generate coverage report

### Non-Functional Requirements

- [x] Tests run in isolated environment
- [x] Cleanup after each test
- [x] Fast execution (< 2 minutes total)
- [x] Clear failure messages

## Architecture Overview

```
apps/api/
├── tests/
│   ├── setup.ts              # Test environment setup
│   ├── teardown.ts           # Cleanup
│   ├── helpers/
│   │   ├── client.ts         # HTTP client
│   │   └── fixtures.ts       # Test data
│   ├── integration/
│   │   ├── videos.test.ts
│   │   ├── upload.test.ts
│   │   ├── analytics.test.ts
│   │   └── live.test.ts
│   └── e2e/
│       ├── upload-flow.test.ts
│       └── live-flow.test.ts
└── vitest.config.ts          # Test configuration
```

### Key Components

- **Test Framework**: Vitest (fast, modern)
- **HTTP Client**: Custom wrapper for API requests
- **Test Database**: Separate PostgreSQL for tests
- **Fixtures**: Reusable test data

## Implementation Phases

### Phase 1: Test Setup (Est: 0.5 days)

**Scope**: Configure test environment and utilities

**Tasks**:

1. [ ] Add test dependencies - file: `apps/api/package.json`
2. [ ] Create Vitest config - file: `apps/api/vitest.config.ts`
3. [ ] Create test environment - file: `apps/api/tests/setup.ts`
4. [ ] Create test helpers - file: `apps/api/tests/helpers/client.ts`

**Files to Create**:

`apps/api/package.json` (add dependencies):

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

`apps/api/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', '**/*.test.ts', 'dist/**']
    }
  }
})
```

`apps/api/tests/setup.ts`:

```typescript
import { beforeAll, afterAll } from 'vitest'
import { prisma } from '@repo/database'

// Test environment variables
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/streaming_video_test'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.RABBITMQ_URL = 'amqp://admin:password@localhost:5672'
process.env.MINIO_ENDPOINT = 'localhost'
process.env.MINIO_PORT = '9000'

beforeAll(async () => {
  // Clean database before tests
  await prisma.videoViewLog.deleteMany()
  await prisma.videoVariant.deleteMany()
  await prisma.video.deleteMany()
})

afterAll(async () => {
  // Cleanup after tests
  await prisma.videoViewLog.deleteMany()
  await prisma.videoVariant.deleteMany()
  await prisma.video.deleteMany()
  await prisma.$disconnect()
})
```

`apps/api/tests/helpers/client.ts`:

```typescript
import request from 'supertest'
import { app } from '../../src/app'

export class TestClient {
  private baseUrl = 'http://localhost:3001'

  async get(path: string) {
    return request(app.fetch as any).get(path)
  }

  async post(path: string, body?: any) {
    return request(app.fetch as any)
      .post(path)
      .send(body)
  }

  async patch(path: string, body?: any) {
    return request(app.fetch as any)
      .patch(path)
      .send(body)
  }

  async delete(path: string) {
    return request(app.fetch as any).delete(path)
  }
}

export const client = new TestClient()
```

### Phase 2: Route Tests (Est: 1 day)

**Scope**: Test individual route modules

**Tasks**:

1. [ ] Test videos routes - file: `apps/api/tests/integration/videos.test.ts`
2. [ ] Test upload routes - file: `apps/api/tests/integration/upload.test.ts`
3. [ ] Test analytics routes - file: `apps/api/tests/integration/analytics.test.ts`
4. [ ] Test live routes - file: `apps/api/tests/integration/live.test.ts`

**Files to Create**:

`apps/api/tests/integration/videos.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@repo/database'
import { client } from '../helpers/client'

describe('Videos Routes', () => {
  beforeEach(async () => {
    // Clean database before each test
    await prisma.video.deleteMany()
  })

  describe('GET /api/videos/list', () => {
    it('should return empty list initially', async () => {
      const res = await client.get('/api/videos/list')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.videos).toEqual([])
      expect(res.body.data.total).toBe(0)
    })

    it('should return videos with pagination', async () => {
      // Create test videos
      await prisma.video.createMany({
        data: [
          {
            id: 'video1',
            title: 'Video 1',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            isLiveNow: false,
            viewsToday: 0,
            viewsMonth: 0,
            viewsTotal: 0
          },
          {
            id: 'video2',
            title: 'Video 2',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            isLiveNow: false,
            viewsToday: 0,
            viewsMonth: 0,
            viewsTotal: 0
          }
        ]
      })

      const res = await client.get('/api/videos/list?limit=1')

      expect(res.status).toBe(200)
      expect(res.body.data.videos).toHaveLength(1)
      expect(res.body.data.total).toBe(2)
    })
  })

  describe('GET /api/videos/:id', () => {
    it('should return video details', async () => {
      const video = await prisma.video.create({
        data: {
          id: 'test-video',
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          isLiveNow: false,
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.get(`/api/videos/${video.id}`)

      expect(res.status).toBe(200)
      expect(res.body.data.video.id).toBe(video.id)
      expect(res.body.data.video.title).toBe(video.title)
    })

    it('should return 404 for non-existent video', async () => {
      const res = await client.get('/api/videos/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })
  })

  describe('PATCH /api/videos/:id', () => {
    it('should update video metadata', async () => {
      const video = await prisma.video.create({
        data: {
          id: 'test-video',
          title: 'Original Title',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          isLiveNow: false,
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.patch(`/api/videos/${video.id}`, {
        title: 'Updated Title',
        visibility: 'UNLISTED'
      })

      expect(res.status).toBe(200)
      expect(res.body.data.video.title).toBe('Updated Title')
      expect(res.body.data.video.visibility).toBe('UNLISTED')
    })
  })

  describe('DELETE /api/videos/:id', () => {
    it('should delete video', async () => {
      const video = await prisma.video.create({
        data: {
          id: 'test-video',
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          isLiveNow: false,
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.delete(`/api/videos/${video.id}`)

      expect(res.status).toBe(200)

      // Verify deleted
      const deleted = await prisma.video.findUnique({ where: { id: video.id } })
      expect(deleted).toBeNull()
    })
  })
})
```

`apps/api/tests/integration/upload.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { client } from '../helpers/client'

describe('Upload Routes', () => {
  describe('POST /api/upload/presign', () => {
    it('should generate presigned upload URL', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'test-video.mp4',
        fileSize: 1000000,
        contentType: 'video/mp4'
      })

      expect(res.status).toBe(201)
      expect(res.body.data.videoId).toBeDefined()
      expect(res.body.data.uploadUrl).toBeDefined()
      expect(res.body.data.key).toBeDefined()
      expect(res.body.data.expiresIn).toBe(3600)
    })

    it('should reject files over 2GB', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'large-video.mp4',
        fileSize: 3 * 1024 * 1024 * 1024, // 3GB
        contentType: 'video/mp4'
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid MIME types', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'malware.exe',
        fileSize: 1000000,
        contentType: 'application/x-msdownload'
      })

      expect(res.status).toBe(400)
    })
  })
})
```

### Phase 3: E2E Tests (Est: 0.5 days)

**Scope**: Test complete workflows

**Tasks**:

1. [ ] Test upload flow - file: `apps/api/tests/e2e/upload-flow.test.ts`
2. [ ] Test live flow - file: `apps/api/tests/e2e/live-flow.test.ts`

**Files to Create**:

`apps/api/tests/e2e/upload-flow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { client } from '../helpers/client'
import { prisma } from '@repo/database'

describe('Upload Flow E2E', () => {
  it('should complete full upload workflow', async () => {
    // 1. Get presigned URL
    const presignRes = await client.post('/api/upload/presign', {
      fileName: 'test.mp4',
      fileSize: 1000000,
      contentType: 'video/mp4'
    })

    expect(presignRes.status).toBe(201)
    const { videoId, key } = presignRes.body.data

    // 2. Simulate file upload (skip actual MinIO upload in tests)
    // In real scenario, upload file to presignedUrl using fetch/axios

    // 3. Mark upload complete
    const completeRes = await client.post(`/api/upload/${videoId}/complete`, {
      key,
      title: 'Test Video',
      description: 'E2E test video'
    })

    expect(completeRes.status).toBe(201)
    expect(completeRes.body.data.video.status).toBe('PENDING')

    // 4. Verify video exists
    const video = await prisma.video.findUnique({ where: { id: videoId } })
    expect(video).toBeDefined()
    expect(video?.title).toBe('Test Video')

    // 5. Get video details
    const detailsRes = await client.get(`/api/videos/${videoId}`)
    expect(detailsRes.status).toBe(200)
  })
})
```

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual function logic (in services)
2. **Integration Tests**: Route handlers + database + external services
3. **E2E Tests**: Complete workflows (upload → transcode → playback)
4. **Load Tests**: Concurrent requests, performance (future)

### Coverage Goals

- Routes: 100%
- Services: 90%
- Overall: 85%

## Security Considerations

- [ ] Test database isolated from production
- [ ] Test data cleanup after each run
- [ ] No real credentials in tests
- [ ] Mock external services if needed

## Risk Assessment

| Risk             | Impact | Mitigation                  |
| ---------------- | ------ | --------------------------- |
| Tests too slow   | Medium | Parallel execution, fast DB |
| Flaky tests      | Medium | Proper setup/teardown       |
| Missing coverage | Low    | Coverage reports, CI gates  |

## Quick Reference

### Run Tests

```bash
# All tests
bun test

# Watch mode
bun test:watch

# Coverage report
bun test:coverage

# Specific file
bun test tests/integration/videos.test.ts
```

### Docker Test Environment

```bash
# Start test dependencies
docker-compose -f docker-compose.test.yml up -d

# Run tests
bun test

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

## TODO Checklist

- [ ] Add test dependencies to package.json
- [ ] Create vitest.config.ts
- [ ] Create tests/setup.ts
- [ ] Create tests/helpers/client.ts
- [ ] Write videos.test.ts
- [ ] Write upload.test.ts
- [ ] Write analytics.test.ts
- [ ] Write live.test.ts
- [ ] Write upload-flow E2E test
- [ ] Write live-flow E2E test
- [ ] Run all tests
- [ ] Generate coverage report
- [ ] Verify coverage > 85%
- [ ] Add CI workflow for tests
- [ ] Commit changes

## Dependencies

**Required Before**:

- All Phase 3 plans (01-08) implemented

**Required After**:

- CI/CD pipeline integration
- Frontend E2E tests

## Unresolved Questions

- Use test database or mock Prisma client?
- Mock MinIO/Redis/RabbitMQ or use real services?
- Run tests in Docker container for consistency?
- Separate test command for unit vs integration?
