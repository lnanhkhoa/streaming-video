import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(3001),

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

  // Database (optional here, primarily for worker/services)
  DATABASE_URL: z.string().optional()
})

const parsed = schema.safeParse({
  PORT: process.env.PORT,

  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  RABBITMQ_URL: process.env.RABBITMQ_URL,

  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_PORT: process.env.MINIO_PORT,
  MINIO_USE_SSL: process.env.MINIO_USE_SSL,
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,

  DATABASE_URL: process.env.DATABASE_URL
})

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
