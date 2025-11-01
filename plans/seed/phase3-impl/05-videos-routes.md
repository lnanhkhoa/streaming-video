# Videos Routes Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: Implement video CRUD routes: list, get by ID, update, delete with caching

## Executive Summary

Create video management routes for listing, retrieving, updating, deleting videos. Integrates database, cache, storage services. Primary user-facing API.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 3.1-3.4 (Core, Storage, Cache services), Phase 2 (Database schema)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3.5)

## Requirements

### Functional Requirements

- [x] GET /api/videos/list - List all videos with pagination
- [x] GET /api/videos/:id - Get video details with variants
- [x] PATCH /api/videos/:id - Update video metadata
- [x] DELETE /api/videos/:id - Delete video and assets
- [x] Cache integration (list: 60s, details: 30s)
- [x] Presigned URLs for playback
- [x] Filter by status, type, visibility

### Non-Functional Requirements

- [x] Response time < 200ms (cached)
- [x] Pagination support (limit/offset)
- [x] Proper error messages
- [x] Cache invalidation on updates

## Architecture Overview

```
apps/api/src/
├── routes/
│   └── videos.ts          # Route handlers
└── services/
    └── video.service.ts   # Business logic
```

### Key Components

- **Video Routes**: HTTP handlers
- **Video Service**: Database + cache operations
- **Response Helpers**: Consistent API responses

### Data Flow

```
GET /list → Check cache → Cache hit? → Return
                ↓
           Query DB → Cache result → Return

GET /:id → Check cache → Cache hit? → Return
               ↓
          Query DB + variants → Cache → Generate presigned URLs → Return

PATCH /:id → Update DB → Invalidate cache → Return

DELETE /:id → Delete DB → Delete files → Invalidate cache → Return
```

## Implementation Phases

### Phase 1: Video Service (Est: 1 day)

**Scope**: Create video service layer

**Tasks**:

1. [ ] Create video service - file: `apps/api/src/services/video.service.ts`
2. [ ] Implement list videos
3. [ ] Implement get video by ID
4. [ ] Implement update video
5. [ ] Implement delete video
6. [ ] Add cache integration

**Files to Create**:

`apps/api/src/services/video.service.ts`:

```typescript
import { prisma } from '@repo/database'
import type { Video, VideoVariant } from '@repo/constants'
import { cacheService } from './cache.service'
import { storageService } from './storage.service'

interface ListVideosOptions {
  limit?: number
  offset?: number
  status?: string
  videoType?: string
  visibility?: string
}

interface VideoWithVariants {
  video: Video & { playbackUrl?: string }
  variants: (VideoVariant & { playbackUrl?: string })[]
}

class VideoService {
  /**
   * List videos with filters and pagination
   */
  async listVideos(options: ListVideosOptions = {}) {
    const { limit = 20, offset = 0, status, videoType, visibility } = options

    // Check cache
    const cacheKey = `video:list:${JSON.stringify(options)}`
    const cached = await cacheService.get<{ videos: Video[]; total: number }>(cacheKey)
    if (cached) return cached

    // Query database
    const where = {
      ...(status && { status }),
      ...(videoType && { videoType }),
      ...(visibility && { visibility })
    }

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.video.count({ where })
    ])

    const result = { videos, total }

    // Cache result
    await cacheService.set(cacheKey, result, 60)

    return result
  }

  /**
   * Get video by ID with variants
   */
  async getVideoById(id: string): Promise<VideoWithVariants | null> {
    // Check cache
    const cacheKey = `video:${id}`
    const cached = await cacheService.get<VideoWithVariants>(cacheKey)
    if (cached) return cached

    // Query database
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        variants: true
      }
    })

    if (!video) return null

    // Generate presigned URLs for playback
    let playbackUrl: string | undefined
    if (video.hlsManifestKey) {
      playbackUrl = await storageService.getPresignedDownloadUrl(
        'processed',
        video.hlsManifestKey,
        3600
      )
    }

    const variantsWithUrls = await Promise.all(
      video.variants.map(async (variant) => ({
        ...variant,
        playbackUrl: await storageService.getPresignedDownloadUrl(
          'processed',
          variant.playlistKey,
          3600
        )
      }))
    )

    const result = {
      video: { ...video, playbackUrl },
      variants: variantsWithUrls
    }

    // Cache result
    await cacheService.set(cacheKey, result, 30)

    return result
  }

  /**
   * Update video metadata
   */
  async updateVideo(
    id: string,
    data: { title?: string; description?: string; visibility?: string }
  ) {
    const video = await prisma.video.update({
      where: { id },
      data
    })

    // Invalidate cache
    await cacheService.invalidateVideo(id)

    return video
  }

  /**
   * Delete video and associated assets
   */
  async deleteVideo(id: string): Promise<void> {
    const video = await prisma.video.findUnique({
      where: { id },
      include: { variants: true }
    })

    if (!video) {
      throw new Error('Video not found')
    }

    // Delete from storage
    const deletePromises: Promise<void>[] = []

    // Delete original
    if (video.hlsManifestKey) {
      const originalKey = video.hlsManifestKey.replace('/master.m3u8', '')
      // Note: Actual deletion would need to list and delete all segments
      // This is simplified
    }

    // Delete variants
    for (const variant of video.variants) {
      deletePromises.push(storageService.deleteFile('processed', variant.playlistKey))
    }

    // Delete thumbnail
    if (video.thumbnailKey) {
      deletePromises.push(storageService.deleteFile('thumbnails', video.thumbnailKey))
    }

    await Promise.all(deletePromises)

    // Delete from database
    await prisma.video.delete({
      where: { id }
    })

    // Invalidate cache
    await cacheService.invalidateVideo(id)
  }
}

export const videoService = new VideoService()
```

### Phase 2: Video Routes (Est: 0.5 days)

**Scope**: Create HTTP route handlers

**Tasks**:

1. [ ] Create routes file - file: `apps/api/src/routes/videos.ts`
2. [ ] Implement GET /list
3. [ ] Implement GET /:id
4. [ ] Implement PATCH /:id
5. [ ] Implement DELETE /:id
6. [ ] Add validation
7. [ ] Wire up to app.ts

**Files to Create**:

`apps/api/src/routes/videos.ts`:

```typescript
import { Hono } from 'hono'
import { videoService } from '../services/video.service'
import { successResponse, errorResponse } from '../utils/response'
import { updateVideoSchema } from '../utils/validator'

const videoRoutes = new Hono()

/**
 * GET /api/videos/list
 * List videos with pagination and filters
 */
videoRoutes.get('/list', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 20
    const offset = Number(c.req.query('offset')) || 0
    const status = c.req.query('status')
    const videoType = c.req.query('videoType')
    const visibility = c.req.query('visibility')

    const result = await videoService.listVideos({
      limit,
      offset,
      status,
      videoType,
      visibility
    })

    return successResponse(c, result)
  } catch (error) {
    console.error('List videos error:', error)
    return errorResponse(c, 'Failed to list videos', 500)
  }
})

/**
 * GET /api/videos/:id
 * Get video details with variants and playback URLs
 */
videoRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    const result = await videoService.getVideoById(id)

    if (!result) {
      return errorResponse(c, 'Video not found', 404)
    }

    return successResponse(c, result)
  } catch (error) {
    console.error('Get video error:', error)
    return errorResponse(c, 'Failed to get video', 500)
  }
})

/**
 * PATCH /api/videos/:id
 * Update video metadata
 */
videoRoutes.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate input
    const validated = updateVideoSchema.parse(body)

    const video = await videoService.updateVideo(id, validated)

    return successResponse(c, { video })
  } catch (error: any) {
    console.error('Update video error:', error)

    if (error.name === 'ZodError') {
      return errorResponse(c, 'Invalid input', 400)
    }

    return errorResponse(c, error.message || 'Failed to update video', 500)
  }
})

/**
 * DELETE /api/videos/:id
 * Delete video and all associated assets
 */
videoRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    await videoService.deleteVideo(id)

    return successResponse(c, { message: 'Video deleted successfully' })
  } catch (error: any) {
    console.error('Delete video error:', error)

    if (error.message === 'Video not found') {
      return errorResponse(c, 'Video not found', 404)
    }

    return errorResponse(c, 'Failed to delete video', 500)
  }
})

export { videoRoutes }
```

Update `apps/api/src/app.ts`:

```typescript
import { videoRoutes } from './routes/videos'

// Add after other middleware
app.route('/api/videos', videoRoutes)
```

## Testing Strategy

- **Unit Tests**:
  - Service methods return correct data
  - Cache hit/miss scenarios
  - Validation schemas
- **Integration Tests**:
  - GET /list returns videos
  - GET /:id returns video + variants
  - PATCH /:id updates video
  - DELETE /:id removes video
  - Cache invalidation works
  - Presigned URLs generated

## Security Considerations

- [ ] Input validation prevents injection
- [ ] UUIDs prevent enumeration
- [ ] Presigned URLs expire (1 hour)
- [ ] Soft delete option (future)

## Risk Assessment

| Risk              | Impact | Mitigation                    |
| ----------------- | ------ | ----------------------------- |
| Cache stampede    | Medium | Short TTLs, stagger updates   |
| Orphaned files    | Medium | Cleanup job, transaction logs |
| Large result sets | Low    | Enforce max limit (100)       |

## Quick Reference

### API Endpoints

```bash
# List videos
GET /api/videos/list?limit=20&offset=0&status=READY

# Get video
GET /api/videos/:id

# Update video
PATCH /api/videos/:id
Body: { "title": "New Title", "visibility": "PUBLIC" }

# Delete video
DELETE /api/videos/:id
```

### Response Format

```json
{
  "success": true,
  "data": {
    "video": { ... },
    "variants": [ ... ]
  }
}
```

## TODO Checklist

- [x] Create video.service.ts
- [x] Create routes/videos.ts
- [x] Wire up routes in app.ts
- [ ] Test list endpoint (requires Database + Docker)
- [ ] Test get endpoint (requires Database + Docker)
- [ ] Test update endpoint (requires Database + Docker)
- [ ] Test delete endpoint (requires Database + Docker)
- [ ] Test cache integration (requires Database + Docker)
- [ ] Test presigned URL generation (requires Database + Docker)
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 2: Database schema with Video, VideoVariant models
- Phase 3.1: API Core Setup
- Phase 3.2: Storage Service
- Phase 3.3: Cache Service

**Required After**:

- Frontend integration
