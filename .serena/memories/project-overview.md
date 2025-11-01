# Project Overview

## Project Name

**streaming-video** - A video streaming platform built with modern web technologies

## Purpose

A full-stack video streaming application using ClaudeKit Engineer template as foundation. Supports video upload, processing, streaming, and playback with distributed architecture.

## Tech Stack

### Runtime & Package Manager

- **Node.js**: >= 22
- **Bun**: >= 1.1.0 (current: 1.2.21)
- **TypeScript**: 5.9.3

### Monorepo Structure

- **Turborepo**: 2.5.5 for monorepo orchestration
- Workspace structure with apps and packages

### Applications

1. **API** (apps/api)
   - Framework: Hono 4.10.4
   - Server: @hono/node-server
   - Validation: Zod 4.1.12 with @hono/zod-validator
   - Testing: Vitest 4.0.6

2. **Web** (apps/web)
   - Framework: Next.js
   - UI: React-based

3. **Worker** (apps/worker)
   - Background job processing

### Shared Packages

- **@repo/database**: Prisma-based database layer
- **@repo/constants**: Shared constants
- **@repo/utils**: Shared utilities
- **@repo/eslint-config**: ESLint configuration
- **@repo/typescript-config**: TypeScript configuration

### Infrastructure

- **Database**: Prisma ORM
- **Queue**: RabbitMQ (amqplib 0.10.9)
- **Cache**: Redis (ioredis 5.8.2)
- **Storage**: MinIO 8.0.6 (S3-compatible object storage)
- **Scheduling**: node-cron 4.2.1
- **Docker**: docker-compose for local development

### Development Tools

- **Linting**: ESLint 9.39.0
- **Formatting**: Prettier 3.6.2
- **Testing**: Vitest 4.0.6 with @vitest/coverage-v8
- **Build**: tsup 8.3.5 for TypeScript builds
- **Turbo**: @turbo/gen 2.3.3

## System Architecture

Microservices architecture with:

- API service for REST endpoints
- Worker service for background processing
- Web service for frontend
- Shared packages for code reuse
- Message queue for async communication
- Redis for caching
- MinIO for video/file storage
- PostgreSQL database (via Prisma)

## Platform

- Development OS: Darwin (macOS)
- Version: macOS 24.6.0
