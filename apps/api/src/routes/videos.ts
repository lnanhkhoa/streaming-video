import { Hono } from 'hono'
import { videoService } from '../services/video.service.js'
import { successResponse } from '../utils/response.js'
import { updateVideoSchema } from '../utils/validator.js'
import { zValidator } from '../middlewares/validation.js'
import { NotFoundError } from '../utils/errors.js'

const videoRoutes = new Hono()

/**
 * GET /api/videos/list
 * List videos with pagination and filters
 */
videoRoutes.get('/list', async (c) => {
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
})

/**
 * GET /api/videos/:id
 * Get video details with variants and playback URLs
 */
videoRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const result = await videoService.getVideoById(id)
  if (!result) throw new NotFoundError('Video', id)

  return successResponse(c, result)
})

/**
 * PATCH /api/videos/:id
 * Update video metadata
 */
videoRoutes.patch('/:id', zValidator('json', updateVideoSchema), async (c) => {
  const id = c.req.param('id')
  const data = c.req.valid('json') // Fully typed from schema!

  const video = await videoService.updateVideo(id, data)

  return successResponse(c, { video })
})

/**
 * DELETE /api/videos/:id
 * Delete video and all associated assets
 */
videoRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  await videoService.deleteVideo(id)

  return successResponse(c, { message: 'Video deleted successfully' })
})

export { videoRoutes }
