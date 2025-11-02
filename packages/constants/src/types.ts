// Enums
export type VideoStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'LIVE'
export type VideoType = 'VOD' | 'LIVE'
export type VideoVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
export type AllowedVideoTypes = 'video/mp4' | 'video/webm' | 'video/ogg'

// Video Interface
export interface Video {
  id: string
  title: string
  description?: string
  status: VideoStatus
  videoType: VideoType
  visibility: VideoVisibility
  hlsManifestKey?: string
  thumbnailKey?: string
  duration?: number
  streamKey?: string
  isLiveNow: boolean
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
  createdAt: Date
  updatedAt: Date
  variants?: VideoVariant[]
  playbackUrl?: string
}

// Video Variant
export interface VideoVariant {
  id: string
  videoId: string
  resolution: string
  width: number
  height: number
  bitrate: number
  codec: string
  format: string
  playlistKey: string
  createdAt: Date
}

// Video View Log
export interface VideoViewLog {
  id: string
  videoId: string
  viewedAt: Date
}

// API Types
export interface PresignUploadRequest {
  fileName: string
  fileSize: number
  contentType: string
}

export interface PresignUploadResponse {
  videoId: string
  uploadUrl: string
  key: string
}

export interface CreateLiveStreamRequest {
  title: string
  description?: string
}

export interface CreateLiveStreamResponse {
  videoId: string
  streamKey: string
  webrtcUrl: string
}

export interface VideoStatsResponse {
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
}
