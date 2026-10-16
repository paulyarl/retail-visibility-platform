import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../prisma', () => ({
  prisma: {
    tenants: { findFirst: vi.fn() },
    custom_domains: { findFirst: vi.fn() },
  },
}));

const config = vi.hoisted(() => ({
  frontendUrl: 'https://visibleshelf.com' as string,
  webUrl: 'https://visibleshelf.com' as string,
  get: vi.fn((): string | undefined => undefined),
}));

vi.mock('../../config/unifiedConfig', () => ({ unifiedConfig: config }));

import { prisma } from '../../prisma';
import {
  platformApex,
  resolveStorefrontCanonical,
  canonicalStorefrontBaseUrl,
} from '../storefront-url';

const tenantsMock = (prisma as any).tenants;
const domainsMock = (prisma as any).custom_domains;

describe('storefront-url helper (the API-side canonical ladder)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.frontendUrl = 'https://visibleshelf.com';
    config.webUrl = 'https://visibleshelf.com';
    config.get.mockReturnValue(undefined);
  });

  describe('platformApex', () => {
    it('derives the apex from config — never a hardcoded literal', () => {
      expect(platformApex()).toBe('visibleshelf.com');
      config.frontendUrl = 'https://visibleshelf.store/';
      expect(platformApex()).toBe('visibleshelf.store');
    });

    it('falls back to the prod apex when config is empty', () => {
      config.frontendUrl = '';
      config.webUrl = '';
      expect(platformApex()).toBe('visibleshelf.com');
    });
  });

  describe('resolveStorefrontCanonical', () => {
    it('an active custom domain wins the ladder', async () => {
      tenantsMock.findFirst.mockResolvedValue({ id: 'tid-1', subdomain: 'baraka' });
      domainsMock.findFirst.mockResolvedValue({ domain: 'mybrand.com' });
      const canon = await resolveStorefrontCanonical('tid-1');
      expect(canon).toEqual({
        kind: 'custom',
        host: 'mybrand.com',
        tenantId: 'tid-1',
        subdomain: 'baraka',
      });
      expect(canonicalStorefrontBaseUrl(canon)).toBe('https://mybrand.com');
    });

    it('falls back to the platform subdomain when no domain is active', async () => {
      tenantsMock.findFirst.mockResolvedValue({ id: 'tid-1', subdomain: 'baraka' });
      domainsMock.findFirst.mockResolvedValue(null);
      const canon = await resolveStorefrontCanonical('baraka');
      expect(canon).toEqual({
        kind: 'subdomain',
        host: 'baraka',
        tenantId: 'tid-1',
        subdomain: 'baraka',
      });
      expect(canonicalStorefrontBaseUrl(canon)).toBe('https://baraka.visibleshelf.com');
    });

    it('a path-only tenant has no merchant-controlled base URL', async () => {
      tenantsMock.findFirst.mockResolvedValue({ id: 'tid-1', subdomain: null });
      domainsMock.findFirst.mockResolvedValue(null);
      const canon = await resolveStorefrontCanonical('tid-1');
      expect(canon).toEqual({ kind: 'path', host: null, tenantId: 'tid-1', subdomain: null });
      // GMC must treat this as "not published" — the platform path would be a
      // mismatched domain.
      expect(canonicalStorefrontBaseUrl(canon)).toBeNull();
    });

    it('returns null for an unknown tenant', async () => {
      tenantsMock.findFirst.mockResolvedValue(null);
      expect(await resolveStorefrontCanonical('nope')).toBeNull();
      expect(canonicalStorefrontBaseUrl(null)).toBeNull();
    });

    it('looks up by id OR slug and only ever accepts an ACTIVE domain', async () => {
      tenantsMock.findFirst.mockResolvedValue({ id: 'tid-1', subdomain: null });
      domainsMock.findFirst.mockResolvedValue(null);

      await resolveStorefrontCanonical('baraka');

      expect(tenantsMock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ id: 'baraka' }, { slug: 'baraka' }] } }),
      );
      expect(domainsMock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: 'tid-1', status: 'active' },
          orderBy: { is_primary: 'desc' },
        }),
      );
    });
  });
});
