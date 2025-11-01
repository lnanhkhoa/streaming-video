import { Hono } from 'hono'
import { z } from 'zod'
import { liveService } from '../services/live.service.js'
import { successResponse } from '../utils/response.js'
import { createLiveStreamSchema } from '../utils/validator.js'
import { zValidator } from '../middlewares/validation.js'
import { BadRequestError } from '../utils/errors.js'

const liveRoutes = new Hono()

// Validation schemas for live stream operations
const startStreamSchema = z.object({
  streamKey: z.string().min(1, 'Stream key is required'),
})

const stopStreamSchema = z.object({
  convertToVOD: z.boolean().optional().default(false),
})

const visibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']),
})

/**
 * POST /api/live/create
 * Create new live stream session
 */
liveRoutes.post('/create', zValidator('json', createLiveStreamSchema), async (c) => {
  const { title, description } = c.req.valid('json')

  const result = await liveService.createStream(title, description)

  return successResponse(c, result, 201)
})

/**
 * POST /api/live/:id/start
 * Start live streaming
 */
liveRoutes.post('/:id/start', zValidator('json', startStreamSchema), async (c) => {
  const videoId = c.req.param('id')
  const { streamKey } = c.req.valid('json')

  await liveService.startStream(videoId, streamKey)

  return successResponse(c, {
    message: 'Stream started successfully',
    status: 'LIVE',
  })
})

/**
 * POST /api/live/:id/stop
 * Stop live streaming
 */
liveRoutes.post('/:id/stop', zValidator('json', stopStreamSchema), async (c) => {
  const videoId = c.req.param('id')
  const { convertToVOD } = c.req.valid('json')

  await liveService.stopStream(videoId, convertToVOD)

  return successResponse(c, {
    message: 'Stream stopped successfully',
    status: convertToVOD ? 'PENDING' : 'READY',
  })
})

/**
 * GET /api/live/active
 * Get all active live streams
 */
liveRoutes.get('/active', async (c) => {
  const streams = await liveService.getActiveStreams()

  return successResponse(c, { streams, count: streams.length })
})

/**
 * GET /api/live/:id
 * Get stream details
 */
liveRoutes.get('/:id', async (c) => {
  const videoId = c.req.param('id')
  const stream = await liveService.getStream(videoId)

  return successResponse(c, { stream })
})

/**
 * PATCH /api/live/:id/visibility
 * Update stream visibility
 */
liveRoutes.patch('/:id/visibility', zValidator('json', visibilitySchema), async (c) => {
  const videoId = c.req.param('id')
  const { visibility } = c.req.valid('json')

  await liveService.updateStreamVisibility(videoId, visibility)

  return successResponse(c, {
    message: 'Visibility updated successfully',
    visibility,
  })
})

/**
 * GET /api/live/:id/watch
 * Stream playback endpoint (placeholder)
 */
liveRoutes.get('/:id/watch', async (c) => {
  const videoId = c.req.param('id')
  const stream = await liveService.getStream(videoId)

  if (!stream.isLiveNow) {
    throw new BadRequestError('Stream is not currently live')
  }

  // TODO: Phase 5 - Return HLS manifest or player URL
  return successResponse(c, {
    message: 'Playback not yet implemented',
    stream,
    note: 'Will integrate with RTMP server in Phase 5',
  })
})

export { liveRoutes }
