#!/usr/bin/env tsx
/**
 * Test script for FFmpeg transcoder
 *
 * Usage:
 *   bun run test:transcode
 *
 * This script:
 * 1. Generates a test video (10s, 1080p)
 * 2. Transcodes it to HLS with multiple variants
 * 3. Verifies output files exist
 */

import { transcodeVideo, getVideoMetadata } from './src/transcoder'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'

const TEST_INPUT = '/tmp/test-video-1080p.mp4'
const TEST_OUTPUT = '/tmp/transcode-test'

async function generateTestVideo() {
  console.log('📹 Generating test video...')
  try {
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=duration=10:size=1920x1080:rate=30 ` +
        `-f lavfi -i sine=frequency=1000:duration=10 ` +
        `-pix_fmt yuv420p -c:v libx264 -c:a aac ${TEST_INPUT}`,
      { stdio: 'inherit' }
    )
    console.log(`✅ Test video created: ${TEST_INPUT}`)
  } catch (error) {
    console.error('❌ Failed to generate test video:', error)
    throw error
  }
}

async function verifyOutputs() {
  console.log('\n🔍 Verifying outputs...')

  const expectedFiles = [
    'master.m3u8',
    'thumbnail.jpg',
    '1080p/playlist.m3u8',
    '720p/playlist.m3u8',
    '480p/playlist.m3u8'
  ]

  for (const file of expectedFiles) {
    const filePath = path.join(TEST_OUTPUT, file)
    try {
      const stat = await fs.stat(filePath)
      console.log(`✅ ${file} (${stat.size} bytes)`)
    } catch {
      console.error(`❌ Missing: ${file}`)
      throw new Error(`Expected file not found: ${file}`)
    }
  }

  // Check for segment files
  const variants = ['1080p', '720p', '480p']
  for (const variant of variants) {
    const variantDir = path.join(TEST_OUTPUT, variant)
    const files = await fs.readdir(variantDir)
    const segments = files.filter((f) => f.endsWith('.ts'))
    console.log(`✅ ${variant}/ has ${segments.length} segments`)
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...')
  try {
    await fs.rm(TEST_INPUT, { force: true })
    await fs.rm(TEST_OUTPUT, { recursive: true, force: true })
    console.log('✅ Cleanup complete')
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error)
  }
}

async function main() {
  console.log('🎬 FFmpeg Transcoder Test\n')

  try {
    // 1. Generate test video
    await generateTestVideo()

    // 2. Extract metadata
    console.log('\n📊 Extracting metadata...')
    const metadata = await getVideoMetadata(TEST_INPUT)
    console.log(`   Resolution: ${metadata.width}x${metadata.height}`)
    console.log(`   Duration: ${metadata.duration.toFixed(1)}s`)
    console.log(`   Codec: ${metadata.codec}`)
    console.log(`   FPS: ${metadata.fps.toFixed(1)}`)

    // 3. Transcode
    console.log('\n🎥 Starting transcoding...')
    await transcodeVideo(TEST_INPUT, TEST_OUTPUT, 'test-video')

    // 4. Verify outputs
    await verifyOutputs()

    console.log('\n✅ All tests passed!')
    console.log(`\n📂 Output directory: ${TEST_OUTPUT}`)
    console.log('   To test playback:')
    console.log(`   open ${TEST_OUTPUT}/master.m3u8`)
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    // Optionally cleanup (comment out to inspect outputs)
    // await cleanup()
  }
}

main()
