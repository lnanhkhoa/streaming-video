import { zValidator as zv } from '@hono/zod-validator'
import type { ZodSchema } from 'zod'
import type { ValidationTargets } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * Custom zValidator wrapper that throws HTTPException on validation failure
 * This ensures all validation errors are handled consistently by the global error handler
 *
 * @param target - The validation target (json, query, param, header, cookie, form)
 * @param schema - The Zod schema to validate against
 * @returns Hono middleware for validation
 *
 * @example
 * ```ts
 * app.post('/users', zValidator('json', userSchema), async (c) => {
 *   const data = c.req.valid('json') // Fully typed!
 *   return c.json({ success: true, data })
 * })
 * ```
 */
export const zValidator = <T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) => {
  return zv(target, schema, (result, c) => {
    if (!result.success) {
      // Throw HTTPException with the Zod error as cause
      // This will be caught by the global error handler
      throw new HTTPException(400, { message: 'Validation failed', cause: result.error })
    }
  })
}
