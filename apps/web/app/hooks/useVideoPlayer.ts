'use client'

import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface UseVideoPlayerOptions {
  manifestUrl: string
  isLive: boolean
  onPlay?: () => void
  onError?: (error: Error) => void
}

export function useVideoPlayer({
  manifestUrl,
  isLive,
  onPlay,
  onError,
}: UseVideoPlayerOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Clean up previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Low latency config for live streams
        liveSyncDurationCount: isLive ? 3 : undefined,
        liveMaxLatencyDurationCount: isLive ? 5 : undefined,
        enableWorker: true,
        lowLatencyMode: isLive,
      })

      hls.loadSource(manifestUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed')
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('Fatal HLS error:', data)
          onError?.(new Error(`HLS error: ${data.type} - ${data.details}`))
        }
      })

      hlsRef.current = hls
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = manifestUrl
      video.addEventListener('error', () => {
        onError?.(new Error('Video playback error'))
      })
    } else {
      onError?.(new Error('HLS not supported in this browser'))
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [manifestUrl, isLive, onError])

  const handlePlay = () => {
    onPlay?.()
  }

  return { videoRef, handlePlay }
}
