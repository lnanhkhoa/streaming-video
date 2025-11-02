export const HELLO_WORLD = 'Hello World'
// Video Processing
export const HLS_VARIANTS = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800 },
  { resolution: '480p', width: 854, height: 480, bitrate: 1400 }
] as const

export const VIDEO_RESOLUTIONS = ['1080p', '720p', '480p'] as const

export const VIDEO_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
  LIVE: 'LIVE'
} as const

// Upload Limits
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
export const MIN_FILE_SIZE = 1024 // 1KB

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'] as const

// storage buckets
export const BUCKET_RAW = 'videos-raw'
export const BUCKET_PROCESSED = 'videos-processed'
export const BUCKET_THUMBNAILS = 'thumbnails'

// FFmpeg Settings
export const FFMPEG_PRESET = 'medium'
export const FFMPEG_CRF = 23
export const HLS_SEGMENT_TIME = 6 // seconds
export const HLS_LIVE_SEGMENT_TIME = 2 // seconds

// Cache TTL (seconds)
export const CACHE_TTL = {
  VIDEO_LIST: 60,
  VIDEO_STATS: 30,
  PRESIGNED_URL: 3600
} as const

// View Reset Times
export const DAILY_RESET_HOUR = 0 // Midnight UTC
export const MONTHLY_RESET_DAY = 1 // 1st of month
