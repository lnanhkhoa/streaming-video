import { Hono } from 'hono'
import { z } from 'zod'
import { liveService } from '../services/live.service'
import { successResponse } from '../utils/response'
import { createLiveStreamSchema } from '../utils/validator'
import { zValidator } from '../middlewares/validation'
import { BadRequestError } from '../utils/errors'
import { Bindings } from 'hono/types'

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

export const liveRoutes = new Hono<{ Bindings: Bindings }>()
  /**
   * POST /api/live/create
   * Create new live stream session
   */
  .post('/create', zValidator('json', createLiveStreamSchema), async (c) => {
    const { title, description } = c.req.valid('json')

    const result = await liveService.createStream(title, description)

    return successResponse(c, result, 201)
  })

  /**
   * POST /api/live/:id/start
   * Start live streaming
   */
  .post('/:id/start', zValidator('json', startStreamSchema), async (c) => {
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
  .post('/:id/stop', zValidator('json', stopStreamSchema), async (c) => {
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
  .get('/active', async (c) => {
    const streams = await liveService.getActiveStreams()

    return successResponse(c, { streams, count: streams.length })
  })

  /**
   * GET /api/live/:id
   * Get stream details
   */
  .get('/:id', async (c) => {
    const videoId = c.req.param('id')
    const stream = await liveService.getStream(videoId)

    return successResponse(c, { stream })
  })

  /**
   * PATCH /api/live/:id/visibility
   * Update stream visibility
   */
  .patch('/:id/visibility', zValidator('json', visibilitySchema), async (c) => {
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
   * Get HLS playback URL from MinIO
   */
  .get('/:id/watch', async (c) => {
    const videoId = c.req.param('id')
    const stream = await liveService.getStream(videoId)

    if (stream.videoType !== 'LIVE') {
      throw new BadRequestError('Not a live stream')
    }

    // HLS manifest URL from MinIO processed bucket
    const hlsUrl = stream.hlsManifestKey
      ? `${process.env.NEXT_PUBLIC_STORAGE_URL}/videos-processed/${stream.hlsManifestKey}`
      : null

    return successResponse(c, {
      videoId: stream.id,
      title: stream.title,
      isLive: stream.isLiveNow,
      hlsUrl,
      status: stream.status
    })
  })
