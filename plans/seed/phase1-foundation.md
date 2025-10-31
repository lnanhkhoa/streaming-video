# Phase 1: Foundation Setup

**Date**: 2025-10-31
**Estimated Time**: 2-3 days
**Dependencies**: None
**Detailed Plan**: `251031-tech-stack-detailed.md`

## Overview

Set up monorepo structure, package configuration, and development tooling.

## Tasks

### 1. Monorepo Structure

Create packages structure:
```bash
packages/
├── @repo/constants/     # Constants
├── @repo/database/      # Prisma schema + client
├── @repo/types/         # Shared TypeScript types
├── @repo/utils/         # Shared utilities
├── @repo/eslint-config/ # ESLint configs (existing)
└── @repo/typescript-config/ # TS configs (existing)
```

Create apps structure:
```bash
apps/
├── api/      # Hono backend (existing)
├── web/      # Next.js frontend (existing)
└── worker/   # FFmpeg transcoding worker (NEW)
```

### 2. Package Configuration

**`packages/@repo/database/package.json`**:
```json
{
  "name": "@repo/database",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0"
  }
}
```

**`packages/@repo/types/package.json`**:
```json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts"
}
```

**`packages/@repo/utils/package.json`**:
```json
{
  "name": "@repo/utils",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts"
}
```

### 3. Worker App Setup

**`apps/worker/package.json`**:
```json
{
  "name": "worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format cjs --dts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "@repo/database": "workspace:*",
    "amqplib": "^0.10.0",
    "fluent-ffmpeg": "^2.1.0",
    "minio": "^7.1.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/amqplib": "^0.10.0",
    "@types/fluent-ffmpeg": "^2.1.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 4. Update Turbo Configuration

**`turbo.json`**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "db:generate": {
      "cache": false,
      "outputs": ["node_modules/.prisma/**"]
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

### 5. Update Root package.json

Add workspace references and scripts:
```json
{
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### 6. Create Placeholder Files

**`packages/@repo/types/index.ts`**:
```typescript
// Shared TypeScript types
export interface Video {
  id: string
  title: string
  status: VideoStatus
  // ... more fields
}

export type VideoStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'LIVE'
export type VideoType = 'VOD' | 'LIVE'
export type VideoVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'
```

**`packages/@repo/utils/index.ts`**:
```typescript
// Shared utility functions
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

**`apps/worker/src/index.ts`**:
```typescript
console.log('Worker starting...')

// Will be implemented in Phase 4
```

## Verification

Run these commands to verify setup:
```bash
# Install dependencies
bun install

# Verify turbo can find all packages
bun turbo build --dry-run

# Verify worker app
cd apps/worker
bun run dev  # Should start without errors
```

## Success Criteria

- ✅ All packages created with proper structure
- ✅ Turbo can discover all workspaces
- ✅ Worker app builds and runs
- ✅ No compilation errors
- ✅ Dependencies resolve correctly

## Notes

- Keep files < 500 lines
- Use TypeScript for all code
- Follow existing code style from `api` and `web` apps
