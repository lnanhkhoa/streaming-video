# Video Streaming Platform

A scalable video streaming platform built with modern technologies, supporting video upload, adaptive bitrate streaming (HLS), and real-time transcoding. This project focuses on **Video on Demand (VOD)** with automatic multi-resolution transcoding.

## 🚀 Features

- **Video Upload**: Client-side direct upload to object storage using presigned URLs
- **Adaptive Streaming**: Automatic HLS transcoding to multiple resolutions (1080p, 720p, 480p)
- **Real-time Progress**: Live transcoding progress tracking with time estimates
- **Video Management**: Full CRUD operations for video metadata and visibility controls
- **Analytics**: View tracking with daily/monthly/total statistics
- **Scalable Architecture**: Distributed worker system for concurrent video processing
- **Modern UI**: Responsive Next.js interface with React Query and TailwindCSS

## 🏗️ Architecture

This is a **Turborepo monorepo** with the following structure:

### Apps

- **`api`**: Hono-based REST API server
  - Video upload and management endpoints
  - Analytics and view tracking
  - Queue job publishing
  - Redis caching layer

- **`web`**: Next.js 16 frontend application
  - Video upload interface
  - HLS video player
  - Real-time transcoding progress
  - Video library and search

- **`worker`**: FFmpeg transcoding worker
  - RabbitMQ consumer for transcode jobs
  - Multi-resolution HLS generation
  - Progress tracking and error handling
  - Concurrent job processing

### Packages

- **`@repo/database`**: Prisma ORM with PostgreSQL schema
- **`@repo/constants`**: Shared constants and configurations
- **`@repo/utils`**: Common utilities and helpers
- **`@repo/eslint-config`**: Shared ESLint configurations
- **`@repo/typescript-config`**: Shared TypeScript configurations

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TailwindCSS 4, Zustand, TanStack Query |
| **Backend API** | Hono, TypeScript, Zod validation |
| **Database** | PostgreSQL, Prisma ORM |
| **Cache** | Redis |
| **Queue** | RabbitMQ |
| **Storage** | MinIO (S3-compatible) |
| **Video Processing** | FFmpeg (fluent-ffmpeg) |
| **Monorepo** | Turborepo |
| **Runtime** | Bun 1.2+ / Node.js 22+ |

## 📋 Prerequisites

- **Bun** >= 1.1.0 (recommended) or **Node.js** >= 22
- **Docker** and **Docker Compose** (for infrastructure services)
- **FFmpeg** installed on the worker machine

## 🚦 Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd streaming-video
bun install
```

### 2. Environment Setup

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `RABBITMQ_URL`: RabbitMQ connection URL
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`: MinIO/S3 credentials
- `NEXT_PUBLIC_API_URL`: API URL for frontend
- `WORKER_CONCURRENCY`: Number of concurrent transcoding jobs (1-16)

### 3. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, RabbitMQ, and MinIO
docker-compose -f docker-compose.dev.yml up -d

# View logs
bun docker:logs
```

### 4. Database Setup

```bash
# Generate Prisma client
bun db:generate

# Run migrations
bun db:migrate

# (Optional) Open Prisma Studio
bun db:studio
```

### 5. Start Development Servers

```bash
# Start all apps (api, web, worker)
bun dev

# Or start individually
bun dev:api      # API on http://localhost:3001
bun dev:web      # Web on http://localhost:3000
bun dev:worker   # Worker process
```

## 📦 Available Scripts

### Development

```bash
bun dev           # Run all apps in development mode
bun dev:api       # Run API only
bun dev:web       # Run web only
bun dev:worker    # Run worker only
```

### Building

```bash
bun build         # Build all apps
bun build:api     # Build API only
bun build:web     # Build web only
bun build:worker  # Build worker only
```

### Production

```bash
bun start         # Start all apps in production mode
bun start:api     # Start API only
bun start:web     # Start web only
bun start:worker  # Start worker only
```

### Database

```bash
bun db:generate          # Generate Prisma client
bun db:migrate           # Run migrations in development
bun db:migrate:deploy    # Run migrations in production
bun db:push              # Push schema without migrations
bun db:studio            # Open Prisma Studio
```

### Docker

```bash
bun docker:build   # Build Docker images
bun docker:up      # Start services
bun docker:down    # Stop services
bun docker:logs    # View logs
bun docker:clean   # Stop and remove volumes
```

### Code Quality

```bash
bun lint           # Run ESLint
bun typecheck      # Type check all apps
bun format         # Format code with Prettier
bun test           # Run tests
```

## 🎬 How It Works

### Video Upload Flow

1. **Client requests presigned URL** → `POST /api/upload/presign`
2. **Client uploads directly to MinIO** using presigned URL
3. **Client completes upload** → `POST /api/upload/:id/complete`
4. **API creates video record** in database (status: PENDING)
5. **API publishes transcode job** to RabbitMQ queue

### Video Transcoding Flow

1. **Worker consumes job** from RabbitMQ queue
2. **Downloads original video** from MinIO
3. **Transcodes to HLS** with multiple resolutions:
   - 1080p @ 5000 kbps
   - 720p @ 2800 kbps
   - 480p @ 1400 kbps
4. **Generates master playlist** (master.m3u8)
5. **Uploads all segments** to MinIO
6. **Updates database** with variants and status (READY)
7. **Client polls progress** → `GET /api/videos/:id/progress`

### Video Playback

1. **Client requests video** → `GET /api/videos/:id`
2. **API returns video metadata** + variant playback URLs
3. **Client loads HLS player** with master.m3u8 URL
4. **Player adapts quality** based on bandwidth
5. **View is tracked** → `POST /api/analytics/view/:id`

## 🗂️ Project Structure

```
streaming-video/
├── apps/
│   ├── api/                    # Hono API server
│   │   └── src/
│   │       ├── routes/         # API routes
│   │       ├── services/       # Business logic
│   │       ├── middlewares/    # Express-like middleware
│   │       └── utils/          # Helpers and validators
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App router pages
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   └── lib/                # Client utilities
│   └── worker/                 # FFmpeg worker
│       └── src/
│           ├── consumer.ts     # RabbitMQ consumer
│           ├── libs/           # FFmpeg & utilities
│           └── services/       # Storage & metrics
├── packages/
│   ├── database/               # Prisma schema & client
│   ├── constants/              # Shared constants
│   ├── utils/                  # Shared utilities
│   ├── eslint-config/          # ESLint configs
│   └── typescript-config/      # TS configs
├── docker-compose.dev.yml      # Development services
└── turbo.json                  # Turborepo config
```

## 🐳 Infrastructure Services

| Service | Port | Dashboard | Default Credentials |
|---------|------|-----------|---------------------|
| **PostgreSQL** | 5445 | - | postgres / password |
| **Redis** | 6379 | - | password |
| **RabbitMQ** | 5672, 15672 | http://localhost:15672 | admin / password |
| **MinIO** | 9000, 9001 | http://localhost:9001 | admin / password |

## 📝 API Endpoints

### Videos
- `GET /api/videos` - List videos (with pagination/filters)
- `GET /api/videos/:id` - Get video details + variants
- `PATCH /api/videos/:id` - Update video metadata
- `DELETE /api/videos/:id` - Delete video
- `GET /api/videos/:id/progress` - Get transcoding progress

### Upload
- `POST /api/upload/presign` - Get presigned upload URL
- `POST /api/upload/:id/complete` - Complete upload + start transcoding

### Analytics
- `POST /api/analytics/view/:id` - Track video view
- `GET /api/analytics/stats/:id` - Get video statistics

### Health
- `GET /health` - API health check

## 🔧 Configuration

### Worker Tuning

Adjust worker performance in `.env`:

```env
WORKER_CONCURRENCY=2     # Number of concurrent jobs (1-16)
FFMPEG_PRESET=medium     # FFmpeg preset (ultrafast, fast, medium, slow)
FFMPEG_CRF=23           # Quality (lower = better, 18-28)
WORKER_TEMP_DIR=./tmp   # Temp directory for processing
```

### Video Resolutions

Edit resolution configurations in:
- `apps/worker/src/consumer.ts` - Transcoding settings
- `packages/constants/` - Resolution definitions

## 🧪 Testing

```bash
# API integration tests
cd apps/api
bun test

# Worker tests
cd apps/worker
bun test:transcode    # Test transcoding
bun test:storage      # Test storage operations
bun test:e2e          # End-to-end test
```

## 🚀 Deployment

### Build for Production

```bash
bun build
```

### Environment Variables

Ensure production environment variables are set:
- Database connection with SSL
- Production Redis instance
- RabbitMQ cluster
- MinIO/S3 bucket with CDN
- CORS origins configured

### Scaling Workers

Run multiple worker instances for concurrent processing:

```bash
# Worker instance 1
WORKER_CONCURRENCY=4 bun start:worker

# Worker instance 2 (different machine)
WORKER_CONCURRENCY=4 bun start:worker
```

## 📚 Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Hono Documentation](https://hono.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [HLS Specification](https://datatracker.ietf.org/doc/html/rfc8216)

## 📄 License

[Your License Here]

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
