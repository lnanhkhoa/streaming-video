import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error'
import { videoRoutes } from './routes/videos'
import { uploadRoutes } from './routes/upload'
import { analyticsRoutes } from './routes/analytics'
import { liveRoutes } from './routes/live'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes - properly typed for RPC
const routes = app
  .route('/api/videos', videoRoutes)
  .route('/api/upload', uploadRoutes)
  .route('/api/analytics', analyticsRoutes)
  .route('/api/live', liveRoutes)

// Global error handler (must be last)
routes.onError(errorHandler)

export { routes as app }
export type AppType = typeof routes
