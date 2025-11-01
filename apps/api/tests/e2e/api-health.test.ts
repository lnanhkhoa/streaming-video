import { describe, it, expect } from 'vitest'
import { client } from '../helpers/client'

describe('API Health E2E', () => {
  it('should return healthy status', async () => {
    const res = await client.get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })

  it('should handle 404 for unknown routes', async () => {
    const res = await client.get('/api/unknown-route')

    expect(res.status).toBe(404)
  })
})
