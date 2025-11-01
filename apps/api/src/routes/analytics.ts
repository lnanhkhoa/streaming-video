import { Hono } from 'hono'
import { analyticsService } from '../services/analytics.service.js'
import { successResponse } from '../utils/response.js'
import { NotFoundError } from '../utils/errors.js'

const analyticsRoutes = new Hono()

/**
 * POST /api/analytics/view/:id
 * Track a video view
 */
analyticsRoutes.post('/view/:id', async (c) => {
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
analyticsRoutes.get('/stats/:id', async (c) => {
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
analyticsRoutes.post('/reset/daily', async (c) => {
  const count = await analyticsService.resetDailyViews()
  return successResponse(c, { message: `Reset daily views for ${count} videos` })
})

/**
 * POST /api/analytics/reset/monthly
 * Manual trigger for monthly reset (internal use)
 */
analyticsRoutes.post('/reset/monthly', async (c) => {
  const count = await analyticsService.resetMonthlyViews()
  return successResponse(c, { message: `Reset monthly views for ${count} videos` })
})

export { analyticsRoutes }
