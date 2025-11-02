import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error'
import videoRoutes from './routes/videos'
import uploadRoutes from './routes/upload'
import analyticsRoutes from './routes/analytics'
import liveRoutes from './routes/live'

type AppBindings = {
  Bindings: Record<string, unknown>
}

// Create base app with middleware
const baseApp = new Hono<AppBindings>()
baseApp.use('*', logger())
baseApp.use('*', cors())
baseApp.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Create app with routes and error handler
const app = baseApp
  .route('/api/videos', videoRoutes)
  .route('/api/upload', uploadRoutes)
  .route('/api/analytics', analyticsRoutes)
  .route('/api/live', liveRoutes)
  .onError(errorHandler)

export { app }
