# Analytics Routes Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: Implement view tracking, stats retrieval with cache, periodic counter resets

## Executive Summary

Create analytics routes for tracking video views. Store view logs, aggregate counts (today/month/total), cache stats, schedule periodic resets.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 3.1 (Core), 3.3 (Cache), Phase 2 (Database)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3.7)

## Requirements

### Functional Requirements

- [x] POST /api/analytics/view/:id - Track video view
- [x] GET /api/analytics/stats/:id - Get video stats
- [x] Increment viewsToday, viewsMonth, viewsTotal
- [x] Create VideoViewLog record
- [x] Cache stats (30s TTL)
- [x] Scheduled resets (daily, monthly)

### Non-Functional Requirements

- [x] Fast view tracking (< 100ms)
- [x] Cache-first stats retrieval
- [x] Atomic counter increments
- [ ] Duplicate view prevention (same IP/session) - Future enhancement

## Architecture Overview

```
apps/api/src/
├── routes/
│   └── analytics.ts
└── services/
    └── analytics.service.ts
```

### Key Components

- **Analytics Routes**: View tracking, stats retrieval
- **Analytics Service**: Business logic, counter management
- **Cache Integration**: Stats caching (30s)
- **Scheduled Jobs**: Daily/monthly resets

### Data Flow

```
POST /view/:id
     ↓
Increment counters (today/month/total)
     ↓
Create ViewLog record
     ↓
Invalidate stats cache
     ↓
Return success

GET /stats/:id
     ↓
Check cache → Cache hit? → Return
     ↓
Query database → Cache result → Return
```

## Implementation Phases

### Phase 1: Analytics Service (Est: 0.5 days)

**Scope**: Create analytics service layer

**Tasks**:

1. [ ] Create analytics service - file: `apps/api/src/services/analytics.service.ts`
2. [ ] Implement trackView
3. [ ] Implement getStats
4. [ ] Add cache integration

**Files to Create**:

`apps/api/src/services/analytics.service.ts`:

```typescript
import { prisma } from '@repo/database'
import { cacheService } from './cache.service'

interface VideoStats {
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
}

class AnalyticsService {
  /**
   * Track video view - increment counters and create log
   */
  async trackView(videoId: string, ip?: string): Promise<void> {
    try {
      // TODO: Implement duplicate prevention (same IP within 24h)
      // For now, track all views

      // Increment all view counters atomically
      await prisma.video.update({
        where: { id: videoId },
        data: {
          viewsToday: { increment: 1 },
          viewsMonth: { increment: 1 },
          viewsTotal: { increment: 1 }
        }
      })

      // Create view log
      await prisma.videoViewLog.create({
        data: {
          videoId,
          viewedAt: new Date()
        }
      })

      // Invalidate stats cache
      await cacheService.del(cacheService.keys.videoStats(videoId))
    } catch (error) {
      console.error('Track view error:', error)
      throw new Error('Failed to track view')
    }
  }

  /**
   * Get video stats with caching
   */
  async getStats(videoId: string): Promise<VideoStats | null> {
    // Check cache
    const cached = await cacheService.getVideoStats<VideoStats>(videoId)
    if (cached) return cached

    // Query database
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        viewsToday: true,
        viewsMonth: true,
        viewsTotal: true
      }
    })

    if (!video) return null

    const stats: VideoStats = {
      viewsToday: video.viewsToday,
      viewsMonth: video.viewsMonth,
      viewsTotal: video.viewsTotal
    }

    // Cache result
    await cacheService.cacheVideoStats(videoId, stats)

    return stats
  }

  /**
   * Reset daily view counters (run at midnight UTC)
   */
  async resetDailyViews(): Promise<number> {
    try {
      const result = await prisma.video.updateMany({
        data: {
          viewsToday: 0
        }
      })

      console.log(`✅ Reset daily views for ${result.count} videos`)
      return result.count
    } catch (error) {
      console.error('Reset daily views error:', error)
      throw new Error('Failed to reset daily views')
    }
  }

  /**
   * Reset monthly view counters (run on 1st of month)
   */
  async resetMonthlyViews(): Promise<number> {
    try {
      const result = await prisma.video.updateMany({
        data: {
          viewsMonth: 0
        }
      })

      console.log(`✅ Reset monthly views for ${result.count} videos`)
      return result.count
    } catch (error) {
      console.error('Reset monthly views error:', error)
      throw new Error('Failed to reset monthly views')
    }
  }
}

export const analyticsService = new AnalyticsService()
```

### Phase 2: Analytics Routes (Est: 0.5 days)

**Scope**: Create HTTP route handlers

**Tasks**:

1. [ ] Create routes file - file: `apps/api/src/routes/analytics.ts`
2. [ ] Implement POST /view/:id
3. [ ] Implement GET /stats/:id
4. [ ] Add validation
5. [ ] Wire up to app.ts

**Files to Create**:

`apps/api/src/routes/analytics.ts`:

```typescript
import { Hono } from 'hono'
import { analyticsService } from '../services/analytics.service'
import { successResponse, errorResponse } from '../utils/response'

const analyticsRoutes = new Hono()

/**
 * POST /api/analytics/view/:id
 * Track a video view
 */
analyticsRoutes.post('/view/:id', async (c) => {
  try {
    const videoId = c.req.param('id')

    // Get client IP (for duplicate prevention)
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

    await analyticsService.trackView(videoId, ip)

    return successResponse(c, { message: 'View tracked successfully' })
  } catch (error: any) {
    console.error('Track view error:', error)

    if (error.code === 'P2025') {
      // Prisma record not found
      return errorResponse(c, 'Video not found', 404)
    }

    return errorResponse(c, 'Failed to track view', 500)
  }
})

/**
 * GET /api/analytics/stats/:id
 * Get video statistics
 */
analyticsRoutes.get('/stats/:id', async (c) => {
  try {
    const videoId = c.req.param('id')

    const stats = await analyticsService.getStats(videoId)

    if (!stats) {
      return errorResponse(c, 'Video not found', 404)
    }

    return successResponse(c, stats)
  } catch (error) {
    console.error('Get stats error:', error)
    return errorResponse(c, 'Failed to get stats', 500)
  }
})

/**
 * POST /api/analytics/reset/daily
 * Manual trigger for daily reset (internal use)
 */
analyticsRoutes.post('/reset/daily', async (c) => {
  try {
    const count = await analyticsService.resetDailyViews()
    return successResponse(c, { message: `Reset daily views for ${count} videos` })
  } catch (error) {
    console.error('Reset daily error:', error)
    return errorResponse(c, 'Failed to reset daily views', 500)
  }
})

/**
 * POST /api/analytics/reset/monthly
 * Manual trigger for monthly reset (internal use)
 */
analyticsRoutes.post('/reset/monthly', async (c) => {
  try {
    const count = await analyticsService.resetMonthlyViews()
    return successResponse(c, { message: `Reset monthly views for ${count} videos` })
  } catch (error) {
    console.error('Reset monthly error:', error)
    return errorResponse(c, 'Failed to reset monthly views', 500)
  }
})

export { analyticsRoutes }
```

Update `apps/api/src/app.ts`:

```typescript
import { analyticsRoutes } from './routes/analytics'

// Add after other routes
app.route('/api/analytics', analyticsRoutes)
```

### Phase 3: Scheduled Resets (Est: 0.5 days)

**Scope**: Add cron jobs for periodic resets

**Tasks**:

1. [ ] Add node-cron dependency
2. [ ] Create scheduler - file: `apps/api/src/utils/scheduler.ts`
3. [ ] Schedule daily reset (midnight UTC)
4. [ ] Schedule monthly reset (1st of month)
5. [ ] Initialize in index.ts

**Files to Create**:

Add to `apps/api/package.json`:

```json
{
  "dependencies": {
    "node-cron": "^3.0.0"
  }
}
```

`apps/api/src/utils/scheduler.ts`:

```typescript
import cron from 'node-cron'
import { analyticsService } from '../services/analytics.service'

export function initializeScheduler() {
  // Reset daily views at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    console.log('🕐 Running daily views reset...')
    try {
      await analyticsService.resetDailyViews()
    } catch (error) {
      console.error('Daily reset failed:', error)
    }
  })

  // Reset monthly views at midnight on 1st of month UTC
  cron.schedule('0 0 1 * *', async () => {
    console.log('🕐 Running monthly views reset...')
    try {
      await analyticsService.resetMonthlyViews()
    } catch (error) {
      console.error('Monthly reset failed:', error)
    }
  })

  console.log('✅ Analytics scheduler initialized')
}
```

Update `apps/api/src/index.ts`:

```typescript
import { serve } from '@hono/node-server'
import { app } from './app'
import { initializeScheduler } from './utils/scheduler'

const port = Number(process.env.PORT) || 3001

// Initialize scheduler
initializeScheduler()

console.log(`🚀 API server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
```

## Testing Strategy

- **Unit Tests**:
  - trackView increments counters
  - getStats returns cached data
  - Reset functions update all videos
- **Integration Tests**:
  - POST /view/:id increments counts
  - GET /stats/:id returns correct stats
  - Cache invalidation works
  - Manual reset endpoints work
  - Duplicate view prevention (future)

## Security Considerations

- [ ] Rate limit view tracking (prevent abuse)
- [ ] Reset endpoints require auth (internal only)
- [ ] IP-based duplicate prevention
- [ ] Validate video exists before tracking

## Risk Assessment

| Risk              | Impact | Mitigation                            |
| ----------------- | ------ | ------------------------------------- |
| View count abuse  | Medium | IP-based deduplication, rate limiting |
| Cache stampede    | Low    | Short TTL (30s)                       |
| Reset job failure | Medium | Manual trigger endpoints, monitoring  |
| Counter overflow  | Low    | Use BigInt for viewsTotal             |

## Quick Reference

### API Endpoints

```bash
# Track view
POST /api/analytics/view/:videoId

# Get stats
GET /api/analytics/stats/:videoId
Response: {
  "viewsToday": 123,
  "viewsMonth": 456,
  "viewsTotal": 789
}

# Manual resets (internal)
POST /api/analytics/reset/daily
POST /api/analytics/reset/monthly
```

### Cron Schedule

```
0 0 * * *   # Daily reset (midnight UTC)
0 0 1 * *   # Monthly reset (1st of month, midnight UTC)
```

## TODO Checklist

- [ ] Create analytics.service.ts
- [ ] Create routes/analytics.ts
- [ ] Create utils/scheduler.ts
- [ ] Add node-cron dependency
- [ ] Wire up routes in app.ts
- [ ] Initialize scheduler in index.ts
- [ ] Test view tracking
- [ ] Test stats retrieval
- [ ] Test cache integration
- [ ] Test manual reset endpoints
- [ ] Verify scheduled jobs run
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 3.1: API Core Setup
- Phase 3.3: Cache Service
- Phase 2: Database schema with Video, VideoViewLog models

**Required After**:

- Frontend integration (track views on video play)
- Monitoring/alerting for failed resets

## Unresolved Questions

- Implement session-based duplicate prevention?
- Track additional metrics (watch time, completion rate)?
- Add analytics dashboard/reporting?
- Store view logs indefinitely or purge old data?
