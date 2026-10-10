import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    tenants: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    directory_settings_list: { findFirst: vi.fn() },
  },
}));

import { prisma } from '../../prisma';
import {
  RESERVED_SUBDOMAINS,
  normalizeSubdomain,
  isValidSubdomainFormat,
  isReservedSubdomain,
  checkSubdomainAvailability,
  clearSubdomain,
} from '../subdomain';

const tenantsMock = prisma.tenants as any;
const settingsMock = (prisma as any).directory_settings_list as any;

describe('subdomain helper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes case and whitespace', () => {
    expect(normalizeSubdomain('  Joes-Market ')).toBe('joes-market');
    expect(normalizeSubdomain(null)).toBe('');
    expect(normalizeSubdomain(undefined)).toBe('');
  });

  it('validates format', () => {
    expect(isValidSubdomainFormat('joes-market')).toBe(true);
    expect(isValidSubdomainFormat('j')).toBe(true);
    expect(isValidSubdomainFormat('-joes')).toBe(false);
    expect(isValidSubdomainFormat('joes-')).toBe(false);
    expect(isValidSubdomainFormat('joes_market')).toBe(false);
    expect(isValidSubdomainFormat('Joes')).toBe(false);
  });

  it('flags reserved names', () => {
    expect(isReservedSubdomain('admin')).toBe(true);
    expect(isReservedSubdomain('api')).toBe(true);
    expect(isReservedSubdomain('www')).toBe(true);
    expect(isReservedSubdomain('joes-market')).toBe(false);
    expect(RESERVED_SUBDOMAINS.size).toBeGreaterThan(0);
  });

  it('rejects invalid + reserved before any DB read', async () => {
    expect(await checkSubdomainAvailability('-bad')).toEqual({ available: false, code: 'invalid_subdomain' });
    expect(await checkSubdomainAvailability('admin')).toEqual({ available: false, code: 'reserved_subdomain' });
    expect(tenantsMock.findFirst).not.toHaveBeenCalled();
  });

  it('reports taken when another tenant holds the value as slug or subdomain', async () => {
    tenantsMock.findFirst.mockResolvedValue({ id: 't2', name: 'Other' });
    const result = await checkSubdomainAvailability('joes-market', 't1');
    expect(result).toEqual({
      available: false,
      code: 'subdomain_taken',
      takenBy: { tenantId: 't2', tenantName: 'Other' },
    });
    // Cross-namespace: checks subdomain OR slug, excluding the tenant being renamed.
    expect(tenantsMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ subdomain: 'joes-market' }, { slug: 'joes-market' }],
          id: { not: 't1' },
        }),
      }),
    );
  });

  it('reports taken when directory_settings_list holds the value', async () => {
    tenantsMock.findFirst.mockResolvedValue(null);
    settingsMock.findFirst.mockResolvedValue({ tenant_id: 't3' });
    expect(await checkSubdomainAvailability('joes-market')).toEqual({ available: false, code: 'subdomain_taken' });
  });

  it('reports available when nothing holds it', async () => {
    tenantsMock.findFirst.mockResolvedValue(null);
    settingsMock.findFirst.mockResolvedValue(null);
    expect(await checkSubdomainAvailability('joes-market')).toEqual({ available: true });
  });

  it('clearSubdomain nulls subdomain but keeps slug', async () => {
    tenantsMock.findUnique.mockResolvedValue({ slug: 'joes-market', subdomain: 'joes-market' });
    tenantsMock.update.mockResolvedValue({});
    const result = await clearSubdomain('t1');
    expect(result).toEqual({
      ok: true,
      before: { slug: 'joes-market', subdomain: 'joes-market' },
      after: { slug: 'joes-market', subdomain: null },
    });
    expect(tenantsMock.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { subdomain: null } });
  });

  it('clearSubdomain reports tenant_not_found', async () => {
    tenantsMock.findUnique.mockResolvedValue(null);
    expect(await clearSubdomain('missing')).toEqual({ ok: false, code: 'tenant_not_found' });
  });
});
