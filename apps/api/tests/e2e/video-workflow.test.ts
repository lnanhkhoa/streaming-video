import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { prisma } from '@repo/database'
import { client } from '../helpers/client'
import { BUCKET_RAW } from '@repo/constants'

describe('Video Workflow E2E', () => {
  it('should complete full video lifecycle', async () => {
    // 1. Create a video (simulating upload complete)
    const video = await prisma.video.create({
      data: {
        id: nanoid(),
        title: 'E2E Test Video',
        description: 'Testing full workflow',
        status: 'READY',
        videoType: 'VOD',
        visibility: 'PUBLIC',
        isLiveNow: false,
        viewsToday: 0,
        viewsMonth: 0,
        viewsTotal: 0,
        variants: {
          create: [
            {
              resolution: '720p',
              width: 1280,
              height: 720,
              bitrate: 2500,
              codec: 'h264',
              format: 'hls',
              storageKey: 'test-video-e2e/720p',
              playlistKey: 'test-video-e2e/720p/playlist.m3u8'
            }
          ]
        }
      }
    })

    // Verify video was created
    const dbVideo = await prisma.video.findUnique({ where: { id: video.id } })
    expect(dbVideo).toBeDefined()
    expect(dbVideo?.title).toBe('E2E Test Video')

    // 2. List videos - should include our video
    const listRes = await client.get('/api/videos')
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.total).toBeGreaterThan(0)

    // 3. Get video details
    const detailsRes = await client.get(`/api/videos/${video.id}`)
    expect(detailsRes.status).toBe(200)
    expect(detailsRes.body.data.video.id).toBe(video.id)
    expect(detailsRes.body.data.variants).toHaveLength(1)

    // 4. Track a view
    const viewRes = await client.post(`/api/analytics/view/${video.id}`)
    expect(viewRes.status).toBe(200)

    // 5. Get stats - should show 1 view
    const statsRes = await client.get(`/api/analytics/stats/${video.id}`)
    expect(statsRes.status).toBe(200)
    expect(statsRes.body.data.viewsTotal).toBe(1)

    // 6. Update video metadata
    const updateRes = await client.patch(`/api/videos/${video.id}`, {
      title: 'Updated E2E Video',
      visibility: 'UNLISTED'
    })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.data.video.title).toBe('Updated E2E Video')

    // 7. Delete video
    const deleteRes = await client.delete(`/api/videos/${video.id}`)
    expect(deleteRes.status).toBe(200)

    // 8. Verify video is deleted
    const deletedVideo = await prisma.video.findUnique({ where: { id: video.id } })
    expect(deletedVideo).toBeNull()
  })

  it('should handle upload presign workflow', async () => {
    // 1. Get presigned URL
    const presignRes = await client.post('/api/upload/presign', {
      fileName: 'e2e-test.mp4',
      fileSize: 5000000,
      contentType: 'video/mp4'
    })

    expect(presignRes.status).toBe(201)
    expect(presignRes.body.data.videoId).toBeDefined()
    expect(presignRes.body.data.uploadUrl).toContain(BUCKET_RAW)
    expect(presignRes.body.data.key).toContain('original.mp4')

    const { videoId, key } = presignRes.body.data

    // 2. Simulate upload (in real scenario, upload to presignedUrl)
    // Skip actual file upload in tests

    // 3. Complete upload (will fail because file doesn't exist in MinIO)
    const completeRes = await client.post(`/api/upload/${videoId}/complete`, {
      key,
      title: 'E2E Upload Test'
    })

    // Expected to fail with 404 since we didn't actually upload
    expect(completeRes.status).toBe(404)
  })
})
