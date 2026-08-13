/**
 * PitchService — Assembles the full outreach pitch from component variants
 *
 * Fetches each component (opener, header, closer, contact) by ID, renders
 * the assembled pitch text in the fixed format via renderPitchText, and
 * persists to mkt_outreach_pitches_list with full provenance:
 *   - which variant of each component was used
 *   - which review/response pairs (stored as JSON on the pitch row)
 *   - who assembled it, when
 *
 * The opener is required (the handshake). Header, closer, and contact are
 * optional (nullable FKs) — the pitch can be assembled with just the opener
 * + preview if the operator chooses.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §5.5
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { NotFoundError } from '../../middleware/errorHandler';
import { generateOutreachPitchId } from '../../lib/id-generator';
import { renderPitchText, type ReviewPair, type AssemblePitchInput } from './pitch-renderer';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PitchResult {
  pitch: any;
  assembledText: string;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class PitchService extends BaseService {
  private static instance: PitchService;

  private constructor() {
    super();
  }

  static getInstance(): PitchService {
    if (!PitchService.instance) {
      PitchService.instance = new PitchService();
    }
    return PitchService.instance;
  }

  // ====================
  // ASSEMBLE
  // ====================

  /**
   * Assemble a full pitch from component variant IDs + review/response pairs.
   *
   * 1. Fetch each component by ID (opener required; header/closer/contact optional)
   * 2. Render the assembled text via renderPitchText (enforces negative-first ordering)
   * 3. Persist to mkt_outreach_pitches_list with all variant IDs + review_pairs JSON
   */
  async assemblePitch(input: AssemblePitchInput, ctx?: RequestCtx): Promise<PitchResult> {
    // ── Fetch opener (required) ──
    const opener = await this.prisma.mkt_outreach_openers_list.findUnique({
      where: { id: input.openerId },
    });
    if (!opener) {
      throw new NotFoundError(`Opener ${input.openerId} not found`);
    }
    if (!opener.opener_text) {
      throw new Error(`Opener ${input.openerId} has no opener_text`);
    }

    // ── Fetch header (optional) ──
    let header: any = null;
    if (input.headerId) {
      header = await this.prisma.mkt_outreach_headers_list.findUnique({
        where: { id: input.headerId },
      });
      if (!header) {
        throw new NotFoundError(`Header ${input.headerId} not found`);
      }
    }

    // ── Fetch closer (optional) ──
    let closer: any = null;
    if (input.closerId) {
      closer = await this.prisma.mkt_outreach_closers_list.findUnique({
        where: { id: input.closerId },
      });
      if (!closer) {
        throw new NotFoundError(`Closer ${input.closerId} not found`);
      }
    }

    // ── Fetch contact (optional) ──
    let contact: any = null;
    if (input.contactId) {
      contact = await this.prisma.mkt_outreach_contacts_list.findUnique({
        where: { id: input.contactId },
      });
      if (!contact) {
        throw new NotFoundError(`Contact ${input.contactId} not found`);
      }
    }

    // ── Validate preview pairs ──
    // The 3-slot preview generalizes beyond review responses — the wire
    // format uses review_text (evidence) / response_text (fix), but the
    // operator-visible content depends on the archetype (listing
    // corrections, CTA fixes, product-visibility fixes, etc.). The
    // validation messages use the generic "evidence"/"fix" terminology
    // so they read correctly for every archetype.
    if (!input.reviewPairs || input.reviewPairs.length === 0) {
      throw new Error('At least one preview pair is required for the preview');
    }
    for (const pair of input.reviewPairs) {
      if (!pair.review_text?.trim()) {
        throw new Error('Every preview pair must have evidence text');
      }
      if (!pair.response_text?.trim()) {
        throw new Error('Every preview pair must have fix text');
      }
    }

    // ── Render the assembled pitch text ──
    const assembledText = renderPitchText({
      openerText: opener.opener_text,
      headerText: header?.header_text ?? null,
      reviewPairs: input.reviewPairs,
      closerText: closer?.closer_text ?? null,
      contactText: contact?.contact_text ?? null,
    });

    // ── Persist ──
    const pitch = await this.prisma.mkt_outreach_pitches_list.create({
      data: {
        id: generateOutreachPitchId(),
        campaign_id: input.campaignId,
        opener_id: input.openerId,
        header_id: input.headerId || null,
        closer_id: input.closerId || null,
        contact_id: input.contactId || null,
        review_pairs: input.reviewPairs as any,
        assembled_text: assembledText,
        created_by: input.createdBy || null,
      },
    });

    logger.info('Outreach pitch assembled', ctx, {
      pitchId: pitch.id,
      campaignId: input.campaignId,
      openerId: input.openerId,
      headerId: input.headerId,
      closerId: input.closerId,
      contactId: input.contactId,
      reviewPairCount: input.reviewPairs.length,
      assembledLength: assembledText.length,
    });

    // Fire-and-forget: auto-complete checklist outreach steps
    import('../OutreachChecklistBridgeService')
      .then(({ default: bridge }) =>
        bridge.onOutreachArtifactCreated(input.campaignId, 'pitch', input.createdBy ?? 'system', ctx),
      )
      .catch((err) => {
        logger.warn('Pitch bridge auto-complete failed (swallowed)', ctx, {
          error: (err as Error).message,
          campaignId: input.campaignId,
        });
      });

    return { pitch, assembledText };
  }

  // ====================
  // READ
  // ====================

  async listPitches(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_outreach_pitches_list.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list outreach pitches', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getPitch(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_outreach_pitches_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get outreach pitch', ctx, {
        error: (error as Error).message,
        pitchId: id,
      });
      throw this.handleError(error, ctx);
    }
  }
}

export default PitchService.getInstance();
