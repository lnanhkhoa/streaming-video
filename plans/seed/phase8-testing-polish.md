# Phase 8: Testing & Polish

**Date**: 2025-10-31
**Estimated Time**: 2-3 days
**Dependencies**: All previous phases (1-7)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 8)

## Overview

Comprehensive testing, error handling, loading states, responsive design, and final polish for production.

## Tasks

### 1. Error Handling

#### 1.1 Frontend Error Handling

**Create `apps/web/components/ErrorBoundary.tsx`**:

```typescript
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong</h2>
          <p className="mt-4 text-gray-600">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Update `apps/web/app/layout.tsx`**:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>{/* ... */}</nav>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

#### 1.3 API Error Handling in Frontend

**Update `apps/web/lib/api.ts`**:

```typescript
class APIClient {
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    try {
      const res = await fetch(`${API_URL}${path}`, options)

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `HTTP ${res.status}: ${res.statusText}`)
      }

      return res.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error occurred')
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  async post<T>(path: string, data?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    })
  }
}
```

### 2. Loading States

#### 2.1 Skeleton Components

**Create `apps/web/components/ui/skeleton.tsx`**:

```typescript
import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      {...props}
    />
  )
}
```

**Create `apps/web/components/video/VideoCardSkeleton.tsx`**:

```typescript
import { Skeleton } from '@/components/ui/skeleton'

export function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}
```

#### 2.2 Loading Pages

**Create `apps/web/app/loading.tsx`**:

```typescript
import { VideoCardSkeleton } from '@/components/video/VideoCardSkeleton'

export default function Loading() {
  return (
    <main className="container mx-auto p-8">
      <div className="h-10 w-48 bg-gray-200 animate-pulse rounded mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    </main>
  )
}
```

#### 2.3 Upload Progress

**Update `apps/web/components/video/UploadForm.tsx`**:

```typescript
'use client'

import { useState } from 'react'
import { Progress } from '@/components/ui/progress'

export function UploadForm() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')

  const handleUpload = async (file: File) => {
    try {
      setUploading(true)
      setStatus('Getting upload URL...')
      setProgress(10)

      // Get presigned URL
      const { uploadUrl, videoId } = await api.post('/api/upload/presign', {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type
      })

      setStatus('Uploading to storage...')
      setProgress(20)

      // Upload with progress tracking
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 70) + 20
          setProgress(percent)
        }
      })

      await new Promise((resolve, reject) => {
        xhr.onload = () => xhr.status === 200 ? resolve(null) : reject()
        xhr.onerror = reject
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      setStatus('Notifying server...')
      setProgress(95)

      // Notify completion
      await api.post(`/api/upload/${videoId}/complete`)

      setProgress(100)
      setStatus('Upload complete! Processing...')

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = `/videos/${videoId}`
      }, 2000)

    } catch (error) {
      setStatus(`Error: ${error.message}`)
      setUploading(false)
    }
  }

  return (
    <div className="max-w-xl">
      {uploading && (
        <div className="space-y-4">
          <Progress value={progress} />
          <p className="text-sm text-gray-600">{status}</p>
        </div>
      )}
      {/* ... file input ... */}
    </div>
  )
}
```

### 3. Responsive Design

#### 3.1 Mobile Optimization

**Update `apps/web/app/page.tsx`**:

```typescript
export default async function HomePage() {
  const videos = await api.get<Video[]>('/api/videos/list')

  return (
    <main className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl md:text-4xl font-bold mb-4 md:mb-8">Videos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map(video => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </main>
  )
}
```

#### 3.2 Video Player Mobile

**Update `apps/web/components/video/VideoPlayer.tsx`**:

```typescript
export function VideoPlayer({ videoId, manifestUrl, isLive }: Props) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline // Important for mobile
        poster={thumbnailUrl}
      />
    </div>
  )
}
```

#### 3.3 Navigation Mobile

**Update `apps/web/app/layout.tsx`**:

```typescript
'use client'

import { Menu } from 'lucide-react'
import { useState } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <html lang="en">
      <body>
        <nav className="border-b">
          <div className="container mx-auto p-4 flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Link href="/" className="font-bold text-xl">StreamVideo</Link>

              {/* Desktop menu */}
              <div className="hidden md:flex gap-4">
                <Link href="/">Videos</Link>
                <Link href="/live">Live</Link>
                <Link href="/videos/upload">Upload</Link>
                <Link href="/live/create">Go Live</Link>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu />
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden border-t p-4 flex flex-col gap-2">
              <Link href="/" onClick={() => setMenuOpen(false)}>Videos</Link>
              <Link href="/live" onClick={() => setMenuOpen(false)}>Live</Link>
              <Link href="/videos/upload" onClick={() => setMenuOpen(false)}>Upload</Link>
              <Link href="/live/create" onClick={() => setMenuOpen(false)}>Go Live</Link>
            </div>
          )}
        </nav>
        {children}
      </body>
    </html>
  )
}
```

### 4. Validation

#### 4.1 Upload Validation

**Update `apps/web/components/video/UploadForm.tsx`**:

```typescript
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/ogg']

const validateFile = (file: File) => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only MP4, WebM, and OGG are allowed.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 2GB.')
  }

  if (file.size < 1024) {
    throw new Error('File too small. Minimum size is 1KB.')
  }
}
```

#### 4.2 API Validation

**Create `apps/api/src/utils/validator.ts`**:

```typescript
import { z } from 'zod'

export const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z
    .number()
    .min(1024)
    .max(2 * 1024 * 1024 * 1024),
  contentType: z.enum(['video/mp4', 'video/webm', 'video/ogg'])
})

export const createLiveSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional()
})

export const trackViewSchema = z.object({
  videoId: z.string().cuid()
})
```

**Update routes to use validation**:

```typescript
import { uploadSchema } from '../utils/validator'

app.post('/presign', async (c) => {
  const body = await c.req.json()
  const validated = uploadSchema.parse(body) // Throws ZodError if invalid

  // ... rest of logic
})
```

### 5. Testing Scenarios

#### 5.1 API Testing Checklist

Test all endpoints:

```bash
# Health check
curl http://localhost:3001/health

# List videos
curl http://localhost:3001/api/videos/list

# Get video
curl http://localhost:3001/api/videos/{id}

# Get presigned URL
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","fileSize":1000000,"contentType":"video/mp4"}'

# Track view
curl -X POST http://localhost:3001/api/analytics/view/{videoId}

# Get stats
curl http://localhost:3001/api/analytics/stats/{videoId}

# Create live stream
curl -X POST http://localhost:3001/api/live/create \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Stream","description":"Test"}'

# Start stream
curl -X POST http://localhost:3001/api/live/{id}/start

# Stop stream
curl -X POST http://localhost:3001/api/live/{id}/stop
```

#### 5.2 Frontend Testing Checklist

Manual tests:

- [ ] Homepage loads and shows videos
- [ ] Video player works (play, pause, seek)
- [ ] Video quality switching works
- [ ] Upload form validates input
- [ ] Upload progress shows correctly
- [ ] Upload completes successfully
- [ ] View count increments
- [ ] Live streams page shows only live videos
- [ ] Create live stream works
- [ ] Camera permission requested
- [ ] Camera preview displays (mirrored)
- [ ] Start streaming button works
- [ ] Stop streaming button works
- [ ] Live indicator shows correctly
- [ ] Navigation works on mobile
- [ ] Responsive layout on tablet
- [ ] Error messages display properly
- [ ] Loading states show correctly

#### 5.3 Worker Testing Checklist

- [ ] Worker connects to RabbitMQ
- [ ] Consumes transcode jobs
- [ ] Downloads video from MinIO
- [ ] Transcodes to 3 variants
- [ ] Generates thumbnail
- [ ] Creates master playlist
- [ ] Uploads files to MinIO
- [ ] Updates database status
- [ ] Handles FFmpeg errors
- [ ] Cleans up temp files
- [ ] Logs errors properly

### 6. Performance Testing

#### 6.1 Load Testing

**Simple load test script** `scripts/load-test.sh`:

```bash
#!/bin/bash

# Test API endpoints
echo "Testing API performance..."

# List videos (should be fast)
ab -n 1000 -c 10 http://localhost:3001/api/videos/list

# View tracking (should handle concurrent writes)
ab -n 500 -c 50 -p view.json -T application/json \
  http://localhost:3001/api/analytics/view/test-video-id

echo "Load test complete"
```

#### 6.2 Video Playback Testing

Test on different devices:

- Desktop Chrome
- Desktop Safari
- Desktop Firefox
- iPhone Safari
- Android Chrome
- iPad Safari

Test scenarios:

- Seek to different positions
- Switch quality mid-playback
- Play multiple videos in sequence
- Pause and resume
- Full screen mode

### 7. Browser Compatibility

#### 7.1 HLS.js Fallback

**Update `apps/web/components/video/VideoPlayer.tsx`**:

```typescript
useEffect(() => {
  if (!videoRef.current || !manifestUrl) return

  // Native HLS support (Safari)
  if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
    videoRef.current.src = manifestUrl
  }
  // HLS.js for other browsers
  else if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: isLive
    })
    hls.loadSource(manifestUrl)
    hls.attachMedia(videoRef.current)
    setHlsInstance(hls)
  } else {
    console.error('HLS not supported')
  }
}, [manifestUrl, isLive])
```

#### 7.2 Camera API Fallback

**Update `apps/web/components/live/CameraStream.tsx`**:

```typescript
const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: true
    })

    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }

    setStream(stream)
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      setError('Camera permission denied')
    } else if (error.name === 'NotFoundError') {
      setError('No camera found')
    } else {
      setError('Failed to access camera')
    }
  }
}
```

### 8. Final Polish

#### 8.1 Empty States

**Create `apps/web/components/EmptyState.tsx`**:

```typescript
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-gray-500 text-lg">{message}</p>
    </div>
  )
}
```

**Use in pages**:

```typescript
{videos.length === 0 && <EmptyState message="No videos yet" />}
```

#### 8.2 Success Messages

**Create toast notification** (optional, using sonner):

```bash
bun add sonner
```

```typescript
import { toast } from 'sonner'

// In upload completion
toast.success('Video uploaded successfully!')

// In error
toast.error('Upload failed. Please try again.')
```

#### 8.3 Favicon & Meta Tags

**Update `apps/web/app/layout.tsx`**:

```typescript
export const metadata = {
  title: 'StreamVideo - Self-hosted Streaming Platform',
  description: 'Upload and stream videos with adaptive HLS playback',
  icons: {
    icon: '/favicon.ico'
  }
}
```

### 9. Documentation

#### 9.1 README Updates

Update main `README.md` with:

- Quick start guide
- Development setup
- Production deployment
- Testing instructions
- Troubleshooting

#### 9.2 API Documentation

Create `docs/API.md`:

```markdown
# API Documentation

## Endpoints

### Videos

- GET `/api/videos/list` - List all videos
- GET `/api/videos/:id` - Get video details
- DELETE `/api/videos/:id` - Delete video

### Upload

- POST `/api/upload/presign` - Get presigned upload URL
- POST `/api/upload/:id/complete` - Mark upload complete

### Live

- POST `/api/live/create` - Create live stream
- POST `/api/live/:id/start` - Start streaming
- POST `/api/live/:id/stop` - Stop streaming
- POST `/api/live/:id/signal` - WebRTC signaling

### Analytics

- POST `/api/analytics/view/:id` - Track view
- GET `/api/analytics/stats/:id` - Get view stats
```

### 10. Security Checklist

- [ ] All environment variables use strong passwords
- [ ] MinIO bucket is private (presigned URLs only)
- [ ] Database credentials are secure
- [ ] No sensitive data in logs
- [ ] Error messages don't leak internal info
- [ ] File upload size limits enforced
- [ ] File type validation on frontend and backend
- [ ] SQL injection prevented (Prisma parameterized queries)
- [ ] XSS prevented (React escapes by default)
- [ ] CORS configured properly

## Verification

Run through complete user flows:

1. **VOD Flow**:
   - Upload video
   - Wait for processing
   - Watch video
   - Switch quality
   - Check view count

2. **Live Flow**:
   - Create stream
   - Grant camera permission
   - Start streaming
   - Open in another browser
   - Watch live
   - Stop streaming
   - Video converts to VOD

3. **Error Flow**:
   - Upload invalid file
   - Upload oversized file
   - Access non-existent video
   - Network error during upload
   - Camera permission denied

## Success Criteria

- ✅ All error scenarios handled gracefully
- ✅ Loading states show for all async operations
- ✅ Responsive design works on mobile/tablet/desktop
- ✅ All form inputs validated
- ✅ API endpoints return proper error codes
- ✅ Worker handles failures without crashing
- ✅ Camera fallbacks work for unsupported browsers
- ✅ Video player works in all major browsers
- ✅ No console errors in production
- ✅ Performance acceptable under load
- ✅ Documentation complete and accurate
- ✅ Security checklist complete

## Performance Targets

- **Page load**: < 2 seconds
- **API response**: < 200ms
- **Video upload**: Progress updates every 100ms
- **Video start**: < 1 second to first frame
- **Live latency**: < 5 seconds

## Notes

- Test on real devices, not just browser dev tools
- Use realistic video files for testing (not tiny test files)
- Monitor resource usage during transcoding
- Check logs for any warnings or errors
- Verify all cleanup happens (temp files, stopped streams, etc.)
- Test backup/restore procedures

## Final Deliverables

- ✅ Working MVP deployed
- ✅ All features tested
- ✅ Documentation complete
- ✅ Known issues documented
- ✅ Performance benchmarks documented
- ✅ Deployment guide tested
