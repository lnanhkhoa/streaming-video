/**
 * Health Check HTTP Server
 *
 * Provides health and metrics endpoints for monitoring:
 * - GET /health - Health status
 * - GET /metrics - Detailed metrics
 */

import { createServer } from 'node:http'
import { env } from './env'
import { metrics } from './services/metrics'

export function startHealthServer(): void {
  const server = createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.setHeader('Content-Type', 'application/json')

    if (req.url === '/health') {
      // Health check endpoint
      const health = metrics.getHealth()
      res.writeHead(200)
      res.end(JSON.stringify(health, null, 2))
    } else if (req.url === '/metrics') {
      // Metrics endpoint
      const stats = metrics.getStats()
      res.writeHead(200)
      res.end(JSON.stringify(stats, null, 2))
    } else {
      // 404
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  server.listen(env.HEALTH_PORT, () => {
    console.log(`🏥 Health check server listening on http://localhost:${env.HEALTH_PORT}`)
    console.log(`   Health: http://localhost:${env.HEALTH_PORT}/health`)
    console.log(`   Metrics: http://localhost:${env.HEALTH_PORT}/metrics`)
  })

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Health server error:', error)
  })
}
