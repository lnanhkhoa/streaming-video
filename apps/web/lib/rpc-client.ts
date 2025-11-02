import { hc } from 'hono/client'
import type { AppType } from '../../api/src/types/rpc'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * RPC client for API communication
 */
export const rpcClient = hc<AppType>(API_URL)