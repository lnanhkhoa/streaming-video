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
