const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Standard API success response wrapper
 */
interface SuccessResponse<T> {
  success: true
  data: T
}

/**
 * Standard API error response
 */
interface ErrorResponse {
  success: false
  error: {
    message: string
    status: number
    code?: string
    details?: unknown
  }
}

export interface Video {
  id: string
  title: string
  description: string
  thumbnailUrl?: string
  hlsManifestKey: string
  isLiveNow: boolean
  createdAt: string
  updatedAt: string
}

export interface LiveStream {
  videoId: string
  streamKey: string
  rtmpUrl: string
  isActive: boolean
}

export interface ViewStats {
  videoId: string
  viewsToday: number
  viewsThisMonth: number
  viewsTotal: number
}

/**
 * Make API request with standardized response handling
 * Automatically unwraps { success: true, data: T } responses
 */
async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  const json = await res.json()

  if (!res.ok) {
    // Handle error response format
    const errorResponse = json as ErrorResponse
    const errorMessage = errorResponse.error?.message || res.statusText
    throw new Error(`API error: ${errorMessage}`)
  }

  // Unwrap success response
  const successResponse = json as SuccessResponse<T>
  return successResponse.data
}

// Video endpoints
export const videoAPI = {
  listVideos: (liveOnly?: boolean) => {
    const query = liveOnly ? '?live=true' : ''
    return apiRequest<Video[]>(`/api/videos${query}`)
  },
  getVideo: (id: string) => apiRequest<Video>(`/api/videos/${id}`),
  getVideoStats: (id: string) => apiRequest<ViewStats>(`/api/videos/${id}/stats`),
  trackView: (id: string) => apiRequest(`/api/videos/${id}/view`, { method: 'POST' })
}

// Live streaming endpoints
export const liveAPI = {
  createLiveStream: (data: { title: string; description?: string }) =>
    apiRequest<LiveStream>('/api/live/create', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  startLiveStream: (videoId: string) =>
    apiRequest(`/api/live/${videoId}/start`, { method: 'POST' }),
  stopLiveStream: (videoId: string) => apiRequest(`/api/live/${videoId}/stop`, { method: 'POST' })
}

// Upload endpoints
export const uploadAPI = {
  getUploadUrl: (filename: string) =>
    apiRequest<{ uploadUrl: string; key: string }>('/api/upload/url', {
      method: 'POST',
      body: JSON.stringify({ filename })
    }),
  completeUpload: (data: { key: string; title: string; description?: string }) =>
    apiRequest<Video>('/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify(data)
    })
}
