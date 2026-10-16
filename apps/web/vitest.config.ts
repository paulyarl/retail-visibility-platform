import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // These files are named *.test.ts but contain script-style functions, not
    // vitest suites — they fail "No test suite found". Excluded until converted.
    exclude: [
      'src/tests/FlexibleApiSingletonV2.test.ts',
      'src/tests/TenantPublicServiceMigration.test.ts',
      'src/lib/sku-generator.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
