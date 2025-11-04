import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.videoVariant.deleteMany()
  await prisma.videoViewLog.deleteMany()
  await prisma.video.deleteMany()

  // Create sample video with variants
  const video1 = await prisma.video.create({
    data: {
      title: 'Sample Video 1',
      description: 'Test video for development',
      status: 'READY',
      videoType: 'VOD',
      visibility: 'PUBLIC',
      hlsManifestKey: 'videos/sample1/master.m3u8',
      thumbnailKey: 'thumbnails/sample1.jpg',
      duration: 120,
      variants: {
        create: [
          {
            resolution: '1080p',
            bitrate: 5000,
            codec: 'h264',
            format: 'hls',
            storageKey: 'videos/sample1/1080p',
            playlistKey: 'videos/sample1/1080p/playlist.m3u8',
            size: 50000000
          },
          {
            resolution: '720p',
            bitrate: 2500,
            codec: 'h264',
            format: 'hls',
            storageKey: 'videos/sample1/720p',
            playlistKey: 'videos/sample1/720p/playlist.m3u8',
            size: 25000000
          },
          {
            resolution: '480p',
            bitrate: 1000,
            codec: 'h264',
            format: 'hls',
            storageKey: 'videos/sample1/480p',
            playlistKey: 'videos/sample1/480p/playlist.m3u8',
            size: 10000000
          }
        ]
      }
    }
  })

  const video2 = await prisma.video.create({
    data: {
      title: 'Sample Video 2',
      description: 'Another test video',
      status: 'READY',
      videoType: 'VOD',
      visibility: 'UNLISTED',
      hlsManifestKey: 'videos/sample2/master.m3u8',
      thumbnailKey: 'thumbnails/sample2.jpg',
      duration: 180,
      variants: {
        create: [
          {
            resolution: '720p',
            bitrate: 2500,
            codec: 'h264',
            format: 'hls',
            storageKey: 'videos/sample2/720p',
            playlistKey: 'videos/sample2/720p/playlist.m3u8',
            size: 30000000
          }
        ]
      }
    }
  })

  const video3 = await prisma.video.create({
    data: {
      title: 'Live Stream Test',
      description: 'Test live stream',
      status: 'PENDING',
      videoType: 'LIVE',
      visibility: 'PUBLIC'
    }
  })

  console.log('✅ Database seeded successfully!')
  console.log(`   - Created video: ${video1.id} (${video1.title})`)
  console.log(`   - Created video: ${video2.id} (${video2.title})`)
  console.log(`   - Created video: ${video3.id} (${video3.title})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
