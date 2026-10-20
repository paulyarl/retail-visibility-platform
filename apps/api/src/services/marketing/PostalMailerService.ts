/**
 * PostalMailerService — campaign-first, triage-aware postcard generator.
 *
 * Reuses the existing opener intelligence stack:
 *   - resolveCampaignArchetype (operator-accepted triage or fallback)
 *   - OutreachOpenerService.resolveOpener (signal extraction + prompt)
 *   - aiProviderFactory (AI-generated, credible copy)
 *
 * Generates a 4x6" postcard payload with a scannable QR destination — the
 * operator's pick, or the auto precedence (claim → portal → diagnostic
 * gallery → site root). The gallery step mints when the campaign is eligible
 * and otherwise reuses an existing live link.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { unifiedConfig } from '../../config/unifiedConfig';
import { HttpError, NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { OutreachOpenerService } from '../OutreachOpenerService';
import aiProviderFactory from '../ai-providers';
import MarketingCustomerService from '../MarketingCustomerService';
import MarketingDeliverableService from '../MarketingDeliverableService';
import GalleryEligibilityService from './GalleryEligibilityService';
import { resolveGalleryArchetypeDefaults } from './GalleryArchetypeDefaults';
import { resolveGalleryTheme } from './gallery-theme';
import type { ArchetypeCode } from '../outreach-openers/archetype-selection';

/**
 * Operator-picked QR destination for the mailer composer (Outreach Kit tab).
 * 'auto' preserves the original precedence (claim → portal → gallery → site).
 * 'site' is the explicit homepage pick; 'none' is the auto fallback result —
 * both land on the site root but stay distinct for logging.
 */
export type MailerQrDestination =
  | 'auto'
  | 'diagnostic_gallery'
  | 'cascade_gallery'
  | 'cascade_confirm'
  | 'claim'
  | 'portal'
  | 'site'
  | 'custom';

export interface MailerQrOptions {
  destination?: MailerQrDestination;
  customUrl?: string;
  /** Pin the QR to a specific existing gallery link (mkt_deliverable_preview_tokens
   *  id or token string) instead of reuse-or-mint. Only meaningful with
   *  destination === 'diagnostic_gallery'. */
  galleryTokenId?: string;
}

export interface PostalMailerQrTarget {
  qrUrl: string;
  qrDestination: Exclude<MailerQrDestination, 'auto'> | 'none';
  ctaLabel: string;
  token: string | null;
  /** Expiry of the token encoded in the QR (gallery/claim destinations). */
  tokenExpiresAt: Date | null;
}

export interface PostalMailerPayload {
  campaignId: string;
  businessName: string;
  addressLines: string[];
  headline: string;
  body: string;
  ctaLabel: string;
  qrUrl: string;
  qrDestination: 'diagnostic_gallery' | 'cascade_gallery' | 'cascade_confirm' | 'claim' | 'portal' | 'site' | 'custom' | 'none';
  archetype: string;
  token: string | null;
  /** Styled QR PNG data URL from the admin QR designer — when present the
   *  postcard embeds it verbatim instead of rendering a classic B/W code. */
  qrImageDataUrl?: string;
  filename: string;
}

class PostalMailerService {
  private static instance: PostalMailerService;

  private constructor() {}

  static getInstance(): PostalMailerService {
    if (!PostalMailerService.instance) {
      PostalMailerService.instance = new PostalMailerService();
    }
    return PostalMailerService.instance;
  }

  /**
   * Resolve the QR landing URL for a mailer without generating the PDF.
   * Backs the composer's "Design QR" step — the styled QR is rendered
   * client-side, so the URL must be settled before the operator styles it.
   * Applies the same scope/stage gate as generate() (minus the address
   * requirement — a URL needs no mailing address).
   */
  async resolveQrTarget(
    campaignId: string,
    qrOptions?: MailerQrOptions,
    ctx?: RequestCtx,
  ): Promise<PostalMailerQrTarget> {
    const campaign = await this.loadCampaign(campaignId);
    this.assertMailerAllowed(campaign);

    const resolved = await this.resolveQrDestination(campaign, ctx, qrOptions);
    return {
      ...resolved,
      ctaLabel: this.ctaLabelForDestination(resolved.qrDestination),
    };
  }

  /**
   * Build a signal-aware postcard payload for a campaign.
   */
  async generate(
    campaignId: string,
    ctx?: RequestCtx,
    importCopy?: { headline: string; body: string },
    qrOptions?: MailerQrOptions,
    qrImageDataUrl?: string,
  ): Promise<PostalMailerPayload> {
    const campaign = await this.loadCampaign(campaignId);
    this.assertMailerAllowed(campaign);

    if (!this.hasMailingAddress(campaign)) {
      throw new ValidationError('Campaign has no mailing address');
    }

    // Resolve archetype + extracted fields using the same pipeline as openers.
    const { resolvedPrompt, selection } = await OutreachOpenerService.getInstance().resolveOpener(
      campaignId,
      'direct_paid',
      ctx,
    );

    // Generate postcard copy: import wins over AI.
    const { headline, body } = await this.generateCopy(resolvedPrompt, importCopy, ctx);

    // Pick the QR destination and mint the right token.
    const { qrUrl, qrDestination, token } = await this.resolveQrDestination(campaign, ctx, qrOptions);

    const addressLines = this.formatAddressLines(campaign);

    logger.info('PostalMailerService.generate', ctx, {
      campaignId,
      archetype: selection.archetype,
      qrDestination,
    });

    return {
      campaignId: campaign.id,
      businessName: campaign.business_name ?? 'Your Business',
      addressLines,
      headline,
      body,
      ctaLabel: this.ctaLabelForDestination(qrDestination),
      qrUrl,
      qrDestination,
      archetype: selection.archetype,
      token,
      qrImageDataUrl,
      filename: `postcard-${campaign.id}-${selection.archetype.toLowerCase()}.pdf`,
    };
  }

  private async loadCampaign(campaignId: string) {
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_name: true,
        address_line1: true,
        address_line2: true,
        address_city: true,
        address_state: true,
        address_zip: true,
        address_country: true,
        email: true,
        scope: true,
        stage: true,
        date_paid: true,
        customer_id: true,
        package_price_cents: true,
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    return campaign;
  }

  private assertMailerAllowed(campaign: { scope: string | null; stage: string | null }) {
    const allowedStages = ['seek', 'seed', 'preview_built'];
    if (campaign.scope !== 'business' || !allowedStages.includes(campaign.stage ?? '')) {
      throw new ValidationError('Mailer is only available for business-scope campaigns in seek, seed, or preview_built stage');
    }
  }

  private hasMailingAddress(campaign: any): boolean {
    return !!(campaign.address_line1 && campaign.address_city && campaign.address_state);
  }

  private formatAddressLines(campaign: any): string[] {
    const lines: string[] = [campaign.business_name ?? 'Business Owner'];
    if (campaign.address_line1) lines.push(campaign.address_line1);
    if (campaign.address_line2) lines.push(campaign.address_line2);
    const cityStateZip = [campaign.address_city, campaign.address_state, campaign.address_zip]
      .filter(Boolean)
      .join(', ');
    if (cityStateZip) lines.push(cityStateZip);
    if (campaign.address_country && campaign.address_country !== 'US') {
      lines.push(campaign.address_country);
    }
    return lines;
  }

  /**
   * Run a short AI pass over the resolved opener prompt to produce a
   * headline + body that fit on a 4x6" postcard.
   */
  private async generateCopy(
    resolvedPrompt: string,
    importCopy?: { headline: string; body: string },
    ctx?: RequestCtx,
  ): Promise<{ headline: string; body: string }> {
    // Path 2: operator-imported copy (external AI or hand-written).
    if (importCopy?.headline?.trim() && importCopy?.body?.trim()) {
      return {
        headline: importCopy.headline.trim(),
        body: importCopy.body.trim(),
      };
    }

    // Path 1: platform AI generation.
    const systemPrompt = `You are writing the front of a 4x6 inch postcard for a local business owner. The user prompt contains the research and signal context. Output ONLY a valid JSON object with two keys: "headline" (5-10 words) and "body" (25-45 words). No markdown, no URLs, no pricing, no text outside the JSON. The tone is quiet, specific, and useful — prove you did the homework.`;

    try {
      const result = await aiProviderFactory.generateChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: resolvedPrompt },
        ],
        maxTokens: 400,
        temperature: 0.7,
      });

      const raw = (result.content ?? '').trim();
      const parsed = this.parsePostcardJson(raw);
      return {
        headline: parsed.headline || 'We found a visibility gap for your business',
        body: parsed.body || 'Local customers are searching, but your public profile is missing key details. Scan the code to see what we found and how to fix it.',
      };
    } catch (error) {
      logger.error('PostalMailerService AI copy generation failed', undefined, { error: (error as Error).message });
      throw new HttpError(
        503,
        'ai_unavailable',
        'Platform AI is unavailable. Provide headline and body to import, or try again later.',
      );
    }
  }

  private parsePostcardJson(raw: string): { headline: string; body: string } {
    try {
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        headline: String(parsed.headline ?? '').trim(),
        body: String(parsed.body ?? '').trim(),
      };
    } catch {
      // Fallback: if the model ignored instructions, split the text by line breaks.
      const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
      return {
        headline: lines[0] ?? '',
        body: lines.slice(1).join(' '),
      };
    }
  }

  /**
   * Pick the QR destination and mint a token when needed.
   *
   * `destination: 'auto'` (or omitted) keeps the original precedence:
   * claim → portal → diagnostic gallery → site root. The gallery step mints
   * when the campaign is eligible and otherwise reuses an existing live link —
   * a seek/seed campaign that minted at preview_built still has a real gallery
   * to send people to, so the postcard shouldn't dead-end on the site root.
   * Any explicit destination is operator-chosen and validated hard — a
   * forced pick that cannot resolve is a 400, never a silent fallback.
   */
  private async resolveQrDestination(
    campaign: any,
    ctx?: RequestCtx,
    qrOptions?: MailerQrOptions,
  ): Promise<Omit<PostalMailerQrTarget, 'ctaLabel'>> {
    // WEB_URL carries a trailing slash in prod ('https://visibleshelf.com/'),
    // which would otherwise produce '//' paths in every encoded QR.
    const baseUrl = (unifiedConfig.frontendUrl || unifiedConfig.webUrl || 'https://app.visibleshelf.com').replace(/\/+$/, '');
    const destination = qrOptions?.destination ?? 'auto';

    if (destination !== 'auto') {
      switch (destination) {
        case 'diagnostic_gallery': {
          if (qrOptions?.galleryTokenId) {
            return this.explicitGalleryQrTarget(campaign, qrOptions.galleryTokenId, baseUrl);
          }
          const eligibility = await GalleryEligibilityService.resolveEligibility(campaign.id, ctx);
          if (!eligibility.eligible || !eligibility.archetype) {
            throw new ValidationError(
              `Diagnostic gallery is not available: ${eligibility.reason}. ${eligibility.action ?? ''}`.trim(),
            );
          }
          return this.galleryQrTarget(campaign, eligibility.archetype, baseUrl, ctx);
        }
        case 'cascade_gallery': {
          // Tagged gallery link — the QR encodes /cf/{shortCode}?surface=
          // cascade_gallery so the scan is attributable per prospect and
          // clears the act-3 gate.
          if (qrOptions?.galleryTokenId) {
            const target = await this.explicitGalleryQrTarget(campaign, qrOptions.galleryTokenId, baseUrl);
            return this.withCascadeTag(target, baseUrl, 'cascade_gallery');
          }
          const eligibility = await GalleryEligibilityService.resolveEligibility(campaign.id, ctx);
          if (!eligibility.eligible || !eligibility.archetype) {
            throw new ValidationError(
              `Diagnostic gallery is not available: ${eligibility.reason}. ${eligibility.action ?? ''}`.trim(),
            );
          }
          const target = await this.galleryQrTarget(campaign, eligibility.archetype, baseUrl, ctx);
          return this.withCascadeTag(target, baseUrl, 'cascade_gallery');
        }
        case 'cascade_confirm': {
          // The confirm page is Phase 4; the destination is scaffolded so the
          // mailer can carry it as soon as a confirm_page token exists.
          const row = await prisma.mkt_deliverable_preview_tokens.findFirst({
            where: {
              campaign_id: campaign.id,
              token_type: 'confirm_page',
              converted_at: null,
              expires_at: { gt: new Date() },
            },
            orderBy: { created_at: 'desc' },
            select: { token: true, short_code: true, expires_at: true },
          });
          if (!row) {
            throw new ValidationError(
              'Confirm page link is not available yet — mint a confirm page token first.',
            );
          }
          return {
            qrUrl: row.short_code
              ? `${baseUrl}/cf/${row.short_code}?surface=cascade_confirm`
              : `${baseUrl}/confirm/${row.token}`,
            qrDestination: 'cascade_confirm',
            token: row.token,
            tokenExpiresAt: row.expires_at,
          };
        }
        case 'claim': {
          if (campaign.customer_id) {
            throw new ValidationError('Campaign already has a claimed customer — use the portal destination.');
          }
          if (!campaign.email) {
            throw new ValidationError('Claim link requires a campaign email.');
          }
          const target = await this.claimQrTarget(campaign, baseUrl);
          if (!target) {
            throw new ValidationError('Claim link could not be issued — no paid, unclaimed campaigns for this email.');
          }
          return target;
        }
        case 'portal': {
          if (!campaign.customer_id) {
            throw new ValidationError('Campaign has no claimed customer — a portal QR would dead-end.');
          }
          return {
            qrUrl: `${baseUrl}/account/marketing`,
            qrDestination: 'portal',
            token: null,
            tokenExpiresAt: null,
          };
        }
        case 'site':
          return { qrUrl: `${baseUrl}/`, qrDestination: 'site', token: null, tokenExpiresAt: null };
        case 'custom': {
          const raw = qrOptions?.customUrl?.trim();
          if (!raw) {
            throw new ValidationError('A custom QR destination requires a URL.');
          }
          let parsed: URL;
          try {
            parsed = new URL(raw);
          } catch {
            throw new ValidationError('Custom QR destination must be a valid URL.');
          }
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new ValidationError('Custom QR destination must be an http(s) URL.');
          }
          return { qrUrl: raw, qrDestination: 'custom', token: null, tokenExpiresAt: null };
        }
      }
    }

    // Auto precedence — claim → portal → gallery → site.
    if (campaign.date_paid && !campaign.customer_id && campaign.email) {
      const target = await this.claimQrTarget(campaign, baseUrl);
      if (target) {
        return target;
      }
    }

    if (campaign.customer_id) {
      return {
        qrUrl: `${baseUrl}/account/marketing`,
        qrDestination: 'portal',
        token: null,
        tokenExpiresAt: null,
      };
    }

    // Diagnostic gallery — mint when the gallery is eligible; otherwise reuse
    // the campaign's existing live link. Eligibility requires
    // preview_built|shown + at least one diagnostic screenshot + a resolved
    // archetype, so a seek/seed campaign (the mailer's cold-outreach default)
    // cannot mint — minting a bare token there printed a card promising a
    // diagnostic the prospect could not open. A live link already minted at
    // preview_built is a different story: the gallery exists, so print it.
    const eligibility = await GalleryEligibilityService.resolveEligibility(campaign.id, ctx);
    if (eligibility.eligible && eligibility.archetype) {
      return this.galleryQrTarget(campaign, eligibility.archetype, baseUrl, ctx);
    }

    const live = await this.liveGalleryQrTarget(campaign.id, baseUrl);
    if (live) {
      logger.info('PostalMailerService: QR reuses an existing gallery link — not mint-eligible', ctx, {
        campaignId: campaign.id,
        stage: campaign.stage,
        reason: eligibility.reason,
      });
      return live;
    }

    logger.info('PostalMailerService: QR falls back to the site root — no eligible diagnostic gallery', ctx, {
      campaignId: campaign.id,
      stage: campaign.stage,
      reason: eligibility.reason,
      screenshotCount: eligibility.screenshotCount,
    });

    return {
      qrUrl: `${baseUrl}/`,
      qrDestination: 'none',
      token: null,
      tokenExpiresAt: null,
    };
  }

  /**
   * Claim-link QR target. Reuses a live claim token for the campaign email
   * when one exists — issueClaimToken voids prior unclaimed tokens, and the
   * composer's Design-QR step must encode the same URL the PDF ends up with.
   */
  private async claimQrTarget(
    campaign: { id: string; email: string | null },
    baseUrl: string,
  ): Promise<Omit<PostalMailerQrTarget, 'ctaLabel'> | null> {
    const email = campaign.email?.toLowerCase().trim();
    if (!email) return null;

    const existing = await prisma.mkt_customer_claim_tokens.findFirst({
      where: { email, claimed_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
      select: { token: true, expires_at: true },
    });

    if (existing) {
      return {
        qrUrl: `${baseUrl}/marketing/claim/${existing.token}`,
        qrDestination: 'claim',
        token: existing.token,
        tokenExpiresAt: existing.expires_at,
      };
    }

    const issued = await MarketingCustomerService.issueClaimToken(email);
    if (!issued) return null;
    return {
      qrUrl: `${baseUrl}/marketing/claim/${issued.token}`,
      qrDestination: 'claim',
      token: issued.token,
      tokenExpiresAt: null,
    };
  }

  /**
   * The campaign's live diagnostic gallery link, if it has one — newest
   * unconverted, unexpired token. Encodable by a postcard even when the
   * campaign can no longer mint: a seek/seed campaign that minted at
   * preview_built still has a gallery worth sending people to.
   */
  private async liveGalleryQrTarget(
    campaignId: string,
    baseUrl: string,
  ): Promise<Omit<PostalMailerQrTarget, 'ctaLabel'> | null> {
    const live = await prisma.mkt_deliverable_preview_tokens.findFirst({
      where: {
        campaign_id: campaignId,
        token_type: 'diagnostic_gallery',
        converted_at: null,
        paid_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
      select: { token: true, short_code: true, expires_at: true },
    });

    if (!live) return null;

    return {
      qrUrl: live.short_code
        ? `${baseUrl}/g/${live.short_code}`
        : `${baseUrl}/preview/${live.token}`,
      qrDestination: 'diagnostic_gallery',
      token: live.token,
      tokenExpiresAt: live.expires_at,
    };
  }

  /**
   * Gallery QR target. Reuses the campaign's live diagnostic_gallery token
   * when one exists — the resolve (QR design) and generate (PDF) steps must
   * encode the same URL, and superseding on every print would churn tokens.
   * The /g/ short code resolves through the campaign anyway, so even a dead
   * encoded code routes to the live token — but keeping them identical avoids
   * relying on the fallback for the common print case.
   */
  private async galleryQrTarget(
    campaign: any,
    archetype: ArchetypeCode,
    baseUrl: string,
    ctx?: RequestCtx,
  ): Promise<Omit<PostalMailerQrTarget, 'ctaLabel'>> {
    const live = await this.liveGalleryQrTarget(campaign.id, baseUrl);
    if (live) return live;

    // No live token — supersede any unconverted stragglers (same contract as
    // the gallery-token route) and mint a fresh 30-day token for print.
    await prisma.mkt_deliverable_preview_tokens.updateMany({
      where: {
        campaign_id: campaign.id,
        token_type: 'diagnostic_gallery',
        converted_at: null,
        paid_at: null,
      },
      data: { converted_at: new Date() },
    });

    const theme = await resolveGalleryTheme(campaign.id, archetype, ctx);
    const defaults = resolveGalleryArchetypeDefaults(archetype, theme);
    const tokenRow = await MarketingDeliverableService.generateCampaignToken(
      campaign.id,
      'diagnostic_gallery',
      undefined,
      30,
      ctx,
      {
        galleryTitle: defaults.galleryTitle,
        gallerySubtitle: defaults.gallerySubtitle,
        frictionSummary: defaults.frictionSummary,
        ctaLabel: defaults.ctaLabel,
        ctaAmountCents: campaign.package_price_cents ?? undefined,
        galleryArchetype: archetype,
      },
    );

    return {
      qrUrl: tokenRow.short_code
        ? `${baseUrl}/g/${tokenRow.short_code}`
        : `${baseUrl}/preview/${tokenRow.token}`,
      qrDestination: 'diagnostic_gallery',
      token: tokenRow.token,
      tokenExpiresAt: tokenRow.expires_at ?? null,
    };
  }

  /**
   * Operator-pinned gallery link — encodes the specific token's URL rather
   * than reuse-or-mint. Dead links still encode (the /g/ short code
   * resolves campaign-aware to the live successor); tokenExpiresAt lets
   * the composer warn about print runway.
   */
  private async explicitGalleryQrTarget(
    campaign: any,
    galleryTokenId: string,
    baseUrl: string,
  ): Promise<Omit<PostalMailerQrTarget, 'ctaLabel'>> {
    const row = await prisma.mkt_deliverable_preview_tokens.findFirst({
      where: {
        campaign_id: campaign.id,
        token_type: 'diagnostic_gallery',
        OR: [{ id: galleryTokenId }, { token: galleryTokenId }],
      },
      select: { token: true, short_code: true, expires_at: true },
    });
    if (!row) {
      throw new ValidationError('Gallery link not found on this campaign.');
    }
    return {
      qrUrl: row.short_code
        ? `${baseUrl}/g/${row.short_code}`
        : `${baseUrl}/preview/${row.token}`,
      qrDestination: 'diagnostic_gallery',
      token: row.token,
      tokenExpiresAt: row.expires_at ?? null,
    };
  }

  /**
   * Wrap a gallery target in the cascade tagged short link. Falls back to the
   * original URL when the token has no short code (the QR still works, it just
   * loses per-prospect scan attribution).
   */
  private async withCascadeTag(
    target: Omit<PostalMailerQrTarget, 'ctaLabel'>,
    baseUrl: string,
    surface: 'cascade_gallery',
  ): Promise<Omit<PostalMailerQrTarget, 'ctaLabel'>> {
    if (!target.token) return target;
    const row = await prisma.mkt_deliverable_preview_tokens.findFirst({
      where: { token: target.token },
      select: { short_code: true },
    });
    if (!row?.short_code) return target;
    return {
      ...target,
      qrUrl: `${baseUrl}/cf/${row.short_code}?surface=${surface}`,
      qrDestination: surface,
    };
  }

  private ctaLabelForDestination(destination: PostalMailerPayload['qrDestination']): string {
    switch (destination) {
      case 'diagnostic_gallery':
      case 'cascade_gallery':
        return 'Scan to see your free diagnostic';
      case 'cascade_confirm':
        return 'Scan to confirm your listing';
      case 'claim':
        return 'Scan to claim your account';
      case 'portal':
        return 'Scan to view your account';
      default:
        return 'Scan to learn more';
    }
  }
}

export default PostalMailerService;
