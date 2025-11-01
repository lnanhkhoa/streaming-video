import { z } from 'zod'

// Upload validation
export const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z
    .number()
    .positive()
    .max(2 * 1024 * 1024 * 1024), // 2GB
  contentType: z.enum(['video/mp4', 'video/webm', 'video/ogg'])
})

export const completeUploadSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional()
})

// Live stream validation
export const createLiveStreamSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional()
})

// Video update validation
export const updateVideoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional()
})

export type PresignUploadInput = z.infer<typeof presignUploadSchema>
export type CreateLiveStreamInput = z.infer<typeof createLiveStreamSchema>
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>
