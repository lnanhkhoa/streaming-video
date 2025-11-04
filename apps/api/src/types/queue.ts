import { z } from 'zod'

// Transcode job schema
export const transcodeJobSchema = z.object({
  type: z.literal('transcode').optional(), // Optional for backward compatibility
  videoId: z.string(),
  inputKey: z.string().min(1)
})

export type TranscodeJob = z.infer<typeof transcodeJobSchema>

// Start live stream job schema
export const startLiveStreamJobSchema = z.object({
  type: z.literal('start-live-stream'),
  videoId: z.string(),
  inputSource: z.string().min(1) // RTMP URL, file path, or HTTP stream URL
})

export type StartLiveStreamJob = z.infer<typeof startLiveStreamJobSchema>

// Stop live stream job schema
export const stopLiveStreamJobSchema = z.object({
  type: z.literal('stop-live-stream'),
  videoId: z.string(),
  convertToVOD: z.boolean().optional()
})

export type StopLiveStreamJob = z.infer<typeof stopLiveStreamJobSchema>

// Union type for all job types
export const workerJobSchema = z.union([
  transcodeJobSchema,
  startLiveStreamJobSchema,
  stopLiveStreamJobSchema
])

export type WorkerJob = z.infer<typeof workerJobSchema>

// Job validation helpers
export function validateTranscodeJob(job: unknown): TranscodeJob {
  return transcodeJobSchema.parse(job)
}

export function validateStartLiveStreamJob(job: unknown): StartLiveStreamJob {
  return startLiveStreamJobSchema.parse(job)
}

export function validateStopLiveStreamJob(job: unknown): StopLiveStreamJob {
  return stopLiveStreamJobSchema.parse(job)
}

export function validateWorkerJob(job: unknown): WorkerJob {
  return workerJobSchema.parse(job)
}
