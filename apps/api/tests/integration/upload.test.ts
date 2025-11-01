import { describe, it, expect } from 'vitest'
import { client } from '../helpers/client'

describe('Upload Routes', () => {
  describe('POST /api/upload/presign', () => {
    it('should generate presigned upload URL', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'test-video.mp4',
        fileSize: 1000000,
        contentType: 'video/mp4'
      })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.videoId).toBeDefined()
      expect(res.body.data.uploadUrl).toBeDefined()
      expect(res.body.data.key).toBeDefined()
      expect(res.body.data.expiresIn).toBe(3600)
    })

    it('should reject files over 2GB', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'large-video.mp4',
        fileSize: 3 * 1024 * 1024 * 1024, // 3GB
        contentType: 'video/mp4'
      })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should reject invalid MIME types', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'malware.exe',
        fileSize: 1000000,
        contentType: 'application/x-msdownload'
      })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should reject missing fields', async () => {
      const res = await client.post('/api/upload/presign', {
        fileName: 'test.mp4'
        // Missing fileSize and contentType
      })

      expect(res.status).toBe(400)
    })

    it('should accept valid video formats', async () => {
      const formats = [
        { contentType: 'video/mp4', ext: 'mp4' },
        { contentType: 'video/webm', ext: 'webm' },
        { contentType: 'video/ogg', ext: 'ogg' }
      ]

      for (const format of formats) {
        const res = await client.post('/api/upload/presign', {
          fileName: `test.${format.ext}`,
          fileSize: 1000000,
          contentType: format.contentType
        })

        expect(res.status).toBe(201)
        expect(res.body.data.key).toContain(format.ext)
      }
    })
  })

  describe('POST /api/upload/:id/complete', () => {
    it('should return 404 when file does not exist in storage', async () => {
      const res = await client.post('/api/upload/test-id/complete', {
        key: 'non-existent-key/original.mp4',
        title: 'Test Video'
      })

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
    })

    it('should reject missing key parameter', async () => {
      const res = await client.post('/api/upload/test-id/complete', {
        title: 'Test Video'
        // Missing key
      })

      expect(res.status).toBe(400)
    })
  })
})
