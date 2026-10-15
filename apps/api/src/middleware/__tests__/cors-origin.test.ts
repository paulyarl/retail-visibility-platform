import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/CustomDomainService', () => ({
  customDomainService: { resolveHostToTenant: vi.fn() },
  default: { resolveHostToTenant: vi.fn() },
}));

import { logger } from '../../logger';
import { customDomainService } from '../../services/CustomDomainService';
import {
  PLATFORM_CORS_ORIGINS,
  isPlatformCorsOrigin,
  isAllowedCustomOrigin,
  resolveCorsOptions,
  clearCorsOriginCache,
} from '../cors-origin';

const resolveHostToTenant = customDomainService.resolveHostToTenant as unknown as ReturnType<typeof vi.fn>;

/** The origin list a resolved options object carries. */
function origins(options: any): (string | RegExp)[] {
  return options.origin as (string | RegExp)[];
}

describe('isPlatformCorsOrigin', () => {
  it.each([
    'http://localhost:3000',
    'https://visibleshelf.com',
    'https://www.visibleshelf.com',
    'https://ivoire-african-market.visibleshelf.com',
    'https://visibleshelf.store',
    'https://ivoire-african-market.visibleshelf.store',
    'https://rvp-git-staging.vercel.app',
  ])('allows platform host %s', (origin) => {
    expect(isPlatformCorsOrigin(origin)).toBe(true);
  });

  it.each([
    'https://placeshelf.store',
    'https://www.placeshelf.store',
    'https://evil.com',
    'https://visibleshelf.com.evil.com',
  ])('rejects non-platform host %s', (origin) => {
    expect(isPlatformCorsOrigin(origin)).toBe(false);
  });
});

describe('resolveCorsOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCorsOriginCache();
  });

  it('returns the platform allowlist when there is no Origin header', async () => {
    const options = await resolveCorsOptions(undefined);
    expect(origins(options)).toEqual(PLATFORM_CORS_ORIGINS);
    expect(resolveHostToTenant).not.toHaveBeenCalled();
  });

  it('does not hit persistence for a platform origin', async () => {
    const options = await resolveCorsOptions('https://ivoire.visibleshelf.com');
    expect(origins(options)).toEqual(PLATFORM_CORS_ORIGINS);
    expect(resolveHostToTenant).not.toHaveBeenCalled();
  });

  it('reflects an origin backed by an active custom domain', async () => {
    resolveHostToTenant.mockResolvedValue({ tenantId: 't1', domain: 'placeshelf.store' });

    const options = await resolveCorsOptions('https://placeshelf.store');
    expect(origins(options)).toContain('https://placeshelf.store');
    expect(resolveHostToTenant).toHaveBeenCalledWith('placeshelf.store');
  });

  it('withholds the origin when no active custom domain matches', async () => {
    resolveHostToTenant.mockResolvedValue(null);

    const options = await resolveCorsOptions('https://evil.com');
    expect(origins(options)).toEqual(PLATFORM_CORS_ORIGINS);
    expect(origins(options)).not.toContain('https://evil.com');
  });

  it('strips www and port before the lookup', async () => {
    resolveHostToTenant.mockResolvedValue({ tenantId: 't1', domain: 'placeshelf.store' });

    await resolveCorsOptions('https://www.placeshelf.store:8443');
    expect(resolveHostToTenant).toHaveBeenCalledWith('placeshelf.store');
  });

  it('ignores an unparseable Origin', async () => {
    const options = await resolveCorsOptions('not-a-url');
    expect(origins(options)).toEqual(PLATFORM_CORS_ORIGINS);
    expect(resolveHostToTenant).not.toHaveBeenCalled();
  });
});

describe('cors origin cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCorsOriginCache();
  });

  it('serves repeat lookups from cache (positive)', async () => {
    resolveHostToTenant.mockResolvedValue({ tenantId: 't1', domain: 'placeshelf.store' });

    await isAllowedCustomOrigin('https://placeshelf.store');
    await isAllowedCustomOrigin('https://placeshelf.store');

    expect(resolveHostToTenant).toHaveBeenCalledTimes(1);
  });

  it('serves repeat lookups from cache (negative)', async () => {
    resolveHostToTenant.mockResolvedValue(null);

    await isAllowedCustomOrigin('https://evil.com');
    await isAllowedCustomOrigin('https://evil.com');

    expect(resolveHostToTenant).toHaveBeenCalledTimes(1);
  });

  it('keys the cache on the logical root — www and apex share one lookup', async () => {
    resolveHostToTenant.mockResolvedValue({ tenantId: 't1', domain: 'placeshelf.store' });

    await isAllowedCustomOrigin('https://placeshelf.store');
    await isAllowedCustomOrigin('https://www.placeshelf.store');

    expect(resolveHostToTenant).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a lookup error and does not cache the failure', async () => {
    resolveHostToTenant.mockRejectedValue(new Error('db down'));

    expect(await isAllowedCustomOrigin('https://placeshelf.store')).toBe(false);
    expect(await isAllowedCustomOrigin('https://placeshelf.store')).toBe(false);

    // A transient fault must be retried, never cached as a denial.
    expect(resolveHostToTenant).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
  });
});
