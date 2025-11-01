/**
 * RPC Type Exports
 *
 * This file explicitly exports the API type for consumption by the web client.
 * Import this in the web app instead of importing from app.ts directly.
 */

import type { app } from '../app'

export type AppType = typeof app
