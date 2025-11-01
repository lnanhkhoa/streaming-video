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
