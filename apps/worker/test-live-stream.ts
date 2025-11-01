/**
 * Live Streaming Integration Test
 *
 * Tests the live streaming workflow:
 * 1. Creates a test video file
 * 2. Starts live stream with file input
 * 3. Monitors HLS segment generation
 * 4. Verifies uploads to MinIO
 * 5. Stops stream and cleans up
 *
 * Usage:
 *   bun test-live-stream.ts
 *
 * Requirements:
 *   - FFmpeg installed
 *   - MinIO running (localhost:9000)
 *   - PostgreSQL running
 */

import { liveStreamManager } from './src/live-stream'
import { storageService } from './src/services/storage'
import { prisma } from '@repo/database'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

const TEST_VIDEO_ID = 'test-live-stream-' + Date.now()
const TEST_STREAM_KEY = 'test-key-' + Date.now()

async function createTestVideo(outputPath: string): Promise<void> {
  console.log('📹 Creating test video...')

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=30:size=1280x720:rate=30', // 30 seconds of test pattern
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=1000:duration=30', // 1kHz tone
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-c:a',
      'aac',
      '-t',
      '30',
      '-y',
      outputPath
    ])

    ffmpeg.on('error', reject)
    ffmpeg.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Test video created')
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
  })
}

async function waitForSegments(videoId: string, minSegments: number = 3): Promise<void> {
  console.log(`⏳ Waiting for ${minSegments} HLS segments...`)

  const maxWaitTime = 30000 // 30 seconds
  const checkInterval = 1000 // 1 second
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Check if segments exist in MinIO
      const exists1 = await storageService.fileExists(`live/${videoId}/segment_000.ts`)
      const exists2 = await storageService.fileExists(`live/${videoId}/segment_001.ts`)
      const exists3 = await storageService.fileExists(`live/${videoId}/segment_002.ts`)
      const manifestExists = await storageService.fileExists(`live/${videoId}/index.m3u8`)

      const segmentCount = [exists1, exists2, exists3].filter(Boolean).length

      console.log(`   Found ${segmentCount} segments, manifest: ${manifestExists ? 'yes' : 'no'}`)

      if (segmentCount >= minSegments && manifestExists) {
        console.log('✅ Segments generated and uploaded!')
        return
      }
    } catch (error) {
      console.log('   Checking...', error)
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval))
  }

  throw new Error('Timeout waiting for segments')
}

async function testLiveStreaming(): Promise<void> {
  console.log('\n🎬 Live Streaming Integration Test\n')

  let testVideoPath: string | null = null

  try {
    // 1. Create test video file
    const tempDir = path.join(os.tmpdir(), `test-live-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    testVideoPath = path.join(tempDir, 'test-input.mp4')
    await createTestVideo(testVideoPath)

    // 2. Create video record in database
    console.log('\n📝 Creating video record...')
    await prisma.video.create({
      data: {
        id: TEST_VIDEO_ID,
        title: 'Test Live Stream',
        description: 'Integration test',
        status: 'PENDING',
        videoType: 'LIVE',
        visibility: 'PRIVATE',
        streamKey: TEST_STREAM_KEY,
        isLiveNow: false,
        viewsToday: 0,
        viewsMonth: 0,
        viewsTotal: 0
      }
    })
    console.log('✅ Video record created')

    // 3. Start live stream
    console.log('\n🎥 Starting live stream...')
    await liveStreamManager.startLiveStream({
      videoId: TEST_VIDEO_ID,
      streamKey: TEST_STREAM_KEY,
      inputSource: testVideoPath
    })

    // 4. Wait for segments to be generated
    await waitForSegments(TEST_VIDEO_ID, 3)

    // 5. Verify database status
    console.log('\n💾 Checking database...')
    const video = await prisma.video.findUnique({
      where: { id: TEST_VIDEO_ID }
    })

    if (!video) {
      throw new Error('Video not found in database')
    }

    console.log(`   Status: ${video.status}`)
    console.log(`   isLiveNow: ${video.isLiveNow}`)
    console.log(`   hlsManifestKey: ${video.hlsManifestKey}`)

    if (video.status !== 'LIVE' || !video.isLiveNow) {
      throw new Error('Video status not updated correctly')
    }

    console.log('✅ Database status correct')

    // 6. Stop stream
    console.log('\n🛑 Stopping stream...')
    await liveStreamManager.stopLiveStream(TEST_VIDEO_ID, false)

    // 7. Verify cleanup
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait for cleanup

    const videoAfterStop = await prisma.video.findUnique({
      where: { id: TEST_VIDEO_ID }
    })

    if (!videoAfterStop) {
      throw new Error('Video not found after stop')
    }

    console.log(`   Status: ${videoAfterStop.status}`)
    console.log(`   isLiveNow: ${videoAfterStop.isLiveNow}`)

    if (videoAfterStop.isLiveNow) {
      throw new Error('Video still marked as live')
    }

    console.log('✅ Stream stopped successfully')

    // 8. Cleanup
    console.log('\n🧹 Cleaning up...')
    await storageService.deleteFiles(`live/${TEST_VIDEO_ID}/`)
    await prisma.video.delete({ where: { id: TEST_VIDEO_ID } })
    if (testVideoPath) {
      await fs.rm(path.dirname(testVideoPath), { recursive: true, force: true })
    }
    console.log('✅ Cleanup complete')

    console.log('\n✨ All tests passed! ✨\n')
  } catch (error) {
    console.error('\n❌ Test failed:', error)

    // Cleanup on error
    try {
      console.log('\n🧹 Cleaning up after error...')
      await liveStreamManager.stopLiveStream(TEST_VIDEO_ID).catch(() => {})
      await storageService.deleteFiles(`live/${TEST_VIDEO_ID}/`).catch(() => {})
      await prisma.video.delete({ where: { id: TEST_VIDEO_ID } }).catch(() => {})
      if (testVideoPath) {
        await fs.rm(path.dirname(testVideoPath), { recursive: true, force: true }).catch(() => {})
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError)
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run test
testLiveStreaming()
