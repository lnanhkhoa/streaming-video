import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create sample videos
  await prisma.video.createMany({
    data: [
      {
        title: 'Sample Video 1',
        description: 'Test video for development',
        status: 'READY',
        videoType: 'VOD',
        visibility: 'PUBLIC',
        hlsManifestKey: 'videos/sample1/master.m3u8',
        duration: 120
      },
      {
        title: 'Live Stream Test',
        description: 'Test live stream',
        status: 'PENDING',
        videoType: 'LIVE',
        visibility: 'PUBLIC',
        isLiveNow: false
      }
    ]
  })

  console.log('Database seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
