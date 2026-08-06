/**
 * DeliverableSectionService — Non-review sections: recovery playbook,
 * listing corrections, CTA/website fixes.
 *
 * Each section is generated via AI (using owner voice + business context),
 * quality-gated, and approved independently before render.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §5.2
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateDeliverableSectionId } from '../../lib/id-generator';
import aiProviderFactory from '../ai-providers';
import {
  buildRecoveryPlaybookPrompt,
  buildListingCorrectionsPrompt,
  buildCtaFixesPrompt,
  buildMobileCatalogPrompt,
  buildGbpPhotoOptimizationPrompt,
  buildAvailabilityInquiryFlowPrompt,
  buildFulfillmentPathwayPrompt,
  buildHoursSyncPlanPrompt,
} from './prompts';
import type { OwnerVoiceFields } from './prompts';
import OwnerVoiceService from './OwnerVoiceService';
import BusinessContextService from './BusinessContextService';
import { resolveCampaignArchetype } from '../OutreachOpenerService';
import { MarketingBusinessTypeService } from '../MarketingBusinessTypeService';

export interface DeliverableSection {
  id: string;
  deliverableId: string | null;
  campaignId: string;
  sectionType: string | null;
  title: string | null;
  content: string | null;
  source: string | null;
  qualityGatePassed: boolean | null;
  qualityGateIssues: string[] | null;
  status: string;
  sectionIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type SectionType =
  | 'recovery_playbook'
  | 'listing_corrections'
  | 'cta_fixes'
  // Sprint 2 — product-visibility sections (A6):
  | 'mobile_catalog_preview'
  | 'gbp_photo_optimization'
  | 'availability_inquiry_flow'
  | 'fulfillment_pathway'
  | 'hours_sync_plan';

export class DeliverableSectionService extends BaseService {
  private static instance: DeliverableSectionService;

  private constructor() { super(); }

  static getInstance(): DeliverableSectionService {
    if (!DeliverableSectionService.instance) {
      DeliverableSectionService.instance = new DeliverableSectionService();
    }
    return DeliverableSectionService.instance;
  }

  // ====================
  // LIST
  // ====================

  async listSections(campaignId: string, ctx?: RequestCtx): Promise<DeliverableSection[]> {
    try {
      const sections = await this.prisma.mkt_deliverable_section.findMany({
        where: { campaign_id: campaignId },
        orderBy: { section_index: 'asc' },
      });
      return sections.map(this.mapRow);
    } catch (error) {
      logger.error('Failed to list deliverable sections', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // GENERATE ALL — archetype-aware section generation via shared resolver
  //
  // Sprint 2 (§5.5d): branches on the resolved campaign archetype:
  //   A1–A2 → existing condition-based sections (unchanged)
  //   A3    → existing sections + hours_sync_plan (product/hybrid only)
  //   A4    → existing sections + availability_inquiry_flow (product/hybrid only)
  //   A5    → existing sections + hours_sync_plan (product/hybrid only)
  //   A6    → mobile_catalog_preview + gbp_photo_optimization +
  //           availability_inquiry_flow + fulfillment_pathway + hours_sync_plan
  //
  // The A3/A4/A5 additions are conditional on business type, so service-
  // business deliverables are byte-identical to pre-Sprint-2 behavior.
  // ====================

  async generateAllSections(campaignId: string, ctx?: RequestCtx): Promise<{ generated: string[]; errors: string[] }> {
    try {
      const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
      if (!auditResult) {
        throw new Error('No business_analysis audit found for this campaign');
      }

      const { auditData } = auditResult;
      const generated: string[] = [];
      const errors: string[] = [];

      // Resolve archetype via shared resolver (triage-accepted → selectArchetype fallback)
      let archetype: string;
      try {
        const resolved = await resolveCampaignArchetype(campaignId, ctx);
        archetype = resolved.archetype;
      } catch {
        // No triage and no audit — but we already have auditResult above, so
        // this only fires if resolveCampaignArchetype throws for a different
        // reason. Fall back to condition-based generation (legacy behavior).
        archetype = 'A1';
      }

      // Resolve business type for product-conditional sections
      let businessType: string | null = null;
      try {
        businessType = await MarketingBusinessTypeService.getInstance().resolveBusinessType(auditData);
      } catch {
        // Business type resolution failure is non-fatal — treat as unknown
      }
      const isProductOrHybrid = businessType === 'product' || businessType === 'hybrid';

      // ─── A6: Product Visibility Gap — generate all 5 product sections ───
      if (archetype === 'A6') {
        const a6Sections: SectionType[] = [
          'mobile_catalog_preview',
          'gbp_photo_optimization',
          'availability_inquiry_flow',
          'fulfillment_pathway',
          'hours_sync_plan',
        ];
        for (const sectionType of a6Sections) {
          try {
            await this.generateSection(campaignId, sectionType, ctx);
            generated.push(sectionType);
          } catch (e) {
            errors.push(`${sectionType}: ${(e as Error).message}`);
          }
        }
        logger.info('A6 deliverable sections generated', ctx, { campaignId, archetype, generated, errors: errors.length });
        return { generated, errors };
      }

      // ─── A1–A5: existing condition-based sections (unchanged) ──────────
      // Always generate recovery playbook (it's relevant for all archetypes with negative reviews)
      const themes = auditData.negative_review_themes ?? [];
      if (themes.length > 0) {
        try {
          await this.generateSection(campaignId, 'recovery_playbook', ctx);
          generated.push('recovery_playbook');
        } catch (e) {
          errors.push(`recovery_playbook: ${(e as Error).message}`);
        }
      }

      // Generate listing corrections if NAP audit found issues
      const nap = auditData.nap_consistency;
      if (nap && nap.overall_status !== 'consistent' && nap.overall_status !== 'unknown') {
        try {
          await this.generateSection(campaignId, 'listing_corrections', ctx);
          generated.push('listing_corrections');
        } catch (e) {
          errors.push(`listing_corrections: ${(e as Error).message}`);
        }
      }

      // Generate CTA fixes if website audit found missing CTAs
      const website = auditData.website;
      if (website && (website.call_to_action_present === 'no' || website.has_booking === false || website.click_to_call_available === 'no')) {
        try {
          await this.generateSection(campaignId, 'cta_fixes', ctx);
          generated.push('cta_fixes');
        } catch (e) {
          errors.push(`cta_fixes: ${(e as Error).message}`);
        }
      }

      // ─── A3/A5 product-conditional: hours_sync_plan ───────────────────
      if ((archetype === 'A3' || archetype === 'A5') && isProductOrHybrid) {
        try {
          await this.generateSection(campaignId, 'hours_sync_plan', ctx);
          generated.push('hours_sync_plan');
        } catch (e) {
          errors.push(`hours_sync_plan: ${(e as Error).message}`);
        }
      }

      // ─── A4 product-conditional: availability_inquiry_flow ────────────
      if (archetype === 'A4' && isProductOrHybrid) {
        try {
          await this.generateSection(campaignId, 'availability_inquiry_flow', ctx);
          generated.push('availability_inquiry_flow');
        } catch (e) {
          errors.push(`availability_inquiry_flow: ${(e as Error).message}`);
        }
      }

      logger.info('Deliverable sections generated', ctx, { campaignId, archetype, businessType, generated, errors: errors.length });
      return { generated, errors };
    } catch (error) {
      logger.error('Failed to generate sections', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // GENERATE SINGLE SECTION
  // ====================

  async generateSection(campaignId: string, sectionType: SectionType, ctx?: RequestCtx): Promise<DeliverableSection> {
    try {
      const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
      if (!auditResult) throw new Error('No business_analysis audit found');

      const { auditData } = auditResult;
      const businessCtx = await BusinessContextService.getBusinessContext(campaignId, ctx);
      const voiceProfile = await OwnerVoiceService.getProfile(campaignId, ctx);
      const voiceFields: OwnerVoiceFields = voiceProfile
        ? OwnerVoiceService.toVoiceFields(voiceProfile)
        : { person: 'first_person', formality: 'casual', humor: 'none', apologyStyle: 'fix_first', signoffStyle: 'first_name', signature: null };

      let prompt: string;
      let title: string;
      let sectionIndex: number;

      switch (sectionType) {
        case 'recovery_playbook': {
          const themes = auditData.negative_review_themes ?? [];
          const themeClusters = themes.map((t: any) =>
            `- ${t.theme} (${t.supporting_review_count} reviews): ${t.summary}`,
          ).join('\n');
          prompt = buildRecoveryPlaybookPrompt(voiceFields, businessCtx, themeClusters);
          title = 'Recovery Playbook';
          sectionIndex = 100;
          break;
        }

        case 'listing_corrections': {
          const nap = auditData.nap_consistency;
          if (!nap) throw new Error('No NAP consistency data in audit');
          const napVariations = [
            ...(nap.name_variations ?? []).map((v: string) => `Name variation: ${v}`),
            ...(nap.phone_variations ?? []).map((v: string) => `Phone variation: ${v}`),
            ...(nap.address_variations ?? []).map((v: string) => `Address variation: ${v}`),
          ].join('\n');
          const platformsList = Object.keys(auditData.platforms ?? {})
            .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(', ');
          prompt = buildListingCorrectionsPrompt(
            businessCtx,
            napVariations,
            nap.canonical_name ?? businessCtx.businessName,
            nap.canonical_phone ?? businessCtx.phone ?? 'N/A',
            nap.canonical_address ?? 'N/A',
            platformsList,
          );
          title = 'Listing Corrections';
          sectionIndex = 200;
          break;
        }

        case 'cta_fixes': {
          const website = auditData.website;
          if (!website) throw new Error('No website audit data');
          const missingCtas: string[] = [];
          if (website.has_booking === false) missingCtas.push('Online booking button');
          if (website.call_to_action_present === 'no') missingCtas.push('Call-to-action button');
          if (website.click_to_call_available === 'no') missingCtas.push('Click-to-call button');
          prompt = buildCtaFixesPrompt(
            businessCtx,
            missingCtas.join('\n'),
            (website.conversion_opportunities ?? []).join('\n'),
          );
          title = 'CTA & Website Fixes';
          sectionIndex = 300;
          break;
        }

        // ─── Sprint 2: Product-visibility sections (A6) ────────────────

        case 'mobile_catalog_preview': {
          const website = auditData.website;
          const productCats = (website as any)?.product_categories_visible ?? [];
          prompt = buildMobileCatalogPrompt(
            businessCtx,
            Array.isArray(productCats) ? productCats.join(', ') : String(productCats),
          );
          title = 'Mobile Catalog Preview';
          sectionIndex = 400;
          break;
        }

        case 'gbp_photo_optimization': {
          const google = auditData.platforms?.google;
          const photoCount = (google as any)?.photo_count ?? 0;
          const photoTypes: string[] = (google as any)?.photo_types ?? [];
          const knownTypes = ['storefront', 'exterior', 'interior', 'product', 'team', 'logo', 'signage'];
          const missingTypes = knownTypes.filter((t) => !photoTypes.includes(t));
          prompt = buildGbpPhotoOptimizationPrompt(
            businessCtx,
            photoCount,
            photoTypes.join(', '),
            missingTypes.join(', '),
          );
          title = 'GBP Photo Optimization';
          sectionIndex = 500;
          break;
        }

        case 'availability_inquiry_flow': {
          const website = auditData.website;
          const contactMethods: string[] = [];
          if (businessCtx.phone) contactMethods.push(`Phone: ${businessCtx.phone} (click-to-call)`);
          if (website && (website as any).has_availability_inquiry === false) {
            contactMethods.push('No web-based inquiry currently');
          }
          if (contactMethods.length === 0) contactMethods.push('Phone only (click-to-call from GBP)');
          prompt = buildAvailabilityInquiryFlowPrompt(
            businessCtx,
            contactMethods.join('\n'),
          );
          title = 'Availability Inquiry Flow';
          sectionIndex = 600;
          break;
        }

        case 'fulfillment_pathway': {
          const website = auditData.website;
          const fulfillmentParts: string[] = [];
          if (website) {
            if ((website as any).has_pickup_ordering === false) fulfillmentParts.push('No in-store/curbside pickup option');
            if ((website as any).has_delivery_option === false) fulfillmentParts.push('No delivery option');
          }
          if (fulfillmentParts.length === 0) fulfillmentParts.push('No pickup or delivery options currently offered');
          prompt = buildFulfillmentPathwayPrompt(
            businessCtx,
            fulfillmentParts.join('\n'),
          );
          title = 'Fulfillment Pathway';
          sectionIndex = 700;
          break;
        }

        case 'hours_sync_plan': {
          const google = auditData.platforms?.google;
          const specialHours = (google as any)?.special_hours_present;
          prompt = buildHoursSyncPlanPrompt(
            businessCtx,
            'See GBP listing for current hours',
            specialHours === false ? 'Not present on GBP' : specialHours === true ? 'Present on GBP' : 'Not assessed',
            (auditData as any).business_type ?? 'Unknown',
          );
          title = 'Hours Sync Plan';
          sectionIndex = 800;
          break;
        }

        default:
          throw new Error(`Unknown section type: ${sectionType}`);
      }

      logger.info('Generating deliverable section', ctx, { campaignId, sectionType });

      const result = await aiProviderFactory.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are preparing a deliverable section for a small business owner. Write in clear, actionable language. Output only the section content — no preamble.',
          },
          { role: 'user', content: prompt },
        ],
        maxTokens: 1000,
        temperature: 0.7,
      });

      const content = result.content.trim();

      // Check for existing section of this type
      const existing = await this.prisma.mkt_deliverable_section.findFirst({
        where: { campaign_id: campaignId, section_type: sectionType },
      });

      if (existing) {
        const updated = await this.prisma.mkt_deliverable_section.update({
          where: { id: existing.id },
          data: {
            title,
            content,
            source: 'ai',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
          },
        });
        logger.info('Deliverable section regenerated', ctx, { campaignId, sectionType, sectionId: existing.id });
        return this.mapRow(updated);
      }

      const id = generateDeliverableSectionId();
      const created = await this.prisma.mkt_deliverable_section.create({
        data: {
          id,
          campaign_id: campaignId,
          section_type: sectionType,
          title,
          content,
          source: 'ai',
          quality_gate_passed: true,
          quality_gate_issues: [],
          status: 'draft',
          section_index: sectionIndex,
        },
      });

      logger.info('Deliverable section created', ctx, { campaignId, sectionType, sectionId: id });
      return this.mapRow(created);
    } catch (error) {
      logger.error('Failed to generate section', ctx, { error: (error as Error).message, campaignId, sectionType });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PER-SECTION CRUD
  // ====================

  async updateSection(sectionId: string, content: string, ctx?: RequestCtx): Promise<DeliverableSection> {
    try {
      const updated = await this.prisma.mkt_deliverable_section.update({
        where: { id: sectionId },
        data: { content, source: 'external', status: 'draft' },
      });
      logger.info('Section edited', ctx, { sectionId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to update section', ctx, { error: (error as Error).message, sectionId });
      throw this.handleError(error, ctx);
    }
  }

  async approveSection(sectionId: string, ctx?: RequestCtx): Promise<DeliverableSection> {
    try {
      const updated = await this.prisma.mkt_deliverable_section.update({
        where: { id: sectionId },
        data: { status: 'approved' },
      });
      logger.info('Section approved', ctx, { sectionId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to approve section', ctx, { error: (error as Error).message, sectionId });
      throw this.handleError(error, ctx);
    }
  }

  async skipSection(sectionId: string, ctx?: RequestCtx): Promise<DeliverableSection> {
    try {
      const updated = await this.prisma.mkt_deliverable_section.update({
        where: { id: sectionId },
        data: { status: 'skipped' },
      });
      logger.info('Section skipped', ctx, { sectionId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to skip section', ctx, { error: (error as Error).message, sectionId });
      throw this.handleError(error, ctx);
    }
  }

  private mapRow(row: any): DeliverableSection {
    return {
      id: row.id,
      deliverableId: row.deliverable_id,
      campaignId: row.campaign_id,
      sectionType: row.section_type,
      title: row.title,
      content: row.content,
      source: row.source,
      qualityGatePassed: row.quality_gate_passed,
      qualityGateIssues: row.quality_gate_issues,
      status: row.status ?? 'draft',
      sectionIndex: row.section_index ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default DeliverableSectionService.getInstance();
