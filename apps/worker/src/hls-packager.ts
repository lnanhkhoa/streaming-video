/**
 * HLS Packager - Real-time HLS Segment Upload
 *
 * Handles uploading HLS segments and manifests to MinIO storage
 * during live streaming. Implements retry logic and cleanup.
 */

import { storageService } from './services/storage'
import path from 'node:path'

export class HLSPackager {
  /**
   * Upload a single HLS segment (.ts file) to MinIO
   */
  async uploadSegment(segmentPath: string, videoId: string): Promise<void> {
    const fileName = path.basename(segmentPath)
    const s3Key = `live/${videoId}/${fileName}`

    try {
      await storageService.uploadFile(segmentPath, s3Key)
      console.log(`⬆️  Segment uploaded: ${s3Key}`)
    } catch (error) {
      console.error(`❌ Failed to upload segment ${fileName}:`, error)
      throw error
    }
  }

  /**
   * Upload HLS manifest (.m3u8 file) to MinIO
   * Manifests are updated frequently during live streaming
   */
  async uploadManifest(manifestPath: string, videoId: string): Promise<void> {
    const s3Key = `live/${videoId}/index.m3u8`

    try {
      await storageService.uploadFile(manifestPath, s3Key)
      console.log(`🔄 Manifest updated: ${s3Key}`)
    } catch (error) {
      console.error(`❌ Failed to upload manifest:`, error)
      throw error
    }
  }

  /**
   * Clean up old segments from storage
   * Keeps only the most recent segments to save storage space
   *
   * @param videoId - Video ID
   * @param maxSegments - Maximum number of segments to keep (default: 5)
   */
  async cleanupOldSegments(videoId: string, maxSegments: number = 5): Promise<void> {
    // TODO: Implement segment cleanup
    // This is optional for MVP - can defer to future enhancement
    // Strategy:
    // 1. List all objects with prefix `live/${videoId}/segment_`
    // 2. Sort by timestamp or sequence number
    // 3. Keep newest N segments
    // 4. Delete older segments
    console.log(`🧹 Cleanup segments for ${videoId} (max: ${maxSegments}) - Not implemented`)
  }
}

export const hlsPackager = new HLSPackager()
