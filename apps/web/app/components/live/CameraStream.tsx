'use client'

import { useEffect, useRef } from 'react'
import { useLiveStream } from '@/hooks/useLiveStream'
import { Button } from '@/components/ui/button'
import { LiveIndicator } from './LiveIndicator'

interface CameraStreamProps {
  videoId: string
  isStreaming: boolean
  onStreamReady?: (stream: MediaStream) => void
}

export function CameraStream({ videoId, isStreaming, onStreamReady }: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const {
    stream,
    error,
    requestMediaAccess,
  } = useLiveStream({
    onStreamReady,
    onError: (err) => console.error('Media access error:', err),
  })

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Request access on mount
  useEffect(() => {
    requestMediaAccess()
  }, [])

  if (error) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center p-8">
        <div className="text-center text-white">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-xl font-semibold mb-2">Camera Access Error</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={requestMediaAccess} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4" />
          <p>Requesting camera access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Live indicator when streaming */}
      {isStreaming && (
        <div className="absolute top-4 left-4 z-10">
          <LiveIndicator size="lg" />
        </div>
      )}

      {/* Preview video - mirrored for selfie view */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]" // Mirror horizontally
      />

      {/* Overlay info */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
          {isStreaming ? (
            <p className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-pulse" />
              You are live
            </p>
          ) : (
            <p>Camera preview - Ready to go live</p>
          )}
        </div>
      </div>
    </div>
  )
}
