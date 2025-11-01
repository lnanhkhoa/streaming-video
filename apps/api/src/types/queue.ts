import { z } from 'zod'

// Transcode job schema
export const transcodeJobSchema = z.object({
  videoId: z.string().uuid(),
  originalKey: z.string().min(1),
  userId: z.string().uuid().optional()
})

export type TranscodeJob = z.infer<typeof transcodeJobSchema>

// Job validation helper
export function validateTranscodeJob(job: unknown): TranscodeJob {
  return transcodeJobSchema.parse(job)
}
