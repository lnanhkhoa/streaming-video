import { app } from '../../src/app'

// Helper to create properly formatted test requests
const createRequest = (path: string, options?: RequestInit) => {
  const url = `http://localhost${path}`
  return new Request(url, options)
}

// Wrapper to maintain consistent API for existing tests
export const client = {
  async get(path: string) {
    const req = createRequest(path, { method: 'GET' })
    const res = await app.fetch(req)
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return {
      status: res.status,
      body
    }
  },

  async post(path: string, body?: any) {
    const req = createRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const res = await app.fetch(req)
    return {
      status: res.status,
      body: await res.json()
    }
  },

  async patch(path: string, body?: any) {
    const req = createRequest(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const res = await app.fetch(req)
    return {
      status: res.status,
      body: await res.json()
    }
  },

  async delete(path: string) {
    const req = createRequest(path, { method: 'DELETE' })
    const res = await app.fetch(req)
    return {
      status: res.status,
      body: await res.json()
    }
  }
}
