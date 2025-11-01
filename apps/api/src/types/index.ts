import type { Video, VideoVariant } from '@repo/constants'

/**
 * Standard success response
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false
  error: {
    message: string
    status: number
    code?: string
    details?: unknown
    cause?: unknown
    stack?: string
  }
}

/**
 * Generic API response that can be either success or error
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

export interface VideoListResponse {
  videos: Video[]
  total: number
}

export interface VideoDetailResponse {
  video: Video
  variants: VideoVariant[]
}

export type { Video, VideoVariant }
