import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '../../logger';
import { deprecate } from '../deprecation';

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
  } as any;
}

describe('deprecation middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets Deprecation + Sunset + successor Link headers', () => {
    const res = makeRes();
    const next = vi.fn();

    deprecate({
      retiredOn: '2026-10-10',
      sunsetOn: '2026-12-10',
      replacement: '/api/slugs/patterns',
      doc: 'docs/SLUG_API_RETIREMENT.md',
    })({ method: 'PUT', originalUrl: '/api/slugs/tenant/t1' } as any, res, next);

    expect(res.headers['Deprecation']).toBe('true');
    expect(res.headers['Sunset']).toBe(new Date('2026-12-10').toUTCString());
    expect(res.headers['Link']).toContain('rel="successor-version"');
    expect(res.headers['Link']).toContain('/api/slugs/patterns');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs a warning only once per method+path (query ignored)', () => {
    const middleware = deprecate({
      retiredOn: '2026-10-10',
      sunsetOn: '2026-12-10',
      replacement: '/api/slugs/patterns',
    });
    const req = { method: 'POST', originalUrl: '/api/slugs/generate?x=1' } as any;

    middleware(req, makeRes(), vi.fn());
    middleware(req, makeRes(), vi.fn());

    expect((logger.warn as any).mock.calls.length).toBe(1);
  });
});
