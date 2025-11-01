# API Core Setup Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: Setup Hono app with core middlewares, type system, routing structure

## Executive Summary

Establish Hono API foundation with CORS, error handling, logging, health check, and modular route structure. Sets up base for all Phase 3 routes.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 1 (Monorepo packages - @repo/database, @repo/constants, @repo/utils)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3)

## Requirements

### Functional Requirements

- [x] Hono app initialization
- [x] CORS middleware configured
- [x] Logging middleware active
- [x] Global error handler
- [x] Health check endpoint
- [x] Type definitions for API responses
- [x] Route module structure

### Non-Functional Requirements

- [x] Fast cold starts
- [x] Type-safe route handlers
- [x] Consistent error responses
- [x] Modular architecture

## Architecture Overview

```
apps/api/src/
├── index.ts              # Entry point
├── app.ts                # Hono app setup
├── middlewares/
│   ├── cors.ts           # CORS configuration
│   └── error.ts          # Error handler
├── routes/
│   └── (placeholder)
├── services/
│   └── (placeholder)
├── utils/
│   ├── validator.ts      # Zod schemas
│   └── response.ts       # Response helpers
└── types/
    └── index.ts          # API types
```

### Key Components

- **Hono App**: Core application with middleware chain
- **Error Handler**: Catches all errors, returns JSON
- **Response Helpers**: successResponse, errorResponse
- **Validator**: Zod schemas for request validation

## Implementation Phases

### Phase 1: Core Setup (Est: 0.5 days)

**Scope**: Create Hono app with basic middleware

**Tasks**:

1. [x] Update package.json dependencies - file: `apps/api/package.json`
2. [x] Create app.ts with middleware - file: `apps/api/src/app.ts`
3. [x] Create index.ts entry point - file: `apps/api/src/index.ts`
4. [x] Create CORS middleware - file: `apps/api/src/middlewares/cors.ts`
5. [x] Create error middleware - file: `apps/api/src/middlewares/error.ts`

**Acceptance Criteria**:

- [x] Server starts on port 3001
- [x] Health endpoint returns 200
- [x] CORS headers present
- [x] Errors return JSON format

**Files to Create**:

`apps/api/package.json`:

```json
{
  "name": "api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "@repo/database": "workspace:*",
    "@repo/constants": "workspace:*",
    "@repo/utils": "workspace:*",
    "ioredis": "^5.3.0",
    "amqplib": "^0.10.0",
    "minio": "^7.1.0",
    "zod": "^3.22.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.5",
    "@types/node": "^20.10.0"
  }
}
```

`apps/api/src/index.ts`:

```typescript
import { serve } from '@hono/node-server'
import { app } from './app'

const port = Number(process.env.PORT) || 3001

console.log(`🚀 API server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
```

`apps/api/src/app.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes will be added here

// Error handler (must be last)
app.onError(errorHandler)

export { app }
```

`apps/api/src/middlewares/cors.ts`:

```typescript
import type { MiddlewareHandler } from 'hono'

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  await next()
}
```

`apps/api/src/middlewares/error.ts`:

```typescript
import type { ErrorHandler } from 'hono'

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('API Error:', err)

  const status = err.status || 500
  const message = err.message || 'Internal Server Error'

  return c.json(
    {
      success: false,
      error: {
        message,
        status
      }
    },
    status
  )
}
```

### Phase 2: Types & Utilities (Est: 0.5 days)

**Scope**: Define API types and response helpers

**Tasks**:

1. [x] Create API types - file: `apps/api/src/types/index.ts`
2. [x] Create response helpers - file: `apps/api/src/utils/response.ts`
3. [x] Create Zod validators - file: `apps/api/src/utils/validator.ts`

**Acceptance Criteria**:

- [x] All response types defined
- [x] Helper functions typed
- [x] Zod schemas export correctly

**Files to Create**:

`apps/api/src/types/index.ts`:

```typescript
import type { Video, VideoVariant } from '@repo/constants'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    status: number
  }
}

export interface VideoListResponse {
  videos: Video[]
  total: number
}

export interface VideoDetailResponse {
  video: Video
  variants: VideoVariant[]
}

export type { Video, VideoVariant }
```

`apps/api/src/utils/response.ts`:

```typescript
import type { Context } from 'hono'
import type { ApiResponse } from '../types'

export function successResponse<T>(c: Context, data: T, status = 200) {
  return c.json<ApiResponse<T>>(
    {
      success: true,
      data
    },
    status
  )
}

export function errorResponse(c: Context, message: string, status = 400) {
  return c.json<ApiResponse>(
    {
      success: false,
      error: {
        message,
        status
      }
    },
    status
  )
}
```

`apps/api/src/utils/validator.ts`:

```typescript
import { z } from 'zod'

// Upload validation
export const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z
    .number()
    .positive()
    .max(2 * 1024 * 1024 * 1024), // 2GB
  contentType: z.enum(['video/mp4', 'video/webm', 'video/ogg'])
})

// Live stream validation
export const createLiveStreamSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional()
})

// Video update validation
export const updateVideoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional()
})

export type PresignUploadInput = z.infer<typeof presignUploadSchema>
export type CreateLiveStreamInput = z.infer<typeof createLiveStreamSchema>
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>
```

## Testing Strategy

- **Unit Tests**: Response helpers return correct format
- **Integration Tests**:
  - Health endpoint returns 200
  - CORS headers present
  - Errors return JSON with correct status
  - Invalid requests rejected with 400

## Security Considerations

- [x] CORS configured for all origins (restrict in production)
- [x] Error messages don't leak sensitive info
- [x] Request validation prevents injection
- [ ] Rate limiting (future)

## Risk Assessment

| Risk          | Impact | Mitigation                          |
| ------------- | ------ | ----------------------------------- |
| Port conflict | High   | Check PORT env var, allow override  |
| CORS issues   | Medium | Test with frontend early            |
| Error leaks   | Medium | Filter error messages in production |

## Quick Reference

### Key Commands

```bash
# Install dependencies
cd apps/api
bun install

# Start dev server
bun run dev

# Test health endpoint
curl http://localhost:3001/health
```

### Environment Variables

```env
PORT=3001
NODE_ENV=development
```

## TODO Checklist

- [x] Update apps/api/package.json with dependencies
- [x] Create src/index.ts
- [x] Create src/app.ts
- [x] Create src/middlewares/error.ts
- [x] Create src/types/index.ts
- [x] Create src/utils/response.ts
- [x] Create src/utils/validator.ts
- [x] Test server starts
- [x] Test health endpoint
- [x] Test CORS headers
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 1: Monorepo packages (@repo/database, @repo/constants, @repo/utils)

**Required After**:

- All subsequent route implementations depend on this
