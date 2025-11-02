# Feature 5: Live Streaming - Broadcasting

**Date**: 2025-11-01
**Estimated Time**: 5-6 hours
**Dependencies**: Feature 1 (Foundation & Setup), Feature 4 (Live Streaming - Viewing)
**Priority**: P1 (High priority)

## Overview

Implement live streaming broadcasting capabilities - create stream, capture camera/microphone, stream via WebRTC or RTMP, and control stream (start/stop, mute, etc.).

## Components/Files to Create

```
apps/web/
├── app/
│   └── live/
│       ├── create/
│       │   └── page.tsx             # Create stream page
│       └── stream/
│           └── [id]/
│               └── page.tsx         # Host streaming page
├── components/
│   └── live/
│       ├── CameraStream.tsx         # Camera capture component
│       └── StreamControls.tsx       # Stream control buttons
├── lib/
│   └── webrtc.ts                    # WebRTC helper (future)
└── hooks/
    └── useLiveStream.ts             # Live stream hook
```

## Broadcasting Flow

```
1. User creates live stream (API: POST /api/live/create)
2. User grants camera/mic permissions
3. User sees local preview (mirrored)
4. User clicks "Start Streaming"
5. WebRTC connection established OR RTMP URL provided
6. Stream goes live
7. HLS manifest becomes available
8. Viewers can watch
9. User clicks "Stop Streaming"
10. Stream ends, becomes VOD
```

## Tasks

### 1. Create Live Stream Hook

**File**: `hooks/useLiveStream.ts`

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'

interface UseLiveStreamOptions {
  onStreamReady?: (stream: MediaStream) => void
  onError?: (error: Error) => void
}

export function useLiveStream({ onStreamReady, onError }: UseLiveStreamOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Request camera and microphone access
  const requestMediaAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user' // Front camera for selfie mode
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = mediaStream
      setStream(mediaStream)
      onStreamReady?.(mediaStream)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera/microphone'
      setError(errorMessage)
      onError?.(new Error(errorMessage))
    }
  }

  // Stop stream and release devices
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
      setIsStreaming(false)
    }
  }

  // Toggle camera on/off
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraOn(videoTrack.enabled)
      }
    }
  }

  // Toggle microphone on/off
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [])

  return {
    stream,
    isStreaming,
    isCameraOn,
    isMicOn,
    error,
    requestMediaAccess,
    stopStream,
    toggleCamera,
    toggleMic,
    setIsStreaming
  }
}
```

### 2. Create Camera Stream Component

**File**: `components/live/CameraStream.tsx`

```typescript
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
```

### 3. Create Stream Controls Component

**File**: `components/live/StreamControls.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, StopCircle } from 'lucide-react'

interface StreamControlsProps {
  isStreaming: boolean
  isCameraOn: boolean
  isMicOn: boolean
  onStartStream: () => void
  onStopStream: () => void
  onToggleCamera: () => void
  onToggleMic: () => void
  disabled?: boolean
}

export function StreamControls({
  isStreaming,
  isCameraOn,
  isMicOn,
  onStartStream,
  onStopStream,
  onToggleCamera,
  onToggleMic,
  disabled = false,
}: StreamControlsProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Stream Controls</h3>

        {/* Media controls */}
        <div className="flex gap-3">
          <Button
            variant={isCameraOn ? 'default' : 'destructive'}
            size="lg"
            onClick={onToggleCamera}
            disabled={disabled}
            className="flex-1"
          >
            {isCameraOn ? (
              <>
                <Video className="w-5 h-5 mr-2" />
                Camera On
              </>
            ) : (
              <>
                <VideoOff className="w-5 h-5 mr-2" />
                Camera Off
              </>
            )}
          </Button>

          <Button
            variant={isMicOn ? 'default' : 'destructive'}
            size="lg"
            onClick={onToggleMic}
            disabled={disabled}
            className="flex-1"
          >
            {isMicOn ? (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Mic On
              </>
            ) : (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Mic Off
              </>
            )}
          </Button>
        </div>

        {/* Stream start/stop */}
        <div>
          {!isStreaming ? (
            <Button
              onClick={onStartStream}
              disabled={disabled}
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Start Streaming
            </Button>
          ) : (
            <Button
              onClick={onStopStream}
              disabled={disabled}
              size="lg"
              variant="destructive"
              className="w-full"
            >
              <StopCircle className="w-5 h-5 mr-2" />
              Stop Streaming
            </Button>
          )}
        </div>

        {/* Status info */}
        <div className="pt-4 border-t text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">Status:</span>{' '}
            {isStreaming ? (
              <span className="text-red-600 font-semibold">🔴 Live</span>
            ) : (
              <span>Ready to stream</span>
            )}
          </p>
          <p>
            <span className="font-medium">Camera:</span>{' '}
            {isCameraOn ? 'On' : 'Off'}
          </p>
          <p>
            <span className="font-medium">Microphone:</span>{' '}
            {isMicOn ? 'On' : 'Off'}
          </p>
        </div>
      </div>
    </Card>
  )
}
```

### 4. Create Live Stream Creation Page

**File**: `app/live/create/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateLiveStream } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CreateLivePage() {
  const router = useRouter()
  const { mutateAsync: createStream, isPending } = useCreateLiveStream()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a stream title')
      return
    }

    try {
      setError(null)

      const stream = await createStream({
        title: title.trim(),
        description: description.trim() || undefined,
      })

      // Redirect to streaming page
      router.push(`/live/stream/${stream.videoId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stream')
    }
  }

  return (
    <main className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Live Stream</h1>
          <p className="text-gray-600">
            Set up your live stream and start broadcasting
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stream Details</CardTitle>
            <CardDescription>
              Enter information about your live stream
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <Input
                type="text"
                placeholder="Enter stream title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter stream description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={4}
                maxLength={500}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={!title.trim() || isPending}
              className="w-full"
              size="lg"
            >
              {isPending ? 'Creating...' : 'Create & Start Setup'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

### 5. Create Host Streaming Page

**File**: `app/live/stream/[id]/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
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
```

## Testing

### 1. Test Stream Creation

Visit: `http://localhost:3000/live/create`

**Steps**:

1. Enter stream title
2. Enter description (optional)
3. Click "Create & Start Setup"

**Expected**:

- Redirects to `/live/stream/[id]`
- Stream created in database

### 2. Test Camera Access

On host streaming page:

**Expected**:

- Browser requests camera/microphone permissions
- After granting: Camera preview shows (mirrored)
- Loading state while requesting

**If denied**:

- Error message displayed
- "Retry" button available

### 3. Test Stream Controls

**Test camera toggle**:

- Click "Camera On" → Video preview goes black, button shows "Camera Off"
- Click "Camera Off" → Video preview returns, button shows "Camera On"

**Test mic toggle**:

- Click "Mic On" → Button shows "Mic Off"
- Click "Mic Off" → Button shows "Mic On"

### 4. Test Stream Start/Stop

**Start stream**:

1. Click "Start Streaming"
2. Expected: Live indicator appears on preview
3. Expected: API called (check network tab)
4. Expected: Stream visible on `/live` page

**Stop stream**:

1. Click "Stop Streaming"
2. Expected: Live indicator disappears
3. Expected: Redirects to video page after 2s

### 5. Test Error Scenarios

**Test 1: Invalid video ID**

- Visit `/live/stream/invalid-id`
- Expected: Error message, back button

**Test 2: Start without camera**

- Deny camera permissions
- Try to start stream
- Expected: Error "Camera not ready"

## Verification Checklist

- ✅ Create stream page works
- ✅ Camera access request works
- ✅ Camera preview displays (mirrored)
- ✅ Camera toggle works
- ✅ Mic toggle works
- ✅ Start streaming works
- ✅ Live indicator appears when streaming
- ✅ Stop streaming works
- ✅ Redirect after stop works
- ✅ Error handling works

## Success Criteria

- ✅ Users can create live streams
- ✅ Camera/mic access granted smoothly
- ✅ Preview shows mirrored (selfie mode)
- ✅ Controls work reliably
- ✅ Stream starts/stops correctly
- ✅ Status updates accurate
- ✅ Errors handled gracefully

## Browser Compatibility

Test on:

- ✅ Chrome (getUserMedia, WebRTC)
- ✅ Safari (getUserMedia, WebRTC)
- ✅ Firefox (getUserMedia, WebRTC)
- ❌ iOS Safari (WebRTC limitations)

## Current Limitations

1. **WebRTC not fully implemented**: Currently just calls API, actual streaming TODO
2. **No RTMP streaming**: Could add RTMP option for OBS/external tools
3. **No stream preview for host**: Host can't see HLS output
4. **No viewer count**: Can't see how many watching
5. **iOS limitations**: WebRTC not fully supported on mobile Safari

## Next Steps

After completion, proceed to:

- **Feature 6**: Layout & Navigation
- **Future**: Implement actual WebRTC streaming
- **Future**: Add RTMP streaming option

## Notes

- Mirror effect (`scale-x-[-1]`) provides natural selfie view
- Media constraints optimized for quality (1080p)
- Echo cancellation, noise suppression enabled for audio
- Tracks stopped on unmount to release camera/mic
- Consider adding beauty filters, virtual backgrounds (future)
- Consider adding screen sharing option (future)
- WebRTC implementation will require signaling server
