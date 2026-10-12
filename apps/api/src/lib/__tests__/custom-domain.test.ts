import { describe, it, expect } from 'vitest';

import {
  attachedHostsFor,
  isNonDnsHost,
  isPlatformDomain,
  isValidDomainFormat,
  normalizeDomainInput,
  normalizeHostForResolve,
} from '../custom-domain';

describe('custom-domain helper', () => {
  describe('normalizeDomainInput', () => {
    it('lowercases and trims', () => {
      expect(normalizeDomainInput('  MyBrand.COM ')).toBe('mybrand.com');
    });

    it('strips scheme, path, port, and trailing dot', () => {
      expect(normalizeDomainInput('https://Shop.MyBrand.com/products?x=1')).toBe('shop.mybrand.com');
      expect(normalizeDomainInput('mybrand.com:443')).toBe('mybrand.com');
      expect(normalizeDomainInput('mybrand.com.')).toBe('mybrand.com');
    });

    it('strips a leading www. to the logical root (D9)', () => {
      expect(normalizeDomainInput('www.mybrand.com')).toBe('mybrand.com');
      expect(normalizeDomainInput('WWW.SHOP.mybrand.com')).toBe('shop.mybrand.com');
    });
  });

  describe('isValidDomainFormat', () => {
    it('accepts apex and subdomain shapes', () => {
      expect(isValidDomainFormat('mybrand.com')).toBe(true);
      expect(isValidDomainFormat('shop.mybrand.com')).toBe(true);
      expect(isValidDomainFormat('mybrand.co.uk')).toBe(true);
      expect(isValidDomainFormat('a-b-c.example.org')).toBe(true);
    });

    it('rejects malformed values', () => {
      expect(isValidDomainFormat('')).toBe(false);
      expect(isValidDomainFormat('mybrand')).toBe(false);
      expect(isValidDomainFormat('-bad.com')).toBe(false);
      expect(isValidDomainFormat('bad-.com')).toBe(false);
      expect(isValidDomainFormat('bad domain.com')).toBe(false);
      expect(isValidDomainFormat('mybrand.c')).toBe(false);
    });
  });

  describe('isNonDnsHost', () => {
    it('rejects localhost and IP literals', () => {
      expect(isNonDnsHost('localhost')).toBe(true);
      expect(isNonDnsHost('127.0.0.1')).toBe(true);
      expect(isNonDnsHost('10.0.0.1')).toBe(true);
      expect(isNonDnsHost('mybrand.com')).toBe(false);
    });
  });

  describe('isPlatformDomain (D8 refusal)', () => {
    it('refuses platform roots and anything under them', () => {
      expect(isPlatformDomain('visibleshelf.com')).toBe(true);
      expect(isPlatformDomain('shop.visibleshelf.com')).toBe(true);
      expect(isPlatformDomain('a.b.visibleshelf.com')).toBe(true);
      expect(isPlatformDomain('visibleshelf.store')).toBe(true);
      expect(isPlatformDomain('tenant.visibleshelf.store')).toBe(true);
    });

    it('allows tenant-owned roots and lookalikes', () => {
      expect(isPlatformDomain('mybrand.com')).toBe(false);
      expect(isPlatformDomain('shop.mybrand.com')).toBe(false);
      expect(isPlatformDomain('visibleshelf.com.evil.com')).toBe(false);
      expect(isPlatformDomain('myvisibleshelf.com')).toBe(false);
    });
  });

  describe('attachedHostsFor (D9/F-B1)', () => {
    it('apex-declared inputs attach apex + www', () => {
      expect(attachedHostsFor('mybrand.com', true)).toEqual(['mybrand.com', 'www.mybrand.com']);
    });

    it('subdomain inputs attach only themselves', () => {
      expect(attachedHostsFor('shop.mybrand.com', false)).toEqual(['shop.mybrand.com']);
    });

    it('multi-part suffix apex still gets www — declared, not parsed (F-B1)', () => {
      expect(attachedHostsFor('mybrand.co.uk', true)).toEqual(['mybrand.co.uk', 'www.mybrand.co.uk']);
    });
  });

  describe('normalizeHostForResolve', () => {
    it('www. hosts resolve via the apex row (D9)', () => {
      expect(normalizeHostForResolve('www.mybrand.com')).toBe('mybrand.com');
      expect(normalizeHostForResolve('www.shop.mybrand.com')).toBe('shop.mybrand.com');
    });

    it('strips the request-host port', () => {
      expect(normalizeHostForResolve('mybrand.com:443')).toBe('mybrand.com');
    });
  });
});
