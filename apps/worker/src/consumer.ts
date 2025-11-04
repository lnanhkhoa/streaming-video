import amqp from 'amqplib'
import { prisma } from '@repo/database'
import { storageService } from './services/storage'
import { transcodeVideo, getVideoMetadata } from './libs/transcoder'
import { liveStreamManager } from './libs/live-stream'
import { metrics } from './services/metrics'
import { retryWithBackoff, ensureDiskSpace, estimateRequiredSpace, formatBytes } from './libs/utils'
import path from 'node:path'
import os from 'node:os'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import { env } from './env'

/**
 * RabbitMQ Consumer
 *
 * Processes video transcode jobs and live streaming jobs from queue.
 * Downloads videos, transcodes to HLS, uploads outputs, updates database.
 */

export interface TranscodeJob {
  type?: 'transcode' // Optional for backward compatibility
  videoId: string
  inputKey: string
}

export interface StartLiveStreamJob {
  type: 'start-live-stream'
  videoId: string
  inputSource: string // RTMP URL, file path, or HTTP stream URL
}

export interface StopLiveStreamJob {
  type: 'stop-live-stream'
  videoId: string
  convertToVOD?: boolean
}

export type WorkerJob = TranscodeJob | StartLiveStreamJob | StopLiveStreamJob

interface RabbitMQConnection {
  connection: amqp.Connection
  channel: amqp.Channel
}

const QUEUE_NAME = 'video-transcode'
const RABBITMQ_URL = env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672'
const TEMP_DIR = env.WORKER_TEMP_DIR || os.tmpdir()
const WORKER_CONCURRENCY = env.WORKER_CONCURRENCY

/**
 * Connect to RabbitMQ and setup channel
 */
async function connectRabbitMQ(): Promise<RabbitMQConnection> {
  let retries = 5
  let lastError: Error | undefined

  while (retries > 0) {
    try {
      console.log(`🔌 Connecting to RabbitMQ (${retries} attempts remaining)...`)
      const connection = await amqp.connect(RABBITMQ_URL)
      const channel = await connection.createChannel()

      // Assert queue exists (create if not)
      await channel.assertQueue(QUEUE_NAME, {
        durable: true // Survive broker restart
      })

      // Set prefetch for concurrent job processing
      await channel.prefetch(WORKER_CONCURRENCY)

      console.log('✅ Connected to RabbitMQ')
      console.log(`📋 Queue: ${QUEUE_NAME} (durable, prefetch=${WORKER_CONCURRENCY})`)

      return { connection: connection as any, channel: channel as any }
    } catch (error) {
      lastError = error as Error
      retries--
      if (retries > 0) {
        const delay = (6 - retries) * 1000
        console.warn(`⚠️ RabbitMQ connection failed, retrying in ${delay}ms...`, error)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(`Failed to connect to RabbitMQ after 5 attempts: ${lastError?.message}`)
}

/**
 * Get variant bitrate by resolution
 */
function getVariantBitrate(resolution: string): number {
  const bitrateMap: Record<string, number> = {
    '1080p': 5000,
    '720p': 2800,
    '480p': 1400
  }
  return bitrateMap[resolution] || 1400
}

/**
 * Get variant dimensions by resolution
 */
function getVariantDimensions(resolution: string): { width: number; height: number } {
  const dimensionsMap: Record<string, { width: number; height: number }> = {
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 },
    '480p': { width: 854, height: 480 }
  }
  return dimensionsMap[resolution] || { width: 854, height: 480 }
}

/**
 * Create VideoVariant database records
 */
async function createVariantRecords(videoId: string, uploadedFiles: string[]): Promise<void> {
  const variants = ['1080p', '720p', '480p']

  for (const resolution of variants) {
    const playlistFile = uploadedFiles.find((f) => f.includes(`${resolution}/playlist.m3u8`))

    if (playlistFile) {
      const dimensions = getVariantDimensions(resolution)
      await prisma.videoVariant.create({
        data: {
          videoId,
          resolution,
          width: dimensions.width,
          height: dimensions.height,
          bitrate: getVariantBitrate(resolution),
          codec: 'h264',
          format: 'hls',
          storageKey: playlistFile.replace('/playlist.m3u8', ''),
          playlistKey: playlistFile
        }
      })
      console.log(`   ✅ Created ${resolution} variant record`)
    }
  }
}

/**
 * Process a single transcode job
 */
async function processTranscodeJob(job: TranscodeJob): Promise<void> {
  const { videoId, inputKey } = job
  const tempDir = path.join(TEMP_DIR, `transcode-${videoId}`)
  const inputPath = path.join(tempDir, 'input.mp4')
  const outputDir = path.join(tempDir, 'output')

  // Record job start for metrics
  metrics.recordJobStart(videoId, videoId)

  console.log(`\n🎬 Processing job: ${videoId}`)
  console.log(`   Input: ${inputKey}`)

  try {
    // 1. Update status to PROCESSING with start time
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'PROCESSING',
        transcodingStartedAt: new Date(),
        transcodingProgress: 0
      }
    })
    console.log('   📝 Status: PROCESSING (0%)')

    // 2. Create temp directories
    await fsp.mkdir(tempDir, { recursive: true })
    await fsp.mkdir(outputDir, { recursive: true })

    // 3. Download from MinIO with retry (20% progress)
    console.log('   ⬇️  Downloading from MinIO...')
    await retryWithBackoff(() => storageService.downloadFile(inputKey, inputPath), {
      maxRetries: 3,
      operationName: 'Download from MinIO'
    })

    await prisma.video.update({
      where: { id: videoId },
      data: { transcodingProgress: 20 }
    })

    // 4. Check disk space
    const inputFileSize = fs.statSync(inputPath).size
    const requiredSpace = estimateRequiredSpace(inputFileSize)
    console.log(`   💾 Input size: ${formatBytes(inputFileSize)}`)
    await ensureDiskSpace(requiredSpace, TEMP_DIR)

    // 5. Extract metadata for duration (30% progress)
    const metadata = await getVideoMetadata(inputPath)
    console.log(
      `   📊 Duration: ${metadata.duration.toFixed(1)}s, ${metadata.width}x${metadata.height}`
    )

    await prisma.video.update({
      where: { id: videoId },
      data: { transcodingProgress: 30 }
    })

    // 6. Transcode (30-80% progress)
    console.log('   🎥 Transcoding to HLS...')
    await transcodeVideo(inputPath, outputDir, videoId)

    await prisma.video.update({
      where: { id: videoId },
      data: { transcodingProgress: 80 }
    })

    // 7. Upload outputs to MinIO with retry (80-90% progress)
    console.log('   ⬆️  Uploading outputs to MinIO...')
    const uploadedFiles = await retryWithBackoff(
      () => storageService.uploadDirectory(outputDir, `videos/${videoId}`),
      {
        maxRetries: 3,
        operationName: 'Upload to MinIO'
      }
    )
    console.log(`   ✅ Uploaded ${uploadedFiles.length} files`)

    await prisma.video.update({
      where: { id: videoId },
      data: { transcodingProgress: 90 }
    })

    // 8. Create VideoVariant records (95% progress)
    console.log('   💾 Creating variant records...')
    await createVariantRecords(videoId, uploadedFiles)

    // 9. Update video to READY (100% progress)
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        duration: Math.round(metadata.duration),
        hlsManifestKey: `videos/${videoId}/master.m3u8`,
        transcodingProgress: 100,
        transcodingError: null
      }
    })

    console.log(`   ✅ Video ${videoId} is READY!`)

    // Record successful job completion
    metrics.recordJobComplete(videoId, true)
  } catch (error) {
    console.error(`   ❌ Transcode failed:`, error)

    // Record failed job
    metrics.recordJobComplete(videoId, false)

    // Update status to FAILED with error message
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'FAILED',
        transcodingError: error instanceof Error ? error.message : String(error)
      }
    })

    throw error
  } finally {
    // Always cleanup temp files
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
      console.log('   🧹 Cleaned up temp files')
    } catch (cleanupErr) {
      console.warn('   ⚠️ Failed to clean up temp files:', cleanupErr)
    }
  }
}

/**
 * Start the worker and consume jobs
 */
export async function startWorker(): Promise<void> {
  const { connection, channel } = await connectRabbitMQ()

  console.log(`🎧 Listening for transcode jobs (${WORKER_CONCURRENCY} concurrent)...\n`)

  // Consume messages
  await channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (!msg) return

      let job: WorkerJob | undefined

      try {
        job = JSON.parse(msg.content.toString()) as WorkerJob

        // Determine job type
        const jobType = (job as any).type || 'transcode'
        console.log(`📥 Received job [${jobType}]: ${job.videoId}`)

        if (jobType === 'start-live-stream') {
          const liveJob = job as StartLiveStreamJob
          await liveStreamManager.startLiveStream({
            videoId: liveJob.videoId,
            inputSource: liveJob.inputSource
          })
          console.log(`✅ Live stream started: ${liveJob.videoId}\n`)
        } else if (jobType === 'stop-live-stream') {
          const stopJob = job as StopLiveStreamJob
          await liveStreamManager.stopLiveStream(stopJob.videoId, stopJob.convertToVOD)
          console.log(`✅ Live stream stopped: ${stopJob.videoId}\n`)
        } else {
          // Default: transcode job
          const transcodeJob = job as TranscodeJob
          await processTranscodeJob(transcodeJob)
          console.log(`✅ Completed transcode: ${transcodeJob.videoId}\n`)
        }

        // Acknowledge successful processing
        channel.ack(msg)
      } catch (error) {
        console.error(`❌ Job failed:`, error)

        // Don't requeue failed jobs (nack without requeue)
        channel.nack(msg, false, false)

        if (job) {
          console.log(`❌ Failed job: ${job.videoId}\n`)
        }
      }
    },
    {
      noAck: false // Manual acknowledgment
    }
  )

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down worker...')
    try {
      // Stop all active live streams first
      await liveStreamManager.stopAllStreams()

      // Close RabbitMQ connections
      await channel.close()
      await (connection as any).close()
      console.log('✅ RabbitMQ connection closed')
    } catch (error) {
      console.error('❌ Error during shutdown:', error)
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
