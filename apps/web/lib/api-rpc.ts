import { rpcClient } from './rpc-client'

/**
 * RPC-based API client
 *
 * Uses Hono RPC for runtime requests but with explicit TypeScript types
 * for compile-time safety. This hybrid approach provides:
 * - Runtime: Full RPC functionality with automatic request/response handling
 * - Compile-time: Explicit types from @repo/constants package
 */

// Re-export types from @repo/constants
export type {
  Video,
  VideoVariant,
  VideoStatus,
  VideoType,
  VideoVisibility,
  CreateLiveStreamRequest,
  PresignUploadRequest,
  VideoStatsResponse
} from '@repo/constants'

import type { Video, VideoStatsResponse, CreateLiveStreamRequest } from '@repo/constants'

/**
 * Helper to unwrap API responses from { success: true, data: T } to T
 */
async function unwrapResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json()
    const errorMessage = error.error?.message || res.statusText
    throw new Error(`API error: ${errorMessage}`)
  }

  const json = await res.json()
  return json.data as T
}

// Video endpoints
export const videoAPI = {
  /**
   * List videos with filters
   */
  listVideos: async (params?: {
    limit?: number
    offset?: number
    status?: string
    videoType?: string
    visibility?: string
    liveOnly?: boolean
  }): Promise<{ videos: Video[]; total: number; hasMore: boolean }> => {
    const res = await (rpcClient as any).api.videos.$get({
      query: params as any
    })
    return unwrapResponse(res)
  },

  /**
   * Get video by ID with variants and playback URLs
   */
  getVideo: async (id: string): Promise<{ video: Video }> => {
    const res = await (rpcClient as any).api.videos[':id'].$get({ param: { id } })
    return unwrapResponse(res)
  },

  /**
   * Update video metadata
   */
  updateVideo: async (
    id: string,
    data: {
      title?: string
      description?: string
      visibility?: string
    }
  ): Promise<{ video: Video }> => {
    const res = await (rpcClient as any).api.videos[':id'].$patch({
      param: { id },
      json: data
    })
    return unwrapResponse(res)
  },

  /**
   * Delete video and all associated assets
   */
  deleteVideo: async (id: string): Promise<{ message: string }> => {
    const res = await (rpcClient as any).api.videos[':id'].$delete({
      param: { id }
    })
    return unwrapResponse(res)
  }
}

// Analytics endpoints
export const analyticsAPI = {
  /**
   * Track a video view
   */
  trackView: async (id: string): Promise<{ message: string }> => {
    const res = await (rpcClient as any).api.analytics.view[':id'].$post({
      param: { id }
    })
    return unwrapResponse(res)
  },

  /**
   * Get video statistics
   */
  getStats: async (id: string): Promise<VideoStatsResponse> => {
    const res = await (rpcClient as any).api.analytics.stats[':id'].$get({ param: { id } })
    return unwrapResponse(res)
  }
}

// Live streaming endpoints
export const liveAPI = {
  /**
   * Create a new live stream
   */
  createLiveStream: async (
    data: CreateLiveStreamRequest
  ): Promise<{
    videoId: string
    streamKey: string
    rtmpUrl: string
  }> => {
    const res = await (rpcClient as any).api.live.create.$post({
      json: data
    })
    return unwrapResponse(res)
  },

  /**
   * Start a live stream
   */
  startLiveStream: async (
    videoId: string
  ): Promise<{
    message: string
    videoId: string
    status: string
  }> => {
    const res = await (rpcClient as any).api.live[':id'].start.$post({
      param: { id: videoId },
      json: { streamKey: '' } // Will be validated by API
    })
    return unwrapResponse(res)
  },

  /**
   * Stop a live stream
   */
  stopLiveStream: async (
    videoId: string
  ): Promise<{
    message: string
    status: string
  }> => {
    const res = await (rpcClient as any).api.live[':id'].stop.$post({
      param: { id: videoId },
      json: {}
    })
    return unwrapResponse(res)
  }
}

// Upload endpoints
export const uploadAPI = {
  /**
   * Get presigned upload URL
   */
  getPresignedUrl: async (data: {
    fileName: string
    fileSize: number
    contentType: string
  }): Promise<{
    videoId: string
    uploadUrl: string
    key: string
    expiresIn: number
  }> => {
    const res = await (rpcClient as any).api.upload.presign.$post({
      json: data
    })
    return unwrapResponse(res)
  },

  /**
   * Complete upload and create video record
   */
  completeUpload: async (
    videoId: string,
    data: {
      key: string
      title: string
      description?: string
    }
  ): Promise<{ video: Video }> => {
    const res = await (rpcClient as any).api.upload[':id'].complete.$post({
      param: { id: videoId },
      json: data
    })
    return unwrapResponse(res)
  }
}
