import { HTTPException } from 'hono/http-exception'
import { Prisma } from '@prisma/client'
import type { Context } from 'hono'

/**
 * Custom error for resource not found scenarios
 */
export class NotFoundError extends HTTPException {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super(404, { message })
  }
}

/**
 * Custom error for validation failures
 */
export class ValidationError extends HTTPException {
  constructor(message: string, details?: unknown) {
    super(400, { message, cause: details })
  }
}

/**
 * Custom error for resource conflicts (e.g., duplicate entries)
 */
export class ConflictError extends HTTPException {
  constructor(message: string, details?: unknown) {
    super(409, { message, cause: details })
  }
}

/**
 * Custom error for unauthorized access
 */
export class UnauthorizedError extends HTTPException {
  constructor(message: string = 'Unauthorized') {
    super(401, { message })
  }
}

/**
 * Custom error for forbidden access
 */
export class ForbiddenError extends HTTPException {
  constructor(message: string = 'Forbidden') {
    super(403, { message })
  }
}

/**
 * Custom error for bad requests
 */
export class BadRequestError extends HTTPException {
  constructor(message: string, details?: unknown) {
    super(400, { message, cause: details })
  }
}

/**
 * Helper to handle Prisma errors and convert to HTTPException
 */
export function handlePrismaError(err: unknown, c: Context): Response {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        return c.json(
          {
            success: false,
            error: {
              message: 'Resource already exists',
              status: 409,
              code: 'CONFLICT',
            },
          },
          409
        )

      case 'P2025': // Record not found
        return c.json(
          {
            success: false,
            error: {
              message: 'Resource not found',
              status: 404,
              code: 'NOT_FOUND',
            },
          },
          404
        )

      case 'P2003': // Foreign key constraint failed
        return c.json(
          {
            success: false,
            error: {
              message: 'Related resource not found',
              status: 400,
              code: 'FOREIGN_KEY_CONSTRAINT',
            },
          },
          400
        )

      default:
        console.error('Unhandled Prisma error:', err)
        return c.json(
          {
            success: false,
            error: {
              message: 'Database error',
              status: 500,
              code: 'DATABASE_ERROR',
            },
          },
          500
        )
    }
  }

  // If not a known Prisma error, rethrow
  throw err
}

/**
 * Helper functions for common error scenarios
 */
export const throwNotFound = (resource: string, id?: string): never => {
  throw new NotFoundError(resource, id)
}

export const throwBadRequest = (message: string, details?: unknown): never => {
  throw new BadRequestError(message, details)
}

export const throwConflict = (message: string, details?: unknown): never => {
  throw new ConflictError(message, details)
}

export const throwUnauthorized = (message?: string): never => {
  throw new UnauthorizedError(message)
}

export const throwForbidden = (message?: string): never => {
  throw new ForbiddenError(message)
}
