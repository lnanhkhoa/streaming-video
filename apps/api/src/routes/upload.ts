import { Hono } from 'hono'
import { Bindings } from 'hono/types'
import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { storageService } from '../services/storage.service'
import { queueService } from '../services/queue.service'
import { successResponse } from '../utils/response'
import { presignUploadSchema, completeUploadSchema } from '../utils/validator'
import { zValidator } from '../middlewares/validation'
import { NotFoundError } from '../utils/errors'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/upload/presign
 * Generate presigned upload URL for client-side upload
 */
app.post('/presign', zValidator('json', presignUploadSchema), async (c) => {
  const { fileName, fileSize, contentType } = c.req.valid('json')

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
})

/**
 * POST /api/upload/:id/complete
 * Mark upload as complete, create video record, trigger transcoding
 */
app.post('/:id/complete', zValidator('json', completeUploadSchema), async (c) => {
  const videoId = c.req.param('id')
  const { key, title, description } = c.req.valid('json')

  // Verify file exists in storage
  const fileExists = await storageService.fileExists('raw', key)
  if (!fileExists) {
    throw new NotFoundError('File in storage')
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
      originalKey: key,
      isLiveNow: false,
      viewsToday: 0,
      viewsMonth: 0,
      viewsTotal: 0
    }
  })

  // Publish transcode job to queue
  const jobPublished = await queueService.publishTranscodeJob({
    videoId,
    inputKey: key
  })

  if (!jobPublished) {
    console.warn(`Failed to publish transcode job for video ${videoId}`)
    // Note: Video still created, job can be retried later
  }

  return successResponse(c, { video }, 201)
})

export default app
