import { Hono } from 'hono'
import { Bindings } from 'hono/types'

import { videoService } from '../services/video.service'
import { successResponse } from '../utils/response'
import { updateVideoSchema } from '../utils/validator'
import { zValidator } from '../middlewares/validation'
import { NotFoundError } from '../utils/errors'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/videos
 * List videos with pagination and filters
 */
app.get('/', async (c) => {
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
app.get('/:id', async (c) => {
  const id = c.req.param('id')

  const result = await videoService.getVideoById(id)
  if (!result) throw new NotFoundError('Video', id)

  return successResponse(c, result)
})

/**
 * PATCH /api/videos/:id
 * Update video metadata
 */
app.patch('/:id', zValidator('json', updateVideoSchema), async (c) => {
  const id = c.req.param('id')
  const data = c.req.valid('json') // Fully typed from schema!

  const video = await videoService.updateVideo(id, data)

  return successResponse(c, { video })
})

/**
 * DELETE /api/videos/:id
 * Delete video and all associated assets
 */
app.delete('/:id', async (c) => {
  const id = c.req.param('id')

  await videoService.deleteVideo(id)

  return successResponse(c, { message: 'Video deleted successfully' })
})

export default app
