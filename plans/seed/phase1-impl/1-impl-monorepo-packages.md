# Monorepo Packages Setup Implementation Plan

**Date**: 2025-10-31
**Type**: Feature Implementation
**Status**: Planning
**Context Tokens**: Create shared workspace packages for database, types, and utilities to support API, Worker, and Web applications in Turborepo monorepo.

## Executive Summary

Establish foundational workspace packages (@repo/database, @repo/utils, @repo/constants) that provide shared functionality across all applications. These packages enable code reuse, maintain consistency, and support the video streaming platform's core operations. Note: @repo/constants now includes both constants AND shared TypeScript types.

## Context Links

- **Related Plans**: `plans/251031-phase1-foundation.md`
- **Dependencies**: Existing Turborepo setup, Bun package manager
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 2.1)

## Requirements

### Functional Requirements

- [x] Database package with Prisma client export
- [x] Utils package with formatting helpers
- [x] Constants package for app-wide values AND shared TypeScript types
- [x] All packages properly configured in workspace

### Non-Functional Requirements

- [x] Zero external dependencies in utils/constants
- [x] Fast builds with Turbo caching
- [x] Type-safe imports across all apps

## Architecture Overview

```
packages/
├── database/         # Prisma client + schema
│   ├── prisma/
│   │   └── schema.prisma
│   ├── index.ts
│   └── package.json
├── utils/           # Utility functions
│   ├── index.ts
│   └── package.json
└── constants/       # App constants + shared TypeScript types
    ├── src/
    │   ├── index.ts       # Exports both constants and types
    │   ├── constants.ts   # Video constants
    │   └── types.ts       # TypeScript interfaces
    └── package.json
```

### Key Components

- **@repo/database**: Prisma client singleton, database types
- **@repo/utils**: formatFileSize, formatDuration, date helpers
- **@repo/constants**: Video resolutions, bitrates, status enums, shared TypeScript types (Video, VideoVariant, API types)

### Data Models

- **Video Types**: VideoStatus, VideoType, VideoVisibility enums
- **Format Helpers**: File size, duration formatting functions

## Implementation Phases

### Phase 1: Database Package (Est: 0.5 days)

**Scope**: Create @repo/database package with Prisma configuration

**Tasks**:

1. [x] Create package structure - file: `packages/database/package.json`
2. [x] Create Prisma placeholder schema - file: `packages/database/prisma/schema.prisma`
3. [x] Create client export - file: `packages/database/index.ts`
4. [x] Add package scripts (db:generate, db:migrate, db:push, db:studio)

**Acceptance Criteria**:

- [x] Package builds without errors
- [x] Can import from `@repo/database` in other packages
- [x] Prisma scripts execute successfully

**Files to Create**:

`packages/database/package.json`:

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

`packages/database/index.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
```

`packages/database/prisma/schema.prisma`:

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

### Phase 2: Utils Package (Est: 0.5 days)

**Scope**: Create utility functions for formatting and common operations

**Tasks**:

1. [x] Create package structure - file: `packages/utils/package.json`
2. [x] Implement file size formatter - file: `packages/utils/index.ts`
3. [x] Implement duration formatter
4. [x] Implement date helpers
5. [x] Add unit tests (optional)

**Acceptance Criteria**:

- [x] formatFileSize returns correct units
- [x] formatDuration handles hours/minutes/seconds
- [x] All functions have JSDoc comments
- [x] Can import utils in all apps

**Files to Create**:

`packages/utils/package.json`:

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

`packages/utils/index.ts`:

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
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
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
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

### Phase 3: Constants Package (Est: 0.5 days)

**Scope**: Define application-wide constants AND shared TypeScript types (merged from types package)

**Tasks**:

1. [x] Update package structure - file: `packages/constants/package.json`
2. [x] Define video constants - file: `packages/constants/src/constants.ts`
3. [x] Define HLS variant configurations
4. [x] Define file upload limits
5. [x] Create types file - file: `packages/constants/src/types.ts`
6. [x] Define shared TypeScript types (VideoStatus, VideoType, VideoVisibility)
7. [x] Define Video interfaces (Video, VideoVariant, VideoViewLog)
8. [x] Define API request/response types
9. [x] Create index.ts to export everything - file: `packages/constants/src/index.ts`

**Acceptance Criteria**:

- [x] All constants exported with types
- [x] All enum types defined
- [x] Video interface matches database schema
- [x] Can import constants and types in all apps
- [x] Constants match detailed plan specifications
- [x] No compilation errors

**Files to Create/Update**:

`packages/constants/package.json`:

```json
{
  "name": "@repo/constants",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "@repo/typescript-config": "*"
  }
}
```

`packages/constants/src/constants.ts`:

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

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'] as const

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

`packages/constants/src/types.ts`:

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

`packages/constants/src/index.ts`:

```typescript
export * from './types'
export * from './constants'
```

## Testing Strategy

- **Unit Tests**: formatFileSize, formatDuration with various inputs
- **Integration Tests**: Import packages in apps/api, apps/worker, apps/web
- **Build Tests**: Turbo can build all packages without errors

## Security Considerations

- [x] No secrets or credentials in constants
- [x] Database client uses connection pooling
- [x] Prisma client singleton prevents connection leaks

## Risk Assessment

| Risk                    | Impact | Mitigation                                 |
| ----------------------- | ------ | ------------------------------------------ |
| Package import fails    | High   | Test imports in all apps before proceeding |
| Prisma client conflicts | Medium | Use singleton pattern with global check    |
| Type mismatches         | Medium | Keep types synced with Prisma schema       |

## Quick Reference

### Key Commands

```bash
# Install dependencies
bun install

# Build all packages
bun turbo build

# Generate Prisma client
cd packages/database
bun run db:generate

# Test imports in API
cd apps/api
bun run dev
```

### Configuration Files

- `packages/database/prisma/schema.prisma`: Database schema (placeholder)
- `turbo.json`: Turbo pipeline configuration
- Root `package.json`: Workspace configuration

## TODO Checklist

- [x] Create @repo/database package structure
- [x] Create @repo/utils package structure
- [x] Update @repo/constants package structure (merge types into constants)
- [x] Install dependencies with `bun install`
- [x] Verify packages resolve in apps/api
- [x] Verify packages resolve in apps/web
- [x] Run `bun turbo build`
- [x] Update root package.json with workspace references
- [x] Commit changes to git
