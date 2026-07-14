import { describe, test, expect } from 'vitest';
import { runLint } from '../scripts/lint-catchall-order';

describe('lint-catchall-order', () => {
  test('no catch-all or param shadowing ordering violations', () => {
    const { catchAll, param } = runLint();

    expect(catchAll).toHaveLength(0);
    expect(param).toHaveLength(0);
  });
});
