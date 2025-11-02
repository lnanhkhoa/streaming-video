import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'esnext',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: false,
  minify: false,
  splitting: false
})
