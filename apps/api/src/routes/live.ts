import { Hono } from 'hono'
import { z } from 'zod'
import { liveService } from '../services/live.service'
import { successResponse } from '../utils/response'
import { createLiveStreamSchema } from '../utils/validator'
import { zValidator } from '../middlewares/validation'
import { BadRequestError } from '../utils/errors'

const liveRoutes = new Hono()

// Validation schemas for live stream operations
const startStreamSchema = z.object({
  streamKey: z.string().min(1, 'Stream key is required'),
  inputSource: z.string().optional() // Optional: RTMP URL, file path, or HTTP stream URL
})

const stopStreamSchema = z.object({
  convertToVOD: z.boolean().optional().default(false)
})

const visibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE'])
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
 * POST /api/live/verify
 * nginx-rtmp authentication callback
 * Returns 200 if streamKey valid, 403 otherwise
 */
liveRoutes.post('/verify', async (c) => {
  try {
    // nginx-rtmp sends streamKey as 'name' in form data
    const body = await c.req.parseBody()
    const streamKey = body.name as string

    if (!streamKey) {
      console.warn('⛔ Auth failed: No stream key provided')
      return c.text('Forbidden', 403)
    }

    // Verify stream key and auto-start stream
    const verified = await liveService.verifyAndStartStream(streamKey)

    if (!verified) {
      console.warn(`⛔ Auth failed: Invalid stream key ${streamKey}`)
      return c.text('Forbidden', 403)
    }

    return c.text('OK', 200)
  } catch (error) {
    console.error('Auth error:', error)
    return c.text('Internal Server Error', 500)
  }
})

/**
 * POST /api/live/unpublish
 * nginx-rtmp unpublish callback (stream stopped)
 */
liveRoutes.post('/unpublish', async (c) => {
  try {
    const body = await c.req.parseBody()
    const streamKey = body.name as string

    if (!streamKey) {
      return c.text('OK', 200) // Don't fail on missing key
    }

    await liveService.handleUnpublish(streamKey)

    return c.text('OK', 200)
  } catch (error) {
    console.error('Unpublish error:', error)
    return c.text('OK', 200) // Always return 200 to nginx
  }
})

/**
 * POST /api/live/:id/start
 * Start live streaming
 */
liveRoutes.post('/:id/start', zValidator('json', startStreamSchema), async (c) => {
  const videoId = c.req.param('id')
  const { streamKey, inputSource } = c.req.valid('json')

  await liveService.startStream(videoId, streamKey, inputSource)

  return successResponse(c, {
    message: 'Stream started successfully',
    videoId,
    status: 'LIVE'
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
    status: convertToVOD ? 'PENDING' : 'READY'
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
    visibility
  })
})

/**
 * GET /api/live/:id/watch
 * Get HLS playback URL
 */
liveRoutes.get('/:id/watch', async (c) => {
  const videoId = c.req.param('id')
  const stream = await liveService.getStream(videoId)

  if (stream.videoType !== 'LIVE') {
    throw new BadRequestError('Not a live stream')
  }

  // HLS manifest URL (served by nginx-rtmp HTTP server)
  const hlsUrl = `${process.env.HLS_SERVER_URL || 'http://localhost:8080/hls'}/${stream.streamKey}.m3u8`

  return successResponse(c, {
    videoId: stream.id,
    title: stream.title,
    isLive: stream.isLiveNow,
    hlsUrl,
    status: stream.status
  })
})

export { liveRoutes }
