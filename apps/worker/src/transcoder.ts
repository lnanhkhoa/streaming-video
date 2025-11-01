import ffmpeg from 'fluent-ffmpeg'
import path from 'node:path'
import fsp from 'node:fs/promises'
import fs from 'node:fs'

/**
 * FFmpeg Transcoder - VOD
 *
 * Converts uploaded videos into HLS format with multiple quality variants.
 */

export interface TranscodeOptions {
  inputPath: string
  outputDir: string
  videoId: string
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
  codec: string
  hasAudio: boolean
}

export interface HLSVariant {
  resolution: string
  width: number
  height: number
  bitrate: number
  audioBitrate: number
}

const HLS_VARIANTS: HLSVariant[] = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000, audioBitrate: 192 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800, audioBitrate: 128 },
  { resolution: '480p', width: 854, height: 480, bitrate: 1400, audioBitrate: 96 }
]

const FFMPEG_PRESET = process.env.FFMPEG_PRESET || 'medium'
const FFMPEG_CRF = parseInt(process.env.FFMPEG_CRF || '23', 10)

/**
 * Extract video metadata using ffprobe
 */
export async function getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
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
export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
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
 * Transcode single variant to HLS
 */
async function transcodeVariant(
  inputPath: string,
  outputDir: string,
  variant: HLSVariant
): Promise<void> {
  const variantDir = path.join(outputDir, variant.resolution)
  await fsp.mkdir(variantDir, { recursive: true })

  const playlistPath = path.join(variantDir, 'playlist.m3u8')
  const segmentPattern = path.join(variantDir, 'segment_%03d.ts')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        `-preset ${FFMPEG_PRESET}`,
        `-crf ${FFMPEG_CRF}`,
        `-b:v ${variant.bitrate}k`,
        `-maxrate ${Math.floor(variant.bitrate * 1.2)}k`,
        `-bufsize ${variant.bitrate * 2}k`,
        `-vf scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:a aac',
        `-b:a ${variant.audioBitrate}k`,
        '-ar 48000',
        '-ac 2',
        '-f hls',
        '-hls_time 6',
        '-hls_playlist_type vod',
        `-hls_segment_filename ${segmentPattern}`
      ])
      .output(playlistPath)
      .on('start', (cmdLine) => {
        console.log(`🎬 Transcoding ${variant.resolution}...`)
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
 * Transcode video to HLS with multiple variants
 */
export async function transcodeToHLS(options: TranscodeOptions): Promise<void> {
  const { inputPath, outputDir, videoId } = options

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

  console.log(`🎥 Transcoding to ${applicableVariants.map((v) => v.resolution).join(', ')}`)

  // Transcode variants sequentially to avoid resource exhaustion
  for (const variant of applicableVariants) {
    await transcodeVariant(inputPath, outputDir, variant)
  }

  console.log('✅ All variants transcoded')
}

/**
 * Generate master HLS playlist
 */
export async function generateMasterPlaylist(
  outputDir: string,
  metadata: VideoMetadata
): Promise<void> {
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3', '']

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

  const masterPath = path.join(outputDir, 'master.m3u8')
  await fsp.writeFile(masterPath, lines.join('\n'), 'utf-8')
  console.log(`📝 Master playlist created: ${masterPath}`)
}

/**
 * Main transcoding entry point
 */
export async function transcodeVideo(
  inputPath: string,
  outputDir: string,
  videoId: string
): Promise<void> {
  console.log(`🎬 Starting transcode for video ${videoId}`)
  console.log(`   Input: ${inputPath}`)
  console.log(`   Output: ${outputDir}`)

  // Ensure output directory exists
  await fsp.mkdir(outputDir, { recursive: true })

  try {
    // 1. Extract metadata
    const metadata = await getVideoMetadata(inputPath)

    // 2. Generate thumbnail
    const thumbnailPath = path.join(outputDir, 'thumbnail.jpg')
    await generateThumbnail(inputPath, thumbnailPath)

    // 3. Transcode to HLS variants
    await transcodeToHLS({ inputPath, outputDir, videoId })

    // 4. Generate master playlist
    await generateMasterPlaylist(outputDir, metadata)

    console.log(`✅ Transcoding complete for ${videoId}`)
  } catch (error) {
    console.error(`❌ Transcoding failed for ${videoId}:`, error)
    // Clean up partial outputs on failure
    try {
      await fsp.rm(outputDir, { recursive: true, force: true })
      console.log('🧹 Cleaned up partial outputs')
    } catch (cleanupErr) {
      console.warn('⚠️ Failed to clean up outputs:', cleanupErr)
    }
    throw error
  }
}
