import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'json', 'html'],
      exclude:   ['**/node_modules/**', '**/dist/**', '**/tests/**', '**/*.d.ts'],
      thresholds:{ lines: 70, functions: 70, branches: 65, statements: 70 },
    },
    setupFiles:  ['./tests/helpers/setup.ts'],
  },
  resolve: {
    alias: {
      '@crm/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
