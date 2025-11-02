# Phase 6: Frontend (Next.js)

**Date**: 2025-10-31 (Updated: 2025-11-01)
**Estimated Time**: 19-24 hours (3-4 days)
**Dependencies**: Phase 3 (Backend API)
**Detailed Plan**: `phase6-impl/` directory with feature-based breakdown

## Overview

Build Next.js 14 app with React 19. Features: video browsing, upload, playback (VOD + Live), live streaming (camera capture). Implementation broken down into 6 focused features for easier development and testing.

## Implementation Features

The implementation is divided into 6 focused features (see `phase6-impl/` directory):

### Feature 1: Foundation & Setup (2-3h, P0)

**File**: `01-foundation-setup.md`

- Install dependencies (HLS.js, React Query, Zustand, Lucide)
- Setup Shadcn/UI components
- Create type-safe API client with TanStack Query hooks
- Configure environment variables
- Setup QueryClientProvider

**Key Files**:

- `lib/api.ts` - API client with TypeScript types
- `lib/hooks.ts` - TanStack Query hooks
- `app/providers.tsx` - QueryClientProvider

### Feature 2: Video Browsing & Playback (4-5h, P0)

**File**: `02-video-browsing-playback.md`

- Home page with video grid
- HLS video player (VOD + Live)
- Video cards with thumbnails
- View tracking and statistics
- Low latency HLS for live streams

**Key Components**:

- `components/video/VideoPlayer.tsx` - HLS.js player
- `components/video/VideoCard.tsx` - Video thumbnail card
- `components/video/VideoList.tsx` - Grid layout
- `components/video/VideoStats.tsx` - View count display
- `hooks/useVideoPlayer.ts` - Player logic
- `hooks/useViewTracking.ts` - View tracking

### Feature 3: Video Upload (3-4h, P1)

**File**: `03-video-upload.md`

- Upload page with form
- File validation (type, size max 500MB)
- Direct upload to MinIO via presigned URL
- Real-time progress tracking with XMLHttpRequest
- Processing status updates

**Key Components**:

- `components/video/UploadForm.tsx` - Upload form with progress
- `app/videos/upload/page.tsx` - Upload page

### Feature 4: Live Streaming - Viewing (2-3h, P1)

**File**: `04-live-streaming-viewing.md`

- Live streams browse page
- Live indicator badges with pulse animation
- Low latency HLS playback
- Empty states with CTAs

**Key Components**:

- `components/live/LiveIndicator.tsx` - Reusable live badge
- `app/live/page.tsx` - Browse live streams

### Feature 5: Live Streaming - Broadcasting (5-6h, P1)

**File**: `05-live-streaming-broadcasting.md`

- Create live stream page
- Camera/microphone capture with getUserMedia
- Stream preview (mirrored for selfie view)
- Stream controls (start/stop, camera/mic toggle)
- Host streaming interface

**Key Components**:

- `components/live/CameraStream.tsx` - Camera capture with preview
- `components/live/StreamControls.tsx` - Control buttons
- `hooks/useLiveStream.ts` - Media stream management
- `app/live/create/page.tsx` - Create stream
- `app/live/stream/[id]/page.tsx` - Host streaming

### Feature 6: Layout & Navigation (2-3h, P0)

**File**: `06-layout-navigation.md`

- Sticky navigation header
- Footer with links
- Logo component with gradient
- Responsive design (mobile/tablet/desktop)
- Global styles and accessibility

**Key Components**:

- `components/layout/Header.tsx` - Navigation with active states
- `components/layout/Footer.tsx` - Footer links
- `components/ui/logo.tsx` - Brand logo
- `app/layout.tsx` - Root layout with metadata

## Final Project Structure

After implementing all features:

```
apps/web/
├── app/
│   ├── layout.tsx                    # Root layout with header/footer
│   ├── page.tsx                      # Home (browse videos)
│   ├── providers.tsx                 # QueryClientProvider
│   ├── globals.css                   # Global styles
│   ├── videos/
│   │   ├── [id]/page.tsx             # Video player
│   │   └── upload/page.tsx           # Upload form
│   └── live/
│       ├── page.tsx                  # Browse live streams
│       ├── create/page.tsx           # Create stream
│       └── stream/[id]/page.tsx      # Host streaming
├── components/
│   ├── video/
│   │   ├── VideoPlayer.tsx
│   │   ├── VideoCard.tsx
│   │   ├── VideoList.tsx
│   │   ├── VideoStats.tsx
│   │   └── UploadForm.tsx
│   ├── live/
│   │   ├── LiveIndicator.tsx
│   │   ├── CameraStream.tsx
│   │   └── StreamControls.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── ui/
│       ├── logo.tsx
│       └── [shadcn components]/
├── lib/
│   ├── api.ts                        # API client
│   ├── hooks.ts                      # TanStack Query hooks
│   ├── webrtc.ts                     # WebRTC (future)
│   └── utils.ts                      # Shadcn utils
└── hooks/
    ├── useVideoPlayer.ts
    ├── useViewTracking.ts
    └── useLiveStream.ts
```

## Implementation Order

### Recommended Sequential Order

```
1. Feature 1: Foundation & Setup         [2-3h]  P0
   ↓
2. Feature 6: Layout & Navigation        [2-3h]  P0 (Can run parallel)
   ↓
3. Feature 2: Video Browsing & Playback  [4-5h]  P0
   ↓
4. Feature 3: Video Upload               [3-4h]  P1
   ↓
5. Feature 4: Live Streaming - Viewing   [2-3h]  P1
   ↓
6. Feature 5: Live Streaming - Broadcasting [5-6h]  P1
```

### Alternative Parallel Approach

**Day 1** (6-8 hours):

- Feature 1: Foundation & Setup
- Feature 6: Layout & Navigation
- Start Feature 2: Video Browsing

**Day 2** (6-8 hours):

- Complete Feature 2: Video Browsing & Playback
- Feature 3: Video Upload

**Day 3** (6-8 hours):

- Feature 4: Live Streaming - Viewing
- Feature 5: Live Streaming - Broadcasting

## Quick Start Guide

For each feature, refer to detailed implementation plan in `phase6-impl/` directory:

1. **Foundation** (`01-foundation-setup.md`)
   - Run: `bun add hls.js lucide-react @tanstack/react-query zustand`
   - Run: `bunx shadcn@latest init`
   - Create `lib/api.ts` and `lib/hooks.ts`
   - Setup `app/providers.tsx`

2. **Layout** (`06-layout-navigation.md`)
   - Create `components/layout/Header.tsx`
   - Create `components/layout/Footer.tsx`
   - Update `app/layout.tsx`
   - Update `app/globals.css`

3. **Video Browsing** (`02-video-browsing-playback.md`)
   - Create video player with HLS.js
   - Create video cards and list components
   - Implement view tracking
   - Build home page and video player page

4. **Upload** (`03-video-upload.md`)
   - Create upload form with validation
   - Implement presigned URL upload
   - Add progress tracking
   - Build upload page

5. **Live Viewing** (`04-live-streaming-viewing.md`)
   - Create live indicator component
   - Update video cards for live badge
   - Build live streams page

6. **Live Broadcasting** (`05-live-streaming-broadcasting.md`)
   - Create camera stream component
   - Create stream controls
   - Implement media capture
   - Build create and host pages

## Environment Setup

**`.env.local`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**`.env.example`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing Strategy

Each feature includes comprehensive testing (see individual feature plans):

### Manual Testing Flow

```bash
bun run dev
open http://localhost:3000
```

**Test Sequence**:

1. Home page - Browse videos (`/`)
2. Video player - Watch VOD (`/videos/[id]`)
3. Upload - Upload new video (`/videos/upload`)
4. Live page - Browse live streams (`/live`)
5. Create stream (`/live/create`)
6. Host stream (`/live/stream/[id]`)

### Browser Compatibility Testing

Test on:

- ✅ Chrome (HLS.js, getUserMedia, WebRTC)
- ✅ Safari (Native HLS, getUserMedia, WebRTC)
- ✅ Firefox (HLS.js, getUserMedia, WebRTC)
- ✅ Mobile Safari (Native HLS, limited WebRTC)

### Responsive Testing

- **Mobile** (< 768px): Bottom nav, single column grid
- **Tablet** (768px-1024px): Top nav, 2 column grid
- **Desktop** (> 1024px): Full nav, 3 column grid

### Accessibility Testing

- Keyboard navigation (Tab, Enter)
- Focus indicators visible
- Screen reader compatibility
- ARIA labels on icons
- Semantic HTML

## Verification Checklist

### Functional Requirements

- ✅ Browse all videos (grid layout)
- ✅ Watch videos with HLS playback
- ✅ Upload videos (up to 500MB)
- ✅ View live streams
- ✅ Host live streams (camera/mic)
- ✅ View counts tracked and displayed
- ✅ Consistent navigation across app

### Technical Requirements

- ✅ TypeScript compilation passes
- ✅ No console errors
- ✅ Responsive on all devices
- ✅ Accessible (keyboard, ARIA)
- ✅ Fast loading (< 3s initial)
- ✅ SEO-friendly (metadata, SSR)

### User Experience

- ✅ Loading states for async operations
- ✅ Error handling with user-friendly messages
- ✅ Progress indicators for uploads/streaming
- ✅ Empty states with clear CTAs
- ✅ Smooth animations and transitions

## Success Criteria

### Users Can

- ✅ Browse all videos in responsive grid
- ✅ Watch videos with adaptive HLS streaming
- ✅ Upload videos with real-time progress
- ✅ View live streams with low latency
- ✅ Host live streams from browser
- ✅ Navigate app intuitively
- ✅ Use app on mobile devices

### App Provides

- ✅ Consistent navigation (header/footer)
- ✅ Real-time view statistics
- ✅ Clear visual feedback
- ✅ Graceful error handling
- ✅ Professional UI/UX

## Known Limitations & Future Enhancements

### Current Limitations

1. **WebRTC not fully implemented** - Streaming calls API but doesn't establish actual connection
2. **No RTMP streaming** - Could add for OBS/external tools
3. **No real-time viewer count** - Could add via WebSocket
4. **No chat feature** - Live chat would enhance experience
5. **iOS WebRTC limitations** - Mobile Safari has limited support

### Future Enhancements

1. **Authentication** - User login, profiles, subscriptions
2. **Search** - Full-text search for videos
3. **Recommendations** - AI-powered video recommendations
4. **Analytics** - Detailed viewer analytics dashboard
5. **Playlists** - Create and share video playlists
6. **Comments** - Video comments and discussions
7. **Notifications** - Push notifications for new uploads
8. **Quality selector** - Manual quality selection
9. **Dark mode** - Theme toggle
10. **Internationalization** - Multi-language support

## Resources

### Documentation

- [Next.js 14 Docs](https://nextjs.org/docs)
- [HLS.js Documentation](https://github.com/video-dev/hls.js)
- [Shadcn/UI Components](https://ui.shadcn.com)
- [TanStack Query Docs](https://tanstack.com/query/latest)

### API Endpoints

Reference `apps/api/src/routes/` for available endpoints:

- `/api/videos/*` - Video management
- `/api/upload/*` - Upload handling
- `/api/live/*` - Live streaming
- `/api/analytics/*` - View analytics

### Detailed Plans

See `phase6-impl/` directory:

- `README.md` - Overview and feature summary
- `01-foundation-setup.md` - Dependencies and setup
- `02-video-browsing-playback.md` - Video player and browsing
- `03-video-upload.md` - Upload functionality
- `04-live-streaming-viewing.md` - Live stream viewing
- `05-live-streaming-broadcasting.md` - Live stream hosting
- `06-layout-navigation.md` - Layout and navigation

## Notes

### Development Best Practices

- Use React Server Components where possible (data fetching)
- Client components only when needed (camera, player, state)
- TanStack Query for all API calls (caching, invalidation)
- Implement loading skeletons for better UX
- Handle errors gracefully (try-catch, error boundaries)
- TypeScript strict mode for type safety
- Follow Shadcn/UI design patterns

### Performance Optimization

- HLS.js adaptive bitrate streaming
- TanStack Query caching reduces API calls
- Low latency HLS for live streams (3-5s delay)
- Direct-to-storage upload (no backend processing)
- Image optimization for thumbnails
- Code splitting with dynamic imports

### Security Considerations

- Presigned URLs for secure uploads (no credentials in frontend)
- File size limits (500MB prevents abuse)
- File type validation (video/\* only)
- CORS configured for API calls
- Media permissions requested explicitly
- No sensitive data in client code
