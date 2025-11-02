'use client'

import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Video } from '@repo/constants'
import { VideoStats } from './VideoStats'

interface VideoCardProps {
  video: Video
}

export function VideoCard({ video }: VideoCardProps) {
  const thumbnailUrl = `${process.env.NEXT_PUBLIC_API_URL}/${video.thumbnailKey}`
  return (
    <Link href={`/videos/${video.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="p-0">
          <div className="relative w-full aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
            {video.thumbnailKey ? (
              <img src={thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No thumbnail
              </div>
            )}

            {video.isLiveNow && (
              <Badge className="absolute top-2 right-2 bg-red-600 text-white">🔴 LIVE</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
          {video.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{video.description}</p>
          )}
        </CardContent>

        <CardFooter className="px-4 pb-4 pt-0">
          <VideoStats videoId={video.id} />
        </CardFooter>
      </Card>
    </Link>
  )
}
