# Feature 4: Live Streaming - Viewing

**Date**: 2025-11-01
**Estimated Time**: 2-3 hours
**Dependencies**: Feature 2 (Video Browsing & Playback)
**Priority**: P1 (High priority)

## Overview

Implement live stream viewing capabilities - browse active live streams, display live indicators, and watch live streams with low latency HLS playback.

## Components/Files to Create

```
apps/web/
├── app/
│   └── live/
│       └── page.tsx              # Browse live streams
└── components/
    └── live/
        └── LiveIndicator.tsx     # Live badge component
```

## Features

- Browse page showing only active live streams
- Live indicator badge on video cards
- Reuse existing VideoPlayer for live playback
- Real-time status updates (future enhancement)

## Tasks

### 1. Create Live Indicator Component

**File**: `components/live/LiveIndicator.tsx`

```typescript
'use client'

import { Badge } from '@/components/ui/badge'

interface LiveIndicatorProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function LiveIndicator({
  className = '',
  size = 'md',
  showText = true
}: LiveIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  return (
    <Badge
      className={`bg-red-600 text-white animate-pulse ${sizeClasses[size]} ${className}`}
    >
      <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
      {showText && 'LIVE'}
    </Badge>
  )
}
```

**Features**:

- Pulsing animation for attention
- Configurable size (sm/md/lg)
- Optional text label
- Red background (standard live color)

### 2. Update VideoCard to Use LiveIndicator

**File**: `components/video/VideoCard.tsx` (Update)

```typescript
'use client'

import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { type Video } from '@/lib/api'
import { VideoStats } from './VideoStats'
import { LiveIndicator } from '@/components/live/LiveIndicator'

interface VideoCardProps {
  video: Video
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link href={`/videos/${video.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="p-0">
          <div className="relative w-full aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No thumbnail
              </div>
            )}

            {/* Use LiveIndicator component */}
            {video.isLiveNow && (
              <div className="absolute top-2 right-2">
                <LiveIndicator size="sm" />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CardTitle className="text-lg line-clamp-2 flex-1">{video.title}</CardTitle>
            {video.isLiveNow && <LiveIndicator size="sm" showText={false} />}
          </div>
          {video.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {video.description}
            </p>
          )}
        </CardContent>

        <CardFooter className="px-4 pb-4 pt-0">
          <VideoStats videoId={video.id} />
        </CardFooter>
      </Card>
    </Link>
  )
}
```

### 3. Update VideoPlayer to Highlight Live

**File**: `components/video/VideoPlayer.tsx` (Update)

```typescript
'use client'

import { useState } from 'react'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'
import { useViewTracking } from '@/hooks/useViewTracking'
import { LiveIndicator } from '@/components/live/LiveIndicator'

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
    onError: (err) => setError(err.message),
  })

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {/* Live indicator with larger size and better positioning */}
      {isLive && (
        <div className="absolute top-4 left-4 z-10">
          <LiveIndicator size="lg" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 z-20">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">Playback Error</p>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        onPlay={handlePlay}
        playsInline
      />
    </div>
  )
}
```

### 4. Create Live Streams Page

**File**: `app/live/page.tsx`

```typescript
'use client'

import { useVideos } from '@/lib/hooks'
import { VideoList } from '@/components/video/VideoList'

export default function LivePage() {
  // Fetch only live streams
  const { data: liveVideos = [], isLoading, error } = useVideos(true)

  if (isLoading) {
    return (
      <main className="container mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold">Live Now</h1>
            <div className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-600">Watch live streams happening right now</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading live streams...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Live Now</h1>
        </div>
        <div className="text-center py-12 text-red-600">
          <p>Failed to load live streams: {error.message}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold">Live Now</h1>
          <div className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse" />
        </div>
        <p className="text-gray-600">
          Watch live streams happening right now
        </p>
      </div>

      {liveVideos.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-block w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            No Live Streams
          </h2>
          <p className="text-gray-600 mb-6">
            There are no live streams at the moment. Check back later!
          </p>
          <a
            href="/live/create"
            className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Start a Live Stream
          </a>
        </div>
      ) : (
        <VideoList videos={liveVideos} />
      )}
    </main>
  )
}
```

**Features**:

- Server component with 30s revalidation
- Shows only active live streams
- Empty state with CTA to create stream
- Pulsing indicator in header

### 5. Update Video Player Page for Live Streams

**File**: `app/videos/[id]/page.tsx` (Already updated in Feature 2)

The video player page from Feature 2 already supports live streams with TanStack Query. The `useVideo` hook automatically handles both VOD and live streams, and the `LiveIndicator` component displays the live status.

## Testing

### 1. Test Live Indicator Component

Create temporary test page to verify animations:

```typescript
// Test page
export default function TestPage() {
  return (
    <div className="p-8 space-y-4">
      <LiveIndicator size="sm" />
      <LiveIndicator size="md" />
      <LiveIndicator size="lg" />
      <LiveIndicator size="md" showText={false} />
    </div>
  )
}
```

**Expected**:

- Pulsing animation visible
- Different sizes work
- White dot pulses
- Text optional

### 2. Test Live Streams Page

Visit: `http://localhost:3000/live`

**Expected**:

- If no live streams: Empty state with CTA
- If live streams exist: Grid of live stream cards
- Page revalidates every 30s

### 3. Test Live Stream Playback

**Prerequisites**: Create a live stream via API

**Steps**:

1. Create live stream via API
2. Start streaming (RTMP or WebRTC)
3. Visit `/live` page
4. Click on live stream card

**Expected**:

- Live indicator shows on card
- Live indicator shows on player
- HLS plays with low latency
- View count increments

### 4. Test Status Transitions

**Test stream going offline**:

1. Watch live stream
2. Stop stream from host side
3. Wait 30s for revalidation

**Expected**:

- Stream disappears from `/live` page
- Video page shows "Uploaded" instead of "Streaming live now"

### 5. Test Multiple Live Streams

Create multiple live streams and verify:

- All show on `/live` page
- All have live indicators
- Can switch between streams

## Verification Checklist

- ✅ LiveIndicator component works
- ✅ Pulsing animation smooth
- ✅ Live page loads correctly
- ✅ Empty state displays when no streams
- ✅ Live streams display in grid
- ✅ Live indicator on cards
- ✅ Live indicator on player
- ✅ Low latency playback works
- ✅ Page revalidation works (30s)
- ✅ Status transitions correct

## Success Criteria

- ✅ Users can browse live streams
- ✅ Live streams clearly marked
- ✅ Empty state informative
- ✅ Playback with low latency
- ✅ Real-time updates (via revalidation)
- ✅ Smooth transitions

## Performance Considerations

- Page revalidation: 30s is balance between freshness and server load
- Consider WebSocket for real-time updates (future enhancement)
- HLS low latency mode: 3-5 second delay is acceptable
- Static generation with revalidation reduces API calls

## Future Enhancements

1. **Real-time updates**: WebSocket for instant status changes
2. **Viewer count**: Show number of current viewers
3. **Chat integration**: Live chat alongside stream
4. **Stream quality selector**: Manual quality selection
5. **Stream preview**: Thumbnail preview on hover
6. **Notifications**: Alert when followed streamer goes live

## Next Steps

After completion, proceed to:

- **Feature 5**: Live Streaming - Broadcasting

## Notes

- Revalidation every 30s keeps data fresh without excessive load
- Empty state encourages users to create streams
- LiveIndicator component reusable across app
- Low latency HLS configured in VideoPlayer hook
- Consider adding "Live" filter to main video page
- Could add "Recently Live" section showing ended streams
