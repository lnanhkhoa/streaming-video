import type { Video } from '@repo/constants'

/**
 * FFmpeg Transcoder
 *
 * TODO (Phase 4):
 * - Download video from MinIO
 * - Transcode to 3 HLS variants (480p, 720p, 1080p)
 * - Generate thumbnail
 * - Create master playlist
 * - Upload all files to MinIO
 * - Update database with manifest keys
 */

export interface TranscodeJob {
  videoId: string
  inputKey: string
}

export async function transcodeVideo(job: TranscodeJob): Promise<void> {
  console.log('TODO: Implement video transcoding in Phase 4')
  throw new Error('Not implemented')
}
