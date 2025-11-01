# Feature 2: Video Browsing & Playback

**Date**: 2025-11-01
**Estimated Time**: 4-5 hours
**Dependencies**: Feature 1 (Foundation & Setup)
**Priority**: P0 (Core feature)

## Overview

Implement video browsing (home page), video playback with HLS.js, video cards/lists, and view statistics display. Supports both VOD and live streams.

## Components/Files to Create

```
apps/web/
├── app/
│   ├── page.tsx                      # Home page (browse videos)
│   └── videos/
│       └── [id]/page.tsx             # Video player page
├── components/
│   └── video/
│       ├── VideoPlayer.tsx           # HLS video player
│       ├── VideoCard.tsx             # Video thumbnail card
│       ├── VideoList.tsx             # Grid of video cards
│       └── VideoStats.tsx            # View count display
└── hooks/
    ├── useVideoPlayer.ts             # Player logic hook
    └── useViewTracking.ts            # View tracking hook
```

## Tasks

### 1. Create Video Player Hook

**File**: `hooks/useVideoPlayer.ts`

```typescript
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
```

### 2. Create View Tracking Hook

**File**: `hooks/useViewTracking.ts`

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { useTrackView } from '@/lib/hooks'

export function useViewTracking(videoId: string) {
  const hasTracked = useRef(false)
  const { mutate: trackView } = useTrackView()

  const handleTrackView = () => {
    if (hasTracked.current) return

    try {
      trackView(videoId)
      hasTracked.current = true
      console.log('View tracked for video:', videoId)
    } catch (error) {
      console.error('Failed to track view:', error)
    }
  }

  return { trackView: handleTrackView }
}
```

### 3. Create Video Player Component

**File**: `components/video/VideoPlayer.tsx`

```typescript
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
    onError: (err) => setError(err.message),
  })

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {isLive && (
        <Badge className="absolute top-4 left-4 z-10 bg-red-600 text-white">
          🔴 LIVE
        </Badge>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4">
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

### 4. Create Video Stats Component

**File**: `components/video/VideoStats.tsx`

```typescript
'use client'

import { useVideoStats } from '@/lib/hooks'

interface VideoStatsProps {
  videoId: string
}

export function VideoStats({ videoId }: VideoStatsProps) {
  const { data: stats, isLoading } = useVideoStats(videoId)

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading stats...</div>
  }

  if (!stats) {
    return null
  }

  return (
    <div className="flex gap-4 text-sm text-gray-600 mt-2">
      <div>
        <span className="font-semibold">{stats.viewsTotal.toLocaleString()}</span> views
      </div>
      <div className="text-gray-400">•</div>
      <div>
        <span className="font-semibold">{stats.viewsToday.toLocaleString()}</span> today
      </div>
      <div className="text-gray-400">•</div>
      <div>
        <span className="font-semibold">{stats.viewsThisMonth.toLocaleString()}</span> this month
      </div>
    </div>
  )
}
```

### 5. Create Video Card Component

**File**: `components/video/VideoCard.tsx`

```typescript
'use client'

import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { type Video } from '@/lib/api'
import { VideoStats } from './VideoStats'

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

            {video.isLiveNow && (
              <Badge className="absolute top-2 right-2 bg-red-600 text-white">
                🔴 LIVE
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
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

### 6. Create Video List Component

**File**: `components/video/VideoList.tsx`

```typescript
import { type Video } from '@/lib/api'
import { VideoCard } from './VideoCard'

interface VideoListProps {
  videos: Video[]
}

export function VideoList({ videos }: VideoListProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No videos found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
```

### 7. Create Home Page

**File**: `app/page.tsx`

```typescript
'use client'

import { useVideos } from '@/lib/hooks'
import { VideoList } from '@/components/video/VideoList'

export default function HomePage() {
  const { data: videos = [], isLoading, error } = useVideos()

  if (isLoading) {
    return (
      <main className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Videos</h1>
          <p className="text-gray-600">Browse all uploaded videos and live streams</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading videos...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Videos</h1>
          <p className="text-gray-600">Browse all uploaded videos and live streams</p>
        </div>
        <div className="text-center py-12 text-red-600">
          <p>Failed to load videos: {error.message}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Videos</h1>
        <p className="text-gray-600">Browse all uploaded videos and live streams</p>
      </div>

      <VideoList videos={videos} />
    </main>
  )
}
```

### 8. Create Video Player Page

**File**: `app/videos/[id]/page.tsx`

```typescript
'use client'

import { useVideo } from '@/lib/hooks'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { VideoStats } from '@/components/video/VideoStats'
import { Badge } from '@/components/ui/badge'

interface VideoPageProps {
  params: { id: string }
}

export default function VideoPage({ params }: VideoPageProps) {
  const { data: video, isLoading, error } = useVideo(params.id)

  if (isLoading) {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading video...</p>
        </div>
      </main>
    )
  }

  if (error || !video) {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center py-12 text-red-600">
          <p>Failed to load video: {error?.message || 'Video not found'}</p>
        </div>
      </main>
    )
  }

  const manifestUrl = `${process.env.NEXT_PUBLIC_API_URL}/videos/${video.hlsManifestKey}`

  return (
    <main className="container mx-auto p-8">
      <VideoPlayer
        videoId={video.id}
        manifestUrl={manifestUrl}
        isLive={video.isLiveNow}
      />

      <div className="mt-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{video.title}</h1>
          {video.isLiveNow && (
            <Badge className="bg-red-600 text-white">🔴 LIVE</Badge>
          )}
        </div>

        {video.description && (
          <p className="text-gray-600 mb-4">{video.description}</p>
        )}

        <VideoStats videoId={video.id} />

        <div className="mt-4 text-sm text-gray-500">
          <p>Uploaded: {new Date(video.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </main>
  )
}
```

## Testing

### 1. Start Development Server

```bash
cd apps/web
bun run dev
```

### 2. Test Home Page

Visit: `http://localhost:3000`

**Expected**:
- Grid of video cards
- Thumbnails displayed (if available)
- "LIVE" badge on active streams
- View counts displayed

### 3. Test Video Player

Click on a video card or visit: `http://localhost:3000/videos/[video-id]`

**Expected**:
- HLS player loads
- Video controls work (play, pause, seek)
- View count increments on play
- "LIVE" badge shows for live streams
- Low latency mode active for live

### 4. Test Error Handling

Try invalid video ID: `http://localhost:3000/videos/invalid-id`

**Expected**:
- Error message displayed gracefully

### 5. Test Responsive Design

Resize browser window or use mobile device.

**Expected**:
- Grid adjusts: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- Video player maintains aspect ratio

## Verification Checklist

- ✅ Home page loads with video list
- ✅ Video cards display correctly
- ✅ HLS player works (VOD)
- ✅ HLS player works (Live)
- ✅ View tracking triggers on play
- ✅ Stats display (today/month/total)
- ✅ "LIVE" badge shows correctly
- ✅ Responsive design works
- ✅ No console errors
- ✅ Error states handled

## Success Criteria

- ✅ Users can browse all videos
- ✅ Users can click to watch videos
- ✅ HLS playback works smoothly
- ✅ View counts update correctly
- ✅ Live streams play with low latency
- ✅ UI is responsive and polished

## Browser Testing

Test on:
- ✅ Chrome (HLS.js)
- ✅ Safari (Native HLS)
- ✅ Firefox (HLS.js)
- ✅ Mobile Safari (Native HLS)

## Next Steps

After completion, can proceed to:
- **Feature 3**: Video Upload
- **Feature 4**: Live Streaming - Viewing

## Notes

- HLS.js automatically selects quality based on bandwidth
- Low latency mode reduces delay for live streams (3-5 seconds typical)
- View tracking happens once per play session (not on replay)
- Stats are fetched client-side for real-time updates
- Native HLS support in Safari means no HLS.js needed
- Consider adding loading skeletons for better UX
