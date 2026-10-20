/**
 * ConfirmPageService — the Four-Act dual-role confirm page (Phase 4).
 *
 * The page names the desk-picked C3 fact (the confirm/awareness role) and
 * leads onward to the gallery (the show role). It is token-gated through a
 * `confirm_page` mkt_deliverable_preview_tokens row; the fact rides the token
 * metadata so the printed artifact and the page cannot drift.
 *
 * A confirm-page scan is act-2 delivery, not the act-3 gate. A form submit
 * records the structured C1/C3/C4 capture and clears the record gate.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §2.1/§2.2/§11 B4.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import { ValidationError } from '../middleware/errorHandler';
import { MarketingDeliverableService } from './MarketingDeliverableService';
import { MarketingOutreachService } from './MarketingOutreachService';
import { resolveClaimUrlForCampaign } from './outreach-openers/outreach-link-vars';
import { trackQrScanEvent } from './QrAnalyticsService';

export interface ConfirmFact {
  field?: string;
  label?: string;
  expected?: string;
  actual?: string;
  sources?: string[];
}

export interface ConfirmPageData {
  token: string;
  expired: boolean;
  businessName: string | null;
  city: string | null;
  state: string | null;
  fact: ConfirmFact | null;
  disputed: boolean;
  galleryUrl: string | null;
  claimUrl: string | null;
  placeUrl: string | null;
  seedStatus: string | null;
  /** Per-prospect attribution key — business_prospect_id or campaign id. */
  productId: string | null;
}

export interface ConfirmPageSubmitInput {
  operational?: boolean;
  painOutcome?: 'confirmed' | 'disputed' | 'not_asked';
  followUpPermission?: 'yes' | 'no' | 'not_asked';
  notes?: string;
}

function baseUrl(): string {
  return (unifiedConfig.frontendUrl || unifiedConfig.webUrl || '').replace(/\/+$/, '');
}

function hasResult(results: any, types: string[]): boolean {
  if (!Array.isArray(results)) return false;
  return results.some((r) => r && types.includes(String(r.type)));
}

export class ConfirmPageService extends BaseService {
  private static instance: ConfirmPageService;

  private constructor() {
    super();
  }

  static getInstance(): ConfirmPageService {
    if (!ConfirmPageService.instance) {
      ConfirmPageService.instance = new ConfirmPageService();
    }
    return ConfirmPageService.instance;
  }

  async mintForCampaign(
    campaignId: string,
    fact: ConfirmFact,
    ctx?: { actorId?: string; actorType?: 'user' | 'system' | 'integration' | 'customer' },
  ): Promise<{ token: string; shortCode: string | null; url: string; qrUrl: string }> {
    if (!fact || (!fact.label && !fact.expected && !fact.actual)) {
      throw new ValidationError('A confirm page requires the desk-picked fact.');
    }

    const campaign = await prisma.$queryRaw<any[]>`
      SELECT id, business_prospect_id FROM mkt_campaigns_list WHERE id = ${campaignId} LIMIT 1
    `;
    if (!campaign[0]) throw new ValidationError('Campaign not found.');

    // One live confirm token per campaign — supersede prior unconverted ones.
    await prisma.mkt_deliverable_preview_tokens.updateMany({
      where: {
        campaign_id: campaignId,
        token_type: 'confirm_page',
        converted_at: null,
      } as any,
      data: { converted_at: new Date() },
    });

    const row = await MarketingDeliverableService.getInstance().generateCampaignToken(
      campaignId,
      'confirm_page',
      undefined,
      30,
      ctx as any,
    );

    await prisma.mkt_deliverable_preview_tokens.update({
      where: { id: row.id },
      data: {
        metadata: {
          fact,
          business_prospect_id: campaign[0].business_prospect_id ?? null,
        } as any,
      } as any,
    });

    const base = baseUrl();
    return {
      token: row.token,
      shortCode: row.short_code ?? null,
      url: `${base}/confirm/${row.token}`,
      qrUrl: row.short_code
        ? `${base}/cf/${row.short_code}?surface=cascade_confirm`
        : `${base}/confirm/${row.token}`,
    };
  }

  async resolve(token: string): Promise<ConfirmPageData | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, token, token_type, campaign_id, expires_at, converted_at, metadata
      FROM mkt_deliverable_preview_tokens
      WHERE token = ${token}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.token_type !== 'confirm_page') return null;

    const expired = !!(row.expires_at && new Date(row.expires_at) < new Date());
    const fact = (row.metadata?.fact ?? null) as ConfirmFact | null;
    const campaignId = row.campaign_id as string;

    const campaignRows = await prisma.$queryRaw<any[]>`
      SELECT
        mc.id,
        mc.business_name,
        mc.business_prospect_id,
        mc.tenant_id,
        mc.city,
        mc.state,
        dps.id AS seed_id,
        dps.status AS seed_status,
        dps.tenant_id AS seed_tenant_id,
        dl.slug,
        dl.city AS listing_city,
        dl.state AS listing_state
      FROM mkt_campaigns_list mc
      LEFT JOIN directory_seed_campaign_links dscl
        ON dscl.campaign_id = mc.id AND dscl.link_role = 'primary'
      LEFT JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
      LEFT JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE mc.id = ${campaignId}
      LIMIT 1
    `;
    const campaign = campaignRows[0] ?? null;

    const claimUrl = await resolveClaimUrlForCampaign(campaignId).catch(() => null);

    const galleryRows = await prisma.$queryRaw<any[]>`
      SELECT token, short_code
      FROM mkt_deliverable_preview_tokens
      WHERE campaign_id = ${campaignId}
        AND token_type = 'diagnostic_gallery'
        AND converted_at IS NULL
        AND paid_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const gallery = galleryRows[0] ?? null;
    const galleryUrl = gallery
      ? gallery.short_code
        ? `${baseUrl()}/g/${gallery.short_code}`
        : `${baseUrl()}/preview/${gallery.token}`
      : null;

    // Disputed fact — a later call/confirm said the fact is wrong. Suppress it
    // on the page rather than repeating a claim the owner already rejected.
    const disputed = await this.isFactDisputed(campaignId, campaign?.seed_id ?? null);

    return {
      token: row.token,
      expired,
      businessName: campaign?.business_name ?? null,
      city: campaign?.listing_city ?? campaign?.city ?? null,
      state: campaign?.listing_state ?? campaign?.state ?? null,
      fact,
      disputed,
      galleryUrl,
      claimUrl,
      placeUrl: campaign?.slug ? `${baseUrl()}/place/${campaign.slug}` : null,
      seedStatus: campaign?.seed_status ?? null,
      productId: row.metadata?.business_prospect_id ?? campaignId,
    };
  }

  private async isFactDisputed(campaignId: string, seedId: string | null): Promise<boolean> {
    try {
      const logs = await prisma.$queryRaw<any[]>`
        SELECT verification_results
        FROM mkt_outreach_log
        WHERE campaign_id = ${campaignId}
          AND verification_results IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
      `;
      if (logs.some((l) => hasResult(l.verification_results, ['fact_disputed', 'pain_not_present']))) {
        return true;
      }
    } catch {
      // Fall through to the seed touches.
    }

    if (seedId) {
      try {
        const touches = await prisma.$queryRaw<any[]>`
          SELECT metadata
          FROM directory_seed_outreach_touches
          WHERE seed_id = ${seedId}
            AND metadata->'verification_results' IS NOT NULL
          ORDER BY occurred_at DESC
          LIMIT 5
        `;
        if (
          touches.some((t) =>
            hasResult(t.metadata?.verification_results, ['fact_disputed', 'pain_not_present']),
          )
        ) {
          return true;
        }
      } catch {
        // Best-effort.
      }
    }
    return false;
  }

  async submit(
    token: string,
    input: ConfirmPageSubmitInput,
    ctx?: { actorId?: string; actorType?: 'user' | 'system' | 'integration' | 'customer'; ip?: string; userAgent?: string },
  ): Promise<{ success: true } | null> {
    const data = await this.resolve(token);
    if (!data) return null;
    if (data.expired) throw new ValidationError('This confirm link has expired.');

    const results: Array<Record<string, any>> = [];
    if (input.operational === true) results.push({ type: 'identity_confirmed' });
    if (input.painOutcome === 'confirmed') results.push({ type: 'pain_confirmed' });
    if (input.painOutcome === 'disputed') {
      results.push({ type: 'fact_disputed', field: data.fact?.field ?? 'desk_fact' });
    }
    if (input.followUpPermission === 'yes') results.push({ type: 'follow_up_requested' });
    if (input.followUpPermission === 'no') {
      results.push({ type: 'other', field: 'follow_up_permission', value: 'no' });
    }
    if (input.notes?.trim()) {
      results.push({ type: 'other', field: 'confirm_page_notes', value: input.notes.trim() });
    }

    const campaignId = await this.campaignIdForToken(token);
    if (!campaignId) return null;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT dscl.seed_id, dps.tenant_id
      FROM directory_seed_campaign_links dscl
      JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
      WHERE dscl.campaign_id = ${campaignId}
        AND dscl.link_role = 'primary'
      ORDER BY dscl.created_at DESC
      LIMIT 1
    `;
    const seed = rows[0] ?? null;

    if (seed) {
      const { default: seedService } = await import('./DirectoryPresenceSeedService.js');
      await seedService.addOutreachTouch(
        seed.seed_id,
        {
          channel: 'form',
          outcome: 'form_submitted',
          notes: input.notes,
          metadata: {
            verification_results: results,
            confirm_token: token,
            source: 'confirm_page',
          },
        },
        { actorId: ctx?.actorId || 'confirm_page', actorType: ctx?.actorType || 'system' },
      );
      await trackQrScanEvent({
        tenantId: seed.tenant_id,
        surface: 'cascade_confirm',
        consumer: 'merchant',
        productId: data.productId ?? undefined,
        source: 'confirm_form',
        userAgent: ctx?.userAgent,
      });
    } else {
      await MarketingOutreachService.getInstance().logContact({
        campaignId,
        contactChannel: 'website',
        contactDate: new Date().toISOString().slice(0, 10),
        outcome: 'reached',
        notes: input.notes,
        callDetails: { contact_result: 'form_submitted' } as any,
        contactedBy: ctx?.actorId,
        verificationResults: results,
      }, ctx as any);
    }

    logger.info('ConfirmPageService.submit', undefined, {
      token,
      results: results.map((r) => r.type),
    });
    return { success: true };
  }

  private async campaignIdForToken(token: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT campaign_id FROM mkt_deliverable_preview_tokens WHERE token = ${token} LIMIT 1
    `;
    return rows[0]?.campaign_id ?? null;
  }
}

export default ConfirmPageService.getInstance();
