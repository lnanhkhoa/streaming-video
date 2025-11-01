#!/usr/bin/env tsx
/**
 * End-to-End Integration Test
 *
 * Tests complete video processing pipeline:
 * 1. Generate test video
 * 2. Upload to MinIO
 * 3. Queue transcode job
 * 4. Process job (download → transcode → upload)
 * 5. Verify database updates
 * 6. Verify MinIO outputs
 * 7. Test playback
 *
 * Prerequisites:
 * - All services running (PostgreSQL, RabbitMQ, MinIO)
 * - Database migrated
 * - Worker NOT running (this script simulates the worker)
 */

import { prisma } from '@repo/database'
import { storageService } from './src/services/storage'
import { transcodeVideo, getVideoMetadata } from './src/transcoder'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import os from 'node:os'

const TEST_VIDEO_PATH = '/tmp/e2e-test-video.mp4'
const TEMP_DIR = path.join(os.tmpdir(), 'e2e-test')

interface TestResult {
  step: string
  status: 'pass' | 'fail'
  duration: number
  error?: string
}

const results: TestResult[] = []

async function runStep(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now()
  console.log(`\n▶️  ${name}`)

  try {
    await fn()
    const duration = Date.now() - start
    results.push({ step: name, status: 'pass', duration })
    console.log(`✅ ${name} (${duration}ms)`)
  } catch (error) {
    const duration = Date.now() - start
    const errorMsg = error instanceof Error ? error.message : String(error)
    results.push({ step: name, status: 'fail', duration, error: errorMsg })
    console.error(`❌ ${name} failed:`, error)
    throw error
  }
}

async function generateTestVideo() {
  console.log('📹 Generating test video (10s, 1080p)...')
  try {
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 ` +
        `-f lavfi -i sine=frequency=1000:duration=10 ` +
        `-pix_fmt yuv420p -c:v libx264 -preset ultrafast -c:a aac ${TEST_VIDEO_PATH}`,
      { stdio: 'inherit' }
    )
    console.log(`✅ Test video created: ${TEST_VIDEO_PATH}`)
  } catch (error) {
    console.error('❌ Failed to generate test video:', error)
    throw error
  }
}

async function createTestVideoRecord(): Promise<string> {
  const video = await prisma.video.create({
    data: {
      title: 'E2E Test Video',
      description: 'End-to-end integration test',
      status: 'PENDING',
      videoType: 'VOD',
      visibility: 'PUBLIC'
    }
  })
  console.log(`✅ Created video record: ${video.id}`)
  return video.id
}

async function uploadToMinIO(videoId: string): Promise<string> {
  const inputKey = `uploads/${videoId}/input.mp4`
  await storageService.uploadFile(TEST_VIDEO_PATH, inputKey)
  console.log(`✅ Uploaded to MinIO: ${inputKey}`)
  return inputKey
}

async function processVideo(videoId: string, inputKey: string) {
  const tempDir = path.join(TEMP_DIR, videoId)
  const inputPath = path.join(tempDir, 'input.mp4')
  const outputDir = path.join(tempDir, 'output')

  try {
    // 1. Update status
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'PROCESSING' }
    })
    console.log('   📝 Status: PROCESSING')

    // 2. Create temp dirs
    await fsp.mkdir(tempDir, { recursive: true })
    await fsp.mkdir(outputDir, { recursive: true })

    // 3. Download
    console.log('   ⬇️  Downloading from MinIO...')
    await storageService.downloadFile(inputKey, inputPath)

    // 4. Get metadata
    const metadata = await getVideoMetadata(inputPath)
    console.log(
      `   📊 Metadata: ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s`
    )

    // 5. Transcode
    console.log('   🎥 Transcoding...')
    await transcodeVideo(inputPath, outputDir, videoId)

    // 6. Upload outputs
    console.log('   ⬆️  Uploading outputs...')
    const uploadedFiles = await storageService.uploadDirectory(outputDir, `videos/${videoId}`)
    console.log(`   ✅ Uploaded ${uploadedFiles.length} files`)

    // 7. Create variants
    console.log('   💾 Creating variant records...')
    const variants = ['1080p', '720p', '480p']
    for (const resolution of variants) {
      const playlistFile = uploadedFiles.find((f) => f.includes(`${resolution}/playlist.m3u8`))
      if (playlistFile) {
        const dimensions = getDimensions(resolution)
        await prisma.videoVariant.create({
          data: {
            videoId,
            resolution,
            width: dimensions.width,
            height: dimensions.height,
            bitrate: getBitrate(resolution),
            codec: 'h264',
            format: 'hls',
            storageKey: playlistFile.replace('/playlist.m3u8', ''),
            playlistKey: playlistFile
          }
        })
        console.log(`   ✅ Created ${resolution} variant`)
      }
    }

    // 8. Update video
    const thumbnailKey = uploadedFiles.find((f) => f.includes('thumbnail.jpg'))
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        duration: Math.round(metadata.duration),
        hlsManifestKey: `videos/${videoId}/master.m3u8`,
        thumbnailKey: thumbnailKey || null
      }
    })
    console.log('   ✅ Status: READY')
  } finally {
    // Cleanup
    await fsp.rm(tempDir, { recursive: true, force: true })
  }
}

function getDimensions(resolution: string) {
  const map: Record<string, { width: number; height: number }> = {
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 },
    '480p': { width: 854, height: 480 }
  }
  return map[resolution] || { width: 854, height: 480 }
}

function getBitrate(resolution: string): number {
  const map: Record<string, number> = {
    '1080p': 5000,
    '720p': 2800,
    '480p': 1400
  }
  return map[resolution] || 1400
}

async function verifyDatabase(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { variants: true }
  })

  if (!video) throw new Error('Video not found in database')
  if (video.status !== 'READY') throw new Error(`Expected status READY, got ${video.status}`)
  if (!video.hlsManifestKey) throw new Error('Missing hlsManifestKey')
  if (!video.thumbnailKey) throw new Error('Missing thumbnailKey')
  if (!video.duration || video.duration < 5) throw new Error('Invalid duration')

  console.log(`   ✅ Video status: ${video.status}`)
  console.log(`   ✅ Manifest: ${video.hlsManifestKey}`)
  console.log(`   ✅ Thumbnail: ${video.thumbnailKey}`)
  console.log(`   ✅ Duration: ${video.duration}s`)

  if (video.variants.length === 0) throw new Error('No variants created')
  console.log(`   ✅ Variants: ${video.variants.length}`)

  for (const variant of video.variants) {
    console.log(`      - ${variant.resolution}: ${variant.bitrate}kbps, ${variant.playlistKey}`)
  }
}

async function verifyMinIO(videoId: string) {
  const expectedFiles = [
    `videos/${videoId}/master.m3u8`,
    `videos/${videoId}/thumbnail.jpg`,
    `videos/${videoId}/1080p/playlist.m3u8`,
    `videos/${videoId}/720p/playlist.m3u8`,
    `videos/${videoId}/480p/playlist.m3u8`
  ]

  for (const key of expectedFiles) {
    const exists = await storageService.fileExists(key)
    if (!exists) throw new Error(`Missing file in MinIO: ${key}`)
    console.log(`   ✅ ${key}`)
  }
}

async function testPlayback(videoId: string) {
  const manifestKey = `videos/${videoId}/master.m3u8`
  const exists = await storageService.fileExists(manifestKey)
  if (!exists) throw new Error('Master playlist not found')

  console.log(`   ✅ Master playlist exists: ${manifestKey}`)
  console.log(`   📺 To test playback:`)
  console.log(`      vlc "http://localhost:9000/streaming-video/${manifestKey}"`)
}

async function cleanup(videoId?: string) {
  console.log('\n🧹 Cleaning up...')

  try {
    // Delete test video file
    if (fs.existsSync(TEST_VIDEO_PATH)) {
      await fsp.rm(TEST_VIDEO_PATH, { force: true })
    }

    // Delete temp directory
    if (fs.existsSync(TEMP_DIR)) {
      await fsp.rm(TEMP_DIR, { recursive: true, force: true })
    }

    // Delete from database and MinIO
    if (videoId) {
      await prisma.videoVariant.deleteMany({ where: { videoId } })
      await prisma.video.delete({ where: { id: videoId } })
      await storageService.deleteFiles(`uploads/${videoId}`)
      await storageService.deleteFiles(`videos/${videoId}`)
      console.log(`✅ Deleted video ${videoId} from database and MinIO`)
    }
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error)
  }
}

function printResults() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Results')
  console.log('='.repeat(60))

  let totalDuration = 0
  let passed = 0
  let failed = 0

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : '❌'
    const duration = `${result.duration}ms`
    console.log(`${icon} ${result.step.padEnd(40)} ${duration.padStart(10)}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    totalDuration += result.duration
    if (result.status === 'pass') passed++
    else failed++
  }

  console.log('='.repeat(60))
  console.log(`Total: ${results.length} tests, ${passed} passed, ${failed} failed`)
  console.log(`Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`)
  console.log('='.repeat(60))
}

async function main() {
  console.log('🎬 End-to-End Integration Test\n')

  let videoId: string | undefined

  try {
    // Connect to database
    await prisma.$connect()
    console.log('✅ Database connected\n')

    // Wait for storage service to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Run test steps
    await runStep('1. Generate test video', generateTestVideo)
    await runStep('2. Create video record', async () => {
      videoId = await createTestVideoRecord()
    })

    if (!videoId) throw new Error('Failed to create video record')

    let inputKey: string = ''
    await runStep('3. Upload to MinIO', async () => {
      inputKey = await uploadToMinIO(videoId!)
    })

    await runStep('4. Process video (download → transcode → upload)', async () => {
      await processVideo(videoId!, inputKey)
    })

    await runStep('5. Verify database updates', async () => {
      await verifyDatabase(videoId!)
    })

    await runStep('6. Verify MinIO outputs', async () => {
      await verifyMinIO(videoId!)
    })

    await runStep('7. Test playback readiness', async () => {
      await testPlayback(videoId!)
    })

    console.log('\n✅ All tests passed!')
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exitCode = 1
  } finally {
    printResults()
    await cleanup(videoId)
    await prisma.$disconnect()
  }
}

main()
