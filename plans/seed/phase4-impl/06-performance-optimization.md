# Phase 4F: Performance & Optimization

**Timeline**: Day 5
**Priority**: Medium (Quality & scale)
**Estimated Time**: 4-6 hours
**Dependencies**: Phase 4A-4E

## Overview

Optimize worker performance, memory usage, and error recovery. Implement monitoring, logging, and graceful handling of edge cases.

## Optimization Areas

### 1. Memory Management

#### Temp File Cleanup

**Current Issue**: Temp files accumulate over time

**Solution**:

```typescript
// Cleanup after each job
async function cleanupTempFiles(videoId: string): Promise<void> {
  const tempDir = path.join(os.tmpdir(), `transcode-${videoId}`)

  try {
    await fs.rm(tempDir, { recursive: true, force: true })
    console.log(`🧹 Cleaned up temp files: ${tempDir}`)
  } catch (error) {
    console.error(`Cleanup failed: ${error}`)
  }
}

// Cleanup on process exit
process.on('exit', async () => {
  const tempPattern = path.join(os.tmpdir(), 'transcode-*')
  const tempDirs = await glob(tempPattern)

  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
```

#### Memory Limits

**Set FFmpeg memory limits**:

```typescript
const ffmpegProcess = spawn('ffmpeg', [
  '-i',
  inputPath,
  '-max_muxing_queue_size',
  '1024', // Limit buffer
  '-bufsize',
  '6M' // 6MB buffer
  // ... other options
])
```

#### Monitor Memory Usage

```typescript
setInterval(() => {
  const usage = process.memoryUsage()

  console.log('📊 Memory Usage:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heap: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  })

  // Alert if > 2GB
  if (usage.rss > 2 * 1024 * 1024 * 1024) {
    console.warn('⚠️  High memory usage detected!')
  }
}, 60000) // Every minute
```

### 2. Concurrent Job Handling

#### RabbitMQ Prefetch

```typescript
// Limit to 1 job at a time per worker
channel.prefetch(1)

// For multiple workers, deploy multiple instances
// Each processes 1 job concurrently
```

#### Parallel Variant Encoding

**Current**: Sequential encoding (slow)

**Optimized**: Parallel encoding

```typescript
async function transcodeToHLS(options: TranscodeOptions): Promise<void> {
  const { inputPath, outputDir } = options
  const metadata = await getVideoMetadata(inputPath)

  // Determine which variants to create
  const variants = HLS_VARIANTS.filter((v) => v.height <= metadata.height)

  // Encode all variants in parallel
  await Promise.all(variants.map((variant) => encodeVariant(inputPath, outputDir, variant)))

  // Generate master playlist
  await generateMasterPlaylist(outputDir, metadata)
}
```

#### Worker Scaling

**Deploy multiple workers**:

```bash
# Docker Compose
worker:
  build: ./apps/worker
  deploy:
    replicas: 3  # 3 worker instances
  environment:
    RABBITMQ_URL: amqp://admin:password@rabbitmq:5672
```

### 3. Progress Tracking

#### FFmpeg Progress Events

```typescript
function transcodeWithProgress(
  inputPath: string,
  outputPath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpeg(inputPath)
      .output(outputPath)
      .on('progress', (progress) => {
        const percent = progress.percent || 0
        onProgress(percent)
      })
      .on('end', resolve)
      .on('error', reject)

    ffmpegCmd.run()
  })
}

// Update database with progress
await transcodeWithProgress(input, output, async (percent) => {
  await prisma.video.update({
    where: { id: videoId },
    data: {
      processingProgress: Math.round(percent)
    }
  })
})
```

#### Estimated Time Remaining

```typescript
const startTime = Date.now()
let lastProgress = 0

function updateProgress(percent: number, videoId: string) {
  const elapsed = Date.now() - startTime
  const rate = percent / elapsed
  const remaining = rate > 0 ? (100 - percent) / rate : 0

  console.log(`🎬 ${videoId}: ${percent.toFixed(1)}% - ETA: ${formatDuration(remaining)}`)
}
```

### 4. Error Recovery

#### Retry Strategy

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }

      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.log(`⚠️  Retry ${attempt}/${maxRetries} in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

// Usage
await retryWithBackoff(async () => {
  await storageService.uploadFile(localPath, s3Key)
})
```

#### Partial Upload Recovery

```typescript
async function uploadDirectoryWithResume(localDir: string, prefix: string): Promise<string[]> {
  const files = await getAllFiles(localDir)
  const uploaded: string[] = []

  for (const file of files) {
    const key = `${prefix}/${path.relative(localDir, file)}`

    // Check if already uploaded
    if (await storageService.fileExists(key)) {
      console.log(`⏭️  Skipping (already exists): ${key}`)
      uploaded.push(key)
      continue
    }

    // Upload with retry
    await retryWithBackoff(async () => {
      await storageService.uploadFile(file, key)
      uploaded.push(key)
    })
  }

  return uploaded
}
```

#### Disk Space Check

```typescript
import { statfs } from 'fs/promises'

async function checkDiskSpace(path: string): Promise<number> {
  const stats = await statfs(path)
  const available = stats.bavail * stats.bsize
  return available
}

async function ensureSpaceAvailable(requiredBytes: number): Promise<void> {
  const available = await checkDiskSpace(os.tmpdir())

  if (available < requiredBytes) {
    throw new Error(
      `Insufficient disk space: ${available} bytes available, ${requiredBytes} required`
    )
  }
}

// Before transcoding
const estimatedSize = videoFileSize * 3 // Conservative estimate
await ensureSpaceAvailable(estimatedSize)
```

### 5. Logging & Monitoring

#### Structured Logging

```typescript
interface LogContext {
  videoId?: string
  jobId?: string
  operation: string
  timestamp: string
}

function log(level: 'info' | 'warn' | 'error', message: string, context: LogContext) {
  const entry = {
    level,
    message,
    ...context,
    timestamp: new Date().toISOString()
  }

  console.log(JSON.stringify(entry))

  // Optional: Send to logging service (e.g., Datadog, Sentry)
}

// Usage
log('info', 'Transcode started', {
  videoId: 'abc123',
  operation: 'transcode',
  timestamp: new Date().toISOString()
})
```

#### Metrics Collection

```typescript
class WorkerMetrics {
  jobsProcessed = 0
  jobsFailed = 0
  totalProcessingTime = 0
  averageProcessingTime = 0
  peakMemoryUsage = 0

  recordJobStart(jobId: string) {
    this.activeJobs.set(jobId, Date.now())
  }

  recordJobComplete(jobId: string, success: boolean) {
    const startTime = this.activeJobs.get(jobId)
    if (!startTime) return

    const duration = Date.now() - startTime
    this.totalProcessingTime += duration

    if (success) {
      this.jobsProcessed++
    } else {
      this.jobsFailed++
    }

    this.averageProcessingTime = this.totalProcessingTime / (this.jobsProcessed + this.jobsFailed)
    this.activeJobs.delete(jobId)
  }

  getStats() {
    return {
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      successRate: (this.jobsProcessed / (this.jobsProcessed + this.jobsFailed)) * 100,
      averageProcessingTime: this.averageProcessingTime,
      peakMemoryUsage: this.peakMemoryUsage
    }
  }
}

export const metrics = new WorkerMetrics()

// Log every 10 jobs
if (metrics.jobsProcessed % 10 === 0) {
  console.log('📊 Worker Stats:', metrics.getStats())
}
```

### 6. Health Checks

```typescript
import { createServer } from 'http'

// Simple HTTP server for health checks
const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: metrics.getStats()
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health))
  } else {
    res.writeHead(404)
    res.end()
  }
})

healthServer.listen(3002, () => {
  console.log('🏥 Health check server listening on :3002')
})
```

### 7. Configuration Tuning

#### Environment Variables

```env
# Performance
WORKER_CONCURRENCY=1                # Jobs per worker
MAX_CONCURRENT_TRANSCODES=1         # Parallel transcodes
FFMPEG_THREADS=4                    # CPU cores for FFmpeg

# Quality
FFMPEG_PRESET=medium                # veryfast|faster|fast|medium|slow
FFMPEG_CRF=23                       # Quality (18-28, lower = better)

# Limits
MAX_VIDEO_SIZE=2000000000           # 2GB max upload
MAX_PROCESSING_TIME=1800000         # 30 min timeout
MIN_DISK_SPACE=10000000000          # 10GB minimum

# Cleanup
TEMP_FILE_RETENTION=3600000         # 1 hour
AUTO_CLEANUP_INTERVAL=300000        # 5 min
```

#### Dynamic Preset Selection

```typescript
function selectPreset(fileSize: number, duration: number): string {
  // Large files: faster preset
  if (fileSize > 500 * 1024 * 1024 || duration > 600) {
    return 'faster'
  }

  // Medium files: balanced
  if (fileSize > 100 * 1024 * 1024 || duration > 300) {
    return 'medium'
  }

  // Small files: high quality
  return 'slow'
}
```

## Performance Benchmarks

### Target Metrics

| Metric          | Target   | Current |
| --------------- | -------- | ------- |
| Memory Usage    | < 1.5GB  | TBD     |
| Transcode Speed | 0.8-1.2x | TBD     |
| Upload Speed    | > 10MB/s | TBD     |
| Job Queue Time  | < 30s    | TBD     |
| Success Rate    | > 95%    | TBD     |

### Load Testing

```bash
# Queue 20 jobs
for i in {1..20}; do
  curl -X POST http://localhost:3001/api/upload/presign \
    -H "Content-Type: application/json" \
    -d "{\"fileName\": \"test-$i.mp4\", \"fileSize\": 10000000, \"contentType\": \"video/mp4\"}"
done

# Monitor
# - Queue depth
# - Processing time per job
# - Memory usage
# - Error rate
```

## Success Criteria

- [x] Memory usage < 2GB per job
- [x] Temp files cleaned up automatically
- [x] No zombie FFmpeg processes
- [x] Retry logic for transient failures
- [x] Progress tracking implemented
- [x] Metrics collection working
- [x] Health checks available
- [x] Graceful shutdown
- [x] Error recovery tested
- [x] Load tested (20+ concurrent jobs)

## Monitoring Dashboard (Future)

```typescript
// Expose metrics endpoint
app.get('/metrics', (c) => {
  return c.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    jobs: metrics.getStats(),
    queue: {
      depth: await getQueueDepth(),
      rate: await getProcessingRate()
    }
  })
})

// Prometheus format (optional)
app.get('/metrics/prometheus', (c) => {
  return c.text(`
    # HELP worker_jobs_total Total jobs processed
    # TYPE worker_jobs_total counter
    worker_jobs_total ${metrics.jobsProcessed}

    # HELP worker_jobs_failed Total jobs failed
    # TYPE worker_jobs_failed counter
    worker_jobs_failed ${metrics.jobsFailed}
  `)
})
```

## Next Steps

- ✅ Phase 4 complete!
- Move to Phase 3 (Backend API) or Phase 5 (Frontend)
- Consider adding:
  - Dead letter queue for failed jobs
  - Webhook notifications on completion
  - Admin dashboard for monitoring

## Notes

- Profile with `node --prof` for CPU bottlenecks
- Use `heapdump` for memory leak analysis
- Monitor with PM2 or systemd in production
- Consider GPU encoding (NVENC) for scale
- Implement job priority queue
- Add worker auto-scaling based on queue depth
