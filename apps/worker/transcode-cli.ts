#!/usr/bin/env node

/**
 * Video Transcoding CLI Script
 * 
 * Standalone script to transcode video files (MKV, MP4, etc.) to HLS format.
 * Supports both quality variants and copy mode (no re-encoding).
 * 
 * Usage:
 *   # With quality variants (default)
 *   npx ts-node transcode-cli.ts --input <path-to-video.mkv> --output <output-dir>
 *   
 *   # Copy mode (no re-encoding, keeps original quality/resolution)
 *   npx ts-node transcode-cli.ts -i video.mkv -o ./output --copy
 *   
 *   # Custom segment duration
 *   npx ts-node transcode-cli.ts -i video.mkv -o ./output --segment-duration 10
 *   npx ts-node transcode-cli.ts -i video.mkv -o ./output --copy --segment-duration 8
 */

import ffmpeg from 'fluent-ffmpeg'
import path from 'node:path'
import fsp from 'node:fs/promises'
import fs from 'node:fs'
import { program } from 'commander'

/**
 * Video metadata interface
 */
interface VideoMetadata {
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
  codec: string
  hasAudio: boolean
}

/**
 * HLS variant configuration
 */
interface HLSVariant {
  resolution: string
  width: number
  height: number
  bitrate: number
  audioBitrate: number
}

const HLS_VARIANTS: HLSVariant[] = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000, audioBitrate: 192 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800, audioBitrate: 128 },
  // { resolution: '480p', width: 854, height: 480, bitrate: 1400, audioBitrate: 96 }
]

const DEFAULT_SEGMENT_DURATION = 6

/**
 * Extract video metadata using ffprobe
 */
async function getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.error('❌ Failed to probe video:', err)
        return reject(new Error(`Failed to extract metadata: ${err.message}`))
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio')

      if (!videoStream) {
        return reject(new Error('No video stream found in input file'))
      }

      const result: VideoMetadata = {
        duration: metadata.format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate), 10) : 0,
        fps: videoStream.r_frame_rate ? eval(videoStream.r_frame_rate.replace('/', '/')) : 30,
        codec: videoStream.codec_name || 'unknown',
        hasAudio: !!audioStream
      }

      console.log(
        `📊 Video metadata: ${result.width}x${result.height}, ${result.duration.toFixed(1)}s, ${result.codec}`
      )
      resolve(result)
    })
  })
}

/**
 * Generate thumbnail from video at 1 second or 10% of duration
 */
async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  const metadata = await getVideoMetadata(inputPath)
  const timestamp = Math.min(1, metadata.duration * 0.1)

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x720'
      })
      .on('end', () => {
        console.log(`📸 Thumbnail generated: ${outputPath}`)
        resolve()
      })
      .on('error', (err) => {
        console.error('❌ Thumbnail generation failed:', err)
        reject(new Error(`Thumbnail generation failed: ${err.message}`))
      })
  })
}

/**
 * Transcode single variant to HLS with hardware encoding (Apple Silicon)
 */
async function transcodeVariantHW(
  inputPath: string,
  outputDir: string,
  variant: HLSVariant,
  segmentDuration: number = DEFAULT_SEGMENT_DURATION
): Promise<void> {
  const variantDir = path.join(outputDir, variant.resolution)
  await fsp.mkdir(variantDir, { recursive: true })

  const playlistPath = path.join(variantDir, 'playlist.m3u8')
  const segmentPattern = path.join(variantDir, 'segment_%03d.ts')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      // Input options: hardware-accelerated decoding
      .inputOptions(['-hwaccel', 'videotoolbox'])
      .outputOptions([
        // Hardware encoding for Apple Silicon
        '-c:v h264_videotoolbox',
        `-b:v ${variant.bitrate}k`,
        `-maxrate ${Math.floor(variant.bitrate * 1.2)}k`,
        `-bufsize ${variant.bitrate * 2}k`,
        `-vf scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:a aac',
        `-b:a ${variant.audioBitrate}k`,
        '-ar 48000',
        '-ac 2',
        '-f hls',
        `-hls_time ${segmentDuration}`,
        '-hls_playlist_type vod',
        `-hls_segment_filename ${segmentPattern}`
      ])
      .output(playlistPath)
      .on('start', (cmdLine) => {
        console.log(`🎬 Transcoding ${variant.resolution} (hardware-encoded)...`)
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r   ${variant.resolution}: ${progress.percent.toFixed(1)}%`)
        }
      })
      .on('end', () => {
        console.log(`\n✅ ${variant.resolution} complete`)
        resolve()
      })
      .on('error', (err) => {
        console.error(`\n❌ ${variant.resolution} failed:`, err)
        reject(new Error(`Transcoding ${variant.resolution} failed: ${err.message}`))
      })

    cmd.run()
  })
}

/**
 * Copy video to HLS without re-encoding (keeps original quality/resolution)
 */
async function copyToHLS(
  inputPath: string,
  outputDir: string,
  segmentDuration: number = DEFAULT_SEGMENT_DURATION
): Promise<VideoMetadata> {
  const metadata = await getVideoMetadata(inputPath)

  // Ensure output directory exists first
  await fsp.mkdir(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, 'playlist.m3u8')
  const segmentPattern = path.join(outputDir, 'segment_%03d.ts')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .outputOptions([
        // Copy video stream without re-encoding
        '-c:v copy',
        // Re-encode audio to AAC for HLS compatibility
        '-c:a aac',
        '-b:a 128k',
        '-ar 48000',
        '-ac 2',
        // Fix timing issues when copying video stream
        '-copyts',
        '-start_at_zero',
        // HLS format options
        '-f hls',
        `-hls_time ${segmentDuration}`,
        '-hls_playlist_type vod',
        '-hls_segment_type mpegts',
        `-hls_segment_filename ${segmentPattern}`,
        // Allow non-monotonous DTS which can occur in copy mode
        '-fflags +genpts'
      ])
      .output(outputPath)
      .on('start', (cmdLine) => {
        console.log(`🎬 Copying to HLS (video copy, audio AAC, original quality ${metadata.width}x${metadata.height})...`)
        console.log(`   FFmpeg: ${cmdLine}`)
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r   Progress: ${progress.percent.toFixed(1)}%`)
        }
      })
      .on('end', () => {
        console.log(`\n✅ Copy complete`)
        resolve(metadata)
      })
      .on('error', async (err) => {
        console.error(`\n⚠️ FFmpeg reported error:`, err.message)
        
        // Check if output files were actually created despite the error
        const playlistExists = fs.existsSync(outputPath)
        const segmentExists = fs.existsSync(path.join(outputDir, 'segment_000.ts'))
        
        if (playlistExists && segmentExists) {
          console.log(`✅ Output files created successfully despite FFmpeg warnings`)
          resolve(metadata)
        } else {
          console.error(`❌ No output files found`)
          reject(new Error(`Copy to HLS failed: ${err.message}`))
        }
      })

    cmd.run()
  })
}

/**
 * Transcode video to HLS with multiple variants
 */
async function transcodeToHLS(
  inputPath: string,
  outputDir: string,
  segmentDuration: number = DEFAULT_SEGMENT_DURATION
): Promise<VideoMetadata> {
  // Get source metadata
  const metadata = await getVideoMetadata(inputPath)

  // Filter variants based on source resolution
  const applicableVariants = HLS_VARIANTS.filter((v) => {
    return v.height <= metadata.height
  })

  if (applicableVariants.length === 0) {
    throw new Error(
      `Source resolution ${metadata.width}x${metadata.height} is too low for any variant`
    )
  }

  console.log(`🎥 Transcoding to ${applicableVariants.map((v) => v.resolution).join(', ')} (segment: ${segmentDuration}s)`)

  // Transcode variants sequentially with hardware encoding
  for (const variant of applicableVariants) {
    await transcodeVariantHW(inputPath, outputDir, variant, segmentDuration)
  }

  console.log('✅ All variants transcoded')
  return metadata
}

/**
 * Generate master HLS playlist
 */
async function generateMasterPlaylist(
  outputDir: string,
  metadata: VideoMetadata,
  isCopyMode: boolean = false
): Promise<void> {
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3', '']

  if (isCopyMode) {
    // For copy mode, just reference the single playlist
    const playlistPath = path.join(outputDir, 'playlist.m3u8')
    if (fs.existsSync(playlistPath)) {
      const bandwidth = metadata.bitrate
      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${metadata.width}x${metadata.height}`
      )
      lines.push('playlist.m3u8')
      lines.push('')
    }
  } else {
    // Check which variants were actually created
    const applicableVariants = HLS_VARIANTS.filter((v) => v.height <= metadata.height)

    for (const variant of applicableVariants) {
      const playlistPath = path.join(outputDir, variant.resolution, 'playlist.m3u8')
      if (fs.existsSync(playlistPath)) {
        const bandwidth = variant.bitrate * 1000
        lines.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${variant.width}x${variant.height}`
        )
        lines.push(`${variant.resolution}/playlist.m3u8`)
        lines.push('')
      }
    }
  }

  const masterPath = path.join(outputDir, 'master.m3u8')
  await fsp.writeFile(masterPath, lines.join('\n'), 'utf-8')
  console.log(`📝 Master playlist created: ${masterPath}`)
}

/**
 * Main transcoding function
 */
async function transcodeVideo(
  inputPath: string,
  outputDir: string,
  copyMode: boolean = false,
  segmentDuration: number = DEFAULT_SEGMENT_DURATION
): Promise<void> {
  // Validate input file exists
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`)
  }

  // Get absolute paths
  const absoluteInputPath = path.resolve(inputPath)
  const absoluteOutputDir = path.resolve(outputDir)

  const modeLabel = copyMode ? 'COPY MODE (no re-encoding)' : 'TRANSCODE MODE'
  console.log(`\n🎬 Starting video ${modeLabel}`)
  console.log(`   Input: ${absoluteInputPath}`)
  console.log(`   Output: ${absoluteOutputDir}`)
  console.log(`   Segment duration: ${segmentDuration}s\n`)

  // Ensure output directory exists
  await fsp.mkdir(absoluteOutputDir, { recursive: true })

  try {
    // 1. Extract metadata
    const metadata = await getVideoMetadata(absoluteInputPath)

    // 2. Generate thumbnail
    const thumbnailPath = path.join(absoluteOutputDir, 'thumbnail.jpg')
    await generateThumbnail(absoluteInputPath, thumbnailPath)

    // 3. Process video
    let finalMetadata: VideoMetadata
    if (copyMode) {
      finalMetadata = await copyToHLS(absoluteInputPath, absoluteOutputDir, segmentDuration)
    } else {
      finalMetadata = await transcodeToHLS(absoluteInputPath, absoluteOutputDir, segmentDuration)
    }

    // 4. Generate master playlist
    await generateMasterPlaylist(absoluteOutputDir, finalMetadata, copyMode)

    console.log(`\n✅ Processing complete!`)
    console.log(`   Master playlist: ${path.join(absoluteOutputDir, 'master.m3u8')}`)
    console.log(`   Thumbnail: ${thumbnailPath}`)
    if (copyMode) {
      console.log(`   Resolution: ${finalMetadata.width}x${finalMetadata.height} (original)`)
    }
  } catch (error) {
    console.error(`\n❌ Processing failed:`, error)
    // Clean up partial outputs on failure
    try {
      await fsp.rm(absoluteOutputDir, { recursive: true, force: true })
      console.log('🧹 Cleaned up partial outputs')
    } catch (cleanupErr) {
      console.warn('⚠️ Failed to clean up outputs:', cleanupErr)
    }
    throw error
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  program
    .name('transcode-cli')
    .description('Convert video files to HLS format with optional quality variants')
    .version('1.0.0')
    .requiredOption('-i, --input <path>', 'Input video file path (MKV, MP4, etc.)')
    .requiredOption('-o, --output <path>', 'Output directory for HLS files')
    .option('-c, --copy', 'Copy mode: no re-encoding, keeps original quality/resolution')
    .option('-s, --segment-duration <seconds>', 'HLS segment duration in seconds (default: 6)', '6')
    .parse(process.argv)

  const options = program.opts()
  const segmentDuration = parseInt(options.segmentDuration, 10)

  if (isNaN(segmentDuration) || segmentDuration < 1) {
    console.error('❌ Error: Segment duration must be a positive number')
    process.exit(1)
  }

  try {
    await transcodeVideo(options.input, options.output, options.copy || false, segmentDuration)
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
