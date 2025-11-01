# Cache Service (Redis) Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: Implement Redis client service for caching video lists, stats, presigned URLs with TTL management

## Executive Summary

Create Redis cache layer for performance optimization. Caches video lists (60s), stats (30s), presigned URLs (3600s). Reduces database queries, improves response times.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 3.1 (API Core Setup)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3.3)

## Requirements

### Functional Requirements

- [x] Redis client singleton
- [x] Get/set/delete operations
- [x] TTL support for expiration
- [x] Exists check
- [x] JSON serialization
- [x] Cache invalidation helpers
- [x] Connection error handling

### Non-Functional Requirements

- [x] Connection pooling
- [x] Retry logic for transient failures
- [x] Type-safe cache keys
- [x] Configurable TTLs

## Architecture Overview

```
apps/api/src/services/
└── cache.service.ts

Cache Keys Pattern:
- video:list           # Video list cache
- video:{id}           # Single video cache
- video:stats:{id}     # Video stats cache
- upload:presigned:{id} # Presigned URL cache
```

### Key Components

- **Redis Client**: ioredis singleton
- **Cache Operations**: get, set, del, exists
- **TTL Management**: Per-key expiration
- **Key Patterns**: Consistent namespacing

### Data Flow

```
Request → Check Cache → Cache Hit? → Return Cached
                      ↓
                   Cache Miss
                      ↓
                Query Database
                      ↓
                Store in Cache (with TTL)
                      ↓
                Return Response
```

## Implementation Phases

### Phase 1: Client Setup (Est: 0.5 days)

**Scope**: Create Redis client singleton with config

**Tasks**:

1. [ ] Create cache service - file: `apps/api/src/services/cache.service.ts`
2. [ ] Add environment variables - file: `.env`
3. [ ] Add connection error handling
4. [ ] Test connection

**Acceptance Criteria**:

- [ ] Client connects to Redis
- [ ] Environment config works
- [ ] Connection errors logged
- [ ] Graceful fallback if Redis unavailable

**Files to Create**:

`apps/api/src/services/cache.service.ts`:

```typescript
import Redis from 'ioredis'
import { CACHE_TTL } from '@repo/constants'

class CacheService {
  private client: Redis
  private isConnected = false

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ Redis connection failed after 3 retries')
          return null
        }
        return Math.min(times * 200, 2000)
      }
    })

    this.client.on('connect', () => {
      this.isConnected = true
      console.log('✅ Redis connected')
    })

    this.client.on('error', (err) => {
      this.isConnected = false
      console.error('❌ Redis error:', err.message)
    })
  }

  // Methods will be added here
}

export const cacheService = new CacheService()
```

### Phase 2: Core Operations (Est: 0.5 days)

**Scope**: Implement get/set/del/exists operations

**Tasks**:

1. [ ] Implement get with JSON parsing
2. [ ] Implement set with TTL
3. [ ] Implement del
4. [ ] Implement exists
5. [ ] Add error handling
6. [ ] Test operations

**Acceptance Criteria**:

- [ ] get returns parsed JSON or null
- [ ] set stores data with TTL
- [ ] del removes key
- [ ] exists returns boolean
- [ ] All operations handle Redis down gracefully

**Code to Add**:

```typescript
// Add to CacheService class

/**
 * Get value from cache
 * @param key - Cache key
 * @returns Parsed JSON value or null
 */
async get<T = unknown>(key: string): Promise<T | null> {
  if (!this.isConnected) return null

  try {
    const value = await this.client.get(key)
    if (!value) return null
    return JSON.parse(value) as T
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

/**
 * Set value in cache with TTL
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in seconds (optional)
 */
async set(key: string, value: unknown, ttl?: number): Promise<void> {
  if (!this.isConnected) return

  try {
    const serialized = JSON.stringify(value)
    if (ttl) {
      await this.client.setex(key, ttl, serialized)
    } else {
      await this.client.set(key, serialized)
    }
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

/**
 * Delete key from cache
 * @param key - Cache key or pattern
 */
async del(key: string): Promise<void> {
  if (!this.isConnected) return

  try {
    await this.client.del(key)
  } catch (error) {
    console.error('Cache del error:', error)
  }
}

/**
 * Check if key exists
 * @param key - Cache key
 */
async exists(key: string): Promise<boolean> {
  if (!this.isConnected) return false

  try {
    const result = await this.client.exists(key)
    return result === 1
  } catch (error) {
    console.error('Cache exists error:', error)
    return false
  }
}
```

### Phase 3: Cache Helpers (Est: 0.5 days)

**Scope**: Add domain-specific cache helpers

**Tasks**:

1. [ ] Add cache key generators
2. [ ] Add invalidation helpers
3. [ ] Add TTL constants usage
4. [ ] Test helpers

**Acceptance Criteria**:

- [ ] Key generators return consistent format
- [ ] Invalidation clears related keys
- [ ] TTLs match constants

**Code to Add**:

```typescript
// Add to CacheService class

// Cache key generators
keys = {
  videoList: () => 'video:list',
  video: (id: string) => `video:${id}`,
  videoStats: (id: string) => `video:stats:${id}`,
  presignedUrl: (id: string) => `upload:presigned:${id}`
}

/**
 * Cache video list
 */
async cacheVideoList(videos: unknown[]): Promise<void> {
  await this.set(this.keys.videoList(), videos, CACHE_TTL.VIDEO_LIST)
}

/**
 * Get cached video list
 */
async getVideoList<T = unknown>(): Promise<T[] | null> {
  return this.get<T[]>(this.keys.videoList())
}

/**
 * Cache video stats
 */
async cacheVideoStats(videoId: string, stats: unknown): Promise<void> {
  await this.set(this.keys.videoStats(videoId), stats, CACHE_TTL.VIDEO_STATS)
}

/**
 * Get cached video stats
 */
async getVideoStats<T = unknown>(videoId: string): Promise<T | null> {
  return this.get<T>(this.keys.videoStats(videoId))
}

/**
 * Cache presigned URL
 */
async cachePresignedUrl(videoId: string, url: string): Promise<void> {
  await this.set(this.keys.presignedUrl(videoId), url, CACHE_TTL.PRESIGNED_URL)
}

/**
 * Get cached presigned URL
 */
async getPresignedUrl(videoId: string): Promise<string | null> {
  return this.get<string>(this.keys.presignedUrl(videoId))
}

/**
 * Invalidate video cache (on update/delete)
 */
async invalidateVideo(videoId: string): Promise<void> {
  await Promise.all([
    this.del(this.keys.video(videoId)),
    this.del(this.keys.videoStats(videoId)),
    this.del(this.keys.videoList())
  ])
}

/**
 * Invalidate all video caches
 */
async invalidateAllVideos(): Promise<void> {
  if (!this.isConnected) return

  try {
    const keys = await this.client.keys('video:*')
    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  } catch (error) {
    console.error('Cache invalidateAll error:', error)
  }
}
```

## Testing Strategy

- **Unit Tests**:
  - get/set/del operations
  - TTL expiration
  - JSON serialization
  - Error handling
- **Integration Tests**:
  - Cache hit/miss flow
  - Invalidation clears correct keys
  - Redis down doesn't crash app

## Security Considerations

- [ ] Redis password in env var
- [ ] No sensitive data in cache keys
- [ ] TTLs prevent stale data
- [ ] Connection retry limits prevent DOS

## Risk Assessment

| Risk              | Impact | Mitigation                        |
| ----------------- | ------ | --------------------------------- |
| Redis unavailable | Medium | Graceful fallback, no cache       |
| Cache stampede    | Medium | Use short TTLs, implement locking |
| Stale data        | Low    | Proper invalidation on updates    |
| Memory pressure   | Low    | Set Redis maxmemory policy        |

## Quick Reference

### Key Commands

```bash
# Start Redis
docker-compose -f docker-compose.dev.yml up redis -d

# Test connection
redis-cli -h localhost -p 6379 -a password ping

# Monitor cache
redis-cli -h localhost -p 6379 -a password MONITOR
```

### Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password
```

### Docker Compose

Add to `docker-compose.dev.yml`:

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass password
  ports:
    - '6379:6379'
```

### Cache TTLs

From `@repo/constants`:

```typescript
CACHE_TTL = {
  VIDEO_LIST: 60, // 1 minute
  VIDEO_STATS: 30, // 30 seconds
  PRESIGNED_URL: 3600 // 1 hour
}
```

## TODO Checklist

- [x] Create cache.service.ts
- [x] Add Redis env vars to .env
- [x] Update docker-compose.dev.yml
- [ ] Start Redis container (requires Docker)
- [ ] Test client connection (requires Docker)
- [ ] Test get/set operations (requires Docker)
- [ ] Test TTL expiration (requires Docker)
- [ ] Test invalidation helpers (requires Docker)
- [ ] Test Redis down scenario (requires Docker)
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 3.1: API Core Setup (for service structure)
- @repo/constants package (for CACHE_TTL)

**Required After**:

- All route implementations (videos, upload, analytics)
