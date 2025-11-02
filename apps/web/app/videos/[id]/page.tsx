'use client'

import { useVideo } from '@/lib/hooks'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { VideoStats } from '@/components/video/VideoStats'
import { Badge } from '@/components/ui/badge'
import { useParams } from 'next/navigation'

export default function VideoPage() {
  const params = useParams()
  const { data, isLoading, error } = useVideo(params.id as string)
  const video = data?.video

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

  const manifestUrl = `${process.env.NEXT_PUBLIC_HLS_URL}/${video.hlsManifestKey}`
  if (!video.hlsManifestKey) {
    return (
      <main className="container mx-auto p-8">
        <div className="text-center py-12 text-red-600">
          <p>Failed to load video: Video not found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto p-8">
      <VideoPlayer videoId={video.id} manifestUrl={manifestUrl} isLive={video.isLiveNow} />

      <div className="mt-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{video.title}</h1>
          {video.isLiveNow && <Badge className="bg-red-600 text-white">🔴 LIVE</Badge>}
        </div>

        {video.description && <p className="text-gray-600 mb-4">{video.description}</p>}

        {/* <VideoStats videoId={video.id} /> */}

        <div className="mt-4 text-sm text-gray-500">
          <p>Uploaded: {new Date(video.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </main>
  )
}
