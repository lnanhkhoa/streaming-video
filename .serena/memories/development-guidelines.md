# Development Guidelines & Patterns

## Development Principles

### YANGI (You Aren't Gonna Need It)

- Avoid over-engineering and premature optimization
- Implement features only when needed
- Don't build infrastructure for hypothetical future requirements
- Start simple, refactor when necessary

### KISS (Keep It Simple, Stupid)

- Prefer simple, straightforward solutions
- Avoid unnecessary complexity
- Write code that's easy to understand and modify
- Choose clarity over cleverness

### DRY (Don't Repeat Yourself)

- Eliminate code duplication
- Extract common logic into reusable functions/modules
- Use composition and abstraction appropriately
- Maintain single source of truth

## File Management

### File Size Hard Limit: 500 Lines

When a file exceeds 500 lines, refactor using:

1. **Extract Utility Functions**: Move to packages/utils
2. **Component Splitting**: Break into smaller components
3. **Service Classes**: Extract business logic to services
4. **Module Organization**: Group related functionality

Example:

```
Before: user-service.ts (750 lines)

After:
services/
├── user-service.ts (200 lines)      # Core service
├── user-validation.ts (150 lines)   # Validation
└── user-repository.ts (180 lines)   # Database ops
utils/
└── password-hasher.ts (80 lines)    # Utilities
```

## Project-Specific Patterns

### API Structure (apps/api)

```typescript
// Route handler with Zod validation
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

const schema = z.object({
  title: z.string(),
  duration: z.number()
})

app.post('/videos', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json')
  // Handle request
  return c.json({ success: true })
})
```

### Database Access (Prisma)

```typescript
import { db } from '@repo/database'

// Always use try-catch
async function getUser(id: string) {
  try {
    const user = await db.user.findUnique({
      where: { id }
    })
    return user
  } catch (error) {
    logger.error('Failed to get user', { id, error })
    throw new DatabaseError('User lookup failed', { cause: error })
  }
}
```

### Queue Operations (RabbitMQ)

```typescript
import amqp from 'amqplib'

async function publishJob(queue: string, data: any) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL)
    const channel = await connection.createChannel()
    await channel.assertQueue(queue)
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)))
    await channel.close()
    await connection.close()
  } catch (error) {
    logger.error('Failed to publish job', { queue, error })
    throw new QueueError('Job publishing failed', { cause: error })
  }
}
```

### Caching (Redis)

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    logger.error('Cache read failed', { key, error })
    return null // Fail gracefully
  }
}

async function setCache(key: string, value: any, ttl: number = 3600) {
  try {
    await redis.setex(key, ttl, JSON.stringify(value))
  } catch (error) {
    logger.error('Cache write failed', { key, error })
    // Don't throw - caching is optional
  }
}
```

### Object Storage (MinIO)

```typescript
import { Client } from 'minio'

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
})

async function uploadFile(bucket: string, filename: string, file: Buffer) {
  try {
    await minioClient.putObject(bucket, filename, file)
    return { bucket, filename }
  } catch (error) {
    logger.error('Upload failed', { bucket, filename, error })
    throw new StorageError('File upload failed', { cause: error })
  }
}
```

## Testing Patterns

### Unit Tests (Vitest)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('UserService', () => {
  beforeEach(async () => {
    // Setup
  })

  afterEach(async () => {
    // Cleanup
  })

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'password123' }

      // Act
      const user = await userService.createUser(userData)

      // Assert
      expect(user).toBeDefined()
      expect(user.email).toBe(userData.email)
    })

    it('should throw ValidationError with invalid email', async () => {
      // Arrange
      const userData = { email: 'invalid', password: 'password123' }

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow(ValidationError)
    })
  })
})
```

### Integration Tests

```bash
# Run integration tests via script
cd apps/api
bash scripts/run-integration.sh

# With UI
bash scripts/run-integration.sh --ui
```

## Error Handling Standards

### Custom Error Classes

```typescript
// Base error class
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}
```

### Error Handling in Routes

```typescript
app.post('/videos', async (c) => {
  try {
    const data = await c.req.json()
    const video = await videoService.create(data)
    return c.json(video, 201)
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message, details: error.details }, 400)
    }
    if (error instanceof UnauthorizedError) {
      return c.json({ error: error.message }, 401)
    }
    logger.error('Unexpected error', { error })
    return c.json({ error: 'Internal server error' }, 500)
  }
})
```

## Logging Standards

### Logger Usage

```typescript
import { logger } from '@repo/utils'

// Info logging
logger.info('User created', { userId: user.id, email: user.email })

// Error logging
logger.error('Database query failed', {
  query: sanitizeQuery(query),
  error: error.message,
  stack: error.stack
})

// Debug logging
logger.debug('Cache hit', { key, ttl })

// Never log sensitive data
// BAD: logger.info('Login attempt', { email, password })
// GOOD: logger.info('Login attempt', { email })
```

## Security Best Practices

### Input Validation

```typescript
// Always validate with Zod
const videoSchema = z.object({
  title: z.string().min(1).max(255),
  duration: z.number().positive(),
  tags: z.array(z.string()).max(10)
})

// Sanitize inputs
import { sanitize } from '@repo/utils'
const cleanTitle = sanitize(input.title)
```

### Authentication & Authorization

```typescript
// Middleware for auth
const authMiddleware = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    throw new UnauthorizedError('Token required')
  }

  try {
    const user = await verifyToken(token)
    c.set('user', user)
    await next()
  } catch (error) {
    throw new UnauthorizedError('Invalid token')
  }
}
```

### Environment Variables

```typescript
// Validate env vars on startup
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  MINIO_ENDPOINT: z.string(),
  JWT_SECRET: z.string().min(32)
})

const env = envSchema.parse(process.env)
```

## Monorepo Patterns

### Workspace Dependencies

```json
{
  "dependencies": {
    "@repo/database": "workspace:*",
    "@repo/utils": "workspace:*",
    "@repo/constants": "workspace:*"
  }
}
```

### Importing from Workspace Packages

```typescript
// Import from workspace packages
import { db } from '@repo/database'
import { logger } from '@repo/utils'
import { APP_CONFIG } from '@repo/constants'

// NOT from relative paths
// BAD: import { db } from '../../packages/database'
```

## Agent Collaboration

### Using Planner Agent

```
Before implementation:
1. Delegate to planner agent
2. Planner creates implementation plan
3. Planner spawns researcher agents in parallel
4. Review plan before proceeding
```

### Using Code Reviewer

```
After implementation:
1. Delegate to code-reviewer agent
2. Review findings and address issues
3. Ensure code quality standards met
```

### Using Tester Agent

```
After code review:
1. Delegate to tester agent
2. Run comprehensive test suite
3. Fix any test failures
4. Verify coverage
```

### Using Docs Manager

```
After significant changes:
1. Delegate to docs-manager agent
2. Update documentation
3. Update codebase-summary.md
4. Ensure accuracy
```

## Git Workflow

### Branch Naming

```
feature/video-upload
fix/queue-timeout
refactor/user-service
docs/api-reference
test/integration-tests
```

### Commit Messages (Conventional Commits)

```
feat(api): add video upload endpoint
fix(worker): resolve queue processing timeout
docs: update API documentation
refactor(web): extract video player component
test(api): add integration tests for auth
ci: update GitHub Actions workflow
```

### Pre-Commit Workflow

1. Run linting: `bun lint`
2. Run type check: `bun typecheck`
3. Run tests: `bun test`
4. Format code: `bun format`
5. Build: `bun build`
6. Commit with conventional format
7. NO secrets in commits!

## Discord Notifications

After completing tasks, notify team:

```bash
./.claude/hooks/send-discord.sh 'Feature: Video Upload

Completed:
- Upload endpoint with Zod validation
- MinIO integration for storage
- Queue job for processing
- Integration tests passing

Status: ✅ Ready for review'
```

## Common Pitfalls to Avoid

1. **Don't simulate implementation** - Always write real code
2. **Don't skip tests** - Tests must pass before commit
3. **Don't commit secrets** - Use .env and .gitignore
4. **Don't exceed 500 lines** - Refactor immediately
5. **Don't ignore type errors** - Fix all type issues
6. **Don't log sensitive data** - Sanitize logs
7. **Don't skip error handling** - Always use try-catch
8. **Don't forget Discord notification** - Send update when done
