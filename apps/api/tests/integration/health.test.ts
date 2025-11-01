import { describe, it, expect } from 'vitest'
import { client } from '../helpers/client'

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const res = await client.get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('timestamp')
  })

  it('should return 404 for unknown routes', async () => {
    const res = await client.get('/unknown-route')

    expect(res.status).toBe(404)
  })
})
