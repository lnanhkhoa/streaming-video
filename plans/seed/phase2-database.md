# Phase 2: Database Layer

**Date**: 2025-10-31
**Estimated Time**: 1-2 days
**Dependencies**: Phase 1 (Foundation Setup)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 2.2)

## Overview

Create Prisma schema for MVP: Video, VideoVariant, VideoViewLog models. No authentication.

## Tasks

### 1. Create Prisma Schema

**Location**: `packages/@repo/database/prisma/schema.prisma`

Copy from detailed plan section 2.2. Key models:
- **Video**: Main video entity (VOD + LIVE support)
- **VideoVariant**: Quality variants (480p, 720p, 1080p)
- **VideoViewLog**: View tracking logs

**Important fields**:
```prisma
model Video {
  videoType      VideoType      @default(VOD)  // VOD or LIVE
  streamKey      String?        @unique        // For live streaming
  isLiveNow      Boolean        @default(false)
  viewsToday     Int            @default(0)
  viewsMonth     Int            @default(0)
  viewsTotal     Int            @default(0)
  // ... more fields
}
```

### 2. Environment Configuration

**Create** `.env`:
```env
DATABASE_URL="postgresql://admin:password@localhost:5432/streaming_video"
```

### 3. Setup PostgreSQL

**Docker Compose** (create `docker-compose.dev.yml`):
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: streaming_video
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

Start database:
```bash
docker-compose -f docker-compose.dev.yml up -d postgres
```

### 4. Run Migrations

```bash
# Generate Prisma client
cd packages/@repo/database
bun run db:generate

# Create initial migration
bun run db:migrate
# Name: "init"

# Verify with Prisma Studio
bun run db:studio
```

### 5. Create Prisma Client Export

**`packages/@repo/database/index.ts`**:
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

Update `packages/@repo/database/package.json`:
```json
{
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": "./index.ts"
  }
}
```

### 6. Optional: Seed Data

**`packages/@repo/database/prisma/seed.ts`**:
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create sample videos
  await prisma.video.createMany({
    data: [
      {
        title: 'Sample Video 1',
        description: 'Test video for development',
        status: 'READY',
        videoType: 'VOD',
        visibility: 'PUBLIC',
        hlsManifestKey: 'videos/sample1/master.m3u8',
        duration: 120
      },
      {
        title: 'Live Stream Test',
        description: 'Test live stream',
        status: 'PENDING',
        videoType: 'LIVE',
        visibility: 'PUBLIC',
        isLiveNow: false
      }
    ]
  })

  console.log('Database seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Add to package.json:
```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

Run seed:
```bash
bun run db:seed
```

## Verification

Test database connection:
```typescript
// Test file: test-db.ts
import { prisma } from '@repo/database'

async function test() {
  const videos = await prisma.video.findMany()
  console.log('Videos:', videos)
}

test()
```

Run:
```bash
bun test-db.ts
```

## Success Criteria

- ✅ Prisma schema created with 3 models
- ✅ PostgreSQL running in Docker
- ✅ Migrations applied successfully
- ✅ Prisma Client generated
- ✅ Can query database from code
- ✅ Prisma Studio accessible

## Notes

- Reference detailed plan section 2.2 for complete schema
- All fields must match detailed spec exactly
- Test all indexes work correctly
- Keep seed data minimal for MVP
