import { prisma } from '@repo/database'
import { cacheService } from './cache.service'
import { NotFoundError } from '../utils/errors'

interface VideoStats {
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
}

class AnalyticsService {
  /**
   * Track video view - increment counters and create log
   */
  async trackView(videoId: string, ipAddress?: string): Promise<void> {
    // Check if video exists first
    const videoExists = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true }
    })

    if (!videoExists) {
      throw new NotFoundError('Video', videoId)
    }

    // Increment all view counters atomically
    await prisma.video.update({
      where: { id: videoId },
      data: {
        viewsToday: { increment: 1 },
        viewsMonth: { increment: 1 },
        viewsTotal: { increment: 1 }
      }
    })

    // Create view log
    await prisma.videoViewLog.create({
      data: {
        videoId,
        ipAddress,
        viewedAt: new Date()
      }
    })

    // Invalidate stats cache
    await cacheService.del(cacheService.keys.videoStats(videoId))
  }

  /**
   * Get video stats with caching
   */
  async getStats(videoId: string): Promise<VideoStats | null> {
    // Check cache
    const cached = await cacheService.getVideoStats<VideoStats>(videoId)
    // if (cached) return cached

    // Query database
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        viewsToday: true,
        viewsMonth: true,
        viewsTotal: true
      }
    })

    if (!video) return null

    const stats: VideoStats = {
      viewsToday: video.viewsToday,
      viewsMonth: video.viewsMonth,
      viewsTotal: video.viewsTotal
    }

    // Cache result
    await cacheService.cacheVideoStats(videoId, stats)

    return stats
  }

  /**
   * Reset daily view counters (run at midnight UTC)
   */
  async resetDailyViews(): Promise<number> {
    try {
      const result = await prisma.video.updateMany({
        data: {
          viewsToday: 0
        }
      })

      console.log(`✅ Reset daily views for ${result.count} videos`)
      return result.count
    } catch (error) {
      console.error('Reset daily views error:', error)
      throw new Error('Failed to reset daily views')
    }
  }

  /**
   * Reset monthly view counters (run on 1st of month)
   */
  async resetMonthlyViews(): Promise<number> {
    try {
      const result = await prisma.video.updateMany({
        data: {
          viewsMonth: 0
        }
      })

      console.log(`✅ Reset monthly views for ${result.count} videos`)
      return result.count
    } catch (error) {
      console.error('Reset monthly views error:', error)
      throw new Error('Failed to reset monthly views')
    }
  }
}

export const analyticsService = new AnalyticsService()
