import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { client } from '../helpers/client'

describe('Videos Routes', () => {
  describe('GET /api/videos/list', () => {
    it('should return empty list initially', async () => {
      const res = await client.get('/api/videos/list')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.videos).toEqual([])
      expect(res.body.data.total).toBe(0)
    })

    it('should return videos with pagination', async () => {
      // Create test videos
      await prisma.video.createMany({
        data: [
          {
            id: nanoid(),
            title: 'Video 1',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            isLiveNow: false,
            viewsToday: 0,
            viewsMonth: 0,
            viewsTotal: 0
          },
          {
            id: nanoid(),
            title: 'Video 2',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            isLiveNow: false,
            viewsToday: 0,
            viewsMonth: 0,
            viewsTotal: 0
          }
        ]
      })

      const res = await client.get('/api/videos/list?limit=1')

      expect(res.status).toBe(200)
      expect(res.body.data.videos).toHaveLength(1)
      expect(res.body.data.total).toBe(2)
    })

    it('should filter by status', async () => {
      await prisma.video.createMany({
        data: [
          {
            id: nanoid(),
            title: 'Ready Video',
            status: 'READY',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            isLiveNow: false,
            viewsToday: 0,
            viewsMonth: 0,
            viewsTotal: 0
          },
          {
            id: nanoid(),
            title: 'Pending Video',
            status: 'PENDING',
            videoType: 'VOD',
            visibility: 'PUBLIC',
            isLiveNow: false,
            viewsToday: 0,
            viewsMonth: 0,
            viewsTotal: 0
          }
        ]
      })

      const res = await client.get('/api/videos/list?status=READY')

      expect(res.status).toBe(200)
      expect(res.body.data.videos).toHaveLength(1)
      expect(res.body.data.videos[0].status).toBe('READY')
    })
  })

  describe('GET /api/videos/:id', () => {
    it('should return video details', async () => {
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          isLiveNow: false,
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.get(`/api/videos/${video.id}`)

      expect(res.status).toBe(200)
      expect(res.body.data.video.id).toBe(video.id)
      expect(res.body.data.video.title).toBe(video.title)
    })

    it('should return 404 for non-existent video', async () => {
      const res = await client.get('/api/videos/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBeDefined()
      expect(res.body.error.message).toContain('not found')
    })
  })

  describe('PATCH /api/videos/:id', () => {
    it('should update video metadata', async () => {
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Original Title',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          isLiveNow: false,
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.patch(`/api/videos/${video.id}`, {
        title: 'Updated Title',
        visibility: 'UNLISTED'
      })

      expect(res.status).toBe(200)
      expect(res.body.data.video.title).toBe('Updated Title')
      expect(res.body.data.video.visibility).toBe('UNLISTED')
    })

    it('should return 404 for non-existent video', async () => {
      const res = await client.patch('/api/videos/non-existent', {
        title: 'New Title'
      })

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBeDefined()
    })
  })

  describe('DELETE /api/videos/:id', () => {
    it('should delete video', async () => {
      const video = await prisma.video.create({
        data: {
          id: nanoid(),
          title: 'Test Video',
          status: 'READY',
          videoType: 'VOD',
          visibility: 'PUBLIC',
          isLiveNow: false,
          viewsToday: 0,
          viewsMonth: 0,
          viewsTotal: 0
        }
      })

      const res = await client.delete(`/api/videos/${video.id}`)

      expect(res.status).toBe(200)

      // Verify deleted
      const deleted = await prisma.video.findUnique({ where: { id: video.id } })
      expect(deleted).toBeNull()
    })

    it('should return 404 for non-existent video', async () => {
      const res = await client.delete('/api/videos/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBeDefined()
    })
  })
})
