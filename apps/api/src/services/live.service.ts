import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { NotFoundError, UnauthorizedError, BadRequestError } from '../utils/errors'
import { queueService } from './queue.service'

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

    // RTMP URL for OBS streaming
    const rtmpUrl = `${process.env.RTMP_SERVER_URL || 'rtmp://localhost:1935/live'}/${streamKey}`
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
   * Start live streaming (publish job to worker)
   */
  async startStream(videoId: string, streamKey: string, inputSource?: string): Promise<void> {
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

    // Default input source (can be RTMP URL, file path, or HTTP stream)
    const source = inputSource || `rtmp://localhost:1935/live/${streamKey}`

    // Publish start live stream job to queue
    const published = await queueService.publishStartLiveStreamJob({
      type: 'start-live-stream',
      videoId,
      streamKey,
      inputSource: source
    })

    if (!published) {
      throw new Error('Failed to publish start live stream job')
    }

    console.log(`✅ Start stream job published: ${videoId}`)
  }

  /**
   * Stop live streaming (publish stop job to worker)
   */
  async stopStream(videoId: string, convertToVOD: boolean = false): Promise<void> {
    // Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      throw new NotFoundError('Video', videoId)
    }

    if (video.videoType !== 'LIVE') {
      throw new BadRequestError('Not a live stream')
    }

    // Publish stop live stream job to queue
    const published = await queueService.publishStopLiveStreamJob({
      type: 'stop-live-stream',
      videoId,
      convertToVOD
    })

    if (!published) {
      throw new Error('Failed to publish stop live stream job')
    }

    if (convertToVOD) {
      console.log(`📼 Stop stream job published (convert to VOD): ${videoId}`)
    } else {
      console.log(`✅ Stop stream job published: ${videoId}`)
    }
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

  /**
   * Verify stream key and auto-start stream
   * Called by nginx-rtmp on_publish callback
   */
  async verifyAndStartStream(streamKey: string): Promise<boolean> {
    const video = await prisma.video.findUnique({
      where: { streamKey }
    })

    if (!video || video.videoType !== 'LIVE') {
      return false
    }

    // Auto-start stream on successful publish
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: 'LIVE',
        isLiveNow: true
      }
    })

    console.log(`✅ Auth success: Stream ${video.id} (${video.title})`)
    return true
  }

  /**
   * Handle stream unpublish (stream stopped)
   * Called by nginx-rtmp on_publish_done callback
   */
  async handleUnpublish(streamKey: string): Promise<void> {
    const video = await prisma.video.findUnique({
      where: { streamKey }
    })

    if (video) {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'READY',
          isLiveNow: false
        }
      })
      console.log(`🛑 Stream stopped: ${video.id}`)
    }
  }
}

export const liveService = new LiveService()
