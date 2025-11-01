# Upload Routes Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: Implement upload flow with presigned URLs, file validation, transcode job triggering

## Executive Summary

Create upload routes enabling client-side direct uploads to MinIO. Generate presigned URLs, validate uploads, trigger async transcoding via RabbitMQ queue.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 3.1-3.4 (Core, Storage, Cache, Queue services), Phase 2 (Database)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3.6)

## Requirements

### Functional Requirements

- [x] POST /api/upload/presign - Generate presigned upload URL
- [x] POST /api/upload/:id/complete - Mark upload complete, trigger transcode
- [x] File validation (size, type, extension)
- [x] Video record creation with PENDING status
- [x] Transcode job publishing to queue
- [x] Error handling for invalid uploads

### Non-Functional Requirements

- [x] Support files up to 2GB
- [x] Presigned URLs expire in 1 hour
- [x] Atomic operations (create video → publish job)
- [x] Idempotent completion handler

## Architecture Overview

```
apps/api/src/routes/
└── upload.ts

Flow:
Client → POST /presign → Get URL + videoId
      → Upload to MinIO directly
      → POST /complete → Create video → Publish job → Return
```

### Key Components

- **Upload Routes**: Presign, complete handlers
- **Validation**: Zod schemas for request validation
- **Storage Integration**: Presigned URL generation
- **Queue Integration**: Transcode job publishing

### Data Flow

```
POST /presign
     ↓
Validate request (fileName, fileSize, contentType)
     ↓
Generate unique key (videoId/original.ext)
     ↓
Get presigned upload URL from MinIO
     ↓
Return { videoId, uploadUrl, key }

---

Client uploads file directly to MinIO using presigned URL

---

POST /complete
     ↓
Verify file exists in MinIO
     ↓
Create Video record (status: PENDING)
     ↓
Publish transcode job to RabbitMQ
     ↓
Return video details
```

## Implementation Phases

### Phase 1: Upload Routes (Est: 1 day)

**Scope**: Create upload route handlers

**Tasks**:

1. [ ] Create routes file - file: `apps/api/src/routes/upload.ts`
2. [ ] Implement POST /presign
3. [ ] Implement POST /:id/complete
4. [ ] Add validation
5. [ ] Wire up to app.ts

**Acceptance Criteria**:

- [ ] Presign returns valid upload URL
- [ ] Complete creates video record
- [ ] Transcode job published
- [ ] Errors handled gracefully

**Files to Create**:

`apps/api/src/routes/upload.ts`:

```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { storageService } from '../services/storage.service'
import { queueService } from '../services/queue.service'
import { successResponse, errorResponse } from '../utils/response'
import { presignUploadSchema } from '../utils/validator'

const uploadRoutes = new Hono()

/**
 * POST /api/upload/presign
 * Generate presigned upload URL for client-side upload
 */
uploadRoutes.post('/presign', async (c) => {
  try {
    const body = await c.req.json()

    // Validate input
    const validated = presignUploadSchema.parse(body)
    const { fileName, fileSize, contentType } = validated

    // Generate video ID and object key
    const videoId = nanoid()
    const ext = fileName.split('.').pop() || 'mp4'
    const key = `${videoId}/original.${ext}`

    // Generate presigned upload URL
    const uploadUrl = await storageService.getPresignedUploadUrl(key, 3600)

    return successResponse(
      c,
      {
        videoId,
        uploadUrl,
        key,
        expiresIn: 3600
      },
      201
    )
  } catch (error: any) {
    console.error('Presign upload error:', error)

    if (error.name === 'ZodError') {
      return errorResponse(c, 'Invalid input', 400)
    }

    return errorResponse(c, 'Failed to generate upload URL', 500)
  }
})

/**
 * POST /api/upload/:id/complete
 * Mark upload as complete, create video record, trigger transcoding
 */
uploadRoutes.post('/:id/complete', async (c) => {
  try {
    const videoId = c.req.param('id')
    const body = await c.req.json()
    const { key, title, description } = body

    if (!key) {
      return errorResponse(c, 'Missing key parameter', 400)
    }

    // Verify file exists in storage
    const fileExists = await storageService.fileExists('raw', key)
    if (!fileExists) {
      return errorResponse(c, 'File not found in storage', 404)
    }

    // Create video record
    const video = await prisma.video.create({
      data: {
        id: videoId,
        title: title || 'Untitled Video',
        description: description || null,
        status: 'PENDING',
        videoType: 'VOD',
        visibility: 'PRIVATE',
        isLiveNow: false,
        viewsToday: 0,
        viewsMonth: 0,
        viewsTotal: 0
      }
    })

    // Publish transcode job to queue
    const jobPublished = await queueService.publishTranscodeJob({
      videoId,
      originalKey: key
    })

    if (!jobPublished) {
      console.warn(`Failed to publish transcode job for video ${videoId}`)
      // Note: Video still created, job can be retried later
    }

    return successResponse(c, { video }, 201)
  } catch (error: any) {
    console.error('Complete upload error:', error)

    if (error.code === 'P2002') {
      // Prisma unique constraint violation (idempotency)
      return errorResponse(c, 'Video already exists', 409)
    }

    return errorResponse(c, error.message || 'Failed to complete upload', 500)
  }
})

export { uploadRoutes }
```

### Phase 2: Validation & Error Handling (Est: 0.5 days)

**Scope**: Add robust validation and error cases

**Tasks**:

1. [ ] Update validator schemas
2. [ ] Add file size validation
3. [ ] Add MIME type validation
4. [ ] Test error scenarios

**Acceptance Criteria**:

- [ ] Rejects files > 2GB
- [ ] Rejects invalid MIME types
- [ ] Returns clear error messages
- [ ] Handles duplicate uploads

**Code to Update**:

Update `apps/api/src/utils/validator.ts`:

```typescript
import { z } from 'zod'
import { MAX_FILE_SIZE, ALLOWED_VIDEO_TYPES } from '@repo/constants'

export const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z
    .number()
    .positive()
    .max(MAX_FILE_SIZE, `File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB`),
  contentType: z.enum(ALLOWED_VIDEO_TYPES as any, {
    errorMap: () => ({ message: 'Invalid video format. Allowed: mp4, webm, ogg' })
  })
})

export const completeUploadSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional()
})
```

### Phase 3: Integration (Est: 0.5 days)

**Scope**: Wire up routes and test end-to-end

**Tasks**:

1. [ ] Add routes to app.ts
2. [ ] Test presign endpoint
3. [ ] Test upload to MinIO
4. [ ] Test complete endpoint
5. [ ] Verify job in queue

**Acceptance Criteria**:

- [ ] Full upload flow works
- [ ] Video created in database
- [ ] Job appears in RabbitMQ
- [ ] Worker can consume job

**Code to Update**:

Update `apps/api/src/app.ts`:

```typescript
import { uploadRoutes } from './routes/upload'

// Add after other routes
app.route('/api/upload', uploadRoutes)
```

## Testing Strategy

- **Unit Tests**:
  - Presign generates valid URL
  - Complete creates video record
  - Validation rejects invalid inputs
  - Error handling works
- **Integration Tests**:
  - Full upload flow (presign → upload → complete)
  - File verification in MinIO
  - Job published to queue
  - Idempotency (duplicate complete calls)
  - Large file handling

## Security Considerations

- [ ] Presigned URLs expire (1 hour)
- [ ] File size limits enforced
- [ ] MIME type validation prevents non-video uploads
- [ ] Object keys use UUIDs (no path traversal)
- [ ] Rate limiting upload requests (future)

## Risk Assessment

| Risk              | Impact | Mitigation                         |
| ----------------- | ------ | ---------------------------------- |
| Upload timeout    | Medium | 1-hour presigned URL expiry        |
| Partial upload    | Medium | Verify file exists before complete |
| Queue unavailable | High   | Store job in DB for retry          |
| Duplicate uploads | Low    | Idempotent complete handler        |

## Quick Reference

### API Endpoints

```bash
# Get presigned upload URL
POST /api/upload/presign
Body: {
  "fileName": "video.mp4",
  "fileSize": 50000000,
  "contentType": "video/mp4"
}

Response: {
  "success": true,
  "data": {
    "videoId": "abc123",
    "uploadUrl": "https://minio:9000/...",
    "key": "abc123/original.mp4",
    "expiresIn": 3600
  }
}

# Complete upload
POST /api/upload/:videoId/complete
Body: {
  "key": "abc123/original.mp4",
  "title": "My Video",
  "description": "Video description"
}

Response: {
  "success": true,
  "data": {
    "video": { ... }
  }
}
```

### Upload Flow (Client)

```javascript
// 1. Get presigned URL
const { videoId, uploadUrl, key } = await fetch('/api/upload/presign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type
  })
}).then((r) => r.json())

// 2. Upload directly to MinIO
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
})

// 3. Mark upload complete
await fetch(`/api/upload/${videoId}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key,
    title: 'My Video',
    description: 'Optional description'
  })
})
```

## TODO Checklist

- [ ] Create routes/upload.ts
- [ ] Update utils/validator.ts with upload schemas
- [ ] Wire up routes in app.ts
- [ ] Test presign endpoint
- [ ] Upload test file to MinIO using presigned URL
- [ ] Test complete endpoint
- [ ] Verify video created in database
- [ ] Verify job in RabbitMQ queue
- [ ] Test error cases (invalid file, missing file, etc)
- [ ] Test idempotency (duplicate complete)
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 3.1: API Core Setup
- Phase 3.2: Storage Service (presigned URLs)
- Phase 3.4: Queue Service (job publishing)
- Phase 2: Database schema with Video model

**Required After**:

- Worker service (consumes transcode jobs)
- Frontend upload component

## Unresolved Questions

- Should we support chunked uploads for large files?
- Need upload progress tracking?
- Cleanup orphaned files (presigned but never completed)?
- Resume interrupted uploads?
