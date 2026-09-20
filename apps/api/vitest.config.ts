import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      // Jest E2E suite (imports @jest/globals, runs against a real DB —
      // executed via jest.config.ts, not vitest).
      'src/tests/digital-products.test.ts',
      // Standalone ts-node script — no vitest suite (see file header).
      'src/services/permissions/__tests__/permission-system.test.ts',
    ],
  },
});
