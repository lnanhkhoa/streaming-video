import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { NotFoundError, UnauthorizedError, BadRequestError } from '../utils/errors.js'

interface CreateStreamResult {
  videoId: string
  streamKey: string
  rtmpUrl: string
  playbackUrl: string
}

/**
 * Live Streaming Service (MVP - Metadata Only)
 *
 * Phase 3: Manages stream lifecycle and metadata
 * Future: Will integrate with RTMP server or Cloudflare Stream
 * See: plans/seed/phase3-impl/08-live-routes-rtmp-future.md
 */
class LiveService {
  /**
   * Create new live stream session
   */
  async createStream(title: string, description?: string): Promise<CreateStreamResult> {
    const videoId = nanoid()
    const streamKey = nanoid(32) // Long secret key for authentication

    // Create video record with LIVE type
    await prisma.video.create({
      data: {
        id: videoId,
        title,
        description: description || null,
        status: 'PENDING',
        videoType: 'LIVE',
        visibility: 'PRIVATE', // Default to private until streamer is ready
        streamKey,
        isLiveNow: false,
        viewsToday: 0,
        viewsMonth: 0,
        viewsTotal: 0
      }
    })

    // TODO: In Phase 5, integrate with actual RTMP server
    // For now, return placeholder URLs
    const rtmpUrl = `rtmp://localhost:1935/live/${streamKey}`
    const playbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/live/${videoId}/watch`

    console.log(`✅ Created live stream: ${videoId}`)

    return {
      videoId,
      streamKey,
      rtmpUrl,
      playbackUrl
    }
  }

  /**
   * Start live streaming (update status)
   */
  async startStream(videoId: string, streamKey: string): Promise<void> {
    // Verify stream key for authentication
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      throw new NotFoundError('Video', videoId)
    }

    if (video.streamKey !== streamKey) {
      throw new UnauthorizedError('Invalid stream key')
    }

    if (video.videoType !== 'LIVE') {
      throw new BadRequestError('Not a live stream')
    }

    // Update status to LIVE
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'LIVE',
        isLiveNow: true
      }
    })

    console.log(`✅ Stream started: ${videoId}`)
  }

  /**
   * Stop live streaming
   */
  async stopStream(videoId: string, convertToVOD: boolean = false): Promise<void> {
    const updateData: any = {
      isLiveNow: false
    }

    if (convertToVOD) {
      // Mark as PENDING for future VOD conversion
      // Worker will process recorded stream file
      updateData.status = 'PENDING'
      console.log(`📼 Stream ${videoId} marked for VOD conversion`)
    } else {
      // Just mark as completed live stream
      updateData.status = 'READY'
    }

    await prisma.video.update({
      where: { id: videoId },
      data: updateData
    })

    console.log(`✅ Stream stopped: ${videoId}`)
  }

  /**
   * Get active live streams
   */
  async getActiveStreams(): Promise<any[]> {
    return prisma.video.findMany({
      where: {
        isLiveNow: true,
        videoType: 'LIVE',
        visibility: 'PUBLIC' // Only show public streams
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailKey: true,
        viewsTotal: true,
        createdAt: true
      }
    })
  }

  /**
   * Get stream details (for viewers)
   */
  async getStream(videoId: string): Promise<any> {
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      throw new NotFoundError('Stream', videoId)
    }

    if (video.videoType !== 'LIVE') {
      throw new BadRequestError('Not a live stream')
    }

    // Don't expose stream key to viewers
    const { streamKey, ...streamData } = video

    return streamData
  }

  /**
   * Update stream visibility
   */
  async updateStreamVisibility(
    videoId: string,
    visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
  ): Promise<void> {
    await prisma.video.update({
      where: { id: videoId },
      data: { visibility }
    })

    console.log(`✅ Stream ${videoId} visibility updated to ${visibility}`)
  }
}

export const liveService = new LiveService()
