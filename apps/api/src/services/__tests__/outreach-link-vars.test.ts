/**
 * outreach-link-vars tests — the shared tracked-link/QR resolver (§5.1).
 *
 * Guards the single-source contract: every surface resolves claim/report links
 * through here, so the legacy /directory/claim form can never reappear and the
 * qr_url_* keys stay consistent between scripts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockGetClaimKitMeta, mockGetReportKitMeta } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockGetClaimKitMeta: vi.fn(),
  mockGetReportKitMeta: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock('../ClaimInviteQrKitService', () => ({
  getClaimInviteKitMeta: mockGetClaimKitMeta,
}));

vi.mock('../intelligence/SeedReportDeliveryService', () => ({
  default: { getReportKitMeta: mockGetReportKitMeta },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    frontendUrl: 'https://app.example.com',
    webUrl: 'https://app.example.com',
    get: vi.fn(() => null),
  },
}));

import {
  resolveCampaignSeedId,
  resolveClaimUrlForCampaign,
  resolveClaimUrlForSeed,
  buildOutreachLinkVars,
} from '../outreach-openers/outreach-link-vars';

const KIT = {
  claimUrl: 'https://app.example.com/place/claim/tok-1',
  shortClaimUrl: 'https://app.example.com/c/abc123',
  qrUrl: 'https://app.example.com/q/abc123',
  qrUrlWalkin: 'https://app.example.com/qw/abc123',
  qrUrlSocial: 'https://app.example.com/qs/abc123',
  qrUrlEmail: 'https://app.example.com/qe/abc123',
};

const REPORT_KIT = {
  qrUrlInPerson: 'https://app.example.com/r/abc123',
  qrUrlText: 'https://app.example.com/rt/abc123',
  qrUrlEmail: 'https://app.example.com/re/abc123',
  qrUrlSocial: 'https://app.example.com/rs/abc123',
  qrUrlPhone: 'https://app.example.com/rp/abc123',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([]);
  mockGetClaimKitMeta.mockResolvedValue(null);
  mockGetReportKitMeta.mockResolvedValue(null);
});

describe('resolveCampaignSeedId', () => {
  it('returns the linked seed id', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ seed_id: 'seed-1' }]);
    expect(await resolveCampaignSeedId('camp-1')).toBe('seed-1');
  });

  it('returns null when no link exists', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    expect(await resolveCampaignSeedId('camp-1')).toBeNull();
  });
});

describe('resolveClaimUrlForSeed / ForCampaign', () => {
  it('prefers the claim kit canonical /place/claim URL', async () => {
    mockGetClaimKitMeta.mockResolvedValue(KIT);
    expect(await resolveClaimUrlForSeed('seed-1')).toBe('https://app.example.com/place/claim/tok-1');
  });

  it('falls back to a token lookup (still /place/claim) when the kit cannot resolve', async () => {
    mockGetClaimKitMeta.mockResolvedValue(null);
    mockQueryRaw.mockResolvedValueOnce([{ token: 'tok-fallback' }]);
    expect(await resolveClaimUrlForSeed('seed-1')).toBe('https://app.example.com/place/claim/tok-fallback');
  });

  it('returns null when no active token exists', async () => {
    mockGetClaimKitMeta.mockResolvedValue(null);
    mockQueryRaw.mockResolvedValueOnce([]);
    expect(await resolveClaimUrlForSeed('seed-1')).toBeNull();
  });

  it('resolves for a campaign through its linked seed', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ seed_id: 'seed-1' }]);
    mockGetClaimKitMeta.mockResolvedValue(KIT);
    expect(await resolveClaimUrlForCampaign('camp-1')).toBe(KIT.claimUrl);
  });
});

describe('buildOutreachLinkVars', () => {
  it('returns an empty map without a seed', async () => {
    expect(await buildOutreachLinkVars(null)).toEqual({});
  });

  it('always exposes report_url for a seed', async () => {
    const vars = await buildOutreachLinkVars('seed-1');
    expect(vars.report_url).toBe('https://app.example.com/seed-report/seed-1');
  });

  it('exposes claim + claim QR keys when the claim kit resolves', async () => {
    mockGetClaimKitMeta.mockResolvedValue(KIT);
    const vars = await buildOutreachLinkVars('seed-1');

    expect(vars.claim_url).toBe(KIT.claimUrl);
    expect(vars.claim_short_url).toBe(KIT.shortClaimUrl);
    expect(vars.qr_url_mail).toBe(KIT.qrUrl);
    expect(vars.qr_url_walkin).toBe(KIT.qrUrlWalkin);
    expect(vars.qr_url_claim_social).toBe(KIT.qrUrlSocial);
    expect(vars.qr_url_claim_email).toBe(KIT.qrUrlEmail);
  });

  it('exposes report QR keys when a published report exists', async () => {
    mockGetClaimKitMeta.mockResolvedValue(KIT);
    mockGetReportKitMeta.mockResolvedValue(REPORT_KIT);
    const vars = await buildOutreachLinkVars('seed-1');

    expect(vars.qr_url_report_phone).toBe(REPORT_KIT.qrUrlPhone);
    expect(vars.qr_url_report_email).toBe(REPORT_KIT.qrUrlEmail);
    expect(vars.qr_url_report_social).toBe(REPORT_KIT.qrUrlSocial);
    expect(vars.qr_url_report_in_person).toBe(REPORT_KIT.qrUrlInPerson);
    expect(vars.qr_url_report_text).toBe(REPORT_KIT.qrUrlText);
  });

  it('omits unresolvable kit keys so placeholders stay visible', async () => {
    const vars = await buildOutreachLinkVars('seed-1');
    expect(vars.qr_url_mail).toBeUndefined();
    expect(vars.qr_url_report_in_person).toBeUndefined();
    expect(vars.claim_url).toBeUndefined();
  });

  it('never emits the legacy /directory/claim path', async () => {
    mockGetClaimKitMeta.mockResolvedValue(KIT);
    mockGetReportKitMeta.mockResolvedValue(REPORT_KIT);
    const vars = await buildOutreachLinkVars('seed-1');
    for (const value of Object.values(vars)) {
      expect(value).not.toContain('/directory/claim/');
    }
  });
});
