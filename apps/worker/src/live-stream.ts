/**
 * Live Stream Handler
 *
 * TODO (Phase 4):
 * - Receive WebRTC stream
 * - Convert to HLS in real-time
 * - Upload segments to MinIO
 * - Update manifest dynamically
 * - Handle stream stop
 */

export async function startLiveStream(videoId: string, streamKey: string): Promise<void> {
  console.log('TODO: Implement live streaming in Phase 4')
  throw new Error('Not implemented')
}

export async function stopLiveStream(videoId: string): Promise<void> {
  console.log('TODO: Implement stop live stream in Phase 4')
  throw new Error('Not implemented')
}
