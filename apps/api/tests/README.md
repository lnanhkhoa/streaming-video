# API Testing Guide

## Overview

This directory contains integration and E2E tests for the API using Vitest and Hono's official testing helpers.

## Test Structure

```
tests/
├── setup.ts                    # Test environment setup
├── helpers/
│   └── client.ts              # Test client wrapper
├── integration/               # Route-level tests
│   ├── health.test.ts        # Health check tests
│   ├── videos.test.ts        # Video routes tests
│   ├── upload.test.ts        # Upload routes tests
│   └── analytics.test.ts     # Analytics routes tests
└── e2e/                       # End-to-end workflow tests
    ├── api-health.test.ts
    └── video-workflow.test.ts
```

## Using Hono's Test Client

We use Hono's official `testClient` from `hono/testing` for type-safe testing.

### Basic Example

```typescript
import { describe, it, expect } from 'vitest'
import { testClient } from 'hono/testing'
import { app } from '../../src/app'

describe('My Route', () => {
  const client = testClient(app)

  it('should work', async () => {
    const res = await app.request('/api/endpoint', {
      method: 'GET'
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
  })
})
```

### With Request Body

```typescript
it('should create resource', async () => {
  const res = await app.request('/api/resource', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Test',
      description: 'Test description'
    })
  })

  expect(res.status).toBe(201)
})
```

### With Headers

```typescript
it('should require authentication', async () => {
  const res = await app.request('/api/protected', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token123'
    }
  })

  expect(res.status).toBe(200)
})
```

## Running Tests

### All tests

```bash
bun test
```

### Watch mode

```bash
bun test:watch
```

### Specific test file

```bash
bun test tests/integration/videos.test.ts
```

### With coverage

```bash
bun test:coverage
```

### Verbose output

```bash
bun test --reporter=verbose
```

## Test Helpers

### Client Wrapper

The `tests/helpers/client.ts` provides a wrapper for consistent API:

```typescript
import { client } from '../helpers/client'

// GET request
const res = await client.get('/api/videos/list')

// POST request
const res = await client.post('/api/upload/presign', {
  fileName: 'test.mp4',
  fileSize: 1000000,
  contentType: 'video/mp4'
})

// PATCH request
const res = await client.patch('/api/videos/123', {
  title: 'New Title'
})

// DELETE request
const res = await client.delete('/api/videos/123')
```

## Database Cleanup

Tests automatically clean the database before each test:

```typescript
beforeEach(async () => {
  await prisma.videoViewLog.deleteMany()
  await prisma.videoVariant.deleteMany()
  await prisma.video.deleteMany()
})
```

## Environment Variables

Test environment variables are set in `tests/setup.ts`:

```typescript
process.env.PORT = '3001'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
// ... etc
```

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Clean database**: Use `beforeEach` to reset state
3. **Descriptive names**: Use clear test descriptions
4. **Test edge cases**: Include error scenarios
5. **Use type safety**: Leverage Hono's typed client when possible

## Coverage Goals

- Routes: 95%+
- Services: 85%+
- Overall: 85%+

## Troubleshooting

### Tests timing out

- Increase timeout in `vitest.config.ts`
- Check if services (Redis, RabbitMQ, etc.) are running

### Database errors

- Ensure PostgreSQL is running
- Check DATABASE_URL in setup.ts
- Verify migrations are up to date

### Import errors

- Use `.js` extensions in imports (ESM requirement)
- Check tsconfig.json module resolution

## References

- [Hono Testing Documentation](https://hono.dev/docs/helpers/testing)
- [Vitest Documentation](https://vitest.dev/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
