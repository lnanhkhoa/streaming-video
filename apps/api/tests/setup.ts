import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { prisma } from '@repo/database'
import { cacheService } from '../src/services/cache.service'

console.log('📦 Loading test setup file...')

// Override environment variables for testing
// IMPORTANT: Use a separate test database to avoid polluting production data

// Clean database helper
async function cleanDatabase() {
  // Delete in correct order due to foreign keys
  const viewLogs = await prisma.videoViewLog.deleteMany()
  const variants = await prisma.videoVariant.deleteMany()
  const videos = await prisma.video.deleteMany()

  console.log(
    `🧹 DB Cleanup: ${videos.count} videos, ${variants.count} variants, ${viewLogs.count} logs deleted`
  )
  return { videos: videos.count, variants: variants.count, viewLogs: viewLogs.count }
}

beforeAll(async () => {
  console.log('🧪 Setting up test environment...')
  // Clean database before all tests
  await cleanDatabase()
  // Clear cache
  await cacheService.invalidateAllVideos()
})

beforeEach(async () => {
  console.log('🔄 Running beforeEach cleanup...')
  // Clean database before each test for isolation
  await cleanDatabase()
  // Clear cache before each test
  await cacheService.invalidateAllVideos()
  console.log('✅ beforeEach cleanup complete')
})

// Removed afterEach cleanup to prevent race conditions
// beforeEach is sufficient for test isolation

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  // Final cleanup after all tests
  await cleanDatabase()
  await prisma.$disconnect()
})
