/**
 * Worker-specific types
 */

export interface TranscodeJob {
  videoId: string
  inputKey: string
}

export interface TranscodeResult {
  videoId: string
  manifestKey: string
  thumbnailKey: string
  duration: number
  variants: {
    resolution: string
    playlistKey: string
  }[]
}

export interface LiveStreamConfig {
  videoId: string
  streamKey: string
  outputDir: string
}
