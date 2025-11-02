'use client'

import { useEffect, useRef } from 'react'
import shaka from 'shaka-player'

interface UseVideoPlayerOptions {
  manifestUrl: string
  isLive: boolean
  onPlay?: () => void
  onError?: (error: Error) => void
}

export function useVideoPlayer({ manifestUrl, isLive, onPlay, onError }: UseVideoPlayerOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<shaka.Player | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Initialize Shaka Player
    const initPlayer = async () => {
      try {
        // Clean up previous instance
        if (playerRef.current) {
          await playerRef.current.destroy()
          playerRef.current = null
        }

        // Create new player
        const player = new shaka.Player(video)

        // Configure player
        player.configure({
          streaming: {
            bufferingGoal: isLive ? 2 : 10,
            rebufferingGoal: isLive ? 2 : 8,
            lowLatencyMode: isLive
          }
        })

        // Listen for errors
        player.addEventListener('error', (event: Event) => {
          const errorEvent = event as shaka.util.FakeEvent
          const error = errorEvent.detail as shaka.util.Error
          console.error('Shaka Player error:', error)
          onError?.(new Error(`Playback error: ${error.message}`))
        })

        // Load manifest
        await player.load(manifestUrl)
        console.log('Manifest loaded successfully')

        playerRef.current = player
      } catch (error) {
        console.error('Failed to initialize player:', error)
        onError?.(error instanceof Error ? error : new Error('Failed to initialize player'))
      }
    }

    initPlayer()

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [manifestUrl, isLive, onError])

  const handlePlay = () => {
    onPlay?.()
  }

  return { videoRef, handlePlay }
}
