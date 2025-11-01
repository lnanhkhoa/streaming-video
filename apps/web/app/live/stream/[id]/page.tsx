'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVideo, useStartLiveStream, useStopLiveStream } from '@/lib/hooks'
import { useLiveStream } from '@/hooks/useLiveStream'
import { CameraStream } from '@/components/live/CameraStream'
import { StreamControls } from '@/components/live/StreamControls'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface StreamHostPageProps {
  params: { id: string }
}

export default function StreamHostPage({ params }: StreamHostPageProps) {
  const router = useRouter()
  const [videoId] = useState(params.id)
  const [error, setError] = useState<string | null>(null)

  const { data: streamData, isLoading: isLoadingStream, error: streamError } = useVideo(videoId)
  const { mutateAsync: startStream, isPending: isStarting } = useStartLiveStream()
  const { mutateAsync: stopStream, isPending: isStopping } = useStopLiveStream()

  const {
    stream,
    isStreaming,
    isCameraOn,
    isMicOn,
    toggleCamera,
    toggleMic,
    setIsStreaming,
  } = useLiveStream()

  const handleStartStream = async () => {
    if (!stream) {
      setError('Camera not ready')
      return
    }

    try {
      setError(null)
      await startStream(videoId)
      setIsStreaming(true)

      // TODO: Establish WebRTC connection or provide RTMP URL
      console.log('Stream started:', videoId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream')
    }
  }

  const handleStopStream = async () => {
    try {
      setError(null)
      await stopStream(videoId)
      setIsStreaming(false)

      // Redirect to video page
      setTimeout(() => {
        router.push(`/videos/${videoId}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop stream')
    }
  }

  if (isLoadingStream) {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading stream...</p>
        </div>
      </main>
    )
  }

  if (streamError || !streamData) {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center">
          <p className="text-red-600">{streamError?.message || 'Stream not found'}</p>
          <Button onClick={() => router.push('/live')} className="mt-4">
            Back to Live Streams
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Host Live Stream</h1>
        <p className="text-gray-600">{streamData.title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera preview */}
        <div className="lg:col-span-2">
          <CameraStream
            videoId={videoId}
            isStreaming={isStreaming}
            onStreamReady={(mediaStream) => {
              console.log('Stream ready:', mediaStream)
            }}
          />

          {/* Stream info */}
          <Card className="mt-6 p-6">
            <h3 className="font-semibold mb-3">Stream Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Stream URL:</span>
                <a
                  href={`/videos/${videoId}`}
                  target="_blank"
                  className="text-blue-600 hover:underline"
                >
                  /videos/{videoId}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Video ID:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {videoId}
                </code>
              </div>
            </div>
          </Card>
        </div>

        {/* Controls */}
        <div className="lg:col-span-1">
          <StreamControls
            isStreaming={isStreaming}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            onStartStream={handleStartStream}
            onStopStream={handleStopStream}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
            disabled={!stream || isStarting || isStopping}
          />

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <Card className="mt-6 p-6">
            <h3 className="font-semibold mb-3">Instructions</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Grant camera and microphone permissions</li>
              <li>Check your preview (camera is mirrored)</li>
              <li>Adjust camera and mic settings</li>
              <li>Click "Start Streaming" to go live</li>
              <li>Share your stream URL with viewers</li>
              <li>Click "Stop Streaming" when done</li>
            </ol>
          </Card>
        </div>
      </div>
    </main>
  )
}
