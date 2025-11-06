'use client'

import { useVideo } from '@/lib/hooks'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { TranscodingProgress } from '@/components/video/TranscodingProgress'
import { useParams } from 'next/navigation'
import { env } from '@/env'
import { VIDEO_STATUS } from '@repo/constants'


const video = {
  status: "READY"
}

export default function VideoPage() {
  // const params = useParams()
  // const { data, isLoading, error } = useVideo(params.id as string)
  // const video = data?.video

  // if (isLoading) {
  //   return (
  //     <main className="container mx-auto p-8">
  //       <div className="text-center py-12">
  //         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto" />
  //         <p className="mt-4 text-gray-600">Loading video...</p>
  //       </div>
  //     </main>
  //   )
  // }

  // if (error || !video) {
  //   return (
  //     <main className="container mx-auto p-8">
  //       <div className="text-center py-12 text-red-600">
  //         <p>Failed to load video: {error?.message || 'Video not found'}</p>
  //       </div>
  //     </main>
  //   )
  // }

  // const manifestUrl = `${env.PROCESSED_STORAGE_URL}/${video.hlsManifestKey}`
  const manifestUrl = 'https://pub-aa3b88716caa49448c30e2ab3bd8f98b.r2.dev/interstellar/master.m3u8'

  return (
    <main className="container mx-auto p-8">
      {/* Show transcoding progress */}
      {(video.status === 'PENDING' || video.status === 'PROCESSING') && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <TranscodingProgress videoId={video.id} />
        </div>
      )}

      {/* Show error state */}
      {video.status === 'FAILED' && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 text-red-600">
          ❌ Video transcoding failed. Please try uploading again.
        </div>
      )}

      {/* Show video player when ready */}
      {video.status === VIDEO_STATUS.READY && (
        <VideoPlayer videoId={video.id} manifestUrl={manifestUrl} isLive={false} />
      )}

      <div className="mt-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{video.title}</h1>
        </div>

        {/* {video.description && <p className="text-gray-600 mb-4">{video.description}</p>} */}

        {/* <VideoStats videoId={video.id} /> */}

        {/* <div className="mt-4 text-sm text-gray-500">
          <p>Uploaded: {new Date(video.createdAt).toLocaleDateString()}</p>
        </div> */}
      </div>
    </main>
  )
}
