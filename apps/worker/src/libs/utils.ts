/**
 * Worker Utility Functions
 *
 * - Retry logic with exponential backoff
 * - Disk space validation
 * - Helper functions
 */

import { statfs } from 'node:fs/promises'
import os from 'node:os'

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    operationName?: string
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    operationName = 'Operation'
  } = options

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`❌ ${operationName} failed after ${maxRetries} attempts`)
        throw error
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn(`⚠️  ${operationName} failed (attempt ${attempt}/${maxRetries}): ${errorMsg}`)
      console.log(`   Retrying in ${delay}ms...`)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts`)
}

/**
 * Check available disk space
 */
export async function checkDiskSpace(path: string = os.tmpdir()): Promise<number> {
  try {
    const stats = await statfs(path)
    // Available space in bytes
    const available = Number(stats.bavail) * Number(stats.bsize)
    return available
  } catch (error) {
    console.warn('⚠️  Could not check disk space:', error)
    return 0
  }
}

/**
 * Ensure sufficient disk space is available
 */
export async function ensureDiskSpace(
  requiredBytes: number,
  path: string = os.tmpdir()
): Promise<void> {
  const available = await checkDiskSpace(path)
  const requiredGB = (requiredBytes / (1024 * 1024 * 1024)).toFixed(2)
  const availableGB = (available / (1024 * 1024 * 1024)).toFixed(2)

  if (available < requiredBytes) {
    throw new Error(
      `Insufficient disk space: ${availableGB}GB available, ${requiredGB}GB required at ${path}`
    )
  }

  console.log(`✅ Disk space check passed: ${availableGB}GB available (need ${requiredGB}GB)`)
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * Estimate required disk space for transcoding
 * Conservative estimate: 3x input file size
 */
export function estimateRequiredSpace(inputFileSize: number): number {
  return inputFileSize * 3
}
