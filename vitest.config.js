import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      thresholds: {
        statements: 10,
        branches: 10,
        functions: 10,
        lines: 10
      }
    }
  }
});
