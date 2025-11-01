import type { Context } from 'hono'
import type { SuccessResponse } from '../types/index'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Helper function to return standardized success responses
 *
 * @param c - Hono context
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns JSON response with success: true and data
 *
 * @example
 * ```ts
 * return successResponse(c, { video }, 201)
 * ```
 */
export function successResponse<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<SuccessResponse<T>>({ success: true, data }, status)
}

/**
 * @deprecated Use custom error classes from utils/errors.ts instead
 * This function is kept for backward compatibility but will be removed
 *
 * Instead of:
 * ```ts
 * if (!video) return errorResponse(c, 'Not found', 404)
 * ```
 *
 * Use:
 * ```ts
 * if (!video) throw new NotFoundError('Video', id)
 * ```
 */
