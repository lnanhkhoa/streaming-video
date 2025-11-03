import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error'
import { videoRoutes } from './routes/videos'
import { uploadRoutes } from './routes/upload'
import { analyticsRoutes } from './routes/analytics'
import { prettyJSON } from 'hono/pretty-json'

// Create base app with middleware

const router = new Hono()
router.use('*', logger())
router.use('*', cors())
router.use(prettyJSON())
router.notFound((c) => c.json({ message: 'Not Found', ok: false }, 404))

const app = router
  .get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))
  .route('/api/videos', videoRoutes)
  .route('/api/upload', uploadRoutes)
  .route('/api/analytics', analyticsRoutes)

app.onError(errorHandler)

export { app }
export type AppType = typeof app
