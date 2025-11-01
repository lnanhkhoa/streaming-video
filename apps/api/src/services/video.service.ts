import { prisma } from '@repo/database'
import type { Video, VideoVariant, VideoVisibility } from '@repo/constants'
import { cacheService } from './cache.service'
import { storageService } from './storage.service'
import { NotFoundError } from '../utils/errors.js'

interface ListVideosOptions {
  limit?: number
  offset?: number
  status?: string
  videoType?: string
  visibility?: string
}

interface VideoWithVariants {
  video: Video & { playbackUrl?: string }
  variants: (VideoVariant & { playbackUrl?: string })[]
}

class VideoService {
  /**
   * List videos with filters and pagination
   */
  async listVideos(options: ListVideosOptions = {}) {
    const { limit = 20, offset = 0, status, videoType, visibility } = options

    // Check cache
    const cacheKey = `video:list:${JSON.stringify(options)}`
    const cached = await cacheService.get<{ videos: Video[]; total: number }>(cacheKey)
    if (cached) return cached

    // Query database
    const where: any = {}
    if (status) where.status = status
    if (videoType) where.videoType = videoType
    if (visibility) where.visibility = visibility

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.video.count({ where })
    ])

    const result = { videos, total }

    // Cache result
    await cacheService.set(cacheKey, result, 60)

    return result
  }

  /**
   * Get video by ID with variants
   */
  async getVideoById(id: string): Promise<VideoWithVariants | null> {
    // Check cache
    const cacheKey = `video:${id}`
    const cached = await cacheService.get<VideoWithVariants>(cacheKey)
    if (cached) return cached

    // Query database
    const video = await prisma.video.findUnique({
      where: { id },
      include: { variants: true }
    })

    if (!video) return null

    // Generate presigned URLs for playback
    let playbackUrl: string | undefined
    if (video.hlsManifestKey) {
      playbackUrl = await storageService.getPresignedDownloadUrl(
        'processed',
        video.hlsManifestKey,
        3600
      )
    }

    const variantsWithUrls = await Promise.all(
      video.variants.map(async (variant) => ({
        id: variant.id,
        videoId: variant.videoId,
        resolution: variant.resolution,
        width: variant.width,
        height: variant.height,
        bitrate: variant.bitrate,
        codec: variant.codec,
        format: variant.format,
        playlistKey: variant.playlistKey,
        createdAt: variant.createdAt,
        playbackUrl: await storageService.getPresignedDownloadUrl(
          'processed',
          variant.playlistKey,
          3600
        )
      }))
    )

    const result: VideoWithVariants = {
      video: {
        id: video.id,
        title: video.title,
        description: video.description ?? undefined,
        status: video.status,
        videoType: video.videoType,
        visibility: video.visibility,
        hlsManifestKey: video.hlsManifestKey ?? undefined,
        thumbnailKey: video.thumbnailKey ?? undefined,
        duration: video.duration ?? undefined,
        streamKey: video.streamKey ?? undefined,
        isLiveNow: video.isLiveNow,
        viewsToday: video.viewsToday,
        viewsMonth: video.viewsMonth,
        viewsTotal: video.viewsTotal,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        playbackUrl
      },
      variants: variantsWithUrls
    }

    // Cache result
    await cacheService.set(cacheKey, result, 30)

    return result
  }

  /**
   * Update video metadata
   */
  async updateVideo(
    id: string,
    data: { title?: string; description?: string; visibility?: VideoVisibility }
  ) {
    // Check if video exists first
    const exists = await prisma.video.findUnique({ where: { id } })
    if (!exists) throw new NotFoundError('Video', id)

    const video = await prisma.video.update({ where: { id }, data })

    // Invalidate cache
    await cacheService.invalidateVideo(id)

    return video
  }

  /**
   * Delete video and associated assets
   */
  async deleteVideo(id: string): Promise<void> {
    const video = await prisma.video.findUnique({
      where: { id },
      include: { variants: true }
    })

    if (!video) {
      throw new NotFoundError('Video', id)
    }

    // Delete from storage
    const deletePromises: Promise<void>[] = []

    // Delete variants
    for (const variant of video.variants) {
      deletePromises.push(storageService.deleteFile('processed', variant.playlistKey))
    }

    // Delete thumbnail
    if (video.thumbnailKey) {
      deletePromises.push(storageService.deleteFile('thumbnails', video.thumbnailKey))
    }

    await Promise.all(deletePromises)

    // Delete from database
    await prisma.video.delete({
      where: { id }
    })

    // Invalidate cache
    await cacheService.invalidateVideo(id)
  }
}

export const videoService = new VideoService()
