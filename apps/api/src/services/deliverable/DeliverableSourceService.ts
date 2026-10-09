/**
 * DeliverableSourceService — Signal-gated source material for the eight
 * deliverable types.
 *
 * Pipeline (spec §3.1):
 *   audit → detected_signals[] → SignalExtractor → SignalCode[]
 *     → post-audit analyst prompt (deliverable_source_material)
 *     → per-type fulfill prompt → MarketingDeliverableService render
 *
 * Review-bearing types (review_responses, testimonial_cards) are sourced from
 * the operator-pasted review intake prompt (spec §5.7, G-1 Option D) because
 * business_analysis emits no verbatim review text.
 *
 * Pattern: singleton extends BaseService
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md
 */

import { createHash } from 'crypto';
import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { MarketingExecutionService } from '../MarketingExecutionService';
import { MarketingPromptService } from '../MarketingPromptService';
import { extractSignals } from '../triage/signal-extractor';
import type { SignalCode } from '../triage/signal-taxonomy';
import type { DeliverableType } from '../MarketingDeliverableService';
import {
  deliverableSourceMaterialSchema,
  type DeliverableSourceMaterial,
} from '../../validators/deliverable-source-material.schema';
import { reviewIntakeSchema, type ReviewIntake } from '../../validators/review-intake.schema';
import {
  resolveCampaignSeedId,
  resolveClaimUrlForSeed,
  buildOutreachLinkVars,
  resolveIntakeLinkVarsForCampaign,
} from '../outreach-openers/outreach-link-vars';
import {
  runDeliverableQualityGate,
  runRepetitionGate,
} from './deliverable-quality-gate';
import { buildClaimCta } from './deliverable-cta';

// ─── Template IDs ────────────────────────────────────────────────────────

export const SOURCE_MATERIAL_TEMPLATE_ID = 'mpt-deliverable-source-material';
export const REVIEW_INTAKE_TEMPLATE_ID = 'mpt-review-intake';

export const FULFILL_TEMPLATE_BY_TYPE: Record<string, string> = {
  review_responses: 'mpt-seed-fulfill-001',
  service_menu: 'mpt-seed-fulfill-002',
  gbp_audit: 'mpt-seed-fulfill-003',
  testimonial_cards: 'mpt-seed-fulfill-004',
  nap_report: 'mpt-seed-fulfill-005',
  seo_content: 'mpt-seed-fulfill-006',
  lead_magnet: 'mpt-seed-fulfill-007',
  product_visibility_preview: 'mpt-seed-fulfill-008',
  website_mockup: 'mpt-seed-fulfill-009',
  website_build_package: 'mpt-seed-fulfill-010',
};

// ─── Signal → deliverable type mapping (spec §3.2) ───────────────────────

export const TYPE_GOVERNING_SIGNALS: Record<string, string[]> = {
  review_responses: [
    'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG',
    'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME',
  ],
  service_menu: ['DS_MISSING_SERVICE_MENU', 'WC_MISSING_SERVICE_PAGES'],
  gbp_audit: [
    'DS_CLAIMED_STATUS', 'DS_PHOTO_DEFICIT', 'DS_OUTDATED_HOURS',
    'DS_OUTDATED_HOLIDAY_HOURS', 'DS_MISSING_PROFILE',
  ],
  testimonial_cards: [
    'RA_UNADDRESSED_POSITIVE_BACKLOG', 'VP_MISSING_STOREFRONT_PHOTOS',
    'VP_MISSING_PROJECT_PHOTOS',
  ],
  nap_report: [
    'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT',
    'WC_URL_MISMATCH', 'DS_BROKEN_PROFILE_LINK',
  ],
  seo_content: [
    'WC_MISSING_SERVICE_PAGES', 'WC_MISSING_WEBSITE', 'DS_MISSING_SERVICE_MENU',
    // PB-08 website gap (spec §8.3) — the positioning report is content-shaped.
    'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN', 'WC_PARKED_DOMAIN',
    'WC_UNFINISHED_SITE', 'WC_UNSECURED_WEBSITE', 'WC_LEGACY_BUILDER_SITE',
    'WC_STALE_WEBSITE', 'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH',
  ],
  lead_magnet: [
    'WC_MISSING_CTA', 'WC_MOBILE_FRICTION', 'RA_LOW_REVIEW_VOLUME',
    // PB-08 — the "you need a web presence" teaser.
    'WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN',
    'WC_UNSECURED_WEBSITE',
  ],
  product_visibility_preview: [
    'DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_PRODUCT_BROWSING',
    'WC_MISSING_AVAILABILITY_INQUIRY', 'WC_MISSING_PICKUP_DELIVERY',
  ],
  // PB-08 (website gap) — the visual homepage mockup. Fires for any website
  // absence or deficiency: no site, third-party/builder/parked/unfinished,
  // broken, or a poor-quality owned site.
  website_mockup: [
    'WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN',
    'WC_PARKED_DOMAIN', 'WC_UNFINISHED_SITE', 'WC_BROKEN_WEBSITE',
    'WC_UNSECURED_WEBSITE', 'WC_LEGACY_BUILDER_SITE', 'WC_STALE_WEBSITE',
    'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH',
  ],
  // PB-08 (website gap) — the platform-centric build package: the delivery
  // artifact behind the website_mockup preview. Same WC_* governing set —
  // any website absence or deficiency can justify the full build package.
  website_build_package: [
    'WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN',
    'WC_PARKED_DOMAIN', 'WC_UNFINISHED_SITE', 'WC_BROKEN_WEBSITE',
    'WC_UNSECURED_WEBSITE', 'WC_LEGACY_BUILDER_SITE', 'WC_STALE_WEBSITE',
    'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH',
  ],
};

/** Families the analyst consumes — OX (outreach state) is excluded (G-12). */
export const DELIVERABLE_RELEVANT_FAMILIES = ['RA', 'DS', 'WC', 'CP', 'VP', 'INT'];

export interface DeliverableSourceResolution {
  types: DeliverableType[];
  signals: SignalCode[];
  source: 'model_emitted' | 'derived' | 'fallback';
}

export class DeliverableSourceService extends BaseService {
  private static instance: DeliverableSourceService;

  private constructor() { super(); }

  static getInstance(): DeliverableSourceService {
    if (!DeliverableSourceService.instance) {
      DeliverableSourceService.instance = new DeliverableSourceService();
    }
    return DeliverableSourceService.instance;
  }

  // ========================================================================
  // ELIGIBILITY — which types do this campaign's signals support?
  // ========================================================================

  async resolveEligibleTypes(campaignId: string, ctx?: RequestCtx): Promise<DeliverableSourceResolution> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: { mkt_audits_list: { where: { platform: 'business_analysis' }, take: 1, orderBy: { created_at: 'desc' } } },
      });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const latestAudit = campaign.mkt_audits_list?.[0] ?? null;
      const auditData = (latestAudit?.audit_data ?? null) as any;

      // Phase 6 — signal-aligned gap gate (undefined → legacy primary set).
      const { IntelligenceProfileService } = await import('../intelligence/IntelligenceProfileService');
      const platformSignalWeights = await IntelligenceProfileService.getInstance()
        .resolveSignalWeightMapForCampaign(campaign, auditData, ctx);

      const signals = extractSignals({ campaign, auditData, platformSignalWeights }) as SignalCode[];
      const hasModelSignals = Array.isArray(auditData?.detected_signals);
      const source: DeliverableSourceResolution['source'] =
        hasModelSignals ? 'model_emitted' : signals.length > 0 ? 'derived' : 'fallback';

      const relevant = signals.filter((s) => {
        const fam = String(s).split('_')[0];
        return DELIVERABLE_RELEVANT_FAMILIES.includes(fam);
      });

      let types: DeliverableType[];
      if (source === 'fallback') {
        // No audit / no signals → offer every modal type (legacy behavior, §3.2).
        types = Object.keys(TYPE_GOVERNING_SIGNALS) as DeliverableType[];
      } else {
        types = (Object.entries(TYPE_GOVERNING_SIGNALS)
          .filter(([, gov]) => gov.some((g) => relevant.includes(g as SignalCode)))
          .map(([t]) => t)) as DeliverableType[];
      }

      logger.info('Deliverable eligible types resolved', ctx, {
        campaignId, source, signalCount: relevant.length, types,
      });
      return { types, signals: relevant, source };
    } catch (error) {
      logger.error('Failed to resolve eligible deliverable types', ctx, {
        error: (error as Error).message, campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ========================================================================
  // REVIEW INTAKE (operator-pasted) — spec §5.7
  // ========================================================================

  async ingestReviewIntake(campaignId: string, rawReviews: string, ctx?: RequestCtx): Promise<{
    executionId: string;
    intake: ReviewIntake | null;
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const variables = {
        business_name: campaign.business_name ?? '',
        category: campaign.category ?? '',
        city: campaign.city ?? '',
        raw_reviews: rawReviews,
      };

      const execution = await MarketingExecutionService.getInstance().executeSingle(
        { campaignId, templateId: REVIEW_INTAKE_TEMPLATE_ID, variables, executedBy: ctx?.userId || 'operator' },
        ctx,
      );

      let intake: ReviewIntake | null = null;
      if (execution?.raw_output) {
        intake = this.parseAndValidate(reviewIntakeSchema, execution.raw_output, ctx, execution.id);
      }

      return { executionId: execution.id, intake };
    } catch (error) {
      logger.error('Failed to ingest review intake', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  async getReviewIntake(campaignId: string, ctx?: RequestCtx): Promise<ReviewIntake | null> {
    const execution = await this.prisma.mkt_prompt_executions_list.findFirst({
      where: { campaign_id: campaignId, template_id: REVIEW_INTAKE_TEMPLATE_ID, status: 'completed' },
      orderBy: { executed_at: 'desc' },
    });
    if (!execution?.raw_output) return null;
    return this.parseAndValidate(reviewIntakeSchema, execution.raw_output, ctx, execution.id);
  }

  // ========================================================================
  // SOURCE MATERIAL — post-audit analyst prompt
  // ========================================================================

  async generateSourceMaterial(campaignId: string, ctx?: RequestCtx): Promise<{
    executionId: string;
    sourceMaterial: DeliverableSourceMaterial | null;
  }> {
    try {
      const { eligibility, intake, snapshotHash, variables } =
        await this.buildSourceMaterialContext(campaignId, ctx);

      // Idempotency: reuse a cached execution for the same audit + signals (§7.1).
      const cached = await this.prisma.mkt_prompt_executions_list.findFirst({
        where: { campaign_id: campaignId, template_id: SOURCE_MATERIAL_TEMPLATE_ID, status: 'completed' },
        orderBy: { executed_at: 'desc' },
      });
      if (cached?.raw_output && (cached.variables_used as any)?.evidence_snapshot_hash === snapshotHash) {
        const parsed = this.parseAndValidate(deliverableSourceMaterialSchema, cached.raw_output, ctx, cached.id);
        if (parsed) {
          return { executionId: cached.id, sourceMaterial: this.normalize(parsed, eligibility, intake) };
        }
      }

      const execution = await MarketingExecutionService.getInstance().executeSingle(
        { campaignId, templateId: SOURCE_MATERIAL_TEMPLATE_ID, variables, executedBy: ctx?.userId || 'operator' },
        ctx,
      );

      const parsed = execution?.raw_output
        ? this.parseAndValidate(deliverableSourceMaterialSchema, execution.raw_output, ctx, execution.id)
        : null;

      return {
        executionId: execution.id,
        sourceMaterial: parsed ? this.normalize(parsed, eligibility, intake) : null,
      };
    } catch (error) {
      logger.error('Failed to generate deliverable source material', ctx, {
        error: (error as Error).message, campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Assemble the render context for the source-material prompt — campaign +
   * latest business_analysis audit, eligibility/intake/prior-outreach, the
   * evidence snapshot hash, and the substituted variables. Shared by the
   * internal lane (generateSourceMaterial), the external render lane
   * (renderSourceMaterialPrompt), and the import lane (importSourceMaterial)
   * so the two executions can never drift.
   */
  private async buildSourceMaterialContext(campaignId: string, ctx?: RequestCtx): Promise<{
    campaign: any;
    eligibility: DeliverableSourceResolution;
    intake: ReviewIntake | null;
    snapshotHash: string;
    variables: Record<string, any>;
  }> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      include: { mkt_audits_list: { where: { platform: 'business_analysis' }, take: 1, orderBy: { created_at: 'desc' } } },
    });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const latestAudit = campaign.mkt_audits_list?.[0] ?? null;
    const auditData = (latestAudit?.audit_data ?? null) as any;

    const eligibility = await this.resolveEligibleTypes(campaignId, ctx);
    const intake = await this.getReviewIntake(campaignId, ctx);
    const priorOutreach = await this.buildPriorOutreach(campaignId);
    const businessAttributes = this.formatBusinessAttributes(campaign);
    const discoveryAttribution = MarketingExecutionService.getInstance()
      .renderProspectOriginBlock(campaign);
    const businessAddress = this.formatBusinessAddress(campaign);
    const websiteUrl = campaign.website_url ?? '';
    const businessPhone = campaign.phone ?? '';
    // The hash covers the prompt-shaping context too — an operator-edited
    // origin, re-attributed discovery_context, or a changed website/address
    // renders a different prompt, so a cached execution from before the edit
    // must not be reused.
    const snapshotHash = this.hashSnapshot(
      latestAudit?.id ?? null,
      eligibility.signals,
      [businessAttributes, discoveryAttribution, businessAddress, websiteUrl, businessPhone].join('::'),
    );

    const variables = {
      business_name: campaign.business_name ?? '',
      category: campaign.category ?? '',
      city: campaign.city ?? '',
      website_url: websiteUrl,
      business_address: businessAddress,
      business_phone: businessPhone,
      detected_signals: this.formatSignals(eligibility.signals),
      audit_results: this.serializeAuditResults(auditData),
      business_attributes: businessAttributes,
      discovery_attribution: discoveryAttribution,
      prior_outreach: priorOutreach || '(none sent yet)',
      review_intake: intake ? JSON.stringify(intake) : '(empty)',
      evidence_snapshot_hash: snapshotHash,
    };

    return { campaign, eligibility, intake, snapshotHash, variables };
  }

  /**
   * External lane — render the source-material prompt with the same
   * server-assembled variables generateSourceMaterial uses, for copy/paste
   * into an external LLM. Returns the snapshot hash so the caller can echo
   * it back to importSourceMaterial for §7.1 idempotency.
   */
  async renderSourceMaterialPrompt(campaignId: string, ctx?: RequestCtx): Promise<{
    renderedPrompt: string;
    snapshotHash: string;
  }> {
    try {
      const { variables, snapshotHash } = await this.buildSourceMaterialContext(campaignId, ctx);
      const renderedPrompt = await MarketingExecutionService.getInstance().renderPrompt(
        { campaignId, templateId: SOURCE_MATERIAL_TEMPLATE_ID, variables },
        ctx,
      );
      return { renderedPrompt, snapshotHash };
    } catch (error) {
      logger.error('Failed to render deliverable source material prompt', ctx, {
        error: (error as Error).message, campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * External lane — import an external LLM's JSON output for the
   * source-material prompt. Validated against the deliverable_source_material
   * schema inside importExternalResult (auditPlatform: null — no audit row),
   * then stamped with the render's snapshot hash so the §7.1 cache in
   * generateSourceMaterial recognizes the import as the execution for the
   * audit+signals state it was rendered against. Falls back to the current
   * hash when the caller doesn't echo the render's hash.
   */
  async importSourceMaterial(campaignId: string, input: {
    rawOutput: string;
    source?: string;
    snapshotHash?: string;
  }, ctx?: RequestCtx): Promise<{
    executionId: string;
    sourceMaterial: DeliverableSourceMaterial | null;
  }> {
    try {
      const { eligibility, intake, snapshotHash: currentHash } =
        await this.buildSourceMaterialContext(campaignId, ctx);

      const result = await MarketingPromptService.getInstance().importExternalResult({
        campaignId,
        templateId: SOURCE_MATERIAL_TEMPLATE_ID,
        rawOutput: input.rawOutput,
        source: input.source || 'external',
        executedBy: ctx?.userId,
      }, ctx);

      await this.prisma.mkt_prompt_executions_list.update({
        where: { id: result.execution.id },
        data: { variables_used: { evidence_snapshot_hash: input.snapshotHash ?? currentHash } },
      });

      const parsed = this.parseAndValidate(deliverableSourceMaterialSchema, input.rawOutput, ctx, result.execution.id);
      return {
        executionId: result.execution.id,
        sourceMaterial: parsed ? this.normalize(parsed, eligibility, intake) : null,
      };
    } catch (error) {
      logger.error('Failed to import deliverable source material', ctx, {
        error: (error as Error).message, campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getSourceMaterial(campaignId: string, ctx?: RequestCtx): Promise<DeliverableSourceMaterial | null> {
    const execution = await this.prisma.mkt_prompt_executions_list.findFirst({
      where: { campaign_id: campaignId, template_id: SOURCE_MATERIAL_TEMPLATE_ID, status: 'completed' },
      orderBy: { executed_at: 'desc' },
    });
    if (!execution?.raw_output) return null;
    const parsed = this.parseAndValidate(deliverableSourceMaterialSchema, execution.raw_output, ctx, execution.id);
    if (!parsed) return null;
    const eligibility = await this.resolveEligibleTypes(campaignId, ctx);
    const intake = await this.getReviewIntake(campaignId, ctx);
    return this.normalize(parsed, eligibility, intake);
  }

  /** Resolve the source block for a single deliverable type (null if absent). */
  async getTypeSource(campaignId: string, type: DeliverableType, ctx?: RequestCtx): Promise<unknown | null> {
    const material = await this.getSourceMaterial(campaignId, ctx);
    return (material?.deliverable_sources as any)?.[type] ?? null;
  }

  // ========================================================================
  // FULFILL — resolve a deliverable's content from its source block
  // ========================================================================

  /**
   * Run the type's fulfill prompt with its source block. Returns the fulfill
   * output text, or null when the type has no source block (G-4: callers must
   * route review_responses to the construction workspace, not here).
   */
  async resolveDeliverableContent(campaignId: string, type: DeliverableType, ctx?: RequestCtx): Promise<{
    content: string | null;
    promptTemplateId: string | null;
    sourceMaterialExecutionId: string | null;
    qualityGate: { passed: boolean; issues: string[] };
    repetitionGate: { passed: boolean; issues: string[] };
  }> {
    const templateId = FULFILL_TEMPLATE_BY_TYPE[type];
    if (!templateId) {
      return {
        content: null, promptTemplateId: null, sourceMaterialExecutionId: null,
        qualityGate: { passed: true, issues: [] }, repetitionGate: { passed: true, issues: [] },
      };
    }

    const source = await this.getTypeSource(campaignId, type, ctx);
    if (!source) {
      return {
        content: null, promptTemplateId: templateId, sourceMaterialExecutionId: null,
        qualityGate: { passed: true, issues: [] }, repetitionGate: { passed: true, issues: [] },
      };
    }

    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      include: { mkt_audits_list: { where: { platform: 'business_analysis' }, take: 1, orderBy: { created_at: 'desc' } } },
    });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    const auditData = (campaign.mkt_audits_list?.[0]?.audit_data ?? null) as any;

    // Resolve claim/report links through the canonical module so the
    // /place/claim vs /directory/claim split cannot drift (§5.6). Mint a claim
    // token when the seed has none, mirroring SeedIntelligenceReportService
    // (§13.5 claim handoff) — so the deliverable CTA always carries a working
    // link when the campaign has a linked seed.
    const claimUrl = await this.ensureClaimUrl(campaignId, ctx);

    let linkVars: Record<string, string> = {};
    try {
      const seedId = await resolveCampaignSeedId(campaignId);
      const built = await buildOutreachLinkVars(seedId);
      const intakeVars = await resolveIntakeLinkVarsForCampaign(campaignId);
      if (claimUrl) linkVars.claim_url = claimUrl;
      if (built.claim_short_url) linkVars.claim_short_url = built.claim_short_url;
      if (built.report_url) linkVars.report_url = built.report_url;
      if (intakeVars.intake_url) linkVars.intake_url = intakeVars.intake_url;
      if (intakeVars.intake_short_url) linkVars.intake_short_url = intakeVars.intake_short_url;
    } catch (e) {
      logger.warn('Failed to resolve deliverable link variables', ctx, {
        error: (e as Error).message, campaignId,
      });
    }

    const sourceText = JSON.stringify(source);
    const blockKey = this.sourceVariableKey(type);
    const variables: Record<string, any> = {
      business_name: campaign.business_name ?? '',
      category: campaign.category ?? '',
      city: campaign.city ?? '',
      [blockKey]: sourceText,
      // A single CTA variable so the seeded body never renders a literal
      // {{claim_url}} when no link resolves (link-less variant instead).
      claim_cta: buildClaimCta(claimUrl),
      business_attributes: this.formatBusinessAttributes(campaign),
      public_narrative: auditData?.public_narrative ?? '',
      discovery_attribution: MarketingExecutionService.getInstance()
        .renderProspectOriginBlock(campaign),
      ...linkVars,
    };

    const execution = await MarketingExecutionService.getInstance().executeSingle(
      { campaignId, templateId, variables, executedBy: ctx?.userId || 'operator' },
      ctx,
    );

    const content = execution?.filtered_output ?? execution?.raw_output ?? null;

    // Gates surface as warnings, not hard blocks (§7.4).
    const qualityGate = content
      ? runDeliverableQualityGate(type, content, sourceText)
      : { passed: true, issues: [] };
    const priorOutreach = await this.buildPriorOutreach(campaignId);
    const repetitionGate = content
      ? runRepetitionGate(content, priorOutreach)
      : { passed: true, issues: [] };

    if (!qualityGate.passed || !repetitionGate.passed) {
      logger.warn('Deliverable fulfill gate warnings', ctx, {
        campaignId, type,
        qualityIssues: qualityGate.issues,
        repetitionIssues: repetitionGate.issues,
      });
    }

    return {
      content,
      promptTemplateId: templateId,
      sourceMaterialExecutionId: execution?.id ?? null,
      qualityGate,
      repetitionGate,
    };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /**
   * Deterministic post-normalization (G-10): null out any block whose governing
   * signal is absent, and source the two review-bearing blocks from intake.
   */
  private normalize(
    material: DeliverableSourceMaterial,
    eligibility: DeliverableSourceResolution,
    intake: ReviewIntake | null,
  ): DeliverableSourceMaterial {
    const sources = { ...(material.deliverable_sources as any) };
    for (const [type, governing] of Object.entries(TYPE_GOVERNING_SIGNALS)) {
      const eligible = eligibility.source === 'fallback'
        || governing.some((g) => eligibility.signals.includes(g as SignalCode));
      if (!eligible) sources[type] = null;
    }

    // Review-bearing blocks come from the operator-pasted intake (§5.7).
    if (intake) {
      const unanswered = (intake.reviews ?? []).filter((r) => !r.answered);
      if (unanswered.length > 0) {
        sources.review_responses = {
          reviews: unanswered.map((r) => ({
            platform: r.platform ?? null,
            rating: r.rating ?? null,
            date: r.date ?? null,
            author: r.author ?? null,
            text: r.text,
            sentiment: r.sentiment ?? null,
            is_negative_first: r.is_negative_first ?? false,
          })),
        };
      }
      if ((intake.testimonials ?? []).length > 0) {
        sources.testimonial_cards = { testimonials: intake.testimonials };
      }
    } else {
      sources.review_responses = null;
      sources.testimonial_cards = null;
    }

    return { ...material, deliverable_sources: sources };
  }

  private parseAndValidate<T extends { safeParse: (v: unknown) => any }>(
    schema: T,
    raw: string,
    ctx: RequestCtx | undefined,
    executionId: string,
  ): any | null {
    try {
      const parsed = JSON.parse(this.stripJsonArtifacts(raw));
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      logger.warn('Deliverable source output did not match schema', ctx, {
        executionId, errors: result.error?.format?.(),
      });
      return parsed; // best-effort
    } catch (e) {
      logger.error('Failed to parse deliverable source output', ctx, {
        executionId, error: (e as Error).message,
      });
      return null;
    }
  }

  private stripJsonArtifacts(raw: string): string {
    let s = raw.trim();
    if (s.startsWith('```')) {
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    return first >= 0 && last > first ? s.slice(first, last + 1) : s;
  }

  private formatSignals(signals: SignalCode[]): string {
    if (signals.length === 0) return '(none)';
    return signals.map((s) => `- ${s}`).join('\n');
  }

  private hashSnapshot(auditId: string | null, signals: SignalCode[], contextFingerprint = ''): string {
    return createHash('sha256')
      .update(`${auditId ?? 'none'}::${[...signals].sort().join(',')}::${contextFingerprint}`)
      .digest('hex');
  }

  private sourceVariableKey(type: string): string {
    switch (type) {
      case 'testimonial_cards': return 'testimonials';
      case 'nap_report': return 'nap_status';
      case 'seo_content': return 'service_pages';
      case 'lead_magnet': return 'offer';
      case 'product_visibility_preview': return 'product_visibility';
      case 'website_mockup': return 'website_mockup';
      case 'website_build_package': return 'website_build_package';
      case 'service_menu': return 'services';
      case 'gbp_audit': return 'gbp_audit';
      default: return 'source_material';
    }
  }

  /** Structured Markdown serializer — not a raw JSON dump (§2.10 pattern). */
  private serializeAuditResults(auditData: any): string {
    if (!auditData) return '(no business_analysis audit found)';
    const lines: string[] = [];
    lines.push(`Summary: ${auditData.summary ?? 'N/A'}`);
    if (auditData.business_type) lines.push(`Business type: ${auditData.business_type}`);

    const platforms = auditData.platforms ?? {};
    lines.push('\nPlatforms:');
    for (const [key, p] of Object.entries(platforms)) {
      const pd = p as any;
      lines.push(`- ${key}: status=${pd.profile_status ?? 'unknown'}, rating=${pd.rating ?? 'N/A'}, reviews=${pd.total_reviews ?? 'N/A'}`);
    }

    const nap = auditData.nap_consistency;
    if (nap) {
      lines.push('\nNAP:');
      lines.push(`- canonical: ${nap.canonical_name ?? '?'} / ${nap.canonical_address ?? '?'} / ${nap.canonical_phone ?? '?'}`);
      if (nap.name_variations?.length) lines.push(`- name variations: ${nap.name_variations.join('; ')}`);
      if (nap.address_variations?.length) lines.push(`- address variations: ${nap.address_variations.join('; ')}`);
      if (nap.phone_variations?.length) lines.push(`- phone variations: ${nap.phone_variations.join('; ')}`);
    }

    const website = auditData.website;
    if (website) {
      lines.push('\nWebsite:');
      lines.push(`- url: ${website.url ?? 'N/A'}, status: ${website.status ?? 'N/A'}`);
      if (website.issues?.length) lines.push(`- issues: ${website.issues.join('; ')}`);
      if (website.conversion_opportunities?.length) lines.push(`- conversion opportunities: ${website.conversion_opportunities.join('; ')}`);
    }

    if (auditData.recommended_services?.length) {
      lines.push(`\nRecommended services: ${auditData.recommended_services.join('; ')}`);
    }
    if (auditData.public_narrative) {
      lines.push(`\nPublic narrative: ${auditData.public_narrative}`);
    }

    // Gold-standard-measured results — the audit's gap analysis and gate
    // results are graded against the category benchmark (expected vs actual,
    // non_negotiable vs recommended); the fulfills fix toward that bar.
    const gaps = auditData.gap_analysis?.gaps;
    if (Array.isArray(gaps) && gaps.length > 0) {
      lines.push('\nGap analysis (expected vs actual):');
      for (const g of gaps) {
        lines.push(`- [${g.severity ?? 'recommended'}] ${g.platform ?? '?'} / ${g.field ?? '?'}: expected ${JSON.stringify(g.expected ?? null)}, actual ${JSON.stringify(g.actual ?? null)}${g.gap_description ? ` — ${g.gap_description}` : ''}`);
      }
      if (auditData.gap_analysis.summary) lines.push(`- summary: ${auditData.gap_analysis.summary}`);
    }

    const gateResults = auditData.quality_gate_results?.results;
    if (Array.isArray(gateResults) && gateResults.length > 0) {
      lines.push('\nQuality gate results:');
      for (const r of gateResults) {
        lines.push(`- [${r.severity ?? 'recommended'}] ${r.platform ?? '?'} / ${r.gate ?? '?'}: ${r.passed ? 'passed' : 'FAILED'}${r.notes ? ` — ${r.notes}` : ''}`);
      }
    }

    // Recommended attributes carry their basis — gold_standard_expected
    // entries are the category benchmark's bar, not observed facts.
    if (auditData.recommended_attributes?.length) {
      lines.push('\nRecommended attributes:');
      for (const a of auditData.recommended_attributes) {
        lines.push(`- ${a.label ?? a.key}${a.platform ? ` (${a.platform})` : ''}: ${a.current_state ?? 'unverified'}${a.basis ? `, basis=${a.basis}` : ''}${a.rationale ? ` — ${a.rationale}` : ''}`);
      }
    }

    if (auditData.negative_review_themes?.length) {
      lines.push('\nNegative review themes:');
      for (const t of auditData.negative_review_themes) {
        lines.push(`- ${t.theme}: ${t.summary ?? ''}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Serialize the prospect's recorded attributes into a compact prompt line:
   * operator-set attributes, business origin (drives community-relevant
   * framing — e.g. which holidays matter), tone preference, and secondary
   * shelf categories. '(none recorded)' keeps the rendered prompt explicit
   * about absence rather than leaving a dangling blank.
   */
  private formatBusinessAttributes(campaign: any): string {
    const lines: string[] = [];
    const attrs = Array.isArray(campaign?.attributes) ? campaign.attributes.filter((a: any) => typeof a === 'string' && a.trim()) : [];
    if (attrs.length > 0) lines.push(`Attributes: ${attrs.join(', ')}`);
    const originParts = [campaign?.business_origin_region, campaign?.business_origin_country]
      .filter((v: any) => typeof v === 'string' && v.trim());
    if (originParts.length > 0) lines.push(`Business origin: ${originParts.join(', ')}`);
    if (campaign?.tone) lines.push(`Tone preference: ${campaign.tone}`);
    const secondary = Array.isArray(campaign?.secondary_categories) ? campaign.secondary_categories.filter((c: any) => typeof c === 'string' && c.trim()) : [];
    if (secondary.length > 0) lines.push(`Secondary categories: ${secondary.join(', ')}`);
    return lines.length > 0 ? lines.join('\n') : '(none recorded)';
  }

  /** Street address assembled for prompt display; '' when unrecorded. */
  private formatBusinessAddress(campaign: any): string {
    const parts = [
      campaign?.address_line1,
      campaign?.address_line2,
      campaign?.address_city,
      campaign?.address_state,
      campaign?.address_zip,
    ].filter((v: any) => typeof v === 'string' && v.trim());
    return parts.join(', ');
  }

  /**
   * Resolve a working claim URL for the campaign's linked seed, minting a claim
   * token when none is active (mirrors SeedIntelligenceReportService §13.5
   * claim handoff). Returns null when the campaign has no linked seed, or the
   * seed is already claimed — the caller then uses the link-less CTA variant.
   * Best-effort: never throws.
   */
  private async ensureClaimUrl(campaignId: string, ctx?: RequestCtx): Promise<string | null> {
    try {
      const seedId = await resolveCampaignSeedId(campaignId);
      if (!seedId) return null;

      const existing = await resolveClaimUrlForSeed(seedId);
      if (existing) return existing;

      // Already claimed → there is no claim path left to offer. Minting
      // flips the seed to 'invited', so it is gated on a public-facing
      // status — a draft (still in operator QC) or suppressed seed gets the
      // link-less CTA variant instead of a premature claim link.
      const seed = await this.prisma.$queryRaw<any[]>`
        SELECT status, claimed_at FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
      `;
      if (!seed[0] || seed[0].claimed_at) return null;
      if (seed[0].status !== 'published' && seed[0].status !== 'invited') return null;

      const { default: seedService } = await import('../DirectoryPresenceSeedService.js');
      await seedService.inviteSeed(seedId, 90, {
        actorType: 'system',
        actorId: ctx?.userId ?? 'system',
      });
      logger.info('Deliverable source: minted claim token for CTA', ctx, { campaignId, seedId });

      return await resolveClaimUrlForSeed(seedId);
    } catch (err: any) {
      logger.warn('Deliverable source: claim URL resolution/mint failed (non-blocking)', ctx, {
        campaignId, error: err?.message,
      });
      return null;
    }
  }

  /** Assemble the campaign's already-emitted outreach lines (spec §7.2). */
  private async buildPriorOutreach(campaignId: string): Promise<string> {    const lines: string[] = [];
    try {
      const opener = await this.prisma.mkt_outreach_openers_list.findFirst({
        where: { campaign_id: campaignId },
        orderBy: { executed_at: 'desc' },
      });
      if (opener?.opener_text) lines.push(`Opener: ${opener.opener_text}`);

      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { repair_triage_briefing: true },
      });
      const briefing = campaign?.repair_triage_briefing as any;
      if (briefing?.pitch?.opener_hook) lines.push(`Pitch hook: ${briefing.pitch.opener_hook}`);
      if (Array.isArray(briefing?.outreach_problems)) {
        for (const p of briefing.outreach_problems) {
          if (p?.hook) lines.push(`Problem hook: ${p.hook}`);
        }
      }
    } catch (e) {
      logger.warn('Failed to assemble prior outreach', undefined, { error: (e as Error).message, campaignId });
    }
    return lines.join('\n');
  }
}

export default DeliverableSourceService.getInstance();
