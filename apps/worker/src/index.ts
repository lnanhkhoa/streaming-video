import { prisma } from '@repo/database'
import { storageService } from './services/storage'
import { startWorker } from './consumer'
import { startHealthServer } from './health'

async function main() {
  console.log('🎬 Video processing worker starting...')
  console.log('📦 Environment:', process.env.NODE_ENV || 'development')
  console.log('🌐 RabbitMQ:', process.env.RABBITMQ_URL)
  console.log('💾 Database:', process.env.DATABASE_URL?.split('@')[1])
  console.log('📦 MinIO:', `${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`)
  console.log()

  try {
    // Connect to database
    await prisma.$connect()
    console.log('✅ Database connected')

    // Storage service initializes on import
    console.log('✅ MinIO connected')

    // Start health check server
    startHealthServer()

    // Start RabbitMQ consumer
    await startWorker()
    console.log('✅ Worker ready and listening for jobs')

    // Keep process alive
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Worker failed to start:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

// Graceful shutdown
let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

  try {
    // RabbitMQ connections are closed in consumer shutdown handler
    // Just need to disconnect database here
    await prisma.$disconnect()
    console.log('✅ Database disconnected')

    console.log('✅ Worker shut down successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

main().catch(async (error) => {
  console.error('❌ Fatal error:', error)
  await prisma.$disconnect()
  process.exit(1)
})
