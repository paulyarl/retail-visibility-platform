import { describe, it, expect } from 'vitest';
import {
  canMintGalleryLink,
  defaultGalleryTokenId,
  filterLiveGalleryTokens,
  galleryTokenLabel,
  resolveMailerDestinations,
} from './mailer-qr-destinations';
import type { GalleryEligibility, GalleryToken, MailerQrDestination } from '@/services/MarketingOpsService';

const token = (partial: Partial<GalleryToken>): GalleryToken => ({
  id: partial.id ?? 'mdpt-1',
  token: 'tok-abcdefgh',
  token_type: 'diagnostic_gallery',
  campaign_id: 'mcamp-uvcasj3e',
  expires_at: null,
  viewed_at: null,
  converted_at: null,
  gallery_archetype: null,
  gallery_title: null,
  gallery_subtitle: null,
  friction_summary: null,
  cta_label: null,
  cta_amount_cents: null,
  created_at: '2026-10-16T00:00:00Z',
  ...partial,
});

/** The reported campaign: seek stage, no live link yet, not paid/claimed. */
const ineligible = (over: Partial<GalleryEligibility> = {}): GalleryEligibility => ({
  eligible: false,
  stage: 'seek',
  stageOk: false,
  screenshotCount: 2,
  hasBusinessAnalysisAudit: false,
  hasAcceptedTriage: false,
  archetype: null,
  reason: 'invalid_stage',
  action: 'Advance the campaign to preview_built or shown before generating a gallery link.',
  ...over,
});

const eligible = (over: Partial<GalleryEligibility> = {}): GalleryEligibility =>
  ineligible({ eligible: true, stage: 'preview_built', stageOk: true, archetype: 'A5', reason: null, action: null, ...over });

const seekCampaign = { email: 'owner@example.com', customer_id: null, date_paid: null };

const values = (opts: { value: MailerQrDestination }[]) => opts.map((o) => o.value);

describe('filterLiveGalleryTokens', () => {
  it('keeps unconverted links and drops converted or expired ones', () => {
    const now = new Date('2026-10-16T12:00:00Z').getTime();
    const tokens = [
      token({ id: 'live', short_code: 'LIVE' }),
      token({ id: 'expired', expires_at: '2026-10-15T12:00:00Z' }),
      token({ id: 'converted', converted_at: '2026-10-16T10:00:00Z' }),
      token({ id: 'no-expiry' }),
    ];

    expect(filterLiveGalleryTokens(tokens, now).map((t) => t.id)).toEqual(['live', 'no-expiry']);
  });
});

describe('resolveMailerDestinations', () => {
  it('omits the gallery option at seek with no live links (the reported dropdown)', () => {
    const options = resolveMailerDestinations({
      eligibility: ineligible(),
      liveGalleryTokens: [],
      campaign: seekCampaign,
    });

    expect(values(options)).toEqual(['auto', 'site', 'custom']);
  });

  it('offers the gallery destination when a live link exists even though the campaign cannot mint', () => {
    const options = resolveMailerDestinations({
      eligibility: ineligible(),
      liveGalleryTokens: [token({ id: 'mdpt-943y2up0', short_code: '2W4Q6U' })],
      campaign: seekCampaign,
    });

    expect(values(options)).toContain('diagnostic_gallery');
    expect(values(options)).toEqual(['auto', 'diagnostic_gallery', 'site', 'custom']);
  });

  it('offers the gallery destination when the campaign is mint-eligible', () => {
    const options = resolveMailerDestinations({
      eligibility: eligible(),
      liveGalleryTokens: [],
      campaign: seekCampaign,
    });

    expect(values(options)).toContain('diagnostic_gallery');
  });

  it('gates claim on a paid, unclaimed campaign email and portal on a claimed customer', () => {
    const paid = { ...seekCampaign, date_paid: '2026-10-01T00:00:00Z' };
    expect(values(resolveMailerDestinations({ eligibility: ineligible(), liveGalleryTokens: [], campaign: paid }))).toContain('claim');

    // No email → nothing to claim.
    expect(
      values(resolveMailerDestinations({ eligibility: ineligible(), liveGalleryTokens: [], campaign: { ...paid, email: null } })),
    ).not.toContain('claim');

    // Already claimed → the portal replaces the claim link.
    const claimed = { email: null, customer_id: 'cust-1', date_paid: null };
    const claimedOptions = values(resolveMailerDestinations({ eligibility: ineligible(), liveGalleryTokens: [], campaign: claimed }));
    expect(claimedOptions).toContain('portal');
    expect(claimedOptions).not.toContain('claim');
  });
});

describe('defaultGalleryTokenId', () => {
  it('keeps the reuse-or-mint sentinel when the campaign can mint', () => {
    expect(defaultGalleryTokenId(eligible(), [token({ id: 'live' })])).toBe('');
  });

  it('preselects the newest live link when it cannot', () => {
    expect(defaultGalleryTokenId(ineligible(), [token({ id: 'newest' }), token({ id: 'older' })])).toBe('newest');
    expect(defaultGalleryTokenId(ineligible(), [])).toBe('');
    expect(defaultGalleryTokenId(null, [])).toBe('');
  });

  it('treats a missing eligibility payload as "cannot mint"', () => {
    expect(canMintGalleryLink(null)).toBe(false);
  });
});

describe('galleryTokenLabel', () => {
  it('leads with the short code and flags viewed links', () => {
    const label = galleryTokenLabel(
      token({ short_code: '2W4Q6U', viewed_at: '2026-10-16T13:15:26.738Z', expires_at: '2026-11-15T13:08:37.938Z' }),
    );

    expect(label).toContain('/g/2W4Q6U');
    expect(label).toContain('viewed');
    expect(label).toContain('exp');
  });

  it('falls back to the token tail for a link with no short code', () => {
    expect(galleryTokenLabel(token({ token: 'tok-abcdefgh' }))).toBe('…abcdefgh');
  });
});
