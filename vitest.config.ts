import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/dashboard_frontend/**/*', 'node_modules/**/*'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/dashboard_frontend/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/__tests__/**',
      ]
    }
  }
});