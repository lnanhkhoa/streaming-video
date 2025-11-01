import { Redis } from 'ioredis'
import { CACHE_TTL } from '@repo/constants'
import { env } from '../env'

class CacheService {
  private client: Redis
  private isConnected = false

  constructor() {
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('❌ Redis connection failed after 3 retries')
          return null
        }
        return Math.min(times * 200, 2000)
      }
    })

    this.client.on('connect', () => {
      this.isConnected = true
      console.log('✅ Redis connected')
    })

    this.client.on('error', (err: Error) => {
      this.isConnected = false
      console.error('❌ Redis error:', err.message)
    })
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Parsed JSON value or null
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.isConnected) return null

    try {
      const value = await this.client.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * Set value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isConnected) return

    try {
      const serialized = JSON.stringify(value)
      if (ttl) {
        await this.client.setex(key, ttl, serialized)
      } else {
        await this.client.set(key, serialized)
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Delete key from cache
   * @param key - Cache key or pattern
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) return

    try {
      await this.client.del(key)
    } catch (error) {
      console.error('Cache del error:', error)
    }
  }

  /**
   * Check if key exists
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false

    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  }

  // Cache key generators
  keys = {
    videoList: () => 'video:list',
    video: (id: string) => `video:${id}`,
    videoStats: (id: string) => `video:stats:${id}`,
    presignedUrl: (id: string) => `upload:presigned:${id}`
  }

  /**
   * Cache video list
   */
  async cacheVideoList(videos: unknown[]): Promise<void> {
    await this.set(this.keys.videoList(), videos, CACHE_TTL.VIDEO_LIST)
  }

  /**
   * Get cached video list
   */
  async getVideoList<T = unknown>(): Promise<T[] | null> {
    return this.get<T[]>(this.keys.videoList())
  }

  /**
   * Cache video stats
   */
  async cacheVideoStats(videoId: string, stats: unknown): Promise<void> {
    await this.set(this.keys.videoStats(videoId), stats, CACHE_TTL.VIDEO_STATS)
  }

  /**
   * Get cached video stats
   */
  async getVideoStats<T = unknown>(videoId: string): Promise<T | null> {
    return this.get<T>(this.keys.videoStats(videoId))
  }

  /**
   * Cache presigned URL
   */
  async cachePresignedUrl(videoId: string, url: string): Promise<void> {
    await this.set(this.keys.presignedUrl(videoId), url, CACHE_TTL.PRESIGNED_URL)
  }

  /**
   * Get cached presigned URL
   */
  async getPresignedUrl(videoId: string): Promise<string | null> {
    return this.get<string>(this.keys.presignedUrl(videoId))
  }

  /**
   * Invalidate video cache (on update/delete)
   */
  async invalidateVideo(videoId: string): Promise<void> {
    await Promise.all([
      this.del(this.keys.video(videoId)),
      this.del(this.keys.videoStats(videoId)),
      this.del(this.keys.videoList())
    ])
  }

  /**
   * Invalidate all video caches
   */
  async invalidateAllVideos(): Promise<void> {
    if (!this.isConnected) return

    try {
      const keys = await this.client.keys('video:*')
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidateAll error:', error)
    }
  }
}

export const cacheService = new CacheService()
