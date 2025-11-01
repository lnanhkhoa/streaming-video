# Feature 1: Foundation & Setup

**Date**: 2025-11-01
**Estimated Time**: 2-3 hours
**Dependencies**: None
**Priority**: P0 (Must complete first)

## Overview

Setup Next.js 14 project foundation including dependencies, UI framework (Shadcn/UI), API client, and environment configuration.

## Components/Files to Create

```
apps/web/
├── lib/
│   └── api.ts              # API client
├── .env.local              # Environment variables
└── components/
    └── ui/                 # Shadcn components (via CLI)
```

## Tasks

### 1. Install Core Dependencies

```bash
cd apps/web
bun add hls.js lucide-react @tanstack/react-query zustand
```

**Dependencies**:
- `hls.js`: HLS video playback
- `lucide-react`: Icon library
- `@tanstack/react-query`: Data fetching & caching
- `zustand`: State management

### 2. Setup Shadcn/UI

```bash
cd apps/web
bunx shadcn@latest init

# Follow prompts:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes

# Install required components
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add input
bunx shadcn@latest add badge
bunx shadcn@latest add progress
```

**Generates**:
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/input.tsx`
- `components/ui/badge.tsx`
- `components/ui/progress.tsx`
- `lib/utils.ts`
- `tailwind.config.js` (updated)
- `components.json`

### 3. Create API Client & Hooks

**File**: `lib/api.ts` (API utilities)

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Video {
  id: string
  title: string
  description: string
  thumbnailUrl?: string
  hlsManifestKey: string
  isLiveNow: boolean
  createdAt: string
  updatedAt: string
}

export interface LiveStream {
  videoId: string
  streamKey: string
  rtmpUrl: string
  isActive: boolean
}

export interface ViewStats {
  videoId: string
  viewsToday: number
  viewsThisMonth: number
  viewsTotal: number
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`API error: ${res.statusText} - ${error}`)
  }

  return res.json()
}

// Video endpoints
export const videoAPI = {
  listVideos: (liveOnly?: boolean) => {
    const query = liveOnly ? '?live=true' : ''
    return apiRequest<Video[]>(`/api/videos/list${query}`)
  },
  getVideo: (id: string) => apiRequest<Video>(`/api/videos/${id}`),
  getVideoStats: (id: string) => apiRequest<ViewStats>(`/api/videos/${id}/stats`),
  trackView: (id: string) => apiRequest(`/api/videos/${id}/view`, { method: 'POST' }),
}

// Live streaming endpoints
export const liveAPI = {
  createLiveStream: (data: { title: string; description?: string }) =>
    apiRequest<LiveStream>('/api/live/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  startLiveStream: (videoId: string) =>
    apiRequest(`/api/live/${videoId}/start`, { method: 'POST' }),
  stopLiveStream: (videoId: string) =>
    apiRequest(`/api/live/${videoId}/stop`, { method: 'POST' }),
}

// Upload endpoints
export const uploadAPI = {
  getUploadUrl: (filename: string) =>
    apiRequest<{ uploadUrl: string; key: string }>('/api/upload/url', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),
  completeUpload: (data: { key: string; title: string; description?: string }) =>
    apiRequest<Video>('/api/upload/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
```

**File**: `lib/hooks.ts` (TanStack Query hooks)

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { videoAPI, liveAPI, uploadAPI, type Video, type LiveStream, type ViewStats } from './api'

// Query keys
export const queryKeys = {
  videos: ['videos'] as const,
  videoList: (liveOnly?: boolean) => [...queryKeys.videos, 'list', liveOnly] as const,
  video: (id: string) => [...queryKeys.videos, id] as const,
  videoStats: (id: string) => [...queryKeys.videos, id, 'stats'] as const,
  live: ['live'] as const,
  upload: ['upload'] as const,
}

// Video queries
export function useVideos(liveOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.videoList(liveOnly),
    queryFn: () => videoAPI.listVideos(liveOnly),
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: queryKeys.video(id),
    queryFn: () => videoAPI.getVideo(id),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

export function useVideoStats(id: string) {
  return useQuery({
    queryKey: queryKeys.videoStats(id),
    queryFn: () => videoAPI.getVideoStats(id),
    staleTime: 10 * 1000, // 10 seconds
  })
}

export function useTrackView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => videoAPI.trackView(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videoStats(videoId) })
    },
  })
}

// Live streaming mutations
export function useCreateLiveStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description?: string }) =>
      liveAPI.createLiveStream(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos })
    },
  })
}

export function useStartLiveStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => liveAPI.startLiveStream(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.video(videoId) })
    },
  })
}

export function useStopLiveStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => liveAPI.stopLiveStream(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.video(videoId) })
    },
  })
}

// Upload mutations
export function useGetUploadUrl() {
  return useMutation({
    mutationFn: (filename: string) => uploadAPI.getUploadUrl(filename),
  })
}

export function useCompleteUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { key: string; title: string; description?: string }) =>
      uploadAPI.completeUpload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos })
    },
  })
}
```

### 4. Environment Variables

**File**: `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**File**: `.env.example` (for version control)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 5. Update TypeScript Config (if needed)

Verify `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Testing

### 1. Verify Dependencies

```bash
cd apps/web
bun install
```

Should install without errors.

### 2. Setup QueryClientProvider

Create `app/providers.tsx`:

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

Update `app/layout.tsx` to wrap with Providers:

```typescript
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### 3. Test Hooks in Component

Create temporary test component `app/test/page.tsx`:

```typescript
'use client'

import { useVideos } from '@/lib/hooks'

export default function TestPage() {
  const { data: videos, isLoading, error } = useVideos()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>Videos: {videos?.length || 0}</h1>
      <pre>{JSON.stringify(videos, null, 2)}</pre>
    </div>
  )
}
```

Visit `http://localhost:3000/test` to verify hooks work.

### 3. Verify Shadcn Components

Check files exist:
```bash
ls components/ui/
# Should show: button.tsx, card.tsx, input.tsx, badge.tsx, progress.tsx
```

### 4. Test Build

```bash
bun run build
```

Should compile without errors.

## Verification Checklist

- ✅ All dependencies installed (`bun.lockb` updated)
- ✅ Shadcn/UI components generated
- ✅ `lib/api.ts` created with API utilities
- ✅ `lib/hooks.ts` created with TanStack Query hooks
- ✅ `app/providers.tsx` created with QueryClientProvider
- ✅ `app/layout.tsx` updated to wrap with Providers
- ✅ `.env.local` created
- ✅ TypeScript compilation passes
- ✅ No console errors

## Success Criteria

- ✅ `bun install` completes successfully
- ✅ `bun run build` completes successfully
- ✅ TanStack Query hooks can fetch data
- ✅ QueryClientProvider wraps app
- ✅ Shadcn components available for import
- ✅ Environment variables loaded
- ✅ Test page at `/test` displays videos or API error

## Next Steps

After completion, proceed to:
- **Feature 2**: Video Browsing & Playback
- **Feature 6**: Layout & Navigation (can be done in parallel)

## Notes

- Keep `.env.local` in `.gitignore`
- Commit `.env.example` to repo
- API utilities include TypeScript types for type safety
- TanStack Query handles caching and invalidation automatically
- Query stale times configured for different data freshness needs:
  - Videos list: 30 seconds (frequently changes)
  - Single video: 1 minute (moderate changes)
  - Video stats: 10 seconds (real-time updates)
- Mutations automatically invalidate related queries on success
- Shadcn components are copied to project (not npm package)
- `QueryClientProvider` must wrap entire app for hooks to work
