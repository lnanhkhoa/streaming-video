// Set test database URL BEFORE any imports
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5445/streaming_video_test'

import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig({
  test: {
    env: loadEnv('test', process.cwd(), ''),
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    fileParallelism: false, // Disable parallel file execution
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', '**/*.test.ts', 'dist/**', 'src/env.ts']
    }
  }
})
