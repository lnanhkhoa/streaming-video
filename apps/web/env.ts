import { z } from 'zod'
import { BUCKET_PROCESSED, BUCKET_THUMBNAILS } from '@repo/constants'

const schema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.url(),
  STORAGE_URL: z.url()
})

const parsed = schema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  API_URL: process.env.NEXT_PUBLIC_API_URL,
  STORAGE_URL: process.env.NEXT_PUBLIC_STORAGE_URL
})

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = {
  ...parsed.data,
  PROCESSED_STORAGE_URL: `${parsed.data.STORAGE_URL}/${BUCKET_PROCESSED}`,
  THUMBNAILS_STORAGE_URL: `${parsed.data.STORAGE_URL}/${BUCKET_THUMBNAILS}`
}
