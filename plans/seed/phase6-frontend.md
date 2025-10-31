# Phase 6: Frontend (Next.js)

**Date**: 2025-10-31
**Estimated Time**: 5-6 days
**Dependencies**: Phase 3 (Backend API)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 6)

## Overview

Build Next.js 14 app with React 19. Features: video browsing, upload, playback (VOD + Live), live streaming (camera capture).

## Tasks

### 1. Project Structure

Already exists in `apps/web/`. Update to:

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx             # Browse all videos
│   ├── videos/
│   │   ├── [id]/page.tsx    # Video player
│   │   └── upload/page.tsx  # Upload form
│   └── live/
│       ├── page.tsx         # Browse live streams
│       ├── create/page.tsx  # Create stream
│       └── stream/[id]/page.tsx  # Host streaming
├── components/
│   ├── video/
│   │   ├── VideoPlayer.tsx
│   │   ├── VideoCard.tsx
│   │   ├── VideoList.tsx
│   │   ├── UploadForm.tsx
│   │   └── VideoStats.tsx
│   ├── live/
│   │   ├── CameraStream.tsx
│   │   ├── StreamControls.tsx
│   │   ├── LiveStreamCard.tsx
│   │   └── LiveIndicator.tsx
│   └── ui/ # Shadcn components
├── lib/
│   ├── api.ts
│   ├── webrtc.ts
│   └── analytics.ts
└── hooks/
    ├── useVideoPlayer.ts
    ├── useLiveStream.ts
    └── useViewTracking.ts
```

### 2. Install Dependencies

```bash
cd apps/web
bun add hls.js lucide-react @tanstack/react-query zustand
```

### 3. Shadcn/UI Setup

```bash
bunx shadcn-ui@latest init

# Add components
bunx shadcn-ui@latest add button
bunx shadcn-ui@latest add card
bunx shadcn-ui@latest add input
bunx shadcn-ui@latest add badge
bunx shadcn-ui@latest add progress
```

### 4. API Client

**`lib/api.ts`**:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class APIClient {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`)
    if (!res.ok) throw new Error(`API error: ${res.statusText}`)
    return res.json()
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    })
    if (!res.ok) throw new Error(`API error: ${res.statusText}`)
    return res.json()
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${API_URL}${path}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`API error: ${res.statusText}`)
  }
}

export const api = new APIClient()
```

### 5. Core Components (Priority Order)

#### 5.1 Video Player (VOD + Live)

Reference detailed plan section 6.2 for full implementation.

**Key features**:

- HLS.js for adaptive streaming
- Low latency mode for live
- Auto-track views on play
- Support both VOD and Live

#### 5.2 Video Stats

Display view counts (today/month/total). See section 6.2.

#### 5.3 Video Card & List

```typescript
// VideoCard.tsx
interface VideoCardProps {
  video: Video
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Card>
      <img src={video.thumbnailUrl} alt={video.title} />
      <CardTitle>{video.title}</CardTitle>
      {video.isLiveNow && <LiveIndicator />}
      <VideoStats videoId={video.id} />
    </Card>
  )
}

// VideoList.tsx
export function VideoList({ videos }: { videos: Video[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {videos.map(video => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
```

#### 5.4 Upload Form

Reference detailed plan section 6.3.

**Flow**:

1. Select file
2. Get presigned URL from API
3. Upload directly to MinIO
4. Notify API completion
5. Show processing status

#### 5.5 Camera Stream Component

Reference detailed plan section 6.4.

**Features**:

- Request camera/mic permissions
- Display local preview
- Mirror video for selfie view
- Show "LIVE" indicator

#### 5.6 Stream Controls

Reference detailed plan section 6.4.

**Controls**:

- Start/Stop streaming
- Toggle video on/off
- Toggle audio on/off

### 6. Pages

#### 6.1 Home Page

**`app/page.tsx`**:

```typescript
export default async function HomePage() {
  const videos = await api.get<Video[]>('/api/videos/list')

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Videos</h1>
      <VideoList videos={videos} />
    </main>
  )
}
```

#### 6.2 Video Player Page

**`app/videos/[id]/page.tsx`**:

```typescript
export default async function VideoPage({ params }: { params: { id: string } }) {
  const video = await api.get<Video>(`/api/videos/${params.id}`)

  return (
    <main className="container mx-auto p-8">
      <VideoPlayer
        videoId={video.id}
        manifestUrl={`${API_URL}/videos/${video.hlsManifestKey}`}
        isLive={video.isLiveNow}
      />
      <h1 className="text-3xl font-bold mt-4">{video.title}</h1>
      <p className="text-gray-600">{video.description}</p>
      <VideoStats videoId={video.id} />
    </main>
  )
}
```

#### 6.3 Upload Page

**`app/videos/upload/page.tsx`**:

```typescript
export default function UploadPage() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Upload Video</h1>
      <UploadForm />
    </main>
  )
}
```

#### 6.4 Live Streams Page

**`app/live/page.tsx`**:

```typescript
export default async function LivePage() {
  // Fetch only live streams
  const liveVideos = await api.get<Video[]>('/api/videos/list?live=true')

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🔴 Live Now</h1>
      <VideoList videos={liveVideos} />
    </main>
  )
}
```

#### 6.5 Create Live Stream Page

**`app/live/create/page.tsx`**:

```typescript
'use client'

export default function CreateLivePage() {
  const [title, setTitle] = useState('')

  const handleCreate = async () => {
    const stream = await api.post('/api/live/create', {
      title,
      description: ''
    })

    // Redirect to streaming page
    router.push(`/live/stream/${stream.videoId}`)
  }

  return (
    <main className="container mx-auto p-8">
      <h1>Create Live Stream</h1>
      <Input
        placeholder="Stream title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button onClick={handleCreate}>Create Stream</Button>
    </main>
  )
}
```

#### 6.6 Host Streaming Page

**`app/live/stream/[id]/page.tsx`**:

```typescript
'use client'

export default function StreamHostPage({ params }: { params: { id: string } }) {
  const [stream, setStream] = useState<MediaStream | null>(null)

  const handleStartStream = async () => {
    await api.post(`/api/live/${params.id}/start`)
    // TODO: Establish WebRTC connection
  }

  const handleStopStream = async () => {
    await api.post(`/api/live/${params.id}/stop`)
    stream?.getTracks().forEach(track => track.stop())
  }

  return (
    <main className="container mx-auto p-8">
      <h1>Host Live Stream</h1>
      <CameraStream
        videoId={params.id}
        onStreamReady={setStream}
      />
      <StreamControls
        stream={stream}
        onStartStream={handleStartStream}
        onStopStream={handleStopStream}
      />
    </main>
  )
}
```

### 7. Layout & Navigation

**`app/layout.tsx`**:

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b">
          <div className="container mx-auto p-4 flex gap-4">
            <Link href="/">Videos</Link>
            <Link href="/live">Live</Link>
            <Link href="/videos/upload">Upload</Link>
            <Link href="/live/create">Go Live</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

### 8. Environment Variables

**`.env.local`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 9. Testing

Test each page:

```bash
bun run dev

# Open browser
open http://localhost:3000

# Test flow:
1. Browse videos (/)
2. Watch video (/videos/[id])
3. Upload video (/videos/upload)
4. View live streams (/live)
5. Create & host stream (/live/create → /live/stream/[id])
```

## Verification

- ✅ All pages accessible
- ✅ Video player works (VOD)
- ✅ Upload flow complete
- ✅ View tracking works
- ✅ Live indicator shows correctly
- ✅ Camera stream captures correctly
- ✅ Responsive design (mobile/desktop)

## Success Criteria

- ✅ Users can browse videos
- ✅ Users can watch videos (HLS playback)
- ✅ Users can upload videos
- ✅ Users can view live streams
- ✅ Users can host live streams (camera)
- ✅ View counts display correctly
- ✅ No console errors
- ✅ Loading states work

## Notes

- Reference detailed plan section 6 for complete component code
- Use React Server Components where possible
- Client components only when needed (camera, player)
- Implement loading skeletons for better UX
- Handle errors gracefully (try-catch, error boundaries)
- Test on Chrome, Safari, Firefox
