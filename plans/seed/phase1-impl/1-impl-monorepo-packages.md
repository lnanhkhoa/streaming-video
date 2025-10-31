# Monorepo Packages Setup Implementation Plan

**Date**: 2025-10-31
**Type**: Feature Implementation
**Status**: Planning
**Context Tokens**: Create shared workspace packages for database, types, and utilities to support API, Worker, and Web applications in Turborepo monorepo.

## Executive Summary
Establish foundational workspace packages (@repo/database, @repo/types, @repo/utils, @repo/constants) that provide shared functionality across all applications. These packages enable code reuse, maintain consistency, and support the video streaming platform's core operations.

## Context Links
- **Related Plans**: `plans/251031-phase1-foundation.md`
- **Dependencies**: Existing Turborepo setup, Bun package manager
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 2.1)

## Requirements
### Functional Requirements
- [ ] Database package with Prisma client export
- [ ] Types package with shared TypeScript interfaces
- [ ] Utils package with formatting helpers
- [ ] Constants package for app-wide values
- [ ] All packages properly configured in workspace

### Non-Functional Requirements
- [ ] Zero external dependencies in types/utils/constants
- [ ] Fast builds with Turbo caching
- [ ] Type-safe imports across all apps

## Architecture Overview

```
packages/@repo/
├── database/         # Prisma client + schema
│   ├── prisma/
│   │   └── schema.prisma
│   ├── index.ts
│   └── package.json
├── types/           # Shared TypeScript types
│   ├── index.ts
│   └── package.json
├── utils/           # Utility functions
│   ├── index.ts
│   └── package.json
└── constants/       # App constants
    ├── index.ts
    └── package.json
```

### Key Components
- **@repo/database**: Prisma client singleton, database types
- **@repo/types**: Video, VideoVariant, VideoViewLog interfaces
- **@repo/utils**: formatFileSize, formatDuration, date helpers
- **@repo/constants**: Video resolutions, bitrates, status enums

### Data Models
- **Video Types**: VideoStatus, VideoType, VideoVisibility enums
- **Format Helpers**: File size, duration formatting functions

## Implementation Phases

### Phase 1: Database Package (Est: 0.5 days)
**Scope**: Create @repo/database package with Prisma configuration

**Tasks**:
1. [ ] Create package structure - file: `packages/@repo/database/package.json`
2. [ ] Create Prisma placeholder schema - file: `packages/@repo/database/prisma/schema.prisma`
3. [ ] Create client export - file: `packages/@repo/database/index.ts`
4. [ ] Add package scripts (db:generate, db:migrate, db:push, db:studio)

**Acceptance Criteria**:
- [ ] Package builds without errors
- [ ] Can import from `@repo/database` in other packages
- [ ] Prisma scripts execute successfully

**Files to Create**:

`packages/@repo/database/package.json`:
```json
{
  "name": "@repo/database",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "tsx": "^4.0.0"
  }
}
```

`packages/@repo/database/index.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
```

`packages/@repo/database/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Placeholder - will be populated in Phase 2
```

### Phase 2: Types Package (Est: 0.5 days)
**Scope**: Create shared TypeScript types and interfaces

**Tasks**:
1. [ ] Create package structure - file: `packages/@repo/types/package.json`
2. [ ] Define Video interfaces - file: `packages/@repo/types/index.ts`
3. [ ] Define enum types (VideoStatus, VideoType, VideoVisibility)
4. [ ] Define API request/response types

**Acceptance Criteria**:
- [ ] All enum types defined
- [ ] Video interface matches database schema
- [ ] Can import types in all apps
- [ ] No compilation errors

**Files to Create**:

`packages/@repo/types/package.json`:
```json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
```

`packages/@repo/types/index.ts`:
```typescript
// Enums
export type VideoStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'LIVE'
export type VideoType = 'VOD' | 'LIVE'
export type VideoVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'

// Video Interface
export interface Video {
  id: string
  title: string
  description?: string
  status: VideoStatus
  videoType: VideoType
  visibility: VideoVisibility
  hlsManifestKey?: string
  thumbnailKey?: string
  duration?: number
  streamKey?: string
  isLiveNow: boolean
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
  createdAt: Date
  updatedAt: Date
}

// Video Variant
export interface VideoVariant {
  id: string
  videoId: string
  resolution: string
  width: number
  height: number
  bitrate: number
  codec: string
  format: string
  playlistKey: string
  createdAt: Date
}

// Video View Log
export interface VideoViewLog {
  id: string
  videoId: string
  viewedAt: Date
}

// API Types
export interface PresignUploadRequest {
  fileName: string
  fileSize: number
  contentType: string
}

export interface PresignUploadResponse {
  videoId: string
  uploadUrl: string
  key: string
}

export interface CreateLiveStreamRequest {
  title: string
  description?: string
}

export interface CreateLiveStreamResponse {
  videoId: string
  streamKey: string
  webrtcUrl: string
}

export interface VideoStatsResponse {
  viewsToday: number
  viewsMonth: number
  viewsTotal: number
}
```

### Phase 3: Utils Package (Est: 0.5 days)
**Scope**: Create utility functions for formatting and common operations

**Tasks**:
1. [ ] Create package structure - file: `packages/@repo/utils/package.json`
2. [ ] Implement file size formatter - file: `packages/@repo/utils/index.ts`
3. [ ] Implement duration formatter
4. [ ] Implement date helpers
5. [ ] Add unit tests (optional)

**Acceptance Criteria**:
- [ ] formatFileSize returns correct units
- [ ] formatDuration handles hours/minutes/seconds
- [ ] All functions have JSDoc comments
- [ ] Can import utils in all apps

**Files to Create**:

`packages/@repo/utils/package.json`:
```json
{
  "name": "@repo/utils",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
```

`packages/@repo/utils/index.ts`:
```typescript
/**
 * Format bytes to human-readable file size
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format seconds to duration string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1:23:45" or "5:30")
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Format date to relative time
 * @param date - Date to format
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'just now'
}

/**
 * Generate random ID
 * @param length - Length of ID
 * @returns Random alphanumeric string
 */
export function generateId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Phase 4: Constants Package (Est: 0.25 days)
**Scope**: Define application-wide constants

**Tasks**:
1. [ ] Create package structure - file: `packages/@repo/constants/package.json`
2. [ ] Define video constants - file: `packages/@repo/constants/index.ts`
3. [ ] Define HLS variant configurations
4. [ ] Define file upload limits

**Acceptance Criteria**:
- [ ] All constants exported with types
- [ ] Can import constants in all apps
- [ ] Constants match detailed plan specifications

**Files to Create**:

`packages/@repo/constants/package.json`:
```json
{
  "name": "@repo/constants",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
```

`packages/@repo/constants/index.ts`:
```typescript
// Video Processing
export const HLS_VARIANTS = [
  { resolution: '1080p', width: 1920, height: 1080, bitrate: 5000 },
  { resolution: '720p', width: 1280, height: 720, bitrate: 2800 },
  { resolution: '480p', width: 854, height: 480, bitrate: 1400 }
] as const

export const VIDEO_RESOLUTIONS = ['1080p', '720p', '480p'] as const

// Upload Limits
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
export const MIN_FILE_SIZE = 1024 // 1KB

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg'
] as const

// FFmpeg Settings
export const FFMPEG_PRESET = 'medium'
export const FFMPEG_CRF = 23
export const HLS_SEGMENT_TIME = 6 // seconds
export const HLS_LIVE_SEGMENT_TIME = 2 // seconds

// Cache TTL (seconds)
export const CACHE_TTL = {
  VIDEO_LIST: 60,
  VIDEO_STATS: 30,
  PRESIGNED_URL: 3600
} as const

// View Reset Times
export const DAILY_RESET_HOUR = 0 // Midnight UTC
export const MONTHLY_RESET_DAY = 1 // 1st of month
```

## Testing Strategy
- **Unit Tests**: formatFileSize, formatDuration with various inputs
- **Integration Tests**: Import packages in apps/api, apps/worker, apps/web
- **Build Tests**: Turbo can build all packages without errors

## Security Considerations
- [ ] No secrets or credentials in constants
- [ ] Database client uses connection pooling
- [ ] Prisma client singleton prevents connection leaks

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Package import fails | High | Test imports in all apps before proceeding |
| Prisma client conflicts | Medium | Use singleton pattern with global check |
| Type mismatches | Medium | Keep types synced with Prisma schema |

## Quick Reference
### Key Commands
```bash
# Install dependencies
bun install

# Build all packages
bun turbo build

# Generate Prisma client
cd packages/@repo/database
bun run db:generate

# Test imports in API
cd apps/api
bun run dev
```

### Configuration Files
- `packages/@repo/database/prisma/schema.prisma`: Database schema (placeholder)
- `turbo.json`: Turbo pipeline configuration
- Root `package.json`: Workspace configuration

## TODO Checklist
- [ ] Create @repo/database package structure
- [ ] Create @repo/types package structure
- [ ] Create @repo/utils package structure
- [ ] Create @repo/constants package structure
- [ ] Install dependencies with `bun install`
- [ ] Verify packages resolve in apps/api
- [ ] Verify packages resolve in apps/web
- [ ] Run `bun turbo build --dry-run`
- [ ] Update root package.json with workspace references
- [ ] Commit changes to git
