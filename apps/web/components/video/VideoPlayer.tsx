'use client'

import { useState } from 'react'
import Player from 'next-video/player'
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

      <Player
        src={manifestUrl}
        onPlay={trackView}
        onError={() => setError('Failed to load video')}
        controls
        playsInline
      />
    </div>
  )
}
