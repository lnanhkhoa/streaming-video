/**
 * Live Stream Handler
 *
 * Manages live video streaming:
 * - Spawns FFmpeg process to convert input to HLS
 * - Watches output directory for new segments
 * - Uploads segments to MinIO in real-time
 * - Handles stream lifecycle (start/stop)
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { watch, type FSWatcher } from 'chokidar'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { prisma } from '@repo/database'
import { hlsPackager } from './hls-packager'

export interface LiveStreamConfig {
  videoId: string
  inputSource: string // RTMP URL, file path, or HTTP stream URL
}

interface ActiveStream {
  process: ChildProcess
  watcher: FSWatcher
  outputDir: string
  startTime: Date
}

class LiveStreamManager {
  private activeStreams = new Map<string, ActiveStream>()

  /**
   * Start a new live stream
   * Spawns FFmpeg process and sets up file watching
   */
  async startLiveStream(config: LiveStreamConfig): Promise<void> {
    const { videoId, inputSource } = config

    // Check if stream already active
    if (this.activeStreams.has(videoId)) {
      throw new Error(`Stream ${videoId} is already active`)
    }

    console.log(`🎥 Starting live stream: ${videoId}`)
    console.log(`   Input: ${inputSource}`)

    // Create temporary output directory
    const outputDir = path.join(os.tmpdir(), `live-${videoId}`)
    await fs.mkdir(outputDir, { recursive: true })
    console.log(`📁 Output directory: ${outputDir}`)

    // Build FFmpeg command for HLS output
    const ffmpegArgs = [
      // Input
      '-i',
      inputSource,

      // Video encoding - optimized for low latency
      '-c:v',
      'libx264',
      '-preset',
      'veryfast', // Fast encoding
      '-tune',
      'zerolatency', // Minimize latency
      '-b:v',
      '2500k', // Target bitrate
      '-maxrate',
      '3000k', // Max bitrate
      '-bufsize',
      '6000k', // Buffer size (2x maxrate)
      '-vf',
      'scale=1280:720', // 720p output
      '-g',
      '60', // GOP size: keyframe every 2s at 30fps

      // Audio encoding
      '-c:a',
      'aac',
      '-b:a',
      '128k', // Audio bitrate
      '-ar',
      '48000', // Sample rate

      // HLS output settings
      '-f',
      'hls',
      '-hls_time',
      '2', // 2-second segments for low latency
      '-hls_list_size',
      '5', // Keep only 5 segments in playlist
      '-hls_flags',
      'delete_segments+append_list', // Auto-delete old segments
      '-hls_segment_filename',
      `${outputDir}/segment_%03d.ts`,
      `${outputDir}/index.m3u8`
    ]

    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)
    console.log(`🎬 FFmpeg process started (PID: ${ffmpegProcess.pid})`)

    // Handle FFmpeg stdout/stderr
    ffmpegProcess.stdout?.on('data', (data) => {
      // FFmpeg writes to stderr, not stdout
      console.log(`FFmpeg [${videoId}]:`, data.toString().trim())
    })

    ffmpegProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim()
      // Log only important messages (skip progress updates)
      if (!output.includes('frame=') && !output.includes('speed=')) {
        console.log(`FFmpeg [${videoId}]:`, output)
      }
    })

    // Handle FFmpeg errors and exit
    ffmpegProcess.on('error', async (error) => {
      console.error(`❌ FFmpeg error for ${videoId}:`, error)
      await this.handleStreamError(videoId, error)
    })

    ffmpegProcess.on('exit', async (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ FFmpeg exited with code ${code} for ${videoId}`)
        await this.handleStreamError(videoId, new Error(`FFmpeg exited with code ${code}`))
      } else if (signal) {
        console.log(`⚠️  FFmpeg killed by signal ${signal} for ${videoId}`)
      } else {
        console.log(`✅ FFmpeg exited normally for ${videoId}`)
      }
    })

    // Set up file watcher for real-time uploads
    const watcher = this.watchDirectory(videoId, outputDir)

    // Store active stream info
    this.activeStreams.set(videoId, {
      process: ffmpegProcess,
      watcher,
      outputDir,
      startTime: new Date()
    })

    // Update database status
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'LIVE',
          hlsManifestKey: `live/${videoId}/index.m3u8`
        }
      })
      console.log(`✅ Live stream started: ${videoId}`)
    } catch (error) {
      console.error(`❌ Failed to update database for ${videoId}:`, error)
      // Still continue with the stream even if DB update fails
    }
  }

  /**
   * Set up file watcher for output directory
   * Uploads new segments and manifest updates in real-time
   */
  private watchDirectory(videoId: string, outputDir: string): FSWatcher {
    console.log(`👀 Watching directory: ${outputDir}`)

    const watcher = watch(outputDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms after file stops changing
        pollInterval: 50
      }
    })

    // Handle new files (segments and initial manifest)
    watcher.on('add', async (filePath) => {
      const fileName = path.basename(filePath)
      console.log(`📝 New file detected: ${fileName}`)

      try {
        if (fileName.endsWith('.ts')) {
          // Upload HLS segment
          await hlsPackager.uploadSegment(filePath, videoId)
        } else if (fileName.endsWith('.m3u8')) {
          // Upload manifest
          await hlsPackager.uploadManifest(filePath, videoId)
        }
      } catch (error) {
        console.error(`❌ Upload failed for ${fileName}:`, error)
        // Log but don't stop the stream - continue with next segments
      }
    })

    // Handle manifest updates
    watcher.on('change', async (filePath) => {
      const fileName = path.basename(filePath)

      if (fileName.endsWith('.m3u8')) {
        console.log(`🔄 Manifest updated: ${fileName}`)

        try {
          await hlsPackager.uploadManifest(filePath, videoId)
        } catch (error) {
          console.error(`❌ Manifest upload failed:`, error)
          // Continue - next update might succeed
        }
      }
    })

    watcher.on('error', (error) => {
      console.error(`❌ Watcher error for ${videoId}:`, error)
    })

    return watcher
  }

  /**
   * Stop a live stream gracefully
   */
  async stopLiveStream(videoId: string, convertToVOD: boolean = false): Promise<void> {
    const stream = this.activeStreams.get(videoId)

    if (!stream) {
      console.warn(`⚠️  No active stream found for ${videoId}`)
      return
    }

    console.log(`🛑 Stopping live stream: ${videoId}`)

    try {
      // Send SIGTERM to FFmpeg for graceful shutdown
      stream.process.kill('SIGTERM')

      // Wait a moment for FFmpeg to finish writing
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Stop file watcher
      await stream.watcher.close()
      console.log(`✅ File watcher stopped`)

      // Clean up temporary directory
      try {
        await fs.rm(stream.outputDir, { recursive: true, force: true })
        console.log(`🧹 Cleaned up temp directory: ${stream.outputDir}`)
      } catch (error) {
        console.error(`⚠️  Failed to clean up temp directory:`, error)
        // Non-fatal - continue
      }

      // Remove from active streams
      this.activeStreams.delete(videoId)

      // Update database status
      const newStatus = convertToVOD ? 'PENDING' : 'READY'
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: newStatus
        }
      })

      console.log(`✅ Live stream stopped: ${videoId} (status: ${newStatus})`)

      // If converting to VOD, could trigger transcode job here
      if (convertToVOD) {
        console.log(`📹 VOD conversion requested for ${videoId} (not implemented)`)
        // TODO: Implement VOD conversion by downloading segments and transcoding
      }
    } catch (error) {
      console.error(`❌ Error stopping stream ${videoId}:`, error)
      throw error
    }
  }

  /**
   * Handle stream errors - update status and cleanup
   */
  private async handleStreamError(videoId: string, error: Error): Promise<void> {
    console.error(`❌ Stream error for ${videoId}:`, error)

    try {
      // Update database to FAILED status
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'FAILED'
        }
      })

      // Stop the stream (cleanup)
      await this.stopLiveStream(videoId)
    } catch (cleanupError) {
      console.error(`❌ Error during stream error cleanup:`, cleanupError)
    }
  }

  /**
   * Get count of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size
  }

  /**
   * Get all active stream IDs
   */
  getActiveStreamIds(): string[] {
    return Array.from(this.activeStreams.keys())
  }

  /**
   * Get active stream info
   */
  getActiveStream(videoId: string): ActiveStream | undefined {
    return this.activeStreams.get(videoId)
  }

  /**
   * Stop all active streams (for graceful shutdown)
   */
  async stopAllStreams(): Promise<void> {
    console.log(`🛑 Stopping all active streams (${this.activeStreams.size})`)

    const stopPromises: Promise<void>[] = []

    for (const [videoId] of this.activeStreams) {
      stopPromises.push(
        this.stopLiveStream(videoId).catch((error) => {
          console.error(`❌ Failed to stop stream ${videoId}:`, error)
        })
      )
    }

    await Promise.all(stopPromises)
    console.log(`✅ All streams stopped`)
  }

  /**
   * Convert live stream recording to VOD (optional feature)
   * Concatenates all segments and triggers standard transcode workflow
   */
  async convertToVOD(videoId: string): Promise<void> {
    // TODO: Implement VOD conversion
    // Strategy:
    // 1. Download all segments from MinIO (live/{videoId}/segment_*.ts)
    // 2. Use FFmpeg concat to merge into single MP4
    // 3. Upload merged file to MinIO (BUCKET_RAW/)
    // 4. Trigger standard transcode job via RabbitMQ
    // 5. Clean up live segments after transcode completes

    console.log(`📹 VOD conversion not yet implemented for ${videoId}`)
    throw new Error('VOD conversion not implemented')
  }
}

// Export singleton instance
export const liveStreamManager = new LiveStreamManager()

// Legacy exports for backward compatibility
export async function startLiveStream(videoId: string): Promise<void> {
  throw new Error('Use liveStreamManager.startLiveStream() instead')
}

export async function stopLiveStream(videoId: string): Promise<void> {
  throw new Error('Use liveStreamManager.stopLiveStream() instead')
}
