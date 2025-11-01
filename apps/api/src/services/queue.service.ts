import * as amqp from 'amqplib'
import { type TranscodeJob, validateTranscodeJob } from '../types/queue'
import { env } from '../env'

class QueueService {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null
  private channel: amqp.Channel | null = null
  private readonly queueName = 'transcode-queue'
  private isConnected = false
  private reconnectTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.connect()
  }

  private async connect(): Promise<void> {
    try {
      const url = env.RABBITMQ_URL
      this.connection = await amqp.connect(url)
      this.channel = await this.connection.createChannel()

      // Create durable queue
      if (!this.channel) throw new Error('Channel not initialized')
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

  /**
   * Publish transcode job to queue
   * @param job - Transcode job payload
   * @returns Success boolean
   */
  async publishTranscodeJob(job: TranscodeJob): Promise<boolean> {
    // Validate before publishing
    try {
      validateTranscodeJob(job)
    } catch (error) {
      console.error('Invalid transcode job:', error)
      return false
    }

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
}

export const queueService = new QueueService()

// Graceful shutdown
process.on('SIGINT', async () => {
  await queueService.close()
  process.exit(0)
})
