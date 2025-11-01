import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error.js'
import { videoRoutes } from './routes/videos.js'
import { uploadRoutes } from './routes/upload.js'
import { analyticsRoutes } from './routes/analytics.js'
import { liveRoutes } from './routes/live.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes
app.route('/api/videos', videoRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/analytics', analyticsRoutes)
app.route('/api/live', liveRoutes)

// Global error handler (must be last)
app.onError(errorHandler)

export { app }
