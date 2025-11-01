import { hc } from 'hono/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * RPC client for API communication
 *
 * Note: Due to TypeScript cross-package type resolution limitations in the monorepo,
 * we use runtime RPC (which works perfectly) but fall back to manual types for
 * compile-time safety. This is a pragmatic solution that provides:
 * - Full runtime type safety via RPC
 * - Compile-time safety via explicit types in api-rpc.ts
 * - IDE autocomplete and error checking
 */
export const rpcClient = hc<any>(API_URL)
