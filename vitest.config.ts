import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'vmThreads',
    coverage: {
      exclude: ['src/transpiler/generated/*'],
    },
  },
})
