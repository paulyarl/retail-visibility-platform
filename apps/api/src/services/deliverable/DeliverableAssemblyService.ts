/**
 * DeliverableAssemblyService — Assembles all approved sections into a
 * single content block ready for rendering. Checks that all slots are
 * approved or skipped before allowing assembly.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §2.6
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';

export interface AssemblyResult {
  content: string;
  slotCount: number;
  sectionCount: number;
  skippedSlots: number;
  skippedSections: number;
}

export interface AssemblyStatus {
  ready: boolean;
  totalSlots: number;
  approvedSlots: number;
  draftSlots: number;
  skippedSlots: number;
  totalSections: number;
  approvedSections: number;
  draftSections: number;
  skippedSections: number;
  missingApprovals: string[];
}

export class DeliverableAssemblyService extends BaseService {
  private static instance: DeliverableAssemblyService;

  private constructor() { super(); }

  static getInstance(): DeliverableAssemblyService {
    if (!DeliverableAssemblyService.instance) {
      DeliverableAssemblyService.instance = new DeliverableAssemblyService();
    }
    return DeliverableAssemblyService.instance;
  }

  /**
   * Check if the deliverable is ready to render (all slots and sections
   * are either approved or skipped).
   */
  async getAssemblyStatus(campaignId: string, ctx?: RequestCtx): Promise<AssemblyStatus> {
    try {
      const slots = await this.prisma.mkt_deliverable_review_slot.findMany({
        where: { campaign_id: campaignId },
        orderBy: { slot_index: 'asc' },
      });
      const sections = await this.prisma.mkt_deliverable_section.findMany({
        where: { campaign_id: campaignId },
        orderBy: { section_index: 'asc' },
      });

      const approvedSlots = slots.filter((s) => s.status === 'approved').length;
      const draftSlots = slots.filter((s) => s.status === 'draft').length;
      const skippedSlots = slots.filter((s) => s.status === 'skipped').length;

      const approvedSections = sections.filter((s) => s.status === 'approved').length;
      const draftSections = sections.filter((s) => s.status === 'draft').length;
      const skippedSections = sections.filter((s) => s.status === 'skipped').length;

      const missingApprovals: string[] = [];
      if (draftSlots > 0) missingApprovals.push(`${draftSlots} review slot(s) still in draft`);
      if (draftSections > 0) missingApprovals.push(`${draftSections} section(s) still in draft`);

      return {
        ready: draftSlots === 0 && draftSections === 0,
        totalSlots: slots.length,
        approvedSlots,
        draftSlots,
        skippedSlots,
        totalSections: sections.length,
        approvedSections,
        draftSections,
        skippedSections,
        missingApprovals,
      };
    } catch (error) {
      logger.error('Failed to get assembly status', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Assemble all approved sections into a single content block.
   * Throws if any slots or sections are still in draft status.
   */
  async assemble(campaignId: string, ctx?: RequestCtx): Promise<AssemblyResult> {
    try {
      const status = await this.getAssemblyStatus(campaignId, ctx);
      if (!status.ready) {
        throw new Error(
          `Cannot assemble — ${status.missingApprovals.join(', ')}. ` +
          'Approve or skip all items before rendering.',
        );
      }

      // Fetch approved slots (sorted by slot_index)
      const slots = await this.prisma.mkt_deliverable_review_slot.findMany({
        where: { campaign_id: campaignId, status: 'approved' },
        orderBy: { slot_index: 'asc' },
      });

      // Fetch approved sections (sorted by section_index)
      const sections = await this.prisma.mkt_deliverable_section.findMany({
        where: { campaign_id: campaignId, status: 'approved' },
        orderBy: { section_index: 'asc' },
      });

      // Fetch campaign for header info
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      // Assemble content
      const parts: string[] = [];

      // Header
      parts.push(`${campaign.business_name ?? 'Business'} — Review Response Deliverable`);
      parts.push(`${campaign.category} · ${campaign.city}${campaign.state ? ', ' + campaign.state : ''}`);
      parts.push(`Generated: ${new Date().toLocaleDateString()}`);
      parts.push('');
      parts.push('---');
      parts.push('');

      // Section 1: Review Responses
      parts.push('REVIEW RESPONSES');
      parts.push('');
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        parts.push(`Review #${i + 1}`);
        parts.push(`Platform: ${slot.platform ?? 'Unknown'} · Rating: ${slot.review_rating ?? 'N/A'}★ · Date: ${slot.review_date ? slot.review_date.toISOString().split('T')[0] : 'N/A'}`);
        parts.push('');
        parts.push('Customer Review:');
        parts.push(slot.review_text ?? '');
        parts.push('');
        parts.push('Owner Response:');
        parts.push(slot.response_text ?? '');
        parts.push('');
        parts.push('---');
        parts.push('');
      }

      // Remaining sections (playbook, corrections, CTA)
      for (const section of sections) {
        if (section.title) {
          parts.push(section.title.toUpperCase());
          parts.push('');
        }
        parts.push(section.content ?? '');
        parts.push('');
        parts.push('---');
        parts.push('');
      }

      const content = parts.join('\n');

      logger.info('Deliverable assembled', ctx, {
        campaignId,
        slotCount: slots.length,
        sectionCount: sections.length,
        contentLength: content.length,
      });

      return {
        content,
        slotCount: slots.length,
        sectionCount: sections.length,
        skippedSlots: status.skippedSlots,
        skippedSections: status.skippedSections,
      };
    } catch (error) {
      logger.error('Failed to assemble deliverable', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }
}

export default DeliverableAssemblyService.getInstance();
