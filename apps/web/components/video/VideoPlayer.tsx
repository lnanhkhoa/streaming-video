'use client'

import { useState } from 'react'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'
import { useViewTracking } from '@/hooks/useViewTracking'
import { Badge } from '@/components/ui/badge'

interface VideoPlayerProps {
  videoId: string
  manifestUrl: string
  isLive: boolean
}

export function VideoPlayer({ videoId, manifestUrl, isLive }: VideoPlayerProps) {
  const [error, setError] = useState<string | null>(null)
  const { trackView } = useViewTracking(videoId)

  const { videoRef, handlePlay } = useVideoPlayer({
    manifestUrl,
    isLive,
    onPlay: trackView,
    onError: (err) => setError(err.message)
  })

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {isLive && (
        <Badge className="absolute top-4 left-4 z-10 bg-red-600 text-white">🔴 LIVE</Badge>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">Playback Error</p>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        </div>
      )}

      <video ref={videoRef} controls className="w-full h-full" onPlay={handlePlay} playsInline />
    </div>
  )
}
