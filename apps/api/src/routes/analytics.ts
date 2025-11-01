import { Hono } from 'hono'
import { analyticsService } from '../services/analytics.service'
import { successResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { Bindings } from 'hono/types'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/analytics/view/:id
 * Track a video view
 */
app.post('/view/:id', async (c) => {
  const videoId = c.req.param('id')

  // Get client IP (for duplicate prevention)
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

  await analyticsService.trackView(videoId, ip)

  return successResponse(c, { message: 'View tracked successfully' })
})

/**
 * GET /api/analytics/stats/:id
 * Get video statistics
 */
app.get('/stats/:id', async (c) => {
  const videoId = c.req.param('id')

  const stats = await analyticsService.getStats(videoId)

  if (!stats) {
    throw new NotFoundError('Video', videoId)
  }

  return successResponse(c, stats)
})

/**
 * POST /api/analytics/reset/daily
 * Manual trigger for daily reset (internal use)
 */
app.post('/reset/daily', async (c) => {
  const count = await analyticsService.resetDailyViews()
  return successResponse(c, { message: `Reset daily views for ${count} videos` })
})

/**
 * POST /api/analytics/reset/monthly
 * Manual trigger for monthly reset (internal use)
 */
app.post('/reset/monthly', async (c) => {
  const count = await analyticsService.resetMonthlyViews()
  return successResponse(c, { message: `Reset monthly views for ${count} videos` })
})

export default app
