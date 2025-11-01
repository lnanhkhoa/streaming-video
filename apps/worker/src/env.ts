import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server ports
  PORT: z.coerce.number().default(3001),
  HEALTH_PORT: z.coerce.number().default(3002),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default('password'),

  // RabbitMQ
  RABBITMQ_URL: z.string().default('amqp://admin:password@localhost:5672'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  MINIO_ACCESS_KEY: z.string().default('admin'),
  MINIO_SECRET_KEY: z.string().default('password'),
  MINIO_ROOT_USER: z.string().optional(),
  MINIO_ROOT_PASSWORD: z.string().optional(),

  // Database
  DATABASE_URL: z.string().optional(),

  // FFmpeg transcoding
  FFMPEG_PRESET: z
    .enum([
      'ultrafast',
      'superfast',
      'veryfast',
      'faster',
      'fast',
      'medium',
      'slow',
      'slower',
      'veryslow'
    ])
    .default('medium'),
  FFMPEG_CRF: z.coerce.number().min(0).max(51).default(23),

  // Worker configuration
  WORKER_TEMP_DIR: z.string().optional()
})

const parsed = schema.safeParse({
  NODE_ENV: process.env.NODE_ENV,

  PORT: process.env.PORT,
  HEALTH_PORT: process.env.HEALTH_PORT,

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  RABBITMQ_URL: process.env.RABBITMQ_URL,

  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_PORT: process.env.MINIO_PORT,
  MINIO_USE_SSL: process.env.MINIO_USE_SSL,
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
  MINIO_ROOT_USER: process.env.MINIO_ROOT_USER,
  MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD,

  DATABASE_URL: process.env.DATABASE_URL,

  FFMPEG_PRESET: process.env.FFMPEG_PRESET,
  FFMPEG_CRF: process.env.FFMPEG_CRF,

  WORKER_TEMP_DIR: process.env.WORKER_TEMP_DIR
})

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
