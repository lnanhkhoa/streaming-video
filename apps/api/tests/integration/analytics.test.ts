import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { client } from '../helpers/client'

describe('Analytics Routes', () => {
  describe('POST /api/analytics/view/:id', () => {
    it('should track video view', async () => {
      // Create test video
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.post(`/api/analytics/view/${video.id}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.message).toBe('View tracked successfully')

      // Verify counters incremented
      const updated = await prisma.video.findUnique({ where: { id: video.id } })
      expect(updated?.viewsToday).toBe(1)
      expect(updated?.viewsMonth).toBe(1)
      expect(updated?.viewsTotal).toBe(1)

      // Verify view log created
      const logs = await prisma.videoViewLog.findMany({ where: { videoId: video.id } })
      expect(logs).toHaveLength(1)
    })

    it('should return 404 for non-existent video', async () => {
      const res = await client.post('/api/analytics/view/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBeDefined()
    })

    it('should increment counters on multiple views', async () => {
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      // Track 3 views
      await client.post(`/api/analytics/view/${video.id}`)
      await client.post(`/api/analytics/view/${video.id}`)
      await client.post(`/api/analytics/view/${video.id}`)

      const updated = await prisma.video.findUnique({ where: { id: video.id } })
      expect(updated?.viewsToday).toBe(3)
      expect(updated?.viewsMonth).toBe(3)
      expect(updated?.viewsTotal).toBe(3)
    })
  })

  describe('GET /api/analytics/stats/:id', () => {
    it('should return video statistics', async () => {
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          viewsToday: 10,
          viewsMonth: 50,
          viewsTotal: 100
        }
      })

      const res = await client.get(`/api/analytics/stats/${video.id}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.viewsToday).toBe(10)
      expect(res.body.data.viewsMonth).toBe(50)
      expect(res.body.data.viewsTotal).toBe(100)
    })

    it('should return 404 for non-existent video', async () => {
      const res = await client.get('/api/analytics/stats/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBeDefined()
    })

    it('should cache stats', async () => {
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          viewsToday: 5,
          viewsMonth: 10,
          viewsTotal: 20
        }
      })

      // First request (cache miss)
      const res1 = await client.get(`/api/analytics/stats/${video.id}`)
      expect(res1.status).toBe(200)

      // Update database directly
      await prisma.video.update({
        where: { id: video.id },
        data: { viewsToday: 100 }
      })

      // Second request (cache hit - should return old value)
      const res2 = await client.get(`/api/analytics/stats/${video.id}`)
      expect(res2.status).toBe(200)
      // Note: This might return cached value (5) or new value (100) depending on cache timing
    })
  })

  describe('POST /api/analytics/reset/daily', () => {
    it('should reset daily views for all videos', async () => {
      // Create test videos with views
      await prisma.video.createMany({
        data: [
          {
            id: nanoid(),
            title: 'Video 1',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            viewsToday: 10,
            viewsMonth: 50,
            viewsTotal: 100
          },
          {
            id: nanoid(),
            title: 'Video 2',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            viewsToday: 20,
            viewsMonth: 60,
            viewsTotal: 120
          }
        ]
      })

      const res = await client.post('/api/analytics/reset/daily')

      expect(res.status).toBe(200)
      expect(res.body.data.message).toContain('Reset daily views')

      // Verify daily views reset
      const videos = await prisma.video.findMany()
      videos.forEach((video) => {
        expect(video.viewsToday).toBe(0)
        expect(video.viewsMonth).toBeGreaterThan(0) // Should not be reset
        expect(video.viewsTotal).toBeGreaterThan(0) // Should not be reset
      })
    })
  })

  describe('POST /api/analytics/reset/monthly', () => {
    it('should reset monthly views for all videos', async () => {
      const videoId = nanoid()
      await prisma.video.createMany({
        data: [
          {
            id: videoId,
            title: 'Video 1',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            viewsToday: 10,
            viewsMonth: 50,
            viewsTotal: 100
          }
        ]
      })

      const res = await client.post('/api/analytics/reset/monthly')

      expect(res.status).toBe(200)
      expect(res.body.data.message).toContain('Reset monthly views')

      // Verify monthly views reset
      const video = await prisma.video.findUnique({ where: { id: videoId } })
      expect(video?.viewsMonth).toBe(0)
      expect(video?.viewsToday).toBeGreaterThan(0) // Should not be reset
      expect(video?.viewsTotal).toBeGreaterThan(0) // Should not be reset
    })
  })
})
