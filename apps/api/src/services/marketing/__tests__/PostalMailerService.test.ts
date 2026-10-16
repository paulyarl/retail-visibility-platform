import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsFindUnique,
  mockTokensUpdateMany,
  mockTokensFindFirst,
  mockClaimTokensFindFirst,
  mockResolveEligibility,
  mockGenerateCampaignToken,
  mockResolveGalleryTheme,
  mockIssueClaimToken,
} =
  vi.hoisted(() => ({
    mockCampaignsFindUnique: vi.fn(),
    mockTokensUpdateMany: vi.fn(),
    mockTokensFindFirst: vi.fn(),
    mockClaimTokensFindFirst: vi.fn(),
    mockResolveEligibility: vi.fn(),
    mockGenerateCampaignToken: vi.fn(),
    mockResolveGalleryTheme: vi.fn(),
    mockIssueClaimToken: vi.fn(),
  }));

vi.mock('../../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: { findUnique: mockCampaignsFindUnique },
    mkt_deliverable_preview_tokens: { updateMany: mockTokensUpdateMany, findFirst: mockTokensFindFirst },
    mkt_customer_claim_tokens: { findFirst: mockClaimTokensFindFirst },
  },
}));

vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../config/unifiedConfig', () => ({
  unifiedConfig: { frontendUrl: 'https://app.example.com', webUrl: null },
}));

vi.mock('../../../middleware/errorHandler', () => ({
  HttpError: class HttpError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
  NotFoundError: class NotFoundError extends Error {},
  ValidationError: class ValidationError extends Error {},
}));

vi.mock('../../OutreachOpenerService', () => ({
  OutreachOpenerService: {
    getInstance: () => ({
      resolveOpener: vi.fn().mockResolvedValue({
        resolvedPrompt: 'resolved prompt',
        selection: { archetype: 'A5', source: 'fallback', reason: 'test' },
      }),
    }),
  },
}));

vi.mock('../../ai-providers', () => ({ default: { generateChatCompletion: vi.fn() } }));

vi.mock('../../MarketingCustomerService', () => ({
  default: { issueClaimToken: mockIssueClaimToken },
}));

vi.mock('../../MarketingDeliverableService', () => ({
  default: { generateCampaignToken: mockGenerateCampaignToken },
}));

vi.mock('../GalleryEligibilityService', () => ({
  default: { resolveEligibility: mockResolveEligibility },
}));

vi.mock('../GalleryArchetypeDefaults', () => ({
  resolveGalleryArchetypeDefaults: vi.fn().mockReturnValue({
    galleryTitle: 'Multi-Signal Diagnostic',
    gallerySubtitle: 'Several issues are holding back your visibility.',
    frictionSummary: { unaddressed_reviews: 30 },
    ctaLabel: 'Start Recovery',
  }),
}));

vi.mock('../gallery-theme', () => ({ resolveGalleryTheme: mockResolveGalleryTheme }));

import PostalMailerService from '../PostalMailerService';

const CAMPAIGN_ID = 'mcamp-uvcasj3e';

const campaign = {
  id: CAMPAIGN_ID,
  business_name: 'Arsema G Food Mart LLC',
  address_line1: '6667 W Washington St',
  address_line2: 'Unit A',
  address_city: 'Indianapolis',
  address_state: 'IN',
  address_zip: '46241',
  address_country: 'US',
  email: 'owner@example.com',
  scope: 'business',
  stage: 'preview_built',
  date_paid: null,
  customer_id: null,
  package_price_cents: 15000,
};

const importCopy = { headline: 'Preview - your listings and your reviews', body: 'Pulled together a quick visibility snapshot.' };

const eligible = (overrides: Record<string, unknown> = {}) => ({
  eligible: true,
  stage: 'preview_built',
  stageOk: true,
  screenshotCount: 3,
  hasBusinessAnalysisAudit: true,
  hasAcceptedTriage: false,
  archetype: 'A5',
  reason: null,
  action: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaignsFindUnique.mockResolvedValue({ ...campaign });
  mockTokensUpdateMany.mockResolvedValue({ count: 1 });
  // No live gallery token by default → mint path.
  mockTokensFindFirst.mockResolvedValue(null);
  mockClaimTokensFindFirst.mockResolvedValue(null);
  mockGenerateCampaignToken.mockResolvedValue({ token: 'TOK1', short_code: 'SHORT1', expires_at: new Date('2026-11-15') });
  mockResolveGalleryTheme.mockResolvedValue(null);
  mockIssueClaimToken.mockResolvedValue({ token: 'CLAIM1', campaignIds: [CAMPAIGN_ID] });
});

describe('PostalMailerService QR destination', () => {
  it('mints a gallery token with archetype meta and supersedes prior unconverted ones', async () => {
    mockResolveEligibility.mockResolvedValue(eligible());

    const payload = await PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy);

    expect(payload.qrDestination).toBe('diagnostic_gallery');
    expect(payload.token).toBe('TOK1');
    expect(payload.qrUrl).toBe('https://app.example.com/g/SHORT1');

    expect(mockTokensUpdateMany).toHaveBeenCalledWith({
      where: {
        campaign_id: CAMPAIGN_ID,
        token_type: 'diagnostic_gallery',
        converted_at: null,
        paid_at: null,
      },
      data: { converted_at: expect.any(Date) },
    });

    expect(mockGenerateCampaignToken).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      'diagnostic_gallery',
      undefined,
      30,
      undefined,
      {
        galleryTitle: 'Multi-Signal Diagnostic',
        gallerySubtitle: 'Several issues are holding back your visibility.',
        frictionSummary: { unaddressed_reviews: 30 },
        ctaLabel: 'Start Recovery',
        ctaAmountCents: 15000,
        galleryArchetype: 'A5',
      },
    );
  });

  it('falls back to the long /preview/<token> path when the token has no short code', async () => {
    mockResolveEligibility.mockResolvedValue(eligible());
    mockGenerateCampaignToken.mockResolvedValue({ token: 'TOK1', short_code: null });

    const payload = await PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy);

    expect(payload.qrUrl).toBe('https://app.example.com/preview/TOK1');
  });

  it('never mints a gallery token for a campaign without an eligible gallery', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, stage: 'seek' });
    mockResolveEligibility.mockResolvedValue(
      eligible({ eligible: false, stage: 'seek', stageOk: false, screenshotCount: 0, archetype: null, reason: 'invalid_stage' }),
    );

    const payload = await PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy);

    expect(mockGenerateCampaignToken).not.toHaveBeenCalled();
    expect(mockTokensUpdateMany).not.toHaveBeenCalled();
    expect(payload.qrDestination).toBe('none');
    expect(payload.token).toBeNull();
    expect(payload.qrUrl).toBe('https://app.example.com/');
    expect(payload.ctaLabel).toBe('Scan to learn more');
  });

  it('prefers the customer portal over the gallery once the campaign is claimed', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, customer_id: 'cust-1' });
    mockResolveEligibility.mockResolvedValue(eligible());

    const payload = await PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy);

    expect(payload.qrDestination).toBe('portal');
    expect(payload.qrUrl).toBe('https://app.example.com/account/marketing');
    expect(mockGenerateCampaignToken).not.toHaveBeenCalled();
  });
});

describe('PostalMailerService auto destination with existing gallery links', () => {
  it('reuses a live gallery link when the campaign can no longer mint one', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, stage: 'seek' });
    mockResolveEligibility.mockResolvedValue(
      eligible({
        eligible: false,
        stage: 'seek',
        stageOk: false,
        screenshotCount: 2,
        archetype: null,
        reason: 'invalid_stage',
      }),
    );
    mockTokensFindFirst.mockResolvedValue({
      token: 'LIVE1',
      short_code: 'LIVECD',
      expires_at: new Date('2026-11-15'),
    });

    const payload = await PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy);

    expect(payload.qrDestination).toBe('diagnostic_gallery');
    expect(payload.qrUrl).toBe('https://app.example.com/g/LIVECD');
    expect(payload.token).toBe('LIVE1');
    expect(payload.ctaLabel).toBe('Scan to see your free diagnostic');
    expect(mockGenerateCampaignToken).not.toHaveBeenCalled();
    expect(mockTokensUpdateMany).not.toHaveBeenCalled();
  });

  it('encodes an operator-pinned gallery link without consulting eligibility', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, stage: 'seek' });
    mockTokensFindFirst.mockResolvedValue({
      token: 'LIVE1',
      short_code: 'LIVECD',
      expires_at: new Date('2026-11-15'),
    });

    const target = await PostalMailerService.getInstance().resolveQrTarget(CAMPAIGN_ID, {
      destination: 'diagnostic_gallery',
      galleryTokenId: 'mdpt-943y2up0',
    });

    expect(target.qrDestination).toBe('diagnostic_gallery');
    expect(target.qrUrl).toBe('https://app.example.com/g/LIVECD');
    expect(mockResolveEligibility).not.toHaveBeenCalled();
    expect(mockTokensFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaign_id: CAMPAIGN_ID,
          OR: [{ id: 'mdpt-943y2up0' }, { token: 'mdpt-943y2up0' }],
        }),
      }),
    );
  });

  it('normalizes a trailing slash on the configured frontend URL', async () => {
    const { unifiedConfig } = await import('../../../config/unifiedConfig');
    (unifiedConfig as any).frontendUrl = 'https://app.example.com/';
    try {
      const payload = await PostalMailerService.getInstance().generate(
        CAMPAIGN_ID,
        undefined,
        importCopy,
        { destination: 'site' },
      );

      expect(payload.qrUrl).toBe('https://app.example.com/');
    } finally {
      (unifiedConfig as any).frontendUrl = 'https://app.example.com';
    }
  });
});

describe('PostalMailerService explicit QR destinations', () => {
  it('reuses the live gallery token instead of minting when one exists', async () => {
    mockResolveEligibility.mockResolvedValue(eligible());
    mockTokensFindFirst.mockResolvedValue({
      token: 'LIVE1',
      short_code: 'LIVECD',
      expires_at: new Date('2026-11-15'),
    });

    const payload = await PostalMailerService.getInstance().generate(
      CAMPAIGN_ID,
      undefined,
      importCopy,
      { destination: 'diagnostic_gallery' },
    );

    expect(payload.qrDestination).toBe('diagnostic_gallery');
    expect(payload.qrUrl).toBe('https://app.example.com/g/LIVECD');
    expect(payload.token).toBe('LIVE1');
    expect(mockGenerateCampaignToken).not.toHaveBeenCalled();
    expect(mockTokensUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a forced gallery destination when the campaign is not eligible', async () => {
    mockResolveEligibility.mockResolvedValue(
      eligible({ eligible: false, screenshotCount: 0, archetype: null, reason: 'no_screenshots', action: 'Upload at least one diagnostic screenshot.' }),
    );

    await expect(
      PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy, { destination: 'diagnostic_gallery' }),
    ).rejects.toThrow('no_screenshots');
    expect(mockGenerateCampaignToken).not.toHaveBeenCalled();
  });

  it('lands on the site root for an explicit site destination', async () => {
    const payload = await PostalMailerService.getInstance().generate(
      CAMPAIGN_ID,
      undefined,
      importCopy,
      { destination: 'site' },
    );

    expect(payload.qrDestination).toBe('site');
    expect(payload.qrUrl).toBe('https://app.example.com/');
    expect(payload.ctaLabel).toBe('Scan to learn more');
    expect(mockResolveEligibility).not.toHaveBeenCalled();
  });

  it('encodes a custom URL for the custom destination', async () => {
    const payload = await PostalMailerService.getInstance().generate(
      CAMPAIGN_ID,
      undefined,
      importCopy,
      { destination: 'custom', customUrl: 'https://example.com/place/joes-plumbing' },
    );

    expect(payload.qrDestination).toBe('custom');
    expect(payload.qrUrl).toBe('https://example.com/place/joes-plumbing');
  });

  it('rejects a custom destination without a valid http(s) URL', async () => {
    await expect(
      PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy, { destination: 'custom' }),
    ).rejects.toThrow('requires a URL');
    await expect(
      PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy, {
        destination: 'custom',
        customUrl: 'ftp://nope',
      }),
    ).rejects.toThrow('http(s)');
  });

  it('rejects a forced portal destination when no customer is claimed', async () => {
    await expect(
      PostalMailerService.getInstance().generate(CAMPAIGN_ID, undefined, importCopy, { destination: 'portal' }),
    ).rejects.toThrow('no claimed customer');
  });

  it('reuses a live claim token for the claim destination', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, date_paid: new Date('2026-10-01') });
    mockClaimTokensFindFirst.mockResolvedValue({
      token: 'CLAIMLIVE',
      expires_at: new Date('2026-11-01'),
    });

    const payload = await PostalMailerService.getInstance().generate(
      CAMPAIGN_ID,
      undefined,
      importCopy,
      { destination: 'claim' },
    );

    expect(payload.qrDestination).toBe('claim');
    expect(payload.qrUrl).toBe('https://app.example.com/marketing/claim/CLAIMLIVE');
    expect(mockIssueClaimToken).not.toHaveBeenCalled();
  });

  it('issues a fresh claim token when none is live', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, date_paid: new Date('2026-10-01') });

    const payload = await PostalMailerService.getInstance().generate(
      CAMPAIGN_ID,
      undefined,
      importCopy,
      { destination: 'claim' },
    );

    expect(payload.qrUrl).toBe('https://app.example.com/marketing/claim/CLAIM1');
    expect(mockIssueClaimToken).toHaveBeenCalledWith('owner@example.com');
  });
});

describe('PostalMailerService.resolveQrTarget', () => {
  it('resolves the QR landing without generating copy or a PDF', async () => {
    mockResolveEligibility.mockResolvedValue(eligible());

    const target = await PostalMailerService.getInstance().resolveQrTarget(
      CAMPAIGN_ID,
      { destination: 'diagnostic_gallery' },
    );

    expect(target.qrDestination).toBe('diagnostic_gallery');
    expect(target.qrUrl).toBe('https://app.example.com/g/SHORT1');
    expect(target.ctaLabel).toBe('Scan to see your free diagnostic');
    expect(target.tokenExpiresAt).toEqual(new Date('2026-11-15'));
  });

  it('enforces the same stage gate as generate', async () => {
    mockCampaignsFindUnique.mockResolvedValue({ ...campaign, stage: 'paid' });

    await expect(
      PostalMailerService.getInstance().resolveQrTarget(CAMPAIGN_ID, { destination: 'site' }),
    ).rejects.toThrow('Mailer is only available');
  });
});
