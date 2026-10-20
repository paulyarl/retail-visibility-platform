/**
 * ConfirmPageService tests — mint, resolve, disputed suppression, submit.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockQueryRaw,
  mockUpdateMany,
  mockTokenUpdate,
  mockGenerate,
  mockLogContact,
  mockAddTouch,
  mockClaimUrl,
  mockTrack,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockTokenUpdate: vi.fn(),
  mockGenerate: vi.fn(),
  mockLogContact: vi.fn(),
  mockAddTouch: vi.fn(),
  mockClaimUrl: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    mkt_deliverable_preview_tokens: {
      updateMany: mockUpdateMany,
      update: mockTokenUpdate,
    },
  },
}));

vi.mock('../MarketingDeliverableService', () => ({
  MarketingDeliverableService: {
    getInstance: () => ({ generateCampaignToken: mockGenerate }),
  },
}));

vi.mock('../MarketingOutreachService', () => ({
  MarketingOutreachService: {
    getInstance: () => ({ logContact: mockLogContact }),
  },
}));

vi.mock('../DirectoryPresenceSeedService.js', () => ({
  default: { addOutreachTouch: mockAddTouch },
}));

vi.mock('../outreach-openers/outreach-link-vars', () => ({
  resolveClaimUrlForCampaign: mockClaimUrl,
}));

vi.mock('../QrAnalyticsService', () => ({
  trackQrScanEvent: mockTrack,
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: { frontendUrl: 'https://example.com', webUrl: null },
}));

vi.mock('../../middleware/errorHandler', () => ({
  ValidationError: class ValidationError extends Error {},
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import confirmPageService from '../ConfirmPageService';

function sqlText(sql: any): string {
  return Array.isArray(sql) ? sql.join('?') : String(sql);
}

const tokenRow = {
  id: 'tok-id',
  token: 'TOK1',
  token_type: 'confirm_page',
  campaign_id: 'camp-1',
  expires_at: new Date('2026-11-15T00:00:00Z'),
  converted_at: null,
  metadata: { fact: { label: 'Your Google phone differs from Yelp' }, business_prospect_id: 'prospect-1' },
};

const campaignRow = {
  id: 'camp-1',
  business_name: 'Maria’s Market',
  business_prospect_id: 'prospect-1',
  tenant_id: 'tenant-1',
  city: 'Indianapolis',
  state: 'IN',
  seed_id: 'seed-1',
  seed_status: 'published',
  seed_tenant_id: 'tenant-1',
  slug: 'marias-market',
  listing_city: 'Indianapolis',
  listing_state: 'IN',
};

function wire(overrides: {
  token?: any;
  campaign?: any;
  gallery?: any;
  logs?: any[];
  touches?: any[];
  seedLink?: any;
} = {}) {
  mockQueryRaw.mockImplementation((sql: any) => {
    const s = sqlText(sql);
    if (s.includes('SELECT id, business_prospect_id FROM mkt_campaigns_list')) {
      return Promise.resolve([{ id: 'camp-1', business_prospect_id: 'prospect-1' }]);
    }
    if (s.includes('SELECT id, token, token_type, campaign_id, expires_at, converted_at, metadata')) {
      return Promise.resolve([overrides.token ?? tokenRow]);
    }
    if (s.includes('FROM mkt_campaigns_list mc')) {
      return Promise.resolve([overrides.campaign ?? campaignRow]);
    }
    if (s.includes('token_type = \'diagnostic_gallery\'')) {
      return Promise.resolve(overrides.gallery ? [overrides.gallery] : []);
    }
    if (s.includes('FROM mkt_outreach_log')) {
      return Promise.resolve(overrides.logs ?? []);
    }
    if (s.includes('FROM directory_seed_outreach_touches')) {
      return Promise.resolve(overrides.touches ?? []);
    }
    if (s.includes('FROM directory_seed_campaign_links dscl')) {
      return Promise.resolve(overrides.seedLink ? [overrides.seedLink] : []);
    }
    if (s.includes('SELECT campaign_id FROM mkt_deliverable_preview_tokens')) {
      return Promise.resolve([{ campaign_id: 'camp-1' }]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockTokenUpdate.mockResolvedValue({});
  mockGenerate.mockResolvedValue({ id: 'tok-id', token: 'TOK1', short_code: 'SHORT1' });
  mockClaimUrl.mockResolvedValue('https://example.com/place/claim/CLAIM1');
  mockAddTouch.mockResolvedValue({ id: 'touch-1' });
  mockLogContact.mockResolvedValue({ id: 'log-1' });
  mockTrack.mockResolvedValue(undefined);
  wire();
});

describe('ConfirmPageService', () => {
  it('mints a confirm_page token with the fact in metadata', async () => {
    const result = await confirmPageService.mintForCampaign('camp-1', {
      field: 'desk_fact',
      label: 'Your Google phone differs from Yelp',
    });

    expect(result).toEqual({
      token: 'TOK1',
      shortCode: 'SHORT1',
      url: 'https://example.com/confirm/TOK1',
      qrUrl: 'https://example.com/cf/SHORT1?surface=cascade_confirm',
    });
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ campaign_id: 'camp-1', token_type: 'confirm_page' }),
    }));
    expect(mockTokenUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tok-id' },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          fact: expect.objectContaining({ label: 'Your Google phone differs from Yelp' }),
        }),
      }),
    }));
  });

  it('resolves the page data and the gallery link', async () => {
    wire({ gallery: { token: 'GAL1', short_code: 'GSHORT' } });

    const data = await confirmPageService.resolve('TOK1');

    expect(data?.businessName).toBe('Maria’s Market');
    expect(data?.fact?.label).toContain('Google phone');
    expect(data?.galleryUrl).toBe('https://example.com/g/GSHORT');
    expect(data?.claimUrl).toBe('https://example.com/place/claim/CLAIM1');
    expect(data?.disputed).toBe(false);
    expect(data?.productId).toBe('prospect-1');
  });

  it('suppresses a fact the owner already disputed', async () => {
    wire({ logs: [{ verification_results: [{ type: 'fact_disputed' }] }] });

    const data = await confirmPageService.resolve('TOK1');
    expect(data?.disputed).toBe(true);
  });

  it('marks an expired token', async () => {
    wire({ token: { ...tokenRow, expires_at: new Date('2020-01-01T00:00:00Z') } });

    const data = await confirmPageService.resolve('TOK1');
    expect(data?.expired).toBe(true);
  });

  it('submit writes a seed touch with the structured C1/C3/C4 results', async () => {
    wire({ seedLink: { seed_id: 'seed-1', tenant_id: 'tenant-1' } });

    const result = await confirmPageService.submit('TOK1', {
      operational: true,
      painOutcome: 'confirmed',
      followUpPermission: 'yes',
      notes: 'Phone is correct',
    });

    expect(result).toEqual({ success: true });
    expect(mockAddTouch).toHaveBeenCalledWith(
      'seed-1',
      expect.objectContaining({
        channel: 'form',
        outcome: 'form_submitted',
        metadata: expect.objectContaining({
          verification_results: expect.arrayContaining([
            expect.objectContaining({ type: 'identity_confirmed' }),
            expect.objectContaining({ type: 'pain_confirmed' }),
            expect.objectContaining({ type: 'follow_up_requested' }),
          ]),
        }),
      }),
      expect.anything(),
    );
    expect(mockTrack).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'cascade_confirm',
      productId: 'prospect-1',
    }));
  });

  it('submit falls back to the campaign log when no seed is linked', async () => {
    wire({ seedLink: null });

    const result = await confirmPageService.submit('TOK1', {
      operational: true,
      painOutcome: 'disputed',
    });

    expect(result).toEqual({ success: true });
    expect(mockLogContact.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        campaignId: 'camp-1',
        contactChannel: 'website',
        verificationResults: expect.arrayContaining([
          expect.objectContaining({ type: 'fact_disputed' }),
        ]),
      }),
    );
  });

  it('submit rejects an expired token', async () => {
    wire({ token: { ...tokenRow, expires_at: new Date('2020-01-01T00:00:00Z') } });

    await expect(
      confirmPageService.submit('TOK1', { operational: true }),
    ).rejects.toThrow(/expired/i);
  });
});
