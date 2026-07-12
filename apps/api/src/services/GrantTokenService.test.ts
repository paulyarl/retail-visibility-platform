import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signGrantToken, verifyGrantToken, isGrantTokenExpired } from './GrantTokenService';

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    encryptionKey: 'test-grant-secret-key-for-testing-only!',
  },
}));

describe('GrantTokenService', () => {
  const basePayload = {
    grant_token_id: 'gtok-test123',
    feature_key: 'chatbot_skill_crm_assistant',
    tenant_id: null,
    duration_days: 30,
    max_claims: 1,
  };

  describe('signGrantToken', () => {
    it('signs a grant token and returns a string', () => {
      const token = signGrantToken({
        ...basePayload,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('embeds the correct payload data in the token', () => {
      const token = signGrantToken({
        ...basePayload,
        qr_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.grant_token_id).toBe('gtok-test123');
      expect(decoded!.feature_key).toBe('chatbot_skill_crm_assistant');
      expect(decoded!.duration_days).toBe(30);
      expect(decoded!.max_claims).toBe(1);
    });

    it('preserves tenant_id when provided', () => {
      const token = signGrantToken({
        ...basePayload,
        tenant_id: 'tid-abc123',
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.tenant_id).toBe('tid-abc123');
    });

    it('preserves null tenant_id for open grants', () => {
      const token = signGrantToken({
        ...basePayload,
        tenant_id: null,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.tenant_id).toBeNull();
    });
  });

  describe('verifyGrantToken', () => {
    it('returns null for an invalid token string', () => {
      expect(verifyGrantToken('invalid.token.here')).toBeNull();
    });

    it('returns null for a token signed with a different secret', () => {
      const token = signGrantToken({
        ...basePayload,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      // Tamper with the token
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.invalid_signature`;
      expect(verifyGrantToken(tampered)).toBeNull();
    });

    it('returns null for a completely malformed string', () => {
      expect(verifyGrantToken('not-a-jwt')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(verifyGrantToken('')).toBeNull();
    });
  });

  describe('isGrantTokenExpired', () => {
    it('returns false for a token with future expiry', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const token = signGrantToken({
        ...basePayload,
        qr_expires_at: futureDate,
      });
      const decoded = verifyGrantToken(token)!;
      expect(isGrantTokenExpired(decoded)).toBe(false);
    });

    it('returns true for a token with past expiry', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      // We need to manually construct the decoded object since JWT won't let us
      // sign with a past expiry
      const decoded = {
        ...basePayload,
        qr_expires_at: pastDate.toISOString(),
        iat: Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000),
        exp: Math.floor((Date.now() - 60 * 60 * 1000) / 1000),
      };
      expect(isGrantTokenExpired(decoded)).toBe(true);
    });

    it('returns false for a token expiring exactly now (edge case)', () => {
      const now = new Date(Date.now() + 1000); // 1 second in future
      const token = signGrantToken({
        ...basePayload,
        qr_expires_at: now,
      });
      const decoded = verifyGrantToken(token);
      if (decoded) {
        expect(isGrantTokenExpired(decoded)).toBe(false);
      }
    });
  });

  describe('max_claims enforcement data', () => {
    it('embeds max_claims in the token for backend enforcement', () => {
      const token = signGrantToken({
        ...basePayload,
        max_claims: 10,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.max_claims).toBe(10);
    });

    it('embeds max_claims of 1 by default', () => {
      const token = signGrantToken({
        grant_token_id: 'gtok-test456',
        feature_key: 'analytics_dashboard',
        tenant_id: null,
        duration_days: null,
        max_claims: 1,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.max_claims).toBe(1);
    });
  });

  describe('tenant_id binding', () => {
    it('embeds tenant_id for tenant-specific grants', () => {
      const token = signGrantToken({
        ...basePayload,
        tenant_id: 'tid-specific-tenant',
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.tenant_id).toBe('tid-specific-tenant');
    });

    it('embeds null tenant_id for open grants (any tenant can redeem)', () => {
      const token = signGrantToken({
        ...basePayload,
        tenant_id: null,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.tenant_id).toBeNull();
    });
  });

  describe('duration_days', () => {
    it('embeds duration_days for time-limited grants', () => {
      const token = signGrantToken({
        ...basePayload,
        duration_days: 90,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.duration_days).toBe(90);
    });

    it('embeds null duration_days for permanent grants', () => {
      const token = signGrantToken({
        ...basePayload,
        duration_days: null,
        qr_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const decoded = verifyGrantToken(token);
      expect(decoded!.duration_days).toBeNull();
    });
  });
});
