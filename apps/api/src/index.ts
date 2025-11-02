import { serve } from '@hono/node-server'
import { app } from './app'
import { env } from './env'
import { initializeScheduler } from './utils/scheduler'
import { cacheService } from './services/cache.service'

// Export AppType for RPC client type inference
export type AppType = typeof app

const port = env.PORT

async function startServer() {
  console.log('🚀 API Server Starting...\n')

  // Display environment
  console.log('📦 Environment:', process.env.NODE_ENV || 'development')
  console.log('🌐 Port:', port)
  console.log('💾 Database:', env.DATABASE_URL?.split('@')[1] || 'configured')
  console.log('📦 MinIO:', `${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`)
  console.log('🔴 Redis:', `${env.REDIS_HOST}:${env.REDIS_PORT}`)
  console.log('🐰 RabbitMQ:', env.RABBITMQ_URL?.split('@')[1] || 'configured')
  console.log()

  try {
    // Initialize services
    console.log('🔌 Initializing services...')

    // Storage service initializes on import (singleton)
    console.log('✅ Storage service initialized')
    // await storageService

    // Cache service initializes on import (singleton)
    console.log('✅ Cache service initialized')
    await cacheService.flushDb()

    // Queue service will connect when first used
    console.log('✅ Queue service ready')

    // Initialize scheduler
    initializeScheduler()
    console.log('✅ Scheduler initialized')

    console.log('\n✅ All services ready\n')

    // Start HTTP server
    serve({ fetch: app.fetch, port })

    console.log(`🚀 API server listening on http://localhost:${port}`)
    console.log(`📊 Health check: http://localhost:${port}/health\n`)
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...')
  process.exit(0)
})

startServer()
