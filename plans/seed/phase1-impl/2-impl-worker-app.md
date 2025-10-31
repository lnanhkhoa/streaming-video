# Worker App Setup Implementation Plan

**Date**: 2025-10-31
**Type**: Feature Implementation
**Status**: Planning
**Context Tokens**: Create FFmpeg video processing worker application in Turborepo monorepo. Placeholder setup for Phase 4 implementation.

## Executive Summary
Establish worker application structure with proper TypeScript configuration, build tooling, and placeholder entry point. Worker will handle video transcoding and live streaming in Phase 4.

## Context Links
- **Related Plans**: `plans/251031-phase1-foundation.md`, `plans/251031-phase4-video-worker.md`
- **Dependencies**: @repo/database, @repo/types, FFmpeg (Phase 4)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 4)

## Requirements
### Functional Requirements
- [ ] Worker app with TypeScript support
- [ ] Proper build configuration (tsup)
- [ ] Dev mode with hot reload (tsx watch)
- [ ] Workspace dependency references
- [ ] Placeholder entry point

### Non-Functional Requirements
- [ ] Fast builds with Turbo caching
- [ ] Zero runtime errors on startup
- [ ] Proper TypeScript strict mode
- [ ] Clean console output

## Architecture Overview

```
apps/worker/
├── src/
│   ├── index.ts           # Entry point
│   ├── consumer.ts        # RabbitMQ consumer (Phase 4)
│   ├── transcoder.ts      # FFmpeg transcoding (Phase 4)
│   ├── live-stream.ts     # Live streaming (Phase 4)
│   ├── services/
│   │   └── storage.ts     # MinIO operations (Phase 4)
│   └── types.ts           # Worker-specific types (Phase 4)
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### Key Components
- **Entry Point**: Initializes worker and starts RabbitMQ consumer
- **Build System**: tsup for fast bundling, tsx for development
- **Dependencies**: Workspace packages + external libs (amqplib, minio, fluent-ffmpeg)

## Implementation Phases

### Phase 1: Project Structure (Est: 0.5 days)
**Scope**: Create worker app directory structure and configuration

**Tasks**:
1. [ ] Create app directory - folder: `apps/worker/`
2. [ ] Create src directory - folder: `apps/worker/src/`
3. [ ] Create package.json - file: `apps/worker/package.json`
4. [ ] Create tsconfig.json - file: `apps/worker/tsconfig.json`
5. [ ] Create tsup.config.ts - file: `apps/worker/tsup.config.ts`

**Acceptance Criteria**:
- [ ] Directory structure matches plan
- [ ] Can run `bun install` without errors
- [ ] TypeScript configuration extends from @repo/typescript-config

**Files to Create**:

`apps/worker/package.json`:
```json
{
  "name": "worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/database": "workspace:*",
    "@repo/types": "workspace:*",
    "@repo/utils": "workspace:*",
    "@repo/constants": "workspace:*",
    "amqplib": "^0.10.5",
    "fluent-ffmpeg": "^2.1.3",
    "minio": "^7.1.4"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/amqplib": "^0.10.5",
    "@types/fluent-ffmpeg": "^2.1.27",
    "@types/node": "^22.0.0",
    "tsup": "^8.3.5",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

`apps/worker/tsconfig.json`:
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"],
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`apps/worker/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  dts: false,
  sourcemap: true,
  minify: false,
  splitting: false
})
```

### Phase 2: Entry Point (Est: 0.25 days)
**Scope**: Create placeholder entry point that validates setup

**Tasks**:
1. [ ] Create index.ts - file: `apps/worker/src/index.ts`
2. [ ] Add startup logging
3. [ ] Test database connection
4. [ ] Add graceful shutdown

**Acceptance Criteria**:
- [ ] Worker starts without errors
- [ ] Logs "Worker ready" message
- [ ] Can import @repo packages
- [ ] Process exits cleanly on SIGINT

**Files to Create**:

`apps/worker/src/index.ts`:
```typescript
import { prisma } from '@repo/database'

async function main() {
  console.log('🎬 Video processing worker starting...')
  console.log('📦 Environment:', process.env.NODE_ENV || 'development')

  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected')

    console.log('✅ Worker ready (Phase 4 implementation pending)')
    console.log('👉 This is a placeholder - full implementation in Phase 4')

    // Keep process alive
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Worker failed to start:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down worker...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down worker...')
  await prisma.$disconnect()
  process.exit(0)
})

main().catch(async (error) => {
  console.error('❌ Fatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
```

### Phase 3: Placeholder Files (Est: 0.25 days)
**Scope**: Create placeholder files for Phase 4 implementation

**Tasks**:
1. [ ] Create consumer.ts placeholder - file: `apps/worker/src/consumer.ts`
2. [ ] Create transcoder.ts placeholder - file: `apps/worker/src/transcoder.ts`
3. [ ] Create live-stream.ts placeholder - file: `apps/worker/src/live-stream.ts`
4. [ ] Create services/storage.ts placeholder - file: `apps/worker/src/services/storage.ts`
5. [ ] Create types.ts - file: `apps/worker/src/types.ts`

**Acceptance Criteria**:
- [ ] All files created with TODO comments
- [ ] No compilation errors
- [ ] Imports resolve correctly

**Files to Create**:

`apps/worker/src/consumer.ts`:
```typescript
/**
 * RabbitMQ Consumer
 *
 * TODO (Phase 4):
 * - Connect to RabbitMQ
 * - Assert 'video-transcode' queue
 * - Consume transcode jobs
 * - Process jobs with transcoder
 * - Update video status in database
 * - Handle errors and retries
 */

export async function startConsumer() {
  console.log('TODO: Implement RabbitMQ consumer in Phase 4')
}
```

`apps/worker/src/transcoder.ts`:
```typescript
import type { Video } from '@repo/types'

/**
 * FFmpeg Transcoder
 *
 * TODO (Phase 4):
 * - Download video from MinIO
 * - Transcode to 3 HLS variants (480p, 720p, 1080p)
 * - Generate thumbnail
 * - Create master playlist
 * - Upload all files to MinIO
 * - Update database with manifest keys
 */

export interface TranscodeJob {
  videoId: string
  inputKey: string
}

export async function transcodeVideo(job: TranscodeJob): Promise<void> {
  console.log('TODO: Implement video transcoding in Phase 4')
  throw new Error('Not implemented')
}
```

`apps/worker/src/live-stream.ts`:
```typescript
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
```

`apps/worker/src/services/storage.ts`:
```typescript
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
```

`apps/worker/src/types.ts`:
```typescript
/**
 * Worker-specific types
 */

export interface TranscodeJob {
  videoId: string
  inputKey: string
}

export interface TranscodeResult {
  videoId: string
  manifestKey: string
  thumbnailKey: string
  duration: number
  variants: {
    resolution: string
    playlistKey: string
  }[]
}

export interface LiveStreamConfig {
  videoId: string
  streamKey: string
  outputDir: string
}
```

### Phase 4: Environment Variables (Est: 0.1 days)
**Scope**: Document required environment variables

**Tasks**:
1. [ ] Update .env.example - file: `.env.example`

**Acceptance Criteria**:
- [ ] All worker env vars documented
- [ ] Defaults provided for development

**Update `.env.example`**:
```env
# Worker (Phase 4 - not required yet)
WORKER_CONCURRENCY=1
WORKER_TEMP_DIR=/tmp/transcode
FFMPEG_PRESET=medium
FFMPEG_CRF=23
```

## Testing Strategy
- **Unit Tests**: None required for Phase 1 (placeholder only)
- **Integration Tests**: Verify worker connects to database
- **Build Tests**: `bun run build` succeeds

## Security Considerations
- [ ] No hardcoded credentials in source
- [ ] Environment variables for all secrets
- [ ] Database connection uses Prisma client singleton

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Worker fails to start | High | Test database connection on startup |
| Build fails | Medium | Test build in CI before Phase 4 |
| Missing dependencies | Low | Lock versions in package.json |

## Quick Reference
### Key Commands
```bash
# Development
cd apps/worker
bun install
bun run dev

# Build
bun run build

# Start production
bun run start

# Type check
bun run typecheck
```

### Configuration Files
- `apps/worker/package.json`: Dependencies and scripts
- `apps/worker/tsconfig.json`: TypeScript configuration
- `apps/worker/tsup.config.ts`: Build configuration

## TODO Checklist
- [ ] Create apps/worker directory structure
- [ ] Create package.json with all dependencies
- [ ] Create tsconfig.json extending @repo/typescript-config
- [ ] Create tsup.config.ts for build
- [ ] Create src/index.ts with startup logic
- [ ] Create placeholder files (consumer, transcoder, live-stream, storage)
- [ ] Run `bun install` in worker directory
- [ ] Test `bun run dev` starts successfully
- [ ] Test `bun run build` completes without errors
- [ ] Verify worker logs "Worker ready" message
- [ ] Test SIGINT graceful shutdown
- [ ] Commit changes to git

## Notes
- Full implementation happens in Phase 4 (Video Processing Worker)
- FFmpeg installation not required until Phase 4
- RabbitMQ connection not required until Phase 4
- This phase only validates structure and dependencies
