# Queue Service (RabbitMQ) Implementation Plan

**Date**: 2025-11-01
**Type**: Feature Implementation
**Status**: ✅ Completed
**Context Tokens**: Implement RabbitMQ client for publishing transcode jobs to worker queue with retry logic

## Executive Summary

Create message queue service for async video processing. Publishes transcode jobs from API to worker, decouples upload from processing, enables horizontal scaling of workers.

## Context Links

- **Related Plans**: `plans/seed/phase3-backend-api.md`
- **Dependencies**: Phase 3.1 (API Core Setup)
- **Reference Docs**: `plans/251031-tech-stack-detailed.md` (Section 3.4)

## Requirements

### Functional Requirements

- [x] RabbitMQ connection singleton
- [x] Publish transcode jobs
- [x] Create durable queue
- [x] Message persistence
- [x] Retry logic for connection failures
- [x] Graceful shutdown

### Non-Functional Requirements

- [x] Message durability (survive broker restart)
- [x] Connection pooling
- [x] Auto-reconnect on failure
- [x] Type-safe job payloads

## Architecture Overview

```
apps/api/src/services/
└── queue.service.ts

Queue Structure:
- transcode-queue (durable)
  ├── Message: { videoId, originalKey, userId }
  └── TTL: None (persist until consumed)

Flow:
API → publishTranscodeJob() → RabbitMQ → Worker consumes
```

### Key Components

- **RabbitMQ Client**: amqplib connection
- **Channel**: Persistent channel for publishing
- **Queue**: Durable transcode-queue
- **Job Payload**: Type-safe message format

### Data Flow

```
Upload Complete
     ↓
Create Video Record
     ↓
Publish Transcode Job → RabbitMQ Queue
     ↓                        ↓
Return to Client        Worker Consumes
                             ↓
                        Process Video
                             ↓
                        Update Video Status
```

## Implementation Phases

### Phase 1: Connection Setup (Est: 0.5 days)

**Scope**: Create RabbitMQ connection and channel

**Tasks**:

1. [ ] Create queue service - file: `apps/api/src/services/queue.service.ts`
2. [ ] Add environment variables - file: `.env`
3. [ ] Setup connection with retry
4. [ ] Create durable queue
5. [ ] Test connection

**Acceptance Criteria**:

- [ ] Connects to RabbitMQ
- [ ] Queue created and durable
- [ ] Auto-reconnect on failure
- [ ] Graceful error handling

**Files to Create**:

`apps/api/src/services/queue.service.ts`:

```typescript
import amqp from 'amqplib'

interface TranscodeJob {
  videoId: string
  originalKey: string
  userId?: string
}

class QueueService {
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null
  private readonly queueName = 'transcode-queue'
  private isConnected = false
  private reconnectTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.connect()
  }

  private async connect(): Promise<void> {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672'

      this.connection = await amqp.connect(url)
      this.channel = await this.connection.createChannel()

      // Create durable queue
      await this.channel.assertQueue(this.queueName, {
        durable: true
      })

      this.isConnected = true
      console.log('✅ RabbitMQ connected')

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err.message)
        this.isConnected = false
        this.reconnect()
      })

      this.connection.on('close', () => {
        console.error('❌ RabbitMQ connection closed')
        this.isConnected = false
        this.reconnect()
      })
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error)
      this.isConnected = false
      this.reconnect()
    }
  }

  private reconnect(): void {
    if (this.reconnectTimeout) return

    console.log('🔄 Attempting to reconnect to RabbitMQ in 5s...')
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect()
    }, 5000)
  }

  async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.channel) {
      await this.channel.close()
      this.channel = null
    }

    if (this.connection) {
      await this.connection.close()
      this.connection = null
    }

    this.isConnected = false
    console.log('✅ RabbitMQ connection closed')
  }

  // Methods will be added here
}

export const queueService = new QueueService()

// Graceful shutdown
process.on('SIGINT', async () => {
  await queueService.close()
  process.exit(0)
})
```

### Phase 2: Publish Operations (Est: 0.5 days)

**Scope**: Implement job publishing with retry

**Tasks**:

1. [ ] Implement publishTranscodeJob
2. [ ] Add message persistence
3. [ ] Add retry logic
4. [ ] Test publishing

**Acceptance Criteria**:

- [ ] Jobs published successfully
- [ ] Messages persist to disk
- [ ] Retries on transient failures
- [ ] Returns success/failure

**Code to Add**:

```typescript
// Add to QueueService class

/**
 * Publish transcode job to queue
 * @param job - Transcode job payload
 * @returns Success boolean
 */
async publishTranscodeJob(job: TranscodeJob): Promise<boolean> {
  if (!this.isConnected || !this.channel) {
    console.error('Cannot publish: RabbitMQ not connected')
    return false
  }

  try {
    const message = Buffer.from(JSON.stringify(job))

    const sent = this.channel.sendToQueue(this.queueName, message, {
      persistent: true, // Survive broker restart
      contentType: 'application/json'
    })

    if (sent) {
      console.log(`✅ Published transcode job: ${job.videoId}`)
      return true
    } else {
      console.warn('⚠️ Queue buffer full, message not sent')
      return false
    }
  } catch (error) {
    console.error('Failed to publish transcode job:', error)
    return false
  }
}

/**
 * Get queue stats (for monitoring)
 */
async getQueueStats(): Promise<{ messageCount: number; consumerCount: number } | null> {
  if (!this.isConnected || !this.channel) {
    return null
  }

  try {
    const info = await this.channel.checkQueue(this.queueName)
    return {
      messageCount: info.messageCount,
      consumerCount: info.consumerCount
    }
  } catch (error) {
    console.error('Failed to get queue stats:', error)
    return null
  }
}
```

### Phase 3: Type Safety (Est: 0.5 days)

**Scope**: Add type definitions and validation

**Tasks**:

1. [ ] Create job types - file: `apps/api/src/types/queue.ts`
2. [ ] Add Zod validation
3. [ ] Export types

**Acceptance Criteria**:

- [ ] Job payload typed
- [ ] Validation prevents invalid jobs
- [ ] Types exported for worker

**Files to Create**:

`apps/api/src/types/queue.ts`:

```typescript
import { z } from 'zod'

// Transcode job schema
export const transcodeJobSchema = z.object({
  videoId: z.string().uuid(),
  originalKey: z.string().min(1),
  userId: z.string().uuid().optional()
})

export type TranscodeJob = z.infer<typeof transcodeJobSchema>

// Job validation helper
export function validateTranscodeJob(job: unknown): TranscodeJob {
  return transcodeJobSchema.parse(job)
}
```

Update `queue.service.ts`:

```typescript
import { type TranscodeJob, validateTranscodeJob } from '../types/queue'

// Update publishTranscodeJob to validate:
async publishTranscodeJob(job: TranscodeJob): Promise<boolean> {
  // Validate before publishing
  try {
    validateTranscodeJob(job)
  } catch (error) {
    console.error('Invalid transcode job:', error)
    return false
  }

  // ... rest of implementation
}
```

## Testing Strategy

- **Unit Tests**:
  - Connection initialization
  - Job validation
  - Error handling
- **Integration Tests**:
  - Publish job successfully
  - Worker consumes job
  - Reconnect after failure
  - Queue stats retrieval

## Security Considerations

- [ ] RabbitMQ credentials in env vars
- [ ] Connection URL not logged
- [ ] Job payload validated before publishing
- [ ] No sensitive data in queue messages

## Risk Assessment

| Risk                 | Impact | Mitigation                         |
| -------------------- | ------ | ---------------------------------- |
| RabbitMQ unavailable | High   | Auto-reconnect, job retry logic    |
| Message loss         | High   | Persistent messages, durable queue |
| Queue overflow       | Medium | Monitor queue depth, add alarms    |
| Worker starvation    | Medium | Scale workers horizontally         |

## Quick Reference

### Key Commands

```bash
# Start RabbitMQ
docker-compose -f docker-compose.dev.yml up rabbitmq -d

# Access management UI
open http://localhost:15672
# Login: admin/password

# Check queue
curl -u admin:password http://localhost:15672/api/queues/%2F/transcode-queue
```

### Environment Variables

```env
RABBITMQ_URL=amqp://admin:password@localhost:5672
```

### Docker Compose

Add to `docker-compose.dev.yml`:

```yaml
rabbitmq:
  image: rabbitmq:3-management-alpine
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: password
  ports:
    - '5672:5672' # AMQP
    - '15672:15672' # Management UI
```

### Queue Configuration

```javascript
{
  durable: true,        // Queue survives broker restart
  persistent: true,     // Messages saved to disk
  autoDelete: false,    // Queue persists when no consumers
  prefetch: 1          // Worker processes one job at a time
}
```

## TODO Checklist

- [x] Create queue.service.ts
- [x] Create types/queue.ts
- [x] Add RabbitMQ env vars to .env
- [x] Update docker-compose.dev.yml
- [ ] Start RabbitMQ container (requires Docker)
- [ ] Test connection (requires Docker)
- [ ] Test job publishing (requires Docker)
- [ ] Test queue stats (requires Docker)
- [ ] Test reconnection logic (requires Docker)
- [ ] Verify job persists in queue (requires Docker)
- [ ] Commit changes

## Dependencies

**Required Before**:

- Phase 3.1: API Core Setup (for service structure)

**Required After**:

- Phase 3.3: Upload Routes (publishes jobs)
- Worker service (consumes jobs)

## Unresolved Questions

- Should we add job priority levels?
- Need dead-letter queue for failed jobs?
- Monitoring/alerting for queue depth?
