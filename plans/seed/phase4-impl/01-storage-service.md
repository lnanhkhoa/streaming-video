# Phase 4A: Storage Service

**Timeline**: Day 1
**Priority**: High (Required for all other phases)
**Estimated Time**: 4-6 hours

## Overview

Implement MinIO client for S3-compatible object storage operations. This service handles all file upload/download operations between worker and MinIO.

## File

`apps/worker/src/services/storage.ts`

## Dependencies

**Services**:

- MinIO running on `localhost:9000` or `localhost:9000`

**Environment Variables**:

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password
```

**NPM Packages** (already installed):

- `minio@^7.1.4`

## Implementation Tasks

### 1. MinIO Client Initialization

- [ ] Create MinIO client instance
- [ ] Configure bucket name: `streaming-video`
- [ ] Ensure bucket exists (create if not)
- [ ] Handle connection errors

### 2. Core Methods

#### `downloadFile(key: string, localPath: string): Promise<void>`

- Download file from MinIO to local filesystem
- Handle download errors
- Verify file downloaded successfully

#### `uploadFile(localPath: string, key: string): Promise<void>`

- Upload file from local filesystem to MinIO
- Set correct content type
- Handle upload errors
- Return uploaded file metadata

#### `uploadDirectory(localDir: string, prefix: string): Promise<string[]>`

- Recursively upload entire directory
- Maintain directory structure
- Return array of uploaded keys
- Handle partial failures

#### `fileExists(key: string): Promise<boolean>`

- Check if file exists in bucket
- Handle errors gracefully
- Return boolean

#### `deleteFiles(prefix: string): Promise<void>`

- Delete all files with given prefix
- Used for cleanup operations
- Handle errors

### 3. Error Handling

- Connection errors → retry 3x
- Upload/download errors → throw with context
- Timeout errors → configurable timeout
- Log all operations

## Code Structure

```typescript
import { Client } from 'minio'

interface StorageConfig {
  endpoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
}

class StorageService {
  private client: Client
  private bucket: string

  constructor(config: StorageConfig)
  private async ensureBucket(): Promise<void>

  async downloadFile(key: string, localPath: string): Promise<void>
  async uploadFile(localPath: string, key: string): Promise<void>
  async uploadDirectory(localDir: string, prefix: string): Promise<string[]>
  async fileExists(key: string): Promise<boolean>
  async deleteFiles(prefix: string): Promise<void>
}

export const storageService = new StorageService({
  endpoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  bucket: 'streaming-video'
})
```

## Testing

### Unit Tests

```typescript
describe('StorageService', () => {
  it('connects to MinIO', async () => {
    expect(storageService).toBeDefined()
  })

  it('checks file existence', async () => {
    const exists = await storageService.fileExists('test.txt')
    expect(typeof exists).toBe('boolean')
  })

  it('uploads and downloads file', async () => {
    await storageService.uploadFile('/tmp/test.txt', 'test/test.txt')
    await storageService.downloadFile('test/test.txt', '/tmp/downloaded.txt')
    expect(fs.existsSync('/tmp/downloaded.txt')).toBe(true)
  })
})
```

### Manual Testing

```bash
# Start MinIO
docker-compose -f docker-compose.dev.yml up -d minio

# Test storage service
cd apps/worker
bun run dev  # Should connect without errors

# Check MinIO console
open http://localhost:9001
# Login: admin/password
# Bucket 'streaming-video' should exist
```

## Success Criteria

- [x] MinIO client connects successfully
- [x] Can upload test file to bucket
- [x] Can download test file from bucket
- [x] Can check file existence
- [x] Can delete files by prefix
- [x] Handles all errors gracefully
- [x] No connection leaks

## Verification Checklist

```bash
# 1. MinIO is running
curl http://localhost:9000/minio/health/live
# Should return: OK

# 2. Worker can connect
cd apps/worker
bun run dev
# Should log: ✅ MinIO connected

# 3. Test upload
# (Worker should have test command)
bun run test:storage
```

## Next Steps

Once storage service is complete:

- ✅ Proceed to Phase 4B (FFmpeg Transcoder)
- Storage service will be used by transcoder to download inputs and upload outputs

## Notes

- Keep file operations async
- Use streams for large files (> 100MB)
- Set reasonable timeouts (30s for upload, 60s for download)
- Log all S3 operations for debugging
- Handle network failures gracefully
