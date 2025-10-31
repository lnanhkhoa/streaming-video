import { Hono } from 'hono'
import { HELLO_WORLD } from '@repo/constants'

const app = new Hono()

app.get('/', (c) => {
  return c.text(HELLO_WORLD)
})

export default app
