'use client'

import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Video } from '@repo/constants'
import { VideoStats } from './VideoStats'
import { env } from '@/env'
import Image from 'next/image'

interface VideoCardProps {
  video: Video
}

export function VideoCard({ video }: VideoCardProps) {
  const thumbnailUrl = `${env.THUMBNAILS_STORAGE_URL}/${video.thumbnailKey}`
  return (
    <Link href={`/videos/${video.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="p-0">
          <div className="relative w-full aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
            {video.thumbnailKey ? (
              <Image
                src={thumbnailUrl}
                alt={video.title}
                width={100}
                height={100}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No thumbnail
              </div>
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
