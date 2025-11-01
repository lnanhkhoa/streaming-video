import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { handlePrismaError } from '../utils/errors'

const isDev = process.env.NODE_ENV === 'development'

/**
 * Global error handler for the Hono application
 * Handles HTTPException, ZodError, Prisma errors, and generic errors
 * Returns standardized error responses
 */
export const errorHandler: ErrorHandler = (err, c) => {
  console.error('=== Error Caught ===')
  console.error('Type:', err.constructor.name)
  console.error('Message:', err.message)

  // Handle HTTPException - Hono's standard error class
  if (err instanceof HTTPException) {
    // Log cause for debugging if present
    if (err.cause) {
      console.error('Cause:', err.cause)
    }

    // Get the response from HTTPException
    // This handles both message-based and custom response-based exceptions
    const response = err.getResponse()

    // Parse the response to get the message
    return c.json(
      {
        success: false,
        error: {
          message: err.message,
          status: err.status,
          ...(isDev && err.cause ? { cause: err.cause } : {})
        }
      },
      err.status
    )
  }

  // Handle Zod validation errors (from zValidator middleware)
  if (err instanceof ZodError) {
    console.error('Validation errors:', err.issues)
    return c.json(
      {
        success: false,
        error: {
          message: 'Validation failed',
          status: 400,
          code: 'VALIDATION_ERROR',
          details: err.issues.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        }
      },
      400
    )
  }

  // Handle Prisma errors
  try {
    return handlePrismaError(err, c)
  } catch {
    // If handlePrismaError throws, it wasn't a Prisma error
    // Continue to generic error handling
  }

  // Generic error fallback
  console.error('Unhandled error:', err)
  console.error('Stack:', err.stack)

  return c.json(
    {
      success: false,
      error: {
        message: isDev ? err.message : 'Internal Server Error',
        status: 500,
        code: 'INTERNAL_ERROR',
        ...(isDev && { stack: err.stack })
      }
    },
    500
  )
}
