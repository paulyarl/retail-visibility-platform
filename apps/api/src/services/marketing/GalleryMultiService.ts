/**
 * GalleryMultiService — multi-diagnostic gallery data assembly
 *
 * Assembles gallery data for a multi-gallery token from all eligible sibling
 * campaigns for a business prospect. Each sibling contributes its own
 * archetype-aware gallery section (title, subtitle, friction summary, CTA,
 * screenshots).
 *
 * Eligibility filters:
 *   - Stage must be 'preview_built' or 'shown' (galleries are for live previews)
 *   - Must have at least 1 diagnostic_screenshot file
 *   - Excludes paid/delivered siblings (no point showing a gallery for a
 *     campaign that's already been purchased)
 *
 * Ordering:
 *   - Primary sibling first
 *   - Then by archetype priority (A2 > A1 > A6 > A3 > A4 > A5)
 *   - Then by created_at ascending
 *
 * Pattern: singleton extends BaseService.
 * Spec: docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md
 * Sprint 2 — Multi-Diagnostic Gallery.
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { resolveGalleryArchetypeDefaults } from './GalleryArchetypeDefaults';
import { resolveCampaignArchetype } from '../OutreachOpenerService';
import type { ArchetypeCode } from '../outreach-openers/archetype-selection';

// ─── Types ───────────────────────────────────────────────────────────────

export interface MultiGallerySiblingSection {
  campaignId: string;
  businessName: string | null;
  archetype: ArchetypeCode;
  galleryTitle: string;
  gallerySubtitle: string;
  frictionSummary: Record<string, string | number>;
  ctaLabel: string;
  ctaAmountCents: number | null;
  estimatedFeeCents: number;
  isPrimarySibling: boolean;
  screenshots: MultiGalleryScreenshot[];
}

export interface MultiGalleryScreenshot {
  id: string;
  fileName: string;
  signedUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: Date;
}

export interface MultiGalleryData {
  prospectId: string;
  businessName: string | null;
  siblings: MultiGallerySiblingSection[];
  payUrl: string;
}

// ─── Archetype priority for sibling ordering ─────────────────────────────

const ARCHETYPE_PRIORITY: Record<ArchetypeCode, number> = {
  A2: 1, // BBB crisis — highest priority
  A1: 2, // Review gap
  A6: 3, // Product visibility
  A3: 4, // Listing drift
  A4: 5, // CTA gap
  A5: 6, // Dual/triage (bundle)
};

const ELIGIBLE_STAGES = new Set(['preview_built', 'shown']);

// ─── Service ─────────────────────────────────────────────────────────────

export class GalleryMultiService extends BaseService {
  private static instance: GalleryMultiService;

  private constructor() {
    super();
  }

  static getInstance(): GalleryMultiService {
    if (!GalleryMultiService.instance) {
      GalleryMultiService.instance = new GalleryMultiService();
    }
    return GalleryMultiService.instance;
  }

  /**
   * Assemble multi-gallery data for a business prospect.
   *
   * Loads all sibling campaigns, filters to eligible ones (preview_built/shown
   * with screenshots), resolves archetype-aware defaults per sibling, fetches
   * screenshots with signed URLs, and returns the assembled data.
   *
   * Returns null if no eligible siblings exist (caller should 404).
   */
  async assembleMultiGallery(
    prospectId: string,
    ctx?: RequestCtx,
  ): Promise<MultiGalleryData | null> {
    // 1. Load all sibling campaigns for this prospect
    const siblings = await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: prospectId, scope: 'business' } as any,
      orderBy: { created_at: 'asc' },
    }) as any[];

    if (siblings.length === 0) {
      return null;
    }

    // 2. Filter to eligible stages
    const eligible = siblings.filter((s) => ELIGIBLE_STAGES.has(s.stage));
    if (eligible.length === 0) {
      return null;
    }

    // 3. Sort: primary first, then by archetype priority, then by created_at
    eligible.sort((a, b) => {
      const aPrimary = a.is_primary_sibling ?? false;
      const bPrimary = b.is_primary_sibling ?? false;
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return (a.created_at as Date).getTime() - (b.created_at as Date).getTime();
    });

    // 4. Build per-sibling sections (with screenshots + archetype defaults)
    const sections: MultiGallerySiblingSection[] = [];
    for (const campaign of eligible) {
      const section = await this.buildSiblingSection(campaign, ctx);
      if (section) {
        sections.push(section);
      }
    }

    if (sections.length === 0) {
      return null; // No siblings had screenshots
    }

    // Re-sort sections by archetype priority (primary already first from step 3,
    // but sections may have been filtered by screenshot gate)
    sections.sort((a, b) => {
      if (a.isPrimarySibling && !b.isPrimarySibling) return -1;
      if (!a.isPrimarySibling && b.isPrimarySibling) return 1;
      const aPrio = ARCHETYPE_PRIORITY[a.archetype] ?? 99;
      const bPrio = ARCHETYPE_PRIORITY[b.archetype] ?? 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return 0;
    });

    const businessName = eligible[0]?.business_name ?? null;

    logger.info('Multi-gallery assembled', ctx, {
      prospectId,
      siblingCount: sections.length,
      businessName,
    });

    return {
      prospectId,
      businessName,
      siblings: sections,
      payUrl: `/marketing/pay?prospect=${prospectId}`,
    };
  }

  /**
   * Build a single sibling's gallery section: resolve archetype, fetch
   * screenshots with signed URLs, apply archetype-aware defaults.
   *
   * Returns null if the sibling has no diagnostic screenshots.
   */
  private async buildSiblingSection(
    campaign: any,
    ctx?: RequestCtx,
  ): Promise<MultiGallerySiblingSection | null> {
    const campaignId = campaign.id as string;

    // 1. Fetch screenshots
    const screenshots = await this.prisma.mkt_files_list.findMany({
      where: {
        campaign_id: campaignId,
        file_type: 'diagnostic_screenshot',
      },
      orderBy: { uploaded_at: 'asc' },
      select: {
        id: true,
        file_name: true,
        storage_path: true,
        mime_type: true,
        file_size: true,
        uploaded_at: true,
      },
    });

    if (screenshots.length === 0) {
      return null; // Screenshot gate — skip siblings without screenshots
    }

    // 2. Generate signed URLs (5-minute TTL via Supabase)
    const screenshotsWithUrls = await this.generateSignedUrls(screenshots);

    // 3. Resolve archetype (honors operator-accepted triage)
    let archetype: ArchetypeCode;
    let theme: any = null;
    try {
      const resolved = await resolveCampaignArchetype(campaignId, ctx);
      archetype = resolved.archetype;
    } catch {
      // No audit + no triage — skip this sibling (can't build gallery without archetype)
      logger.warn('Multi-gallery: could not resolve archetype for sibling', ctx, { campaignId });
      return null;
    }

    // 4. Apply archetype-aware defaults
    const defaults = resolveGalleryArchetypeDefaults(archetype, theme);

    return {
      campaignId,
      businessName: campaign.business_name ?? null,
      archetype,
      galleryTitle: defaults.galleryTitle,
      gallerySubtitle: defaults.gallerySubtitle,
      frictionSummary: defaults.frictionSummary,
      ctaLabel: defaults.ctaLabel,
      ctaAmountCents: campaign.estimated_fee_cents ?? null,
      estimatedFeeCents: campaign.estimated_fee_cents ?? 0,
      isPrimarySibling: campaign.is_primary_sibling ?? false,
      screenshots: screenshotsWithUrls,
    };
  }

  /**
   * Generate Supabase signed URLs for screenshots (5-minute TTL).
   * Falls back to null signedUrl if Supabase is not configured.
   */
  private async generateSignedUrls(screenshots: any[]): Promise<MultiGalleryScreenshot[]> {
    let supabaseClient: any = null;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const { StorageBuckets } = await import('../../storage-config');
      const { unifiedConfig } = await import('../../config/unifiedConfig');
      const supabaseUrl = unifiedConfig.supabaseUrl;
      const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
      if (supabaseUrl && supabaseKey) {
        supabaseClient = createClient(supabaseUrl, supabaseKey);
      }
      // Return both the client and bucket name for use below
      return await Promise.all(
        screenshots.map(async (s) => {
          let signedUrl: string | null = null;
          if (supabaseClient) {
            const { data, error } = await supabaseClient.storage
              .from(StorageBuckets.DISPUTES.name)
              .createSignedUrl(s.storage_path, 300);
            if (!error && data) {
              signedUrl = data.signedUrl;
            }
          }
          return {
            id: s.id,
            fileName: s.file_name,
            signedUrl,
            mimeType: s.mime_type,
            fileSize: s.file_size,
            uploadedAt: s.uploaded_at,
          };
        }),
      );
    } catch {
      // Supabase not configured — return screenshots without signed URLs
      return screenshots.map((s) => ({
        id: s.id,
        fileName: s.file_name,
        signedUrl: null,
        mimeType: s.mime_type,
        fileSize: s.file_size,
        uploadedAt: s.uploaded_at,
      }));
    }
  }

  /**
   * Check if a prospect is eligible for multi-gallery token issuance.
   * At least 1 sibling must be at preview_built/shown with screenshots.
   *
   * Used by the token issuance route as a gate.
   */
  async checkEligibility(prospectId: string, ctx?: RequestCtx): Promise<{
    eligible: boolean;
    siblingCount: number;
    eligibleCount: number;
  }> {
    const siblings = await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: prospectId, scope: 'business' } as any,
    }) as any[];

    if (siblings.length === 0) {
      return { eligible: false, siblingCount: 0, eligibleCount: 0 };
    }

    let eligibleCount = 0;
    for (const s of siblings) {
      if (!ELIGIBLE_STAGES.has(s.stage)) continue;
      const screenshotCount = await this.prisma.mkt_files_list.count({
        where: {
          campaign_id: s.id,
          file_type: 'diagnostic_screenshot',
        },
      });
      if (screenshotCount > 0) {
        eligibleCount++;
      }
    }

    return {
      eligible: eligibleCount > 0,
      siblingCount: siblings.length,
      eligibleCount,
    };
  }
}
