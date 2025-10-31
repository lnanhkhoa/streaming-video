/**
 * MinIO Storage Service
 *
 * TODO (Phase 4):
 * - Initialize MinIO client
 * - downloadFile(key, localPath)
 * - uploadFile(localPath, key)
 * - uploadDirectory(localDir, prefix)
 * - deleteFiles(prefix)
 * - fileExists(key)
 */

export class StorageService {
  constructor() {
    console.log('TODO: Initialize MinIO client in Phase 4')
  }

  async downloadFile(key: string, localPath: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async uploadFile(localPath: string, key: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async uploadDirectory(localDir: string, prefix: string): Promise<string[]> {
    throw new Error('Not implemented')
  }
}

export const storageService = new StorageService()
