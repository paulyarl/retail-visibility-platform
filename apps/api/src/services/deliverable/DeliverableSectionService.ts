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
import { MarketingExecutionService } from '../MarketingExecutionService';
import { ownerVoiceVariables, businessContextVariables } from './prompts';
import type { OwnerVoiceFields, BusinessContextFields } from './prompts';
import OwnerVoiceService from './OwnerVoiceService';
import BusinessContextService from './BusinessContextService';
import { resolveCampaignArchetype } from '../OutreachOpenerService';
import { MarketingBusinessTypeService } from '../MarketingBusinessTypeService';

const DEFAULT_VOICE_FIELDS: OwnerVoiceFields = {
  person: 'first_person',
  formality: 'casual',
  humor: 'none',
  apologyStyle: 'fix_first',
  signoffStyle: 'first_name',
  signature: null,
};

/**
 * Prompt-execution templates per section type (seeded by
 * scripts/seed-deliverable-construction-templates.ts). One template per
 * type keeps each hop's prompt body the single source of truth — the
 * external lane renders the identical prompt via renderSectionPrompt and
 * writes the answer back through updateSection (source: 'external').
 */
const SECTION_TEMPLATE_IDS: Record<SectionType, string> = {
  recovery_playbook: 'mpt-deliverable-section-recovery-playbook',
  listing_corrections: 'mpt-deliverable-section-listing-corrections',
  cta_fixes: 'mpt-deliverable-section-cta-fixes',
  mobile_catalog_preview: 'mpt-deliverable-section-mobile-catalog',
  gbp_photo_optimization: 'mpt-deliverable-section-gbp-photo',
  availability_inquiry_flow: 'mpt-deliverable-section-availability-inquiry',
  fulfillment_pathway: 'mpt-deliverable-section-fulfillment-pathway',
  hours_sync_plan: 'mpt-deliverable-section-hours-sync',
  positioning_report: 'mpt-deliverable-section-positioning-report',
  homepage_mockup: 'mpt-deliverable-section-homepage-mockup',
  domain_migration_plan: 'mpt-deliverable-section-domain-migration',
};

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
  | 'hours_sync_plan'
  // PB-08 — website-gap sections (A7):
  | 'positioning_report'
  | 'homepage_mockup'
  | 'domain_migration_plan';

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
  //   A7    → positioning_report + homepage_mockup + domain_migration_plan
  //
  // The A3/A4/A5 additions are conditional on business type, so service-
  // business deliverables are byte-identical to pre-Sprint-2 behavior.
  // ====================

  /**
   * Latest website_positioning audit data for A7 section prompts. The
   * positioning audit owns the WC_* dimension — when present, its
   * presence_classification, issues[].conversion_implication, positioning_gaps
   * and build_scope are the canonical inputs (spec §8.3); the derived
   * describeWebPresence/mustHavePages paths are the fallback for campaigns
   * that haven't run it yet.
   */
  private async getWebsitePositioningAuditData(campaignId: string): Promise<any | null> {
    const row = await this.prisma.mkt_audits_list.findFirst({
      where: { campaign_id: campaignId, platform: 'website_positioning' },
      orderBy: { created_at: 'desc' },
      select: { audit_data: true },
    });
    return (row?.audit_data as any) ?? null;
  }

  /**
   * Describe the current web presence for A7 section prompts. Prefers the
   * website_positioning audit (presence_classification + conversion-framed
   * issues + positioning gaps); falls back to the business audit's website
   * block + any model-emitted signals. Pure over its inputs.
   */
  private describeWebPresence(auditData: any, websiteAudit?: any): { presenceState: string; gapFindings: string } {
    if (websiteAudit?.presence_classification) {
      const PRESENCE_LABELS: Record<string, string> = {
        no_presence: 'No owned website exists',
        third_party_only: 'A social/third-party page is standing in for the website',
        builder_subdomain: 'The site lives on a free builder subdomain',
        parked: 'The domain is parked / not a live site',
        unfinished: 'The site is unfinished (coming-soon page)',
        broken: 'The website link is dead',
        present: 'A working site exists',
      };
      const presenceState = PRESENCE_LABELS[websiteAudit.presence_classification] ?? String(websiteAudit.presence_classification);
      const issues = (websiteAudit.issues ?? []).map((i: any) =>
        i?.conversion_implication ? `${i.issue} — ${i.conversion_implication}` : i?.issue,
      );
      const gaps = (websiteAudit.positioning_gaps ?? []).map((g: any) =>
        g?.gap_description ?? (g?.field ? `${g.field}: expected ${g.expected}, found ${g.actual}` : null),
      );
      const gapFindings = [...issues, ...gaps].filter(Boolean).join('; ');
      return { presenceState, gapFindings: gapFindings || 'None recorded' };
    }

    const w = auditData?.website;
    const status = w?.status?.toLowerCase();
    const detected: string[] = Array.isArray(auditData?.detected_signals) ? auditData.detected_signals : [];
    let presenceState = 'No owned website detected';
    if (w?.url && status !== 'none_found') {
      if (status === 'social_media_only') presenceState = `A social page is standing in for the website (${w.url})`;
      else if (status === 'broken') presenceState = `The website link is dead (${w.url})`;
      else if (detected.includes('WC_PARKED_DOMAIN')) presenceState = 'The domain is parked / not a live site';
      else if (detected.includes('WC_UNFINISHED_SITE')) presenceState = 'The site is unfinished (coming-soon page)';
      else if (detected.includes('WC_BUILDER_SUBDOMAIN')) presenceState = `The site is on a free builder subdomain (${w.url})`;
      else presenceState = `A site exists at ${w.url}`;
    }
    const gapFindings = detected.filter((c) => c.startsWith('WC_')).join(', ');
    return { presenceState, gapFindings };
  }

  /** Must-have page list for the A7 homepage mockup prompt — prefers the
   *  website_positioning audit's build_scope, falls back to a business-type
   *  heuristic. */
  private mustHavePages(auditData: any, websiteAudit?: any): string {
    const fromAudit = websiteAudit?.build_scope?.must_have_pages;
    if (Array.isArray(fromAudit) && fromAudit.length > 0) return fromAudit.join(', ');
    const type = auditData?.business_type;
    if (type === 'product' || type === 'hybrid') {
      return 'Home, Product Categories, Availability/Inquiry, Hours & Location, About, Contact';
    }
    return 'Home, Services, About, Hours & Location, Contact';
  }

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

      // ─── A7: Website Gap — positioning report + homepage mockup + domain plan ─
      if (archetype === 'A7') {
        const a7Sections: SectionType[] = [
          'positioning_report',
          'homepage_mockup',
          'domain_migration_plan',
        ];
        for (const sectionType of a7Sections) {
          try {
            await this.generateSection(campaignId, sectionType, ctx);
            generated.push(sectionType);
          } catch (e) {
            errors.push(`${sectionType}: ${(e as Error).message}`);
          }
        }
        logger.info('A7 deliverable sections generated', ctx, { campaignId, archetype, generated, errors: errors.length });
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

  /**
   * Per-type input assembly shared by generateSection (internal lane) and
   * renderSectionPrompt (external lane). Produces the {{variable}} map the
   * section template consumes — the same values (and defaults) the legacy
   * prompt builders substituted — plus the section title/index metadata.
   */
  private async buildSectionInputs(input: {
    campaignId: string;
    sectionType: SectionType;
    auditData: any;
    businessCtx: BusinessContextFields;
    voiceFields: OwnerVoiceFields;
  }): Promise<{ variables: Record<string, string>; title: string; sectionIndex: number }> {
    const { campaignId, sectionType, auditData, businessCtx, voiceFields } = input;
    const ctxVars = businessContextVariables(businessCtx);
    const voiceVars = ownerVoiceVariables(voiceFields);

    switch (sectionType) {
      case 'recovery_playbook': {
        const themes = auditData.negative_review_themes ?? [];
        const themeClusters = themes.map((t: any) =>
          `- ${t.theme} (${t.supporting_review_count} reviews): ${t.summary}`,
        ).join('\n');
        return {
          variables: { ...ctxVars, ...voiceVars, theme_clusters: themeClusters },
          title: 'Recovery Playbook',
          sectionIndex: 100,
        };
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
        return {
          variables: {
            ...ctxVars,
            nap_variations: napVariations,
            canonical_name: nap.canonical_name ?? businessCtx.businessName,
            canonical_phone: nap.canonical_phone ?? businessCtx.phone ?? 'N/A',
            canonical_address: nap.canonical_address ?? 'N/A',
            platforms_list: platformsList,
          },
          title: 'Listing Corrections',
          sectionIndex: 200,
        };
      }

      case 'cta_fixes': {
        const website = auditData.website;
        if (!website) throw new Error('No website audit data');
        const missingCtas: string[] = [];
        if (website.has_booking === false) missingCtas.push('Online booking button');
        if (website.call_to_action_present === 'no') missingCtas.push('Call-to-action button');
        if (website.click_to_call_available === 'no') missingCtas.push('Click-to-call button');
        return {
          variables: {
            ...ctxVars,
            website_url: businessCtx.websiteUrl ?? 'N/A',
            missing_ctas: missingCtas.join('\n'),
            conversion_opportunities: (website.conversion_opportunities ?? []).join('\n'),
          },
          title: 'CTA & Website Fixes',
          sectionIndex: 300,
        };
      }

      // ─── Sprint 2: Product-visibility sections (A6) ────────────────

      case 'mobile_catalog_preview': {
        const website = auditData.website;
        const productCats = (website as any)?.product_categories_visible ?? [];
        const productCategories = Array.isArray(productCats) ? productCats.join(', ') : String(productCats);
        return {
          variables: {
            ...ctxVars,
            product_categories: productCategories ||
              'Not specified — infer from business category (e.g., for a grocery store: Produce, Grains & Rice, Spices & Seasonings, Sauces & Condiments, Frozen Foods, Beverages, Household Goods)',
          },
          title: 'Mobile Catalog Preview',
          sectionIndex: 400,
        };
      }

      case 'gbp_photo_optimization': {
        const google = auditData.platforms?.google;
        const photoCount = (google as any)?.photo_count ?? 0;
        const photoTypes: string[] = (google as any)?.photo_types ?? [];
        const knownTypes = ['storefront', 'exterior', 'interior', 'product', 'team', 'logo', 'signage'];
        const missingTypes = knownTypes.filter((t) => !photoTypes.includes(t));
        return {
          variables: {
            ...ctxVars,
            photo_count: String(photoCount),
            photo_types_present: photoTypes.join(', ') || 'None detected',
            photo_types_missing: missingTypes.join(', ') || 'All types needed',
          },
          title: 'GBP Photo Optimization',
          sectionIndex: 500,
        };
      }

      case 'availability_inquiry_flow': {
        const website = auditData.website;
        const contactMethods: string[] = [];
        if (businessCtx.phone) contactMethods.push(`Phone: ${businessCtx.phone} (click-to-call)`);
        if (website && (website as any).has_availability_inquiry === false) {
          contactMethods.push('No web-based inquiry currently');
        }
        if (contactMethods.length === 0) contactMethods.push('Phone only (click-to-call from GBP)');
        return {
          variables: { ...ctxVars, contact_methods: contactMethods.join('\n') },
          title: 'Availability Inquiry Flow',
          sectionIndex: 600,
        };
      }

      case 'fulfillment_pathway': {
        const website = auditData.website;
        const fulfillmentParts: string[] = [];
        if (website) {
          if ((website as any).has_pickup_ordering === false) fulfillmentParts.push('No in-store/curbside pickup option');
          if ((website as any).has_delivery_option === false) fulfillmentParts.push('No delivery option');
        }
        if (fulfillmentParts.length === 0) fulfillmentParts.push('No pickup or delivery options currently offered');
        return {
          variables: { ...ctxVars, fulfillment_status: fulfillmentParts.join('\n') },
          title: 'Fulfillment Pathway',
          sectionIndex: 700,
        };
      }

      case 'hours_sync_plan': {
        const google = auditData.platforms?.google;
        const specialHours = (google as any)?.special_hours_present;
        return {
          variables: {
            ...ctxVars,
            regular_hours_status: 'See GBP listing for current hours',
            special_hours_status: specialHours === false ? 'Not present on GBP' : specialHours === true ? 'Present on GBP' : 'Not assessed',
            business_type: (auditData as any).business_type ?? 'Unknown',
          },
          title: 'Hours Sync Plan',
          sectionIndex: 800,
        };
      }

      // ─── PB-08: Website-gap sections (A7) ──────────────────────────

      case 'positioning_report': {
        const websiteAudit = await this.getWebsitePositioningAuditData(campaignId);
        const { presenceState, gapFindings } = this.describeWebPresence(auditData, websiteAudit);
        return {
          variables: {
            ...ctxVars,
            presence_state: presenceState || 'No owned website detected',
            gap_findings: gapFindings || 'None recorded',
          },
          title: 'Web Presence Report',
          sectionIndex: 900,
        };
      }

      case 'homepage_mockup': {
        const websiteAudit = await this.getWebsitePositioningAuditData(campaignId);
        const { presenceState } = this.describeWebPresence(auditData, websiteAudit);
        const mustHave = this.mustHavePages(auditData, websiteAudit);
        return {
          variables: {
            ...ctxVars,
            presence_state: presenceState || 'No owned website detected',
            must_have_pages: mustHave || 'Home, Services/Products, About, Contact',
          },
          title: 'Homepage Mockup',
          sectionIndex: 910,
        };
      }

      case 'domain_migration_plan': {
        const websiteAudit = await this.getWebsitePositioningAuditData(campaignId);
        const { presenceState } = this.describeWebPresence(auditData, websiteAudit);
        const scope = websiteAudit?.build_scope;
        const buildScope = scope
          ? [scope.recommended, scope.scope_notes].filter(Boolean).join(' — ')
          : undefined;
        return {
          variables: {
            ...ctxVars,
            presence_state: presenceState || 'No owned website detected',
            build_scope: buildScope ? `Recommended build scope: ${buildScope}` : '',
          },
          title: 'Domain Migration Plan',
          sectionIndex: 920,
        };
      }

      default:
        throw new Error(`Unknown section type: ${sectionType}`);
    }
  }

  /**
   * Shared context for both lanes — audit data, business context, and the
   * owner voice profile (defaulting when none is set).
   */
  private async buildSectionContext(campaignId: string, ctx?: RequestCtx): Promise<{
    auditData: any;
    businessCtx: BusinessContextFields;
    voiceFields: OwnerVoiceFields;
  }> {
    const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
    if (!auditResult) throw new Error('No business_analysis audit found');

    const businessCtx = await BusinessContextService.getBusinessContext(campaignId, ctx);
    const voiceProfile = await OwnerVoiceService.getProfile(campaignId, ctx);
    const voiceFields: OwnerVoiceFields = voiceProfile
      ? OwnerVoiceService.toVoiceFields(voiceProfile)
      : DEFAULT_VOICE_FIELDS;

    return { auditData: auditResult.auditData, businessCtx, voiceFields };
  }

  /**
   * External lane — render the section's prompt with the same
   * server-assembled variables generateSection uses, for copy/paste into
   * an external LLM. The external answer is written back through
   * updateSection (source: 'external').
   */
  async renderSectionPrompt(campaignId: string, sectionType: SectionType, ctx?: RequestCtx): Promise<string> {
    try {
      const { auditData, businessCtx, voiceFields } = await this.buildSectionContext(campaignId, ctx);
      const { variables } = await this.buildSectionInputs({ campaignId, sectionType, auditData, businessCtx, voiceFields });
      return MarketingExecutionService.getInstance().renderPrompt({
        campaignId,
        templateId: SECTION_TEMPLATE_IDS[sectionType],
        variables,
      }, ctx);
    } catch (error) {
      logger.error('Failed to render section prompt', ctx, { error: (error as Error).message, campaignId, sectionType });
      throw this.handleError(error, ctx);
    }
  }

  async generateSection(campaignId: string, sectionType: SectionType, ctx?: RequestCtx): Promise<DeliverableSection> {
    try {
      const { auditData, businessCtx, voiceFields } = await this.buildSectionContext(campaignId, ctx);
      const { variables, title, sectionIndex } = await this.buildSectionInputs({
        campaignId, sectionType, auditData, businessCtx, voiceFields,
      });

      logger.info('Generating deliverable section', ctx, { campaignId, sectionType });

      // Normalized analyst hop — shared prompt-execution lane. Persists an
      // execution record per section with model/token provenance.
      const execution = await MarketingExecutionService.getInstance().executeSingle({
        campaignId,
        templateId: SECTION_TEMPLATE_IDS[sectionType],
        variables,
        executedBy: ctx?.userId,
      }, ctx);

      const content = (execution.filtered_output ?? execution.raw_output ?? '').trim();

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
