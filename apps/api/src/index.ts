import { serve } from '@hono/node-server'
import { app } from './app'
import { env } from './env'
import { initializeScheduler } from './utils/scheduler'

const port = env.PORT

// Initialize scheduler
initializeScheduler()

console.log(`🚀 API server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
