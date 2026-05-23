import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'lcov'],
      reportsDirectory: 'coverage/front',
      thresholds: {
        statements: 25,
        branches: 60,
        functions: 70,
        lines: 25
      },
      include: [
        'src/constants/**/*.ts',
        'src/constants/**/*.tsx',
        'src/utils/**/*.ts',
        'src/utils/**/*.tsx',
      ],
      exclude: ['src/**/*.d.ts'],
    },
  },
})
