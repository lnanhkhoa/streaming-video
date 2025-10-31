# Phase 7: Docker & Deployment

**Date**: 2025-10-31
**Estimated Time**: 2-3 days
**Dependencies**: All previous phases (1-6)
**Detailed Plan**: `251031-tech-stack-detailed.md` (Section 7)

## Overview

Create production-ready Docker containers and deployment configuration for all services.

## Tasks

### 1. Dockerfiles

#### 1.1 API Dockerfile

**`apps/api/Dockerfile`**:

```dockerfile
FROM oven/bun:1-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/@repo/database/package.json ./packages/@repo/database/
COPY packages/@repo/types/package.json ./packages/@repo/types/
COPY packages/@repo/utils/package.json ./packages/@repo/utils/
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:api

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3001
CMD ["bun", "run", "dist/index.js"]
```

#### 1.2 Worker Dockerfile

**`apps/worker/Dockerfile`**:

```dockerfile
FROM oven/bun:1-alpine AS base

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/@repo/database/package.json ./packages/@repo/database/
COPY packages/@repo/types/package.json ./packages/@repo/types/
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:worker

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install FFmpeg in production image too
RUN apk add --no-cache ffmpeg

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

CMD ["bun", "run", "dist/index.js"]
```

#### 1.3 Web Dockerfile

**`apps/web/Dockerfile`**:

```dockerfile
FROM oven/bun:1-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/@repo/types/package.json ./packages/@repo/types/
COPY packages/@repo/utils/package.json ./packages/@repo/utils/
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build:web

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Update `apps/web/next.config.js`**:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../')
  }
}

module.exports = nextConfig
```

### 2. Docker Compose Production

**`docker-compose.yml`**:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: streaming_video
      POSTGRES_USER: ${DB_USER:-admin}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-admin}']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD:-password}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-admin}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-password}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - app-network
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 30s
      timeout: 10s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-admin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-password}
    volumes:
      - minio_data:/data
    networks:
      - app-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 20s
      retries: 3

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER:-admin}:${DB_PASSWORD:-password}@postgres:5432/streaming_video
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-password}
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD:-password}@rabbitmq:5672
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-admin}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-password}
      PORT: 3001
    ports:
      - '3001:3001'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER:-admin}:${DB_PASSWORD:-password}@postgres:5432/streaming_video
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD:-password}@rabbitmq:5672
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-admin}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-password}
      WORKER_CONCURRENCY: 1
      WORKER_TEMP_DIR: /tmp/transcode
      FFMPEG_PRESET: medium
      FFMPEG_CRF: 23
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    volumes:
      - worker_temp:/tmp/transcode

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://api:3001
    ports:
      - '3000:3000'
    depends_on:
      - api
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:
  worker_temp:
```

### 3. Environment Variables for Production

**`.env.production.example`**:

```env
# Database
DB_USER=admin
DB_PASSWORD=change_this_password

# Redis
REDIS_PASSWORD=change_this_password

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=change_this_password

# MinIO
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=change_this_password

# API
PORT=3001

# Web
NEXT_PUBLIC_API_URL=http://your-domain.com:3001

# Worker
WORKER_CONCURRENCY=2
FFMPEG_PRESET=medium
FFMPEG_CRF=23
```

### 4. Build Scripts

**Update root `package.json`**:

```json
{
  "scripts": {
    "build": "turbo run build",
    "build:api": "turbo run build --filter=api",
    "build:worker": "turbo run build --filter=worker",
    "build:web": "turbo run build --filter=web",
    "docker:build": "docker-compose build",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "docker:clean": "docker-compose down -v"
  }
}
```

### 5. Database Migration Setup

**Create migration script** `scripts/migrate.sh`:

```bash
#!/bin/bash
set -e

echo "Running database migrations..."
cd packages/@repo/database
bun run db:migrate:deploy
echo "Migrations completed successfully"
```

Make executable:

```bash
chmod +x scripts/migrate.sh
```

**Add to API Dockerfile** (before CMD):

```dockerfile
COPY scripts/migrate.sh ./scripts/
RUN chmod +x ./scripts/migrate.sh
```

**Update `packages/@repo/database/package.json`**:

```json
{
  "scripts": {
    "db:migrate:deploy": "prisma migrate deploy"
  }
}
```

### 6. Health Checks

**Add to `apps/api/src/app.ts`**:

```typescript
app.get('/health', async (c) => {
  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    return c.json({ status: 'unhealthy', error: 'Database connection failed' }, 503)
  }

  // Check Redis
  try {
    await cacheService.exists('health-check')
  } catch (error) {
    return c.json({ status: 'unhealthy', error: 'Redis connection failed' }, 503)
  }

  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  })
})
```

### 7. Deployment Steps

**First time deployment**:

1. Clone repository:

```bash
git clone <repo-url>
cd streaming-video
```

2. Copy environment file:

```bash
cp .env.production.example .env
```

3. Edit `.env` with production values:

```bash
nano .env
```

4. Build and start services:

```bash
docker-compose build
docker-compose up -d
```

5. Run migrations:

```bash
docker-compose exec api ./scripts/migrate.sh
```

6. Verify services:

```bash
docker-compose ps
docker-compose logs -f
```

7. Check health:

```bash
curl http://localhost:3001/health
curl http://localhost:3000
```

**Subsequent deployments**:

```bash
git pull
docker-compose build
docker-compose up -d
docker-compose exec api ./scripts/migrate.sh
```

### 8. Monitoring & Logs

**View logs**:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f web

# Last 100 lines
docker-compose logs --tail=100 api
```

**Resource usage**:

```bash
docker stats
```

**Container status**:

```bash
docker-compose ps
```

### 9. Backup Strategy

**Database backup** (`scripts/backup-db.sh`):

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U admin streaming_video > "$BACKUP_DIR/db_$DATE.sql"
echo "Database backed up to $BACKUP_DIR/db_$DATE.sql"
```

**MinIO backup**:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/minio"
mkdir -p $BACKUP_DIR

docker run --rm \
  --network streaming-video_app-network \
  -v $(pwd)/$BACKUP_DIR:/backup \
  minio/mc \
  mirror streaming-video /backup/$DATE
```

### 10. Production Checklist

- [ ] All environment variables set in `.env`
- [ ] Strong passwords for all services
- [ ] Database migrations applied
- [ ] MinIO bucket created and configured
- [ ] Health checks passing
- [ ] Logs being collected properly
- [ ] Backup scripts tested
- [ ] Restart policies configured
- [ ] Monitoring setup (optional: Prometheus/Grafana)
- [ ] SSL/TLS certificates (if using HTTPS)
- [ ] Firewall rules configured
- [ ] Domain names configured

## Verification

Test complete deployment:

1. **Services running**:

```bash
docker-compose ps
# All services should be "Up" and healthy
```

2. **API accessible**:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/videos/list
```

3. **Web accessible**:

```bash
open http://localhost:3000
```

4. **Upload flow works**:

- Upload a video via web UI
- Check worker processes it
- Verify output in MinIO
- Play video in player

5. **Live streaming works**:

- Create live stream
- Start camera stream
- View in player

## Success Criteria

- ✅ All Docker containers build successfully
- ✅ All services start and stay healthy
- ✅ Database migrations applied
- ✅ API responds to requests
- ✅ Frontend loads correctly
- ✅ Video upload → transcode → playback works
- ✅ Live streaming works end-to-end
- ✅ Services restart automatically on failure
- ✅ Logs accessible via docker-compose logs
- ✅ Data persists across restarts

## Performance Targets

- **API response time**: < 200ms
- **Video transcode**: 0.5-1x real-time
- **Startup time**: < 60 seconds for all services
- **Memory usage**: < 4GB total (all containers)

## Notes

- Use Docker volumes for persistent data
- Monitor disk space (videos consume storage)
- Scale worker horizontally by increasing replicas
- Consider CDN for video delivery in production
- Implement log rotation for long-running deployments
- Test backup/restore procedures regularly

## Troubleshooting

**Services not starting**:

```bash
docker-compose logs <service-name>
docker-compose restart <service-name>
```

**Database connection issues**:

```bash
docker-compose exec postgres psql -U admin -d streaming_video
```

**MinIO access issues**:

```bash
docker-compose exec minio mc alias set local http://localhost:9000 admin password
docker-compose exec minio mc ls local
```

**Worker not processing**:

```bash
docker-compose logs -f worker
docker-compose exec rabbitmq rabbitmqctl list_queues
```
