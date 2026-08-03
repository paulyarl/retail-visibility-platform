/**
 * Marketing Ops Routes
 *
 * All routes require authenticateToken + requirePlatformAdmin.
 * Zod validation on all mutation endpoints.
 *
 * Routes:
 *   Campaigns:
 *     GET    /              — list campaigns (filters: stage, category, city, assignedTo, search)
 *     GET    /dashboard     — dashboard stats
 *     GET    /:id           — get campaign with audits, files, stage history
 *     POST   /              — create campaign
 *     PUT    /:id           — update campaign
 *     DELETE /:id           — delete campaign
 *     POST   /:id/transition — transition campaign stage
 *
 *   Audits:
 *     GET    /:campaignId/audits        — list audits for campaign
 *     POST   /:campaignId/audits        — create audit
 *     PUT    /audits/:id                — update audit
 *     DELETE /audits/:id                — delete audit
 *
 *   Files:
 *     GET    /:campaignId/files         — list files for campaign
 *     POST   /:campaignId/files         — create file metadata
 *     DELETE /files/:id                 — delete file
 *
 *   Prompt Templates:
 *     GET    /prompts/templates         — list templates
 *     POST   /prompts/templates         — create template
 *     PUT    /prompts/templates/:id     — update template
 *     DELETE /prompts/templates/:id     — delete template
 *     GET    /prompts/templates/:id/render — resolve template against campaign (no AI call)
 *
 *   Prompt Executions:
 *     GET    /prompts/executions        — list executions (filter: campaignId)
 *     GET    /prompts/executions/:id    — get execution with filter flags
 *     POST   /prompts/executions        — create single execution
 *     POST   /prompts/executions/batch  — batch execution
 *     PUT    /prompts/executions/:id    — update execution (raw output, status, etc.)
 *
 *   Filter Flags:
 *     GET    /prompts/filter-flags      — list filter flags (filter: executionId, status)
 *     PUT    /prompts/filter-flags/:id  — update filter flag (review, override)
 *
 *   Scorecards:
 *     GET    /scorecards                — list scorecards
 *     POST   /scorecards                — upsert scorecard
 *     DELETE /scorecards/:id            — delete scorecard
 *
 *   Deliverable Templates:
 *     GET    /deliverable-templates         — list templates
 *     POST   /deliverable-templates         — create template
 *     PUT    /deliverable-templates/:id     — update template
 *     DELETE /deliverable-templates/:id     — delete template
 *
 *   Deliverables:
 *     GET    /:campaignId/deliverables      — list deliverables for campaign
 *     POST   /:campaignId/deliverables      — create deliverable
 *     POST   /:campaignId/deliverables/generate — generate PDF deliverable
 *     GET    /deliverables/:id/download     — download deliverable PDF
 *     POST   /deliverables/:id/send         — mark deliverable as sent
 *     PUT    /deliverables/:id              — update deliverable
 *     DELETE /deliverables/:id              — delete deliverable
 *
 *   Branding:
 *     GET    /branding                  — list branding configs
 *     GET    /branding/active           — get active branding config
 *     POST   /branding                  — create branding config
 *     PUT    /branding/:id              — update branding config
 *     DELETE /branding/:id              — delete branding config
 *
 *   Export:
 *     GET    /export                    — export campaigns as CSV
 *
 *   Outreach Openers:
 *     GET    /openers                   — list openers (filter: campaignId)
 *     GET    /openers/resolve           — resolve archetype + prompt for a campaign (no AI call)
 *     POST   /openers/execute           — Path 1: generate opener via AI
 *     POST   /openers/import            — Path 2: import externally-generated opener
 *     GET    /openers/:id               — get single opener
 *
 *   Outreach Pitch — Headers:
 *     GET    /openers/headers           — list header variants (filter: campaignId)
 *     GET    /openers/headers/resolve   — resolve header prompt for a campaign (no AI call)
 *     POST   /openers/headers/execute   — Path 1: generate header via AI
 *     POST   /openers/headers/import    — Path 2: import externally-generated header
 *     GET    /openers/headers/:id       — get single header
 *
 *   Outreach Pitch — Closers:
 *     GET    /openers/closers           — list closer variants (filter: campaignId)
 *     GET    /openers/closers/resolve   — resolve closer prompt + default template (no AI call)
 *     POST   /openers/closers/execute   — Path 1: generate closer via AI
 *     POST   /openers/closers/import    — Path 2: import externally-generated/template-edited closer
 *     GET    /openers/closers/:id       — get single closer
 *
 *   Outreach Pitch — Contacts (optional footer, no AI):
 *     GET    /openers/contacts          — list contact variants (filter: campaignId)
 *     POST   /openers/contacts          — create contact variant
 *     PUT    /openers/contacts/:id      — update contact variant
 *     DELETE /openers/contacts/:id      — delete contact variant
 *     GET    /openers/contacts/:id      — get single contact
 *
 *   Outreach Pitch — Review Response Drafts (no persistence — returns draft for slot):
 *     POST   /openers/review-responses/generate — Path 1: AI draft owner response using campaign tone
 *     POST   /openers/review-responses/import   — Path 2: validate externally-drafted owner response
 *
 *   Outreach Pitch — Assembly:
 *     GET    /openers/pitches           — list assembled pitches (filter: campaignId)
 *     POST   /openers/pitches           — assemble + persist a full pitch from variant IDs + review pairs
 *     GET    /openers/pitches/:id       — get single assembled pitch
 *
 *   Playbook Catalog (Sprint 3 — Triage Engine):
 *     GET    /playbooks                 — list playbooks (filter: category, archetype, is_active)
 *     GET    /playbooks/:id             — get single playbook
 *     POST   /playbooks                 — create playbook
 *     PUT    /playbooks/:id             — update playbook
 *     DELETE /playbooks/:id             — delete playbook
 *
 *   Campaign Triage (Sprint 3 — Triage Engine):
 *     POST   /:campaignId/triage/evaluate  — run the cascade, upsert triage result (no campaign mutation)
 *     GET    /:campaignId/triage           — read the latest stored triage result
 *     POST   /:campaignId/triage/accept    — accept recommendation (re-categorize campaign + apply FITD fee)
 *     POST   /:campaignId/triage/override  — override with a different playbook (re-categorize + apply FITD fee)
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import MarketingCampaignService from '../services/MarketingCampaignService';
import { MarketingOutreachService } from '../services/MarketingOutreachService';
import { MarketingHotProspectService } from '../services/MarketingHotProspectService';
import MarketingAuditService from '../services/MarketingAuditService';
import MarketingPromptService from '../services/MarketingPromptService';
import MarketingExecutionService from '../services/MarketingExecutionService';
import MarketingScorecardService from '../services/MarketingScorecardService';
import MarketingFileService from '../services/MarketingFileService';
import MarketingDeliverableService from '../services/MarketingDeliverableService';
import MarketingBrandingService from '../services/MarketingBrandingService';
import MarketingCategoryToneService from '../services/MarketingCategoryToneService';
import MarketingServiceCategoryService from '../services/MarketingServiceCategoryService';
import { ReviewResponseService } from '../services/ReviewResponseService';
import { OutreachOpenerService } from '../services/OutreachOpenerService';
import HeaderService from '../services/outreach-pitch/HeaderService';
import CloserService from '../services/outreach-pitch/CloserService';
import ContactService from '../services/outreach-pitch/ContactService';
import ReviewResponseDraftService from '../services/outreach-pitch/ReviewResponseDraftService';
import PitchService from '../services/outreach-pitch/PitchService';
import OwnerVoiceService from '../services/deliverable/OwnerVoiceService';
import ReviewSlotService from '../services/deliverable/ReviewSlotService';
import DeliverableSectionService from '../services/deliverable/DeliverableSectionService';
import DeliverableAssemblyService from '../services/deliverable/DeliverableAssemblyService';
import DeliverableRenderService from '../services/deliverable/DeliverableRenderService';
import RecoveryResolutionService from '../services/RecoveryResolutionService';
import disputeIntakeService from '../services/DisputeIntakeService';
import ReviewCascadeService from '../services/ReviewCascadeService';
import MarketingPlaybookCatalogService from '../services/MarketingPlaybookCatalogService';
import MarketingSignalRegistryService from '../services/MarketingSignalRegistryService';
import CampaignTriageService from '../services/CampaignTriageService';
import { prisma } from '../prisma';

const router = Router();

// All routes require auth + platform admin
router.use(authenticateToken);
router.use(requirePlatformAdmin);

// ====================
// ZOD SCHEMAS
// ====================

const campaignBaseSchema = z.object({
  scope: z.enum(['business', 'category', 'city']).optional(),
  business_name: z.string().max(255).optional(),
  category: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  neighborhood: z.string().max(100).optional(),
  contact_method: z.string().max(50).optional(),
  contact_info: z.string().max(255).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(255).optional(),
  website_url: z.string().max(500).optional(),
  social_profiles: z.array(z.object({ platform: z.string().max(50), url: z.string().url() })).optional(),
  display_id: z.string().max(20).optional(),
  gbp_claimed: z.boolean().optional(),
  unaddressed_reviews: z.number().int().optional(),
  last_review_date: z.string().datetime().optional(),
  has_website: z.string().max(20).optional(),
  nap_consistent: z.boolean().optional(),
  estimated_tier: z.string().max(20).optional(),
  estimated_fee_cents: z.number().int().optional(),
  pain_score: z.number().int().optional(),
  tone: z.string().max(50).optional(),
  retainer: z.enum(['Fast', 'Medium', 'Slow']).optional(),
  attributes: z.array(z.string()).optional(),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
});

const campaignCreateSchema = campaignBaseSchema.refine((data) => data.scope !== 'business' || (data.business_name && data.business_name.trim().length > 0), {
  message: 'business_name is required for business-scoped campaigns',
  path: ['business_name'],
});

const campaignUpdateSchema = campaignBaseSchema.partial().extend({
  stage: z.enum(['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded']).optional(),
  tone: z.string().max(50).optional(),
  retainer: z.enum(['Fast', 'Medium', 'Slow']).optional(),
  attributes: z.array(z.string()).optional(),
  retainer_status: z.enum(['not_pitched', 'pitched', 'won', 'declined']).optional(),
  retainer_amount_cents: z.number().int().optional(),
  retainer_start_date: z.string().datetime().optional(),
  amount_paid_cents: z.number().int().optional(),
  package_delivered: z.string().optional(),
  campaign_origin: z.enum(['prospect', 'upsell']).optional(),
}).refine((data) => !data.scope || data.scope !== 'business' || (data.business_name && data.business_name.trim().length > 0), {
  message: 'business_name is required for business-scoped campaigns',
  path: ['business_name'],
});

const stageTransitionSchema = z.object({
  to_stage: z.enum(['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded']),
  notes: z.string().optional(),
  trigger_type: z.enum(['manual', 'automated', 'system']).optional(),
});

const linkTenantSchema = z.object({
  tenant_id: z.string().min(1),
});

// Outreach log schemas (Sprint 2)
const contactChannelEnum = z.enum(['phone', 'email', 'website', 'social', 'in_person', 'other']);
const contactOutcomeEnum = z.enum(['reached', 'no_answer', 'left_message', 'interested', 'not_interested', 'callback_scheduled', 'other', 'auto_follow_up_scheduled']);

const outreachLogSchema = z.object({
  contact_channel: contactChannelEnum,
  contact_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'contact_date must be YYYY-MM-DD'),
  outcome: contactOutcomeEnum,
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'follow_up_date must be YYYY-MM-DD').optional(),
  notes: z.string().optional(),
  message_snapshot: z.string().optional(),
  message_subject: z.string().max(255).optional(),
  preview_token: z.string().max(255).optional(),
});

const outreachEditSchema = outreachLogSchema.partial();

// Review-response pipeline schemas (Sprint 5 — Option B)
const reviewPlatformEnum = z.enum(['google', 'yelp', 'facebook', 'other']);
const reviewPipelineStageEnum = z.enum(['backlog', 'responding', 'follow_up', 'closed', 'monitoring']);
const responseTypeEnum = z.enum(['first_response', 'follow_up', 'acknowledgment']);

const reviewPipelineCreateSchema = z.object({
  platform: reviewPlatformEnum,
  total_reviews: z.number().int().optional(),
  unanswered_count: z.number().int().optional(),
  response_rate: z.number().int().min(0).max(100).optional(),
  average_rating: z.number().min(0).max(5).optional(),
  metadata: z.any().optional(),
});

const reviewPipelineMetricsSchema = z.object({
  total_reviews: z.number().int().optional(),
  unanswered_count: z.number().int().optional(),
  response_rate: z.number().int().min(0).max(100).optional(),
  average_rating: z.number().min(0).max(5).optional(),
  metadata: z.any().optional(),
});

const reviewResponseLogSchema = z.object({
  platform_review_id: z.string().max(255).optional(),
  response_text: z.string().optional(),
  response_type: responseTypeEnum,
  notes: z.string().optional(),
});

const reviewScheduleFollowUpSchema = z.object({
  scheduled_for: z.string().datetime(),
  notes: z.string().optional(),
});

const reviewCompleteFollowUpSchema = z.object({
  response_text: z.string().optional(),
  outcome: z.enum(['converted_paid', 'customer_responded', 'no_response', 'duplicate', 'out_of_scope', 'other']).optional(),
});

const reviewUpdateFollowUpSchema = z.object({
  scheduled_for: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const reviewSkipFollowUpSchema = z.object({
  reason: z.string().max(500).optional(),
  outcome: z.enum(['converted_paid', 'customer_responded', 'no_response', 'duplicate', 'out_of_scope', 'other']).optional(),
});

// Hot-prospect override schema (Sprint 3)
const hotProspectOverrideSchema = z.object({
  isHot: z.boolean(),
  reason: z.string().max(255).optional(),
});

const auditCreateSchema = z.object({
  platform: z.string().min(1).max(50),
  review_count: z.number().int().optional(),
  average_rating: z.number().optional(),
  unaddressed_reviews: z.number().int().optional(),
  owner_response_rate: z.number().int().optional(),
  photo_count: z.number().int().optional(),
  claimed: z.boolean().optional(),
  active_page: z.boolean().optional(),
  has_booking: z.boolean().optional(),
  has_contact_form: z.boolean().optional(),
  mobile_friendly: z.boolean().optional(),
  audit_data: z.any().optional(),
});

const auditUpdateSchema = auditCreateSchema.partial();

const fileCreateSchema = z.object({
  file_type: z.string().min(1).max(50),
  file_name: z.string().min(1).max(255),
  storage_path: z.string().min(1).max(500),
  file_size: z.number().int().optional(),
  mime_type: z.string().max(100).optional(),
});

const promptTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  prompt_type: z.enum(['seek', 'fulfill', 'filter', 'retainer', 'category_analysis', 'city_analysis']),
  scope: z.enum(['business', 'category', 'city']).optional(),
  category: z.string().max(100).optional(),
  tone: z.string().max(50).optional(),
  body: z.string().min(1),
  variables: z.any().optional(),
  output_schema: z.any().optional(),
  is_default: z.boolean().optional(),
});

const promptTemplateUpdateSchema = promptTemplateCreateSchema.partial();

const promptTemplateCloneSchema = z.object({
  name: z.string().max(100).optional(),
});

const executionCreateSchema = z.object({
  campaign_id: z.string().min(1),
  template_id: z.string().optional(),
  variables_used: z.any().optional(),
});

const executionUpdateSchema = z.object({
  raw_output: z.string().optional(),
  filtered_output: z.string().optional(),
  pass_rate: z.number().int().optional(),
  flagged_count: z.number().int().optional(),
  status: z.string().optional(),
  ai_provider: z.string().optional(),
  ai_model: z.string().optional(),
  tokens_used: z.number().int().optional(),
  cost_cents: z.number().int().optional(),
});

const batchExecutionSchema = z.object({
  campaign_ids: z.array(z.string().min(1)).min(1),
  template_id: z.string().min(1),
  variables: z.any().optional(),
});

const externalExecutionCreateSchema = z.object({
  campaign_id: z.string().min(1),
  template_id: z.string().min(1),
  raw_output: z.string().min(1),
  source: z.string().max(100).optional(),
  cost_cents: z.number().int().optional(),
});

const filterFlagUpdateSchema = z.object({
  human_override: z.string().optional(),
  status: z.enum(['pending', 'fixed', 'approved_as_is']).optional(),
});

const scorecardUpsertSchema = z.object({
  user_id: z.string().min(1),
  date: z.string().datetime(),
  category_focus: z.string().max(100).optional(),
  neighborhood_focus: z.string().max(100).optional(),
  scope_focus: z.enum(['business', 'category', 'city']).optional(),
  stage_focus: z.string().max(50).optional(),
  previews_built: z.number().int().optional(),
  previews_shown: z.number().int().optional(),
  packages_paid: z.number().int().optional(),
  packages_delivered: z.number().int().optional(),
  revenue_collected_cents: z.number().int().optional(),
  retainers_pitched: z.number().int().optional(),
  retainers_won: z.number().int().optional(),
  notes: z.string().optional(),
});

const scorecardUpdateSchema = z.object({
  user_id: z.string().min(1).optional(),
  date: z.string().datetime().optional(),
  category_focus: z.string().max(100).optional(),
  neighborhood_focus: z.string().max(100).optional(),
  scope_focus: z.enum(['business', 'category', 'city']).optional(),
  stage_focus: z.string().max(50).optional(),
  previews_built: z.number().int().optional(),
  previews_shown: z.number().int().optional(),
  packages_paid: z.number().int().optional(),
  packages_delivered: z.number().int().optional(),
  revenue_collected_cents: z.number().int().optional(),
  retainers_pitched: z.number().int().optional(),
  retainers_won: z.number().int().optional(),
  notes: z.string().optional(),
});

// ─── Playbook Catalog + Triage schemas (Sprint 3) ───────────────────────
const playbookCodeEnum = z.enum(['PB-01', 'PB-02', 'PB-03', 'PB-04', 'PB-05']);
const playbookCategoryEnum = z.enum(['review_management', 'recovery_management', 'triage_management']);
const archetypeEnum = z.enum(['A1', 'A2', 'A3', 'A4', 'A5']);

// ─── Matching rules DSL schema (§6.4) ────────────────────────────────────
// Structured validation for the any/all/none/dual set-membership DSL.
const matchingRulesSchema = z.object({
  any: z.array(z.string()).default([]),
  all: z.array(z.string()).default([]),
  none: z.array(z.string()).default([]),
  dual: z.object({
    groupA: z.array(z.string()),
    groupB: z.array(z.string()),
  }).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.85),
});

const playbookCreateSchema = z.object({
  code: playbookCodeEnum,
  name: z.string().min(1).max(255),
  category: playbookCategoryEnum,
  archetype: archetypeEnum,
  description: z.string().optional(),
  matching_rules: matchingRulesSchema.optional(),
  priority_rank: z.number().int().min(0).max(999).optional(),
  fitd_offer_title: z.string().min(1).max(255),
  fitd_default_fee_cents: z.number().int().min(0),
  retainer_pitch_title: z.string().min(1).max(255),
  retainer_fee_cents: z.number().int().min(0),
  opener_prompt_template_id: z.string().max(255).optional(),
  preview_deliverable_type: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
});

const playbookUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: playbookCategoryEnum.optional(),
  archetype: archetypeEnum.optional(),
  description: z.string().nullable().optional(),
  matching_rules: matchingRulesSchema.optional(),
  priority_rank: z.number().int().min(0).max(999).optional(),
  fitd_offer_title: z.string().min(1).max(255).optional(),
  fitd_default_fee_cents: z.number().int().min(0).optional(),
  retainer_pitch_title: z.string().min(1).max(255).optional(),
  retainer_fee_cents: z.number().int().min(0).optional(),
  opener_prompt_template_id: z.string().max(255).nullable().optional(),
  preview_deliverable_type: z.string().max(50).nullable().optional(),
  is_active: z.boolean().optional(),
});

// ─── Signal registry schemas (Sprint 3) ──────────────────────────────────

const signalCodePattern = /^[A-Z]{2}_[A-Z0-9_]+$/;
const detectionSourceEnum = z.enum(['model_emitted', 'derived', 'operator_input']);

const signalCreateSchema = z.object({
  code: z.string().regex(signalCodePattern, 'Must match FAMILY_UPPER_SNAKE (e.g. RA_REVIEW_DROUGHT)'),
  family: z.string().min(2).max(10),
  label: z.string().min(1).max(255),
  description: z.string().optional(),
  detection_source: detectionSourceEnum.optional(),
  derived_rule: z.object({
    field: z.string(),
    op: z.string(),
    threshold: z.union([z.number(), z.boolean()]),
  }).nullable().optional(),
  is_active: z.boolean().optional(),
});

const signalUpdateSchema = z.object({
  family: z.string().min(2).max(10).optional(),
  label: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  detection_source: detectionSourceEnum.optional(),
  derived_rule: z.object({
    field: z.string(),
    op: z.string(),
    threshold: z.union([z.number(), z.boolean()]),
  }).nullable().optional(),
  is_active: z.boolean().optional(),
});

const signalActivateSchema = z.object({
  is_active: z.boolean(),
});

// ─── Playbook reorder schema (Sprint 3 — cascade reorder affordance) ─────

const playbookReorderSchema = z.object({
  rankings: z.array(z.object({
    id: z.string().min(1),
    priority_rank: z.number().int().min(0).max(999),
  })).min(1),
});

const triageEvaluateSchema = z.object({
  bbb: z.object({
    bbb_grade: z.string().max(5).optional(),
    unanswered_bbb_complaints: z.number().int().min(0).optional(),
  }).optional(),
});

const triageOverrideSchema = z.object({
  playbook_code: playbookCodeEnum,
  reason: z.string().max(500).optional(),
});

const deliverableTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  deliverable_type: z.enum(['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet']),
  category: z.string().max(100).optional(),
  layout_spec: z.any(),
  page_size: z.string().max(20).optional(),
  orientation: z.string().max(20).optional(),
  is_default: z.boolean().optional(),
});

const deliverableTemplateUpdateSchema = deliverableTemplateCreateSchema.partial();

const deliverableCreateSchema = z.object({
  execution_id: z.string().optional(),
  template_id: z.string().optional(),
  deliverable_type: z.enum(['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet']),
  status: z.enum(['preview', 'paid', 'archived']),
  file_name: z.string().min(1).max(255),
  storage_path: z.string().min(1).max(500),
  file_size: z.number().int().optional(),
  mime_type: z.string().max(100).optional(),
  is_watermarked: z.boolean().optional(),
  branding_applied: z.any().optional(),
  sent_at: z.string().datetime().optional(),
  sent_method: z.string().max(50).optional(),
});

const deliverableUpdateSchema = deliverableCreateSchema.partial().extend({
  status: z.enum(['preview', 'paid', 'archived']).optional(),
});

const brandingCreateSchema = z.object({
  operator_name: z.string().min(1).max(255),
  operator_logo_url: z.string().optional(),
  primary_color: z.string().max(20).optional(),
  accent_color: z.string().max(20).optional(),
  text_color: z.string().max(20).optional(),
  font_family: z.string().max(100).optional(),
  footer_disclaimer: z.string().optional(),
  is_active: z.boolean().optional(),
});

const brandingUpdateSchema = brandingCreateSchema.partial();

// ====================
// HELPER
// ====================

function getCtx(req: any): RequestCtx {
  return {
    region: 'us-east-1',
    userId: req.user?.id,
    correlationId: req.headers['x-correlation-id'],
  };
}

function handleServiceError(res: Response, error: unknown, ctx?: RequestCtx): void {
  // Typed HTTP errors (NotFoundError, ConflictError, ValidationError, ...)
  // carry their own statusCode + code and must NOT be collapsed into 500.
  // 500 is reserved for truly unexpected backend failures that need fixing.
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ success: false, error: error.code, message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message.includes('not found') || message.includes('Invalid stage transition')) {
    res.status(400).json({ success: false, error: message });
  } else {
    res.status(500).json({ success: false, error: 'internal_error', message });
  }
}

// ====================
// CAMPAIGN ROUTES
// ====================

router.get('/', async (req: any, res: Response) => {
  try {
    const result = await MarketingCampaignService.listCampaigns({
      stage: req.query.stage,
      scope: req.query.scope,
      category: req.query.category,
      city: req.query.city,
      assignedTo: req.query.assignedTo,
      tone: req.query.tone,
      retainer: req.query.retainer,
      attributes: req.query.attributes ? String(req.query.attributes).split(',') : undefined,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/dashboard', async (req: any, res: Response) => {
  try {
    const stats = await MarketingCampaignService.getDashboardStats(getCtx(req));
    res.json({ success: true, data: stats });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/export', async (req: any, res: Response) => {
  try {
    const result = await MarketingCampaignService.listCampaigns({
      stage: req.query.stage,
      scope: req.query.scope,
      category: req.query.category,
      city: req.query.city,
      limit: 10000,
    }, getCtx(req));

    const headers = 'id,display_id,scope,business_name,category,city,stage,date_entered,date_paid,amount_paid_cents,retainer_status\n';
    const rows = result.items.map((c: any) =>
      `${c.id},${c.display_id || ''},${c.scope},${c.business_name || ''},${c.category},${c.city},${c.stage},${c.date_entered?.toISOString() || ''},${c.date_paid?.toISOString() || ''},${c.amount_paid_cents},${c.retainer_status}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=marketing-campaigns.csv');
    res.send(headers + rows);
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// NOTE: /conversion-stats must be registered BEFORE /:id (single-segment catch-all)
router.get('/conversion-stats', async (req: any, res: Response) => {
  try {
    const stats = await MarketingCampaignService.getConversionStats(getCtx(req));
    res.json({ success: true, data: stats });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/', async (req: any, res: Response) => {
  try {
    const parsed = campaignCreateSchema.parse(req.body);
    const campaign = await MarketingCampaignService.createCampaign({
      scope: parsed.scope,
      businessName: parsed.business_name,
      category: parsed.category,
      city: parsed.city,
      neighborhood: parsed.neighborhood,
      contactMethod: parsed.contact_method,
      contactInfo: parsed.contact_info,
      phone: parsed.phone,
      email: parsed.email,
      websiteUrl: parsed.website_url,
      socialProfiles: parsed.social_profiles,
      displayId: parsed.display_id,
      gbpClaimed: parsed.gbp_claimed,
      unaddressedReviews: parsed.unaddressed_reviews,
      lastReviewDate: parsed.last_review_date ? new Date(parsed.last_review_date) : undefined,
      hasWebsite: parsed.has_website,
      napConsistent: parsed.nap_consistent,
      estimatedTier: parsed.estimated_tier,
      estimatedFeeCents: parsed.estimated_fee_cents,
      painScore: parsed.pain_score,
      tone: parsed.tone,
      retainer: parsed.retainer,
      attributes: parsed.attributes,
      assignedTo: parsed.assigned_to,
      notes: parsed.notes,
    }, getCtx(req));
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/:id', async (req: any, res: Response) => {
  try {
    const parsed = campaignUpdateSchema.parse(req.body);
    const campaign = await MarketingCampaignService.updateCampaign(req.params.id, {
      scope: parsed.scope,
      businessName: parsed.business_name,
      category: parsed.category,
      city: parsed.city,
      neighborhood: parsed.neighborhood,
      contactMethod: parsed.contact_method,
      contactInfo: parsed.contact_info,
      phone: parsed.phone,
      email: parsed.email,
      websiteUrl: parsed.website_url,
      socialProfiles: parsed.social_profiles,
      gbpClaimed: parsed.gbp_claimed,
      unaddressedReviews: parsed.unaddressed_reviews,
      lastReviewDate: parsed.last_review_date ? new Date(parsed.last_review_date) : undefined,
      hasWebsite: parsed.has_website,
      napConsistent: parsed.nap_consistent,
      estimatedTier: parsed.estimated_tier,
      estimatedFeeCents: parsed.estimated_fee_cents,
      painScore: parsed.pain_score,
      tone: parsed.tone,
      retainer: parsed.retainer,
      attributes: parsed.attributes,
      assignedTo: parsed.assigned_to,
      notes: parsed.notes,
      stage: parsed.stage,
      retainerStatus: parsed.retainer_status,
      retainerAmountCents: parsed.retainer_amount_cents,
      retainerStartDate: parsed.retainer_start_date ? new Date(parsed.retainer_start_date) : undefined,
      amountPaidCents: parsed.amount_paid_cents,
      packageDelivered: parsed.package_delivered,
      campaignOrigin: parsed.campaign_origin,
    }, getCtx(req));
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/:id', async (req: any, res: Response) => {
  try {
    await MarketingCampaignService.deleteCampaign(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/:id/transition', async (req: any, res: Response) => {
  try {
    const parsed = stageTransitionSchema.parse(req.body);
    const campaign = await MarketingCampaignService.transitionStage({
      campaignId: req.params.id,
      toStage: parsed.to_stage,
      notes: parsed.notes,
      triggerType: parsed.trigger_type,
      changedBy: req.user?.id,
    }, getCtx(req));
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Profile Repair — switch track (standard ↔ escalated) with stage remap
const switchTrackSchema = z.object({
  to_track: z.enum(['standard', 'escalated']),
  issue_type: z.string().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

router.post('/:id/switch-track', async (req: any, res: Response) => {
  try {
    const parsed = switchTrackSchema.parse(req.body);
    const campaign = await MarketingCampaignService.switchRepairTrack({
      campaignId: req.params.id,
      toTrack: parsed.to_track,
      issueType: parsed.issue_type,
      reason: parsed.reason,
      changedBy: req.user?.id,
    }, getCtx(req));
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Enrich campaign contact fields from Google Places API (opt-in, 72h cache)
router.post('/:id/enrich-contact', async (req: any, res: Response) => {
  try {
    const force = req.body?.force === true;
    const { MarketingGbpEnhancerService } = await import('../services/MarketingGbpEnhancerService.js');
    const result = await MarketingGbpEnhancerService.getInstance().populateContactFields(
      req.params.id,
      getCtx(req),
      { force },
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Contact readiness for stage-gate UI check
router.get('/:id/contact-readiness', async (req: any, res: Response) => {
  try {
    const readiness = await MarketingCampaignService.getContactReadiness(req.params.id, getCtx(req));
    res.json({ success: true, data: readiness });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach log (Sprint 2) ────────────────────────────────────────────
const outreachService = MarketingOutreachService.getInstance();

// Log a contact attempt (creates log + fresh-data snapshot + rollup update)
router.post('/:id/outreach', async (req: any, res: Response) => {
  try {
    const parsed = outreachLogSchema.parse(req.body);
    const log = await outreachService.logContact({
      campaignId: req.params.id,
      contactChannel: parsed.contact_channel,
      contactDate: parsed.contact_date,
      outcome: parsed.outcome,
      followUpDate: parsed.follow_up_date,
      notes: parsed.notes,
      messageSnapshot: parsed.message_snapshot,
      messageSubject: parsed.message_subject,
      previewToken: parsed.preview_token,
      contactedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// List the outreach log for a campaign
router.get('/:id/outreach', async (req: any, res: Response) => {
  try {
    const log = await outreachService.listLog(req.params.id, getCtx(req));
    res.json({ success: true, data: log });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a fresh-data snapshot for the contact message composer (pre-send)
router.get('/:id/fresh-snapshot', async (req: any, res: Response) => {
  try {
    const snapshot = await outreachService.buildFreshSnapshot(req.params.id, getCtx(req));
    res.json({ success: true, data: snapshot });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Edit a log entry
router.put('/outreach/:logId', async (req: any, res: Response) => {
  try {
    const parsed = outreachEditSchema.parse(req.body);
    const updated = await outreachService.editLog(req.params.logId, {
      contactChannel: parsed.contact_channel,
      contactDate: parsed.contact_date,
      outcome: parsed.outcome,
      followUpDate: parsed.follow_up_date,
      notes: parsed.notes,
      messageSnapshot: parsed.message_snapshot,
      messageSubject: parsed.message_subject,
      previewToken: parsed.preview_token,
    }, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Delete a log entry
router.delete('/outreach/:logId', async (req: any, res: Response) => {
  try {
    await outreachService.deleteLog(req.params.logId, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Mark a follow-up as completed
router.post('/outreach/:logId/complete', async (req: any, res: Response) => {
  try {
    const updated = await outreachService.completeFollowUp(req.params.logId, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Dashboard: follow-ups due (overdue / due today / this week)
router.get('/follow-ups-due', async (req: any, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);
    const result = await outreachService.getFollowUpsDue({
      from: today,
      to: weekOut,
      assignedTo: req.query.assigned_to as string | undefined,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Hot-prospect (Sprint 3) ────────────────────────────────────────────
const hotProspectService = MarketingHotProspectService.getInstance();

// List hot prospects (dashboard view)
router.get('/hot-prospects', async (req: any, res: Response) => {
  try {
    const prospects = await hotProspectService.listHotProspects({
      stage: req.query.stage as string | undefined,
      city: req.query.city as string | undefined,
      state: req.query.state as string | undefined,
      category: req.query.category as string | undefined,
    }, getCtx(req));
    res.json({ success: true, data: { prospects } });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Operator override: mark hot / not hot
router.put('/:id/hot-prospect', async (req: any, res: Response) => {
  try {
    const parsed = hotProspectOverrideSchema.parse(req.body);
    const campaign = parsed.isHot
      ? await hotProspectService.setHot(req.params.id, parsed.reason || 'Operator marked hot', getCtx(req))
      : await hotProspectService.setNotHot(req.params.id, getCtx(req));
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Clear deprioritization (resume auto-follow-ups)
router.post('/:id/clear-deprioritized', async (req: any, res: Response) => {
  try {
    const campaign = await hotProspectService.clearDeprioritized(req.params.id, getCtx(req));
    res.json({
      success: true,
      data: {
        is_hot_prospect: campaign.is_hot_prospect,
        hot_prospect_deprioritized: campaign.hot_prospect_deprioritized,
        auto_followup_count: campaign.auto_followup_count,
      },
    });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Sprint 4: manually sync a business_analysis audit onto its campaign
router.post('/:id/audits/:auditId/sync', async (req: any, res: Response) => {
  try {
    const report = await hotProspectService.syncFromAudit(req.params.auditId, getCtx(req));
    res.json({ success: true, data: report });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Sprint 5: retrieve persisted sync report for an execution
router.get('/executions/:executionId/sync-report', async (req: any, res: Response) => {
  try {
    const report = await hotProspectService.getSyncReport(req.params.executionId, getCtx(req));
    res.json({ success: true, data: report });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Sprint 5: create a business-scope child campaign from an unmatched scan business
router.post('/:id/derive-from-scan', async (req: any, res: Response) => {
  try {
    const business = req.body?.business;
    if (!business || typeof business !== 'object' || !business.business_name) {
      return res.status(400).json({ success: false, error: 'validation_error', details: [{ message: 'business.business_name is required' }] });
    }
    const result = await hotProspectService.deriveBusinessCampaignFromScanBusiness(
      req.params.id,
      business,
      getCtx(req),
    );
    res.status(result.created ? 201 : 200).json({ success: true, data: result.campaign, created: result.created });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Sprint 5: bulk create business-scope children for all unmatched businesses in a sync report
const deriveAllUnmatchedSchema = z.object({
  executionId: z.string().min(1),
});

router.post('/:id/derive-all-unmatched', async (req: any, res: Response) => {
  try {
    const parsed = deriveAllUnmatchedSchema.parse(req.body);
    const report = await hotProspectService.getSyncReport(parsed.executionId, getCtx(req));
    if (!report || !report.unmatched?.length) {
      return res.json({ success: true, data: { created: [], failed: [], message: 'No unmatched businesses in sync report' } });
    }

    // Load the execution to get the raw output for the full business JSON.
    // The sync report's unmatched entries only have {businessName, reason} —
    // we need the full business objects to seed the child campaigns.
    const execution = await MarketingPromptService.getExecution(parsed.executionId, getCtx(req));
    if (!execution) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Execution not found' });
    }
    const parsedJson = hotProspectService.parseOutputJson(execution.raw_output);
    if (!parsedJson) {
      return res.status(400).json({ success: false, error: 'parse_error', message: 'Could not parse execution output' });
    }
    const businesses: any[] = parsedJson.businesses ?? [];
    const unmatchedNames = new Set(report.unmatched.map((u: any) => (u.businessName || '').toLowerCase().trim()));
    const unmatchedBusinesses = businesses.filter((b) => unmatchedNames.has((b.business_name || '').toLowerCase().trim()));

    const created: Array<{ campaignId: string; businessName: string }> = [];
    const failed: Array<{ businessName: string; error: string }> = [];

    for (const business of unmatchedBusinesses) {
      try {
        const result = await hotProspectService.deriveBusinessCampaignFromScanBusiness(
          req.params.id,
          business,
          getCtx(req),
        );
        created.push({ campaignId: result.campaign.id, businessName: business.business_name });
      } catch (err: any) {
        failed.push({ businessName: business.business_name ?? '', error: err.message ?? 'Unknown error' });
      }
    }

    res.json({ success: true, data: { created, failed } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Manual campaign→tenant link (sets last_touch_source='manual', fires conversion notification)
router.post('/:id/link-tenant', async (req: any, res: Response) => {
  try {
    const parsed = linkTenantSchema.parse(req.body);
    const campaign = await MarketingCampaignService.linkTenant({
      campaignId: req.params.id,
      tenantId: parsed.tenant_id,
      conversionSource: 'manual',
      changedBy: req.user?.id,
    }, getCtx(req));
    res.json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Derive a business-scope child campaign from a discovered competitor.
// Seeds business_name + estimated_tier from the payload; inherits category,
// city, neighborhood, tone, attributes from the parent. Child starts at `seek`.
const deriveBusinessSchema = z.object({
  business_name: z.string().min(1).max(255),
  rating: z.number().min(0).max(5).optional(),
  review_count: z.number().int().min(0).optional(),
  location: z.string().max(500).optional(),
  detected_signals: z.array(z.string()).optional(),
  assigned_to: z.string().optional(),
});

router.post('/:id/derive-business', async (req: any, res: Response) => {
  try {
    const parsed = deriveBusinessSchema.parse(req.body);
    const campaign = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: req.params.id,
      businessName: parsed.business_name,
      rating: parsed.rating,
      reviewCount: parsed.review_count,
      location: parsed.location,
      detectedSignals: parsed.detected_signals,
      assignedTo: parsed.assigned_to ?? req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Generate or retrieve demo storefront for a campaign (idempotent — reuses live demo)
router.get('/:id/demo-storefront', async (req: any, res: Response) => {
  try {
    const result = await MarketingCampaignService.generateDemoStorefront(req.params.id, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// AUDIT ROUTES
// ====================

router.get('/:campaignId/audits', async (req: any, res: Response) => {
  try {
    const audits = await MarketingAuditService.getAuditsByCampaign(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: audits });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/:campaignId/audits', async (req: any, res: Response) => {
  try {
    const parsed = auditCreateSchema.parse(req.body);
    const audit = await MarketingAuditService.createAudit({
      campaignId: req.params.campaignId,
      ...parsed,
    }, getCtx(req));
    res.status(201).json({ success: true, data: audit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/audits/:id', async (req: any, res: Response) => {
  try {
    const parsed = auditUpdateSchema.parse(req.body);
    const audit = await MarketingAuditService.updateAudit(req.params.id, parsed, getCtx(req));
    res.json({ success: true, data: audit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/audits/:id', async (req: any, res: Response) => {
  try {
    await MarketingAuditService.deleteAudit(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// FILE ROUTES
// ====================

router.get('/:campaignId/files', async (req: any, res: Response) => {
  try {
    const files = await MarketingFileService.getFilesByCampaign(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: files });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/:campaignId/files', async (req: any, res: Response) => {
  try {
    const parsed = fileCreateSchema.parse(req.body);
    const file = await MarketingFileService.createFile({
      campaignId: req.params.campaignId,
      fileType: parsed.file_type,
      fileName: parsed.file_name,
      storagePath: parsed.storage_path,
      fileSize: parsed.file_size,
      mimeType: parsed.mime_type,
      uploadedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: file });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/files/:id', async (req: any, res: Response) => {
  try {
    await MarketingFileService.deleteFile(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// PROMPT TEMPLATE ROUTES
// ====================

router.get('/prompts/templates', async (req: any, res: Response) => {
  try {
    const templates = await MarketingPromptService.listTemplates({
      promptType: req.query.prompt_type,
      scope: req.query.scope,
      category: req.query.category,
      isActive: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    }, getCtx(req));
    res.json({ success: true, data: templates });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/prompts/templates', async (req: any, res: Response) => {
  try {
    const parsed = promptTemplateCreateSchema.parse(req.body);
    const template = await MarketingPromptService.createTemplate({
      name: parsed.name,
      promptType: parsed.prompt_type,
      scope: parsed.scope,
      category: parsed.category,
      tone: parsed.tone,
      body: parsed.body,
      variables: parsed.variables,
      outputSchema: parsed.output_schema,
      isDefault: parsed.is_default,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/prompts/templates/:id', async (req: any, res: Response) => {
  try {
    const parsed = promptTemplateUpdateSchema.parse(req.body);
    const template = await MarketingPromptService.updateTemplate(req.params.id, {
      name: parsed.name,
      promptType: parsed.prompt_type,
      scope: parsed.scope,
      category: parsed.category,
      tone: parsed.tone,
      body: parsed.body,
      variables: parsed.variables,
      outputSchema: parsed.output_schema,
      isDefault: parsed.is_default,
    }, getCtx(req));
    res.json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/prompts/templates/:id', async (req: any, res: Response) => {
  try {
    await MarketingPromptService.deleteTemplate(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/prompts/templates/:id/clone', async (req: any, res: Response) => {
  try {
    const parsed = promptTemplateCloneSchema.parse(req.body);
    const template = await MarketingPromptService.cloneTemplate(req.params.id, {
      name: parsed.name,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/prompts/templates/:id/render', async (req: any, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'campaignId query parameter is required' });
    }
    let variables: Record<string, any> | undefined;
    if (req.query.variables) {
      try {
        variables = JSON.parse(req.query.variables as string);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid variables JSON' });
      }
    }
    const rendered = await MarketingExecutionService.renderPrompt({
      templateId: req.params.id,
      campaignId,
      variables,
    }, getCtx(req));
    res.json({ success: true, data: { rendered_prompt: rendered } });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// PROMPT EXECUTION ROUTES
// ====================

router.get('/prompts/executions', async (req: any, res: Response) => {
  try {
    const executions = await MarketingPromptService.listExecutions(req.query.campaign_id, getCtx(req));
    res.json({ success: true, data: executions });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /prompts/executions/external — import an external agent's JSON result
// Must be registered BEFORE /:id to avoid the catch-all.
router.post('/prompts/executions/external', async (req: any, res: Response) => {
  try {
    const parsed = externalExecutionCreateSchema.parse(req.body);
    const result = await MarketingPromptService.importExternalResult({
      campaignId: parsed.campaign_id,
      templateId: parsed.template_id,
      rawOutput: parsed.raw_output,
      source: parsed.source,
      costCents: parsed.cost_cents,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    // Scope mismatches and validation failures are 400s, not 500s.
    const msg = (error as Error).message || '';
    if (/scope .* is not compatible/i.test(msg) || /out-of-scope variables/i.test(msg)) {
      return res.status(400).json({ success: false, error: 'scope_mismatch', message: msg });
    }
    if (/not valid JSON/i.test(msg) || /does not match .* output schema/i.test(msg) || /does not declare a recognized output_schema/i.test(msg)) {
      return res.status(400).json({ success: false, error: 'validation_error', message: msg });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/prompts/executions/:id', async (req: any, res: Response) => {
  try {
    const execution = await MarketingPromptService.getExecution(req.params.id, getCtx(req));
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    res.json({ success: true, data: execution });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/prompts/executions', async (req: any, res: Response) => {
  try {
    const parsed = executionCreateSchema.parse(req.body);
    const execution = await MarketingExecutionService.executeSingle({
      campaignId: parsed.campaign_id,
      templateId: parsed.template_id || '',
      variables: parsed.variables_used,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: execution });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/prompts/executions/batch', async (req: any, res: Response) => {
  try {
    const parsed = batchExecutionSchema.parse(req.body);
    const results = await MarketingExecutionService.executeBatch({
      campaignIds: parsed.campaign_ids,
      templateId: parsed.template_id,
      variables: parsed.variables,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.json({ success: true, data: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/prompts/executions/:id', async (req: any, res: Response) => {
  try {
    const parsed = executionUpdateSchema.parse(req.body);
    const execution = await MarketingPromptService.updateExecution(req.params.id, {
      rawOutput: parsed.raw_output,
      filteredOutput: parsed.filtered_output,
      passRate: parsed.pass_rate,
      flaggedCount: parsed.flagged_count,
      status: parsed.status,
      aiProvider: parsed.ai_provider,
      aiModel: parsed.ai_model,
      tokensUsed: parsed.tokens_used,
      costCents: parsed.cost_cents,
    }, getCtx(req));
    res.json({ success: true, data: execution });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// FILTER FLAG ROUTES
// ====================

router.get('/prompts/filter-flags', async (req: any, res: Response) => {
  try {
    const flags = await MarketingPromptService.listFilterFlags(req.query.execution_id, req.query.status, getCtx(req));
    res.json({ success: true, data: flags });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/prompts/filter-flags/:id', async (req: any, res: Response) => {
  try {
    const parsed = filterFlagUpdateSchema.parse(req.body);
    const flag = await MarketingPromptService.updateFilterFlag(req.params.id, {
      humanOverride: parsed.human_override,
      status: parsed.status,
      reviewedBy: req.user?.id,
    }, getCtx(req));
    res.json({ success: true, data: flag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// SCORECARD ROUTES
// ====================

router.get('/scorecards', async (req: any, res: Response) => {
  try {
    const scorecards = await MarketingScorecardService.listScorecards({
      userId: req.query.user_id,
      startDate: req.query.start_date ? new Date(req.query.start_date) : undefined,
      endDate: req.query.end_date ? new Date(req.query.end_date) : undefined,
      scopeFocus: req.query.scope,
      stageFocus: req.query.stage,
    }, getCtx(req));
    res.json({ success: true, data: scorecards });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/scorecards', async (req: any, res: Response) => {
  try {
    const parsed = scorecardUpsertSchema.parse(req.body);
    const scorecard = await MarketingScorecardService.upsertScorecard({
      userId: parsed.user_id,
      date: new Date(parsed.date),
      categoryFocus: parsed.category_focus,
      neighborhoodFocus: parsed.neighborhood_focus,
      scopeFocus: parsed.scope_focus,
      stageFocus: parsed.stage_focus,
      previewsBuilt: parsed.previews_built,
      previewsShown: parsed.previews_shown,
      packagesPaid: parsed.packages_paid,
      packagesDelivered: parsed.packages_delivered,
      revenueCollectedCents: parsed.revenue_collected_cents,
      retainersPitched: parsed.retainers_pitched,
      retainersWon: parsed.retainers_won,
      notes: parsed.notes,
    }, getCtx(req));
    res.json({ success: true, data: scorecard });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/scorecards/:id', async (req: any, res: Response) => {
  try {
    const parsed = scorecardUpdateSchema.parse(req.body);
    const scorecard = await MarketingScorecardService.updateScorecard(req.params.id, {
      userId: parsed.user_id,
      date: parsed.date ? new Date(parsed.date) : undefined,
      categoryFocus: parsed.category_focus,
      neighborhoodFocus: parsed.neighborhood_focus,
      scopeFocus: parsed.scope_focus,
      stageFocus: parsed.stage_focus,
      previewsBuilt: parsed.previews_built,
      previewsShown: parsed.previews_shown,
      packagesPaid: parsed.packages_paid,
      packagesDelivered: parsed.packages_delivered,
      revenueCollectedCents: parsed.revenue_collected_cents,
      retainersPitched: parsed.retainers_pitched,
      retainersWon: parsed.retainers_won,
      notes: parsed.notes,
    }, getCtx(req));
    res.json({ success: true, data: scorecard });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/scorecards/:id', async (req: any, res: Response) => {
  try {
    await MarketingScorecardService.deleteScorecard(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// DELIVERABLE TEMPLATE ROUTES
// ====================

router.get('/deliverable-templates', async (req: any, res: Response) => {
  try {
    const templates = await MarketingDeliverableService.listTemplates({
      deliverableType: req.query.deliverable_type,
      category: req.query.category,
      isActive: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    }, getCtx(req));
    res.json({ success: true, data: templates });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/deliverable-templates', async (req: any, res: Response) => {
  try {
    const parsed = deliverableTemplateCreateSchema.parse(req.body);
    const template = await MarketingDeliverableService.createTemplate({
      name: parsed.name,
      deliverableType: parsed.deliverable_type,
      category: parsed.category,
      layoutSpec: parsed.layout_spec,
      pageSize: parsed.page_size,
      orientation: parsed.orientation,
      isDefault: parsed.is_default,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/deliverable-templates/:id', async (req: any, res: Response) => {
  try {
    const parsed = deliverableTemplateUpdateSchema.parse(req.body);
    const template = await MarketingDeliverableService.updateTemplate(req.params.id, {
      name: parsed.name,
      deliverableType: parsed.deliverable_type,
      category: parsed.category,
      layoutSpec: parsed.layout_spec,
      pageSize: parsed.page_size,
      orientation: parsed.orientation,
      isDefault: parsed.is_default,
    }, getCtx(req));
    res.json({ success: true, data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/deliverable-templates/:id', async (req: any, res: Response) => {
  try {
    await MarketingDeliverableService.deleteTemplate(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// DELIVERABLE ROUTES
// ====================

router.get('/:campaignId/deliverables', async (req: any, res: Response) => {
  try {
    const deliverables = await MarketingDeliverableService.listDeliverables({
      campaignId: req.params.campaignId,
      status: req.query.status,
      deliverableType: req.query.deliverable_type,
    }, getCtx(req));
    res.json({ success: true, data: deliverables });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/:campaignId/deliverables', async (req: any, res: Response) => {
  try {
    const parsed = deliverableCreateSchema.parse(req.body);
    const deliverable = await MarketingDeliverableService.createDeliverable({
      campaignId: req.params.campaignId,
      executionId: parsed.execution_id,
      templateId: parsed.template_id,
      deliverableType: parsed.deliverable_type,
      status: parsed.status,
      fileName: parsed.file_name,
      storagePath: parsed.storage_path,
      fileSize: parsed.file_size,
      mimeType: parsed.mime_type,
      isWatermarked: parsed.is_watermarked,
      brandingApplied: parsed.branding_applied,
      sentAt: parsed.sent_at ? new Date(parsed.sent_at) : undefined,
      sentMethod: parsed.sent_method,
      generatedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: deliverable });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/deliverables/:id', async (req: any, res: Response) => {
  try {
    const parsed = deliverableUpdateSchema.parse(req.body);
    const deliverable = await MarketingDeliverableService.updateDeliverable(req.params.id, {
      executionId: parsed.execution_id,
      templateId: parsed.template_id,
      deliverableType: parsed.deliverable_type,
      status: parsed.status,
      fileName: parsed.file_name,
      storagePath: parsed.storage_path,
      fileSize: parsed.file_size,
      mimeType: parsed.mime_type,
      isWatermarked: parsed.is_watermarked,
      brandingApplied: parsed.branding_applied,
      sentAt: parsed.sent_at ? new Date(parsed.sent_at) : undefined,
      sentMethod: parsed.sent_method,
    }, getCtx(req));
    res.json({ success: true, data: deliverable });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/deliverables/:id', async (req: any, res: Response) => {
  try {
    await MarketingDeliverableService.deleteDeliverable(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// BRANDING ROUTES
// ====================

router.get('/branding', async (req: any, res: Response) => {
  try {
    const configs = await MarketingBrandingService.listConfigs(getCtx(req));
    res.json({ success: true, data: configs });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/branding/active', async (req: any, res: Response) => {
  try {
    const config = await MarketingBrandingService.getActiveConfig(getCtx(req));
    res.json({ success: true, data: config });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/branding', async (req: any, res: Response) => {
  try {
    const parsed = brandingCreateSchema.parse(req.body);
    const config = await MarketingBrandingService.createConfig({
      operatorName: parsed.operator_name,
      operatorLogoUrl: parsed.operator_logo_url,
      primaryColor: parsed.primary_color,
      accentColor: parsed.accent_color,
      textColor: parsed.text_color,
      fontFamily: parsed.font_family,
      footerDisclaimer: parsed.footer_disclaimer,
      isActive: parsed.is_active,
    }, getCtx(req));
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/branding/:id', async (req: any, res: Response) => {
  try {
    const parsed = brandingUpdateSchema.parse(req.body);
    const config = await MarketingBrandingService.updateConfig(req.params.id, {
      operatorName: parsed.operator_name,
      operatorLogoUrl: parsed.operator_logo_url,
      primaryColor: parsed.primary_color,
      accentColor: parsed.accent_color,
      textColor: parsed.text_color,
      fontFamily: parsed.font_family,
      footerDisclaimer: parsed.footer_disclaimer,
      isActive: parsed.is_active,
    }, getCtx(req));
    res.json({ success: true, data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/branding/:id', async (req: any, res: Response) => {
  try {
    await MarketingBrandingService.deleteConfig(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// DELIVERABLE GENERATION ROUTES
// ====================

const deliverableGenerateSchema = z.object({
  template_id: z.string().optional(),
  execution_id: z.string().optional(),
  deliverable_type: z.enum(['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet']),
  is_preview: z.boolean().default(true),
  content: z.string().optional(),
});

const deliverableSendSchema = z.object({
  sent_method: z.enum(['email', 'sms', 'hand_delivery', 'portal_download', 'other']),
});

router.post('/:campaignId/deliverables/generate', async (req: any, res: Response) => {
  try {
    const parsed = deliverableGenerateSchema.parse(req.body);
    const deliverable = await MarketingDeliverableService.generateDeliverable({
      campaignId: req.params.campaignId,
      templateId: parsed.template_id,
      executionId: parsed.execution_id,
      deliverableType: parsed.deliverable_type,
      isPreview: parsed.is_preview,
      content: parsed.content,
      generatedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: deliverable });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/deliverables/:id/download', async (req: any, res: Response) => {
  try {
    const fileInfo = await MarketingDeliverableService.getDeliverableFilePath(req.params.id, getCtx(req));
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Deliverable file not found' });
    }
    const pdfBuffer = fs.readFileSync(fileInfo.filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileInfo.fileName)}`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/deliverables/:id/send', async (req: any, res: Response) => {
  try {
    const parsed = deliverableSendSchema.parse(req.body);
    const deliverable = await MarketingDeliverableService.markAsSent(req.params.id, parsed.sent_method, getCtx(req));
    res.json({ success: true, data: deliverable });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// NOTE: /:id must be registered AFTER all static single-segment GET routes
// (e.g. /scorecards, /deliverable-templates, /branding) to avoid being shadowed

// ====================
// PRICING (Payment Collection Sprint)
// ====================

router.get('/pricing/service-categories', async (req: any, res: Response) => {
  try {
    const categories = await MarketingServiceCategoryService.listCategories(req.ctx);
    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to list service categories', req.ctx, { error: (error as Error).message });
    res.status(500).json({ success: false, error: 'failed_to_list_service_categories' });
  }
});

const createServiceCategorySchema = z.object({
  value: z.string().min(1, 'value is required'),
  label: z.string().min(1, 'label is required'),
  isActive: z.boolean().optional(),
});

router.post('/pricing/service-categories', async (req: any, res: Response) => {
  try {
    const parsed = createServiceCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const category = await MarketingServiceCategoryService.upsertCategory(parsed.data, req.ctx);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    logger.error('Failed to create service category', req.ctx, { error: (error as Error).message });
    res.status(500).json({ success: false, error: 'failed_to_create_service_category' });
  }
});

const updatePricingSchema = z.object({
  packagePriceCents: z.number().int().min(0).optional(),
  subscriptionTierId: z.string().optional(),
  couponCode: z.string().optional(),
  serviceCategory: z.string().optional(),
});

router.put('/:id/pricing', async (req: any, res: Response) => {
  try {
    const parsed = updatePricingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const updated = await MarketingCampaignService.updateCampaign(req.params.id, parsed.data, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/:id/revenue', async (req: any, res: Response) => {
  try {
    const revenue = await MarketingCampaignService.getCampaignRevenue(req.params.id, getCtx(req));
    res.json({ success: true, data: revenue });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Openers ───────────────────────────────────────────────────
// IMPORTANT: These routes MUST be declared before router.get('/:id', ...) below,
// otherwise Express matches /openers as a campaign ID param and returns 404.
// Dual execution path mirroring the Prompt Workspace:
//   Path 1 (execute): deterministic archetype selection + LLM + quality gate
//   Path 2 (import):  quality gate on externally-pasted opener text
const outreachOpenerService = OutreachOpenerService.getInstance();

// Zod schemas for opener endpoints
const openerExecuteSchema = z.object({
  campaign_id: z.string().min(1),
  close_variant: z.enum(['soft', 'direct_paid']).optional(),
  operator_name: z.string().max(120).optional(),
});

const openerImportSchema = z.object({
  campaign_id: z.string().min(1),
  opener_text: z.string().min(1),
  close_variant: z.enum(['soft', 'direct_paid']).optional(),
  operator_name: z.string().max(120).optional(),
});

// List openers (filter: campaignId)
router.get('/openers', async (req: any, res: Response) => {
  try {
    const openers = await outreachOpenerService.listOpeners(
      req.query.campaignId as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: openers });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Resolve archetype + extracted fields + prompt for a campaign (no AI call)
// Used by the workspace UI to display the detected archetype + resolved prompt
// before the user clicks Execute (Path 1) or copies the prompt for external use (Path 2).
router.get('/openers/resolve', async (req: any, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'campaignId query parameter is required' });
    }
    const closeVariant = req.query.close_variant as 'soft' | 'direct_paid' | undefined;
    const operatorName = req.query.operator_name as string | undefined;
    const result = await outreachOpenerService.resolveOpener(campaignId, closeVariant, getCtx(req), operatorName);
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 1: Execute opener generation via AI
router.post('/openers/execute', async (req: any, res: Response) => {
  try {
    const parsed = openerExecuteSchema.parse(req.body);
    const result = await outreachOpenerService.executeOpener({
      campaignId: parsed.campaign_id,
      closeVariant: parsed.close_variant,
      executedBy: req.user?.id,
      operatorName: parsed.operator_name,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 2: Import externally-generated opener
router.post('/openers/import', async (req: any, res: Response) => {
  try {
    const parsed = openerImportSchema.parse(req.body);
    const result = await outreachOpenerService.importOpener({
      campaignId: parsed.campaign_id,
      openerText: parsed.opener_text,
      closeVariant: parsed.close_variant,
      executedBy: req.user?.id,
      operatorName: parsed.operator_name,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Split-test analytics — cohort comparison by close_variant
router.get('/openers/split-tests', async (req: any, res: Response) => {
  try {
    const result = await outreachOpenerService.getSplitTestStats(getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Follow-Ups ─────────────────────────────────────────────────
// Follow-up messages for prospects who didn't reply to the opener.
// Stored in the same table (mkt_outreach_openers_list) with
// message_type='follow_up'. Inherits the opener's close_variant.

import { OutreachFollowUpService } from '../services/OutreachFollowUpService';
const outreachFollowUpService = OutreachFollowUpService.getInstance();

const followUpExecuteSchema = z.object({
  campaign_id: z.string().min(1),
  close_variant: z.enum(['soft', 'direct_paid']).optional(),
  operator_name: z.string().max(120).optional(),
});

const followUpImportSchema = z.object({
  campaign_id: z.string().min(1),
  followup_text: z.string().min(1),
  close_variant: z.enum(['soft', 'direct_paid']).optional(),
  followup_type: z.enum(['doing', 'telling']).optional(),
  operator_name: z.string().max(120).optional(),
});

// List follow-ups (filter: campaignId)
router.get('/follow-ups', async (req: any, res: Response) => {
  try {
    const followUps = await outreachFollowUpService.listFollowUps(
      req.query.campaignId as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: followUps });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Resolve follow-up: find opener, re-pull fresh data, diff, auto-select
// doing/telling branch, build the prompt. No LLM call.
router.get('/follow-ups/resolve', async (req: any, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'campaignId query parameter is required' });
    }
    const closeVariant = req.query.close_variant as 'soft' | 'direct_paid' | undefined;
    const operatorName = req.query.operator_name as string | undefined;
    const result = await outreachFollowUpService.resolveFollowUp(
      { campaignId, closeVariant, operatorName },
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 1: Execute follow-up generation via AI
router.post('/follow-ups/execute', async (req: any, res: Response) => {
  try {
    const parsed = followUpExecuteSchema.parse(req.body);
    const result = await outreachFollowUpService.executeFollowUp({
      campaignId: parsed.campaign_id,
      closeVariant: parsed.close_variant,
      executedBy: req.user?.id,
      operatorName: parsed.operator_name,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 2: Import externally-generated follow-up
router.post('/follow-ups/import', async (req: any, res: Response) => {
  try {
    const parsed = followUpImportSchema.parse(req.body);
    const result = await outreachFollowUpService.importFollowUp({
      campaignId: parsed.campaign_id,
      followUpText: parsed.followup_text,
      closeVariant: parsed.close_variant,
      followUpType: parsed.followup_type,
      executedBy: req.user?.id,
      operatorName: parsed.operator_name,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Pitch — Headers ────────────────────────────────────────────
// IMPORTANT: These routes MUST be declared before router.get('/openers/:id', ...)
// below, otherwise Express matches /openers/headers as :id='headers' and returns 404.
// The /openers/:id route has been moved to after all pitch sub-routes.
const headerExecuteSchema = z.object({
  campaign_id: z.string().min(1),
});
const headerImportSchema = z.object({
  campaign_id: z.string().min(1),
  header_text: z.string().min(1),
});

// List header variants (filter: campaignId)
router.get('/openers/headers', async (req: any, res: Response) => {
  try {
    const headers = await HeaderService.listHeaders(
      req.query.campaignId as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: headers });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Resolve header prompt for a campaign (no AI call) — for Path 2 prompt display
router.get('/openers/headers/resolve', async (req: any, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'campaignId query parameter is required' });
    }
    const result = await HeaderService.resolveHeader(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 1: Execute header generation via AI
router.post('/openers/headers/execute', async (req: any, res: Response) => {
  try {
    const parsed = headerExecuteSchema.parse(req.body);
    const result = await HeaderService.executeHeader({
      campaignId: parsed.campaign_id,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 2: Import externally-generated header
router.post('/openers/headers/import', async (req: any, res: Response) => {
  try {
    const parsed = headerImportSchema.parse(req.body);
    const result = await HeaderService.importHeader({
      campaignId: parsed.campaign_id,
      headerText: parsed.header_text,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a single header by ID
router.get('/openers/headers/:id', async (req: any, res: Response) => {
  try {
    const header = await HeaderService.getHeader(req.params.id, getCtx(req));
    if (!header) {
      return res.status(404).json({ success: false, error: 'Header not found' });
    }
    res.json({ success: true, data: header });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Pitch — Closers ────────────────────────────────────────────
const closerExecuteSchema = z.object({
  campaign_id: z.string().min(1),
});
const closerImportSchema = z.object({
  campaign_id: z.string().min(1),
  closer_text: z.string().min(1),
});

// List closer variants (filter: campaignId)
router.get('/openers/closers', async (req: any, res: Response) => {
  try {
    const closers = await CloserService.listClosers(
      req.query.campaignId as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: closers });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Resolve closer prompt + default template for a campaign (no AI call)
router.get('/openers/closers/resolve', async (req: any, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'campaignId query parameter is required' });
    }
    const result = await CloserService.resolveCloser(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 1: Execute closer generation via AI
router.post('/openers/closers/execute', async (req: any, res: Response) => {
  try {
    const parsed = closerExecuteSchema.parse(req.body);
    const result = await CloserService.executeCloser({
      campaignId: parsed.campaign_id,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 2: Import externally-generated or template-edited closer
router.post('/openers/closers/import', async (req: any, res: Response) => {
  try {
    const parsed = closerImportSchema.parse(req.body);
    const result = await CloserService.importCloser({
      campaignId: parsed.campaign_id,
      closerText: parsed.closer_text,
      executedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a single closer by ID
router.get('/openers/closers/:id', async (req: any, res: Response) => {
  try {
    const closer = await CloserService.getCloser(req.params.id, getCtx(req));
    if (!closer) {
      return res.status(404).json({ success: false, error: 'Closer not found' });
    }
    res.json({ success: true, data: closer });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Pitch — Contacts (optional footer, no AI) ──────────────────
const contactCreateSchema = z.object({
  campaign_id: z.string().min(1),
  contact_text: z.string().min(1),
  label: z.string().max(100).optional(),
});
const contactUpdateSchema = z.object({
  contact_text: z.string().min(1).optional(),
  label: z.string().max(100).optional(),
});

// List contact variants (filter: campaignId)
router.get('/openers/contacts', async (req: any, res: Response) => {
  try {
    const contacts = await ContactService.listContacts(
      req.query.campaignId as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: contacts });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Create contact variant
router.post('/openers/contacts', async (req: any, res: Response) => {
  try {
    const parsed = contactCreateSchema.parse(req.body);
    const contact = await ContactService.createContact({
      campaignId: parsed.campaign_id,
      contactText: parsed.contact_text,
      label: parsed.label,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Update contact variant
router.put('/openers/contacts/:id', async (req: any, res: Response) => {
  try {
    const parsed = contactUpdateSchema.parse(req.body);
    const contact = await ContactService.updateContact(req.params.id, {
      contactText: parsed.contact_text,
      label: parsed.label,
    }, getCtx(req));
    res.json({ success: true, data: contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Delete contact variant
router.delete('/openers/contacts/:id', async (req: any, res: Response) => {
  try {
    await ContactService.deleteContact(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a single contact by ID
router.get('/openers/contacts/:id', async (req: any, res: Response) => {
  try {
    const contact = await ContactService.getContact(req.params.id, getCtx(req));
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }
    res.json({ success: true, data: contact });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Pitch — Review Response Drafts (no persistence) ────────────
// Returns a draft for one preview slot. The caller (UI) collects 3 drafts
// and passes them to POST /openers/pitches for assembly + persistence.
const reviewResponseGenerateSchema = z.object({
  campaign_id: z.string().min(1),
  review_text: z.string().min(1),
});
const reviewResponseImportSchema = z.object({
  campaign_id: z.string().min(1),
  review_text: z.string().min(1),
  response_text: z.string().min(1),
});

// Path 1: AI draft owner response using campaign tone
router.post('/openers/review-responses/generate', async (req: any, res: Response) => {
  try {
    const parsed = reviewResponseGenerateSchema.parse(req.body);
    const draft = await ReviewResponseDraftService.generateResponse({
      campaignId: parsed.campaign_id,
      reviewText: parsed.review_text,
    }, getCtx(req));
    res.status(200).json({ success: true, data: draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Path 2: Import externally-drafted owner response (validate non-empty)
router.post('/openers/review-responses/import', async (req: any, res: Response) => {
  try {
    const parsed = reviewResponseImportSchema.parse(req.body);
    const draft = await ReviewResponseDraftService.importResponse({
      campaignId: parsed.campaign_id,
      reviewText: parsed.review_text,
      responseText: parsed.response_text,
    }, getCtx(req));
    res.status(200).json({ success: true, data: draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach Pitch — Assembly ───────────────────────────────────────────
const pitchAssembleSchema = z.object({
  campaign_id: z.string().min(1),
  opener_id: z.string().min(1),
  header_id: z.string().nullable().optional(),
  closer_id: z.string().nullable().optional(),
  contact_id: z.string().nullable().optional(),
  review_pairs: z.array(
    z.object({
      review_text: z.string().min(1),
      response_text: z.string().min(1),
      response_source: z.enum(['ai', 'external']),
      response_ai_provider: z.string().nullable().optional(),
      response_ai_model: z.string().nullable().optional(),
      response_tokens_used: z.number().optional(),
      is_negative_first: z.boolean(),
    }),
  ).min(1),
});

// List assembled pitches (filter: campaignId)
router.get('/openers/pitches', async (req: any, res: Response) => {
  try {
    const pitches = await PitchService.listPitches(
      req.query.campaignId as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: pitches });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Assemble + persist a full pitch from variant IDs + review pairs
router.post('/openers/pitches', async (req: any, res: Response) => {
  try {
    const parsed = pitchAssembleSchema.parse(req.body);
    const result = await PitchService.assemblePitch({
      campaignId: parsed.campaign_id,
      openerId: parsed.opener_id,
      headerId: parsed.header_id,
      closerId: parsed.closer_id,
      contactId: parsed.contact_id,
      reviewPairs: parsed.review_pairs,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a single assembled pitch by ID
router.get('/openers/pitches/:id', async (req: any, res: Response) => {
  try {
    const pitch = await PitchService.getPitch(req.params.id, getCtx(req));
    if (!pitch) {
      return res.status(404).json({ success: false, error: 'Pitch not found' });
    }
    res.json({ success: true, data: pitch });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a single opener by ID — MUST be declared after all /openers/* sub-routes
// (headers, closers, contacts, review-responses, pitches) to avoid Express
// matching /openers/headers as :id='headers'. See route ordering comment above.
router.get('/openers/:id', async (req: any, res: Response) => {
  try {
    const opener = await outreachOpenerService.getOpener(req.params.id, getCtx(req));
    if (!opener) {
      return res.status(404).json({ success: false, error: 'Opener not found' });
    }
    res.json({ success: true, data: opener });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// PLAYBOOK CATALOG ROUTES (Sprint 3 — Triage Engine)
// ====================
// IMPORTANT: These routes MUST be declared before router.get('/:id', ...) below,
// otherwise Express matches /playbooks as a campaign ID param and returns 404.
// Same hazard as /openers above.

router.get('/playbooks', async (req: any, res: Response) => {
  try {
    const playbooks = await MarketingPlaybookCatalogService.listPlaybooks({
      category: req.query.category,
      archetype: req.query.archetype,
      isActive: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    }, getCtx(req));
    res.json({ success: true, data: playbooks });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/playbooks/:id', async (req: any, res: Response) => {
  try {
    const playbook = await MarketingPlaybookCatalogService.getPlaybook(req.params.id, getCtx(req));
    res.json({ success: true, data: playbook });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/playbooks', async (req: any, res: Response) => {
  try {
    const parsed = playbookCreateSchema.parse(req.body);
    const playbook = await MarketingPlaybookCatalogService.createPlaybook({
      code: parsed.code,
      name: parsed.name,
      category: parsed.category,
      archetype: parsed.archetype,
      description: parsed.description,
      matchingRules: parsed.matching_rules,
      priorityRank: parsed.priority_rank,
      fitdOfferTitle: parsed.fitd_offer_title,
      fitdDefaultFeeCents: parsed.fitd_default_fee_cents,
      retainerPitchTitle: parsed.retainer_pitch_title,
      retainerFeeCents: parsed.retainer_fee_cents,
      openerPromptTemplateId: parsed.opener_prompt_template_id,
      previewDeliverableType: parsed.preview_deliverable_type,
      isActive: parsed.is_active,
    }, getCtx(req));
    res.status(201).json({ success: true, data: playbook });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/playbooks/:id', async (req: any, res: Response) => {
  try {
    const parsed = playbookUpdateSchema.parse(req.body);
    const playbook = await MarketingPlaybookCatalogService.updatePlaybook(req.params.id, {
      name: parsed.name,
      category: parsed.category,
      archetype: parsed.archetype,
      description: parsed.description,
      matchingRules: parsed.matching_rules,
      priorityRank: parsed.priority_rank,
      fitdOfferTitle: parsed.fitd_offer_title,
      fitdDefaultFeeCents: parsed.fitd_default_fee_cents,
      retainerPitchTitle: parsed.retainer_pitch_title,
      retainerFeeCents: parsed.retainer_fee_cents,
      openerPromptTemplateId: parsed.opener_prompt_template_id,
      previewDeliverableType: parsed.preview_deliverable_type,
      isActive: parsed.is_active,
    }, getCtx(req));
    res.json({ success: true, data: playbook });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/playbooks/:id', async (req: any, res: Response) => {
  try {
    await MarketingPlaybookCatalogService.deletePlaybook(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Bulk priority_rank reorder — the cascade reorder affordance for the admin
// table (Sprint 3 route + Sprint 4 UI). Reordering IS retuning the cascade.
router.put('/playbooks/reorder', async (req: any, res: Response) => {
  try {
    const parsed = playbookReorderSchema.parse(req.body);
    const updated = await MarketingPlaybookCatalogService.reorderPlaybooks(
      parsed.rankings.map((r) => ({ id: r.id, priorityRank: r.priority_rank })),
      getCtx(req),
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// SIGNAL REGISTRY ROUTES (Sprint 3 — Triage Engine)
// ====================
// IMPORTANT: These routes MUST be declared before router.get('/:id', ...)
// below, otherwise Express matches /signals as a campaign ID param.
// Same hazard as /playbooks and /openers above.

router.get('/signals', async (req: any, res: Response) => {
  try {
    const signals = await MarketingSignalRegistryService.listSignals({
      family: req.query.family,
      isActive: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      detectionSource: req.query.detection_source,
    }, getCtx(req));
    res.json({ success: true, data: signals });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/signals/:id', async (req: any, res: Response) => {
  try {
    const signal = await MarketingSignalRegistryService.getSignal(req.params.id, getCtx(req));
    res.json({ success: true, data: signal });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/signals', async (req: any, res: Response) => {
  try {
    const parsed = signalCreateSchema.parse(req.body);
    const signal = await MarketingSignalRegistryService.createSignal({
      code: parsed.code,
      family: parsed.family,
      label: parsed.label,
      description: parsed.description,
      detectionSource: parsed.detection_source,
      derivedRule: parsed.derived_rule,
      isActive: parsed.is_active,
    }, getCtx(req));
    res.status(201).json({ success: true, data: signal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/signals/:id', async (req: any, res: Response) => {
  try {
    const parsed = signalUpdateSchema.parse(req.body);
    const signal = await MarketingSignalRegistryService.updateSignal(req.params.id, {
      family: parsed.family,
      label: parsed.label,
      description: parsed.description,
      detectionSource: parsed.detection_source,
      derivedRule: parsed.derived_rule,
      isActive: parsed.is_active,
    }, getCtx(req));
    res.json({ success: true, data: signal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/signals/:id', async (req: any, res: Response) => {
  try {
    await MarketingSignalRegistryService.deleteSignal(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/signals/:id/activate', async (req: any, res: Response) => {
  try {
    const parsed = signalActivateSchema.parse(req.body);
    const signal = await MarketingSignalRegistryService.setSignalActive(
      req.params.id,
      parsed.is_active,
      getCtx(req),
    );
    res.json({ success: true, data: signal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/:id', async (req: any, res: Response) => {
  try {
    const campaign = await MarketingCampaignService.getCampaign(req.params.id, getCtx(req));
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// CATEGORY-TONE PRESET ROUTES
// ====================

const categoryTonePresetCreateSchema = z.object({
  category: z.string().min(1).max(100),
  tone: z.string().min(1).max(50),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

const categoryTonePresetUpdateSchema = categoryTonePresetCreateSchema.partial();

router.get('/category-tone-presets', async (req: any, res: Response) => {
  try {
    const presets = await MarketingCategoryToneService.listPresets(getCtx(req));
    res.json({ success: true, data: presets });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/category-tone-presets', async (req: any, res: Response) => {
  try {
    const parsed = categoryTonePresetCreateSchema.parse(req.body);
    const preset = await MarketingCategoryToneService.upsertPreset({
      category: parsed.category,
      tone: parsed.tone,
      description: parsed.description,
      isActive: parsed.is_active,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: preset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/category-tone-presets/:id', async (req: any, res: Response) => {
  try {
    const parsed = categoryTonePresetUpdateSchema.parse(req.body);
    const preset = await MarketingCategoryToneService.upsertPreset({
      category: parsed.category || '',
      tone: parsed.tone || '',
      description: parsed.description,
      isActive: parsed.is_active,
      createdBy: req.user?.id,
    }, getCtx(req));
    res.json({ success: true, data: preset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/category-tone-presets/:id', async (req: any, res: Response) => {
  try {
    await MarketingCategoryToneService.deletePreset(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Review-response pipeline (Sprint 5 — Option B) ─────────────────────
const reviewResponseService = ReviewResponseService.getInstance();

// Create a pipeline for a (campaign, platform) pair (idempotent)
router.post('/:id/review-response/pipelines', async (req: any, res: Response) => {
  try {
    const parsed = reviewPipelineCreateSchema.parse(req.body);
    const pipeline = await reviewResponseService.createPipeline({
      campaignId: req.params.id,
      platform: parsed.platform,
      totalReviews: parsed.total_reviews,
      unansweredCount: parsed.unanswered_count,
      responseRate: parsed.response_rate,
      averageRating: parsed.average_rating,
      metadata: parsed.metadata,
    }, getCtx(req));
    res.status(201).json({ success: true, data: pipeline });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// List all pipelines for a campaign (ordered by priority)
router.get('/:id/review-response/pipelines', async (req: any, res: Response) => {
  try {
    const pipelines = await reviewResponseService.listPipelines(req.params.id, getCtx(req));
    res.json({ success: true, data: pipelines });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get a single pipeline
router.get('/review-response/pipelines/:pipelineId', async (req: any, res: Response) => {
  try {
    const pipeline = await reviewResponseService.getPipeline(req.params.pipelineId, getCtx(req));
    res.json({ success: true, data: pipeline });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Update platform metrics on a pipeline (e.g., after a sync)
router.put('/review-response/pipelines/:pipelineId/metrics', async (req: any, res: Response) => {
  try {
    const parsed = reviewPipelineMetricsSchema.parse(req.body);
    const updated = await reviewResponseService.updateMetrics(req.params.pipelineId, {
      totalReviews: parsed.total_reviews,
      unansweredCount: parsed.unanswered_count,
      responseRate: parsed.response_rate,
      averageRating: parsed.average_rating,
      metadata: parsed.metadata,
    }, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Check gate criteria for a pipeline (returns gate result without mutating stage)
router.get('/review-response/pipelines/:pipelineId/gate', async (req: any, res: Response) => {
  try {
    const result = await reviewResponseService.checkGate(req.params.pipelineId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Advance a pipeline to the next stage (refuses if gate not met unless ?force=true)
router.post('/review-response/pipelines/:pipelineId/advance', async (req: any, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const updated = await reviewResponseService.advanceStage(req.params.pipelineId, force, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Log a review response (first response, follow-up, or acknowledgment)
router.post('/review-response/pipelines/:pipelineId/log', async (req: any, res: Response) => {
  try {
    const parsed = reviewResponseLogSchema.parse(req.body);
    const log = await reviewResponseService.logResponse({
      pipelineId: req.params.pipelineId,
      platformReviewId: parsed.platform_review_id,
      responseText: parsed.response_text,
      responseType: parsed.response_type,
      respondedBy: req.user?.id,
      notes: parsed.notes,
    }, getCtx(req));
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// List the response log for a pipeline (newest first)
router.get('/review-response/pipelines/:pipelineId/log', async (req: any, res: Response) => {
  try {
    const log = await reviewResponseService.listLog(req.params.pipelineId, getCtx(req));
    res.json({ success: true, data: log });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Mark a customer reply on a log entry (creates an open follow-up thread)
router.post('/review-response/log/:logId/customer-reply', async (req: any, res: Response) => {
  try {
    const updated = await reviewResponseService.markCustomerReply(req.params.logId, undefined, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Close a follow-up thread
router.post('/review-response/log/:logId/close', async (req: any, res: Response) => {
  try {
    const updated = await reviewResponseService.closeThread(req.params.logId, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Schedule a future follow-up at a predetermined time (e.g., 48h, 1 week)
router.post('/review-response/pipelines/:pipelineId/schedule-follow-up', async (req: any, res: Response) => {
  try {
    const parsed = reviewScheduleFollowUpSchema.parse(req.body);
    const log = await reviewResponseService.scheduleFollowUp({
      pipelineId: req.params.pipelineId,
      scheduledFor: parsed.scheduled_for,
      notes: parsed.notes,
      respondedBy: req.user?.id,
    }, getCtx(req));
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Complete a scheduled follow-up (operator sent the follow-up)
router.post('/review-response/log/:logId/complete', async (req: any, res: Response) => {
  try {
    const parsed = reviewCompleteFollowUpSchema.parse(req.body || {});
    const updated = await reviewResponseService.completeScheduledFollowUp(req.params.logId, parsed.response_text, getCtx(req), parsed.outcome);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Update a scheduled follow-up's time and/or notes (only status='scheduled')
router.put('/review-response/log/:logId', async (req: any, res: Response) => {
  try {
    const parsed = reviewUpdateFollowUpSchema.parse(req.body);
    const updated = await reviewResponseService.updateScheduledFollowUp(req.params.logId, {
      scheduledFor: parsed.scheduled_for,
      notes: parsed.notes,
    }, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Skip a scheduled follow-up (operator decided no further action needed)
router.post('/review-response/log/:logId/skip', async (req: any, res: Response) => {
  try {
    const parsed = reviewSkipFollowUpSchema.parse(req.body || {});
    const updated = await reviewResponseService.skipScheduledFollowUp(req.params.logId, parsed.reason, getCtx(req), parsed.outcome);
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Dashboard: review-response follow-ups due (overdue / due this week)
router.get('/review-response/follow-ups-due', async (req: any, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);
    const result = await reviewResponseService.getFollowUpsDue({
      from: today,
      to: weekOut,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Deliverable Construction ───────────────────────────────────────────
// Post-payment deliverable: owner voice calibration, batch review response
// generation, recovery playbook, listing corrections, CTA fixes, and render.
// See: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md

// Zod schemas
const voiceUpsertSchema = z.object({
  person: z.enum(['first_person', 'third_person', 'we']).optional(),
  formality: z.enum(['casual', 'professional', 'formal']).optional(),
  humor: z.enum(['none', 'light', 'witty']).optional(),
  apologyStyle: z.enum(['direct_apology', 'fix_first', 'acknowledge_and_pivot']).optional(),
  signoffStyle: z.enum(['first_name', 'full_name', 'title', 'team', 'none']).optional(),
  signature: z.string().max(100).optional(),
});

const slotUpdateSchema = z.object({
  response_text: z.string().min(1),
});

const sectionUpdateSchema = z.object({
  content: z.string().min(1),
});

// ─── Owner Voice ─────────────────────────────────────────

// Get voice profile for a campaign
router.get('/deliverable/voice/:campaignId', async (req: any, res: Response) => {
  try {
    const profile = await OwnerVoiceService.getProfile(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: profile });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// AI infer voice from existing owner responses
router.post('/deliverable/voice/:campaignId/infer', async (req: any, res: Response) => {
  try {
    const result = await OwnerVoiceService.inferVoice(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Create or update voice profile (manual entry or operator override)
router.post('/deliverable/voice/:campaignId', async (req: any, res: Response) => {
  try {
    const parsed = voiceUpsertSchema.parse(req.body || {});
    const profile = await OwnerVoiceService.upsertProfile(req.params.campaignId, {
      person: parsed.person,
      formality: parsed.formality,
      humor: parsed.humor,
      apologyStyle: parsed.apologyStyle,
      signoffStyle: parsed.signoffStyle,
      signature: parsed.signature,
    }, getCtx(req));
    res.json({ success: true, data: profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Review Slots ─────────────────────────────────────────

// List all slots for a campaign
router.get('/deliverable/:campaignId/slots', async (req: any, res: Response) => {
  try {
    const slots = await ReviewSlotService.listSlots(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: slots });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Ingest all unanswered reviews from audit
router.post('/deliverable/:campaignId/slots/ingest', async (req: any, res: Response) => {
  try {
    const result = await ReviewSlotService.ingestReviews(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Batch generate responses for all draft slots
router.post('/deliverable/:campaignId/slots/generate', async (req: any, res: Response) => {
  try {
    const result = await ReviewSlotService.generateAllResponses(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Re-generate a single slot's response
router.post('/deliverable/slots/:slotId/regenerate', async (req: any, res: Response) => {
  try {
    const slot = await ReviewSlotService.regenerateSlot(req.params.slotId, getCtx(req));
    res.json({ success: true, data: slot });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Edit a slot's response text
router.put('/deliverable/slots/:slotId', async (req: any, res: Response) => {
  try {
    const parsed = slotUpdateSchema.parse(req.body);
    const slot = await ReviewSlotService.updateSlotResponse(req.params.slotId, parsed.response_text, getCtx(req));
    res.json({ success: true, data: slot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Approve a slot
router.post('/deliverable/slots/:slotId/approve', async (req: any, res: Response) => {
  try {
    const slot = await ReviewSlotService.approveSlot(req.params.slotId, getCtx(req));
    res.json({ success: true, data: slot });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Skip a slot
router.post('/deliverable/slots/:slotId/skip', async (req: any, res: Response) => {
  try {
    const slot = await ReviewSlotService.skipSlot(req.params.slotId, getCtx(req));
    res.json({ success: true, data: slot });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Deliverable Sections ─────────────────────────────────

// List all sections for a campaign
router.get('/deliverable/:campaignId/sections', async (req: any, res: Response) => {
  try {
    const sections = await DeliverableSectionService.listSections(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: sections });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Generate all sections (playbook, corrections, CTA based on audit)
router.post('/deliverable/:campaignId/sections/generate', async (req: any, res: Response) => {
  try {
    const result = await DeliverableSectionService.generateAllSections(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Edit a section's content
router.put('/deliverable/sections/:sectionId', async (req: any, res: Response) => {
  try {
    const parsed = sectionUpdateSchema.parse(req.body);
    const section = await DeliverableSectionService.updateSection(req.params.sectionId, parsed.content, getCtx(req));
    res.json({ success: true, data: section });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Approve a section
router.post('/deliverable/sections/:sectionId/approve', async (req: any, res: Response) => {
  try {
    const section = await DeliverableSectionService.approveSection(req.params.sectionId, getCtx(req));
    res.json({ success: true, data: section });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Skip a section
router.post('/deliverable/sections/:sectionId/skip', async (req: any, res: Response) => {
  try {
    const section = await DeliverableSectionService.skipSection(req.params.sectionId, getCtx(req));
    res.json({ success: true, data: section });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Render ───────────────────────────────────────────────

// Check render readiness
router.get('/deliverable/:campaignId/render/status', async (req: any, res: Response) => {
  try {
    const status = await DeliverableAssemblyService.getAssemblyStatus(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: status });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Render deliverable (PDF + TXT)
router.post('/deliverable/:campaignId/render', async (req: any, res: Response) => {
  try {
    const result = await DeliverableRenderService.renderDeliverable(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Recovery Management Admin Endpoints ──────────────────────────────────
// Sprint 4 — Recovery Management Engine.
// All routes are admin-authed (mounted at /api/admin/marketing-ops).

// List recovery-pipeline campaigns grouped by stage.
// Includes recovery_management campaigns AND profile_repair/escalated campaigns.
router.get('/recovery/campaigns', async (req: any, res: Response) => {
  try {
    const campaigns = await prisma.mkt_campaigns_list.findMany({
      where: {
        OR: [
          { campaign_category: 'recovery_management' },
          { campaign_category: 'profile_repair', repair_track: 'escalated' },
        ],
      },
      orderBy: { stage_entered_at: 'desc' },
      select: {
        id: true,
        display_id: true,
        business_name: true,
        category: true,
        city: true,
        stage: true,
        stage_entered_at: true,
        notes: true,
        assigned_to: true,
        created_at: true,
        campaign_category: true,
        repair_track: true,
        repair_issue_type: true,
      },
    });

    // Group by stage
    const byStage: Record<string, any[]> = {};
    for (const c of campaigns) {
      if (!byStage[c.stage]) byStage[c.stage] = [];
      byStage[c.stage].push(c);
    }

    res.json({ success: true, data: { campaigns, byStage, total: campaigns.length } });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get full intake + attachments for a campaign
router.get('/recovery/:campaignId/intake', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const intake = await prisma.mkt_dispute_intake.findUnique({
      where: { campaign_id: campaignId },
      include: { mkt_dispute_attachments: true },
    });

    if (!intake) {
      return res.status(404).json({ success: false, error: 'No dispute intake found for this campaign' });
    }

    res.json({ success: true, data: intake });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Download an intake attachment (admin/operator) — streams bytes from Supabase.
// Auth: authenticateToken + requirePlatformAdmin (applied at router top).
router.get('/recovery/:campaignId/intake/attachments/:id', async (req: any, res: Response) => {
  try {
    const { campaignId, id } = req.params;
    const result = await disputeIntakeService.downloadAttachmentByCampaign(campaignId, id, getCtx(req));
    if (!result) {
      return res.status(404).json({ success: false, error: 'Attachment not found for this campaign' });
    }

    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpeg: 'image/jpeg',
    };
    const contentType = contentTypeMap[result.fileType] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    return res.send(result.buffer);
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Reissue the intake link for a campaign (admin/operator). Mints a fresh
// access_token + URL to share with the business owner. Auth: router-level
// authenticateToken + requirePlatformAdmin.
router.post('/recovery/:campaignId/reissue-link', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await disputeIntakeService.reissueLink(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get current resolution draft + sections
router.get('/recovery/:campaignId/draft', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const deliverable = await prisma.mkt_deliverables_list.findFirst({
      where: {
        campaign_id: campaignId,
        deliverable_type: 'recovery_resolution',
        status: { in: ['drafted', 'approved'] },
      },
      orderBy: { generated_at: 'desc' },
      include: {
        mkt_deliverable_sections: { orderBy: { section_index: 'asc' } },
      },
    });

    if (!deliverable) {
      return res.status(404).json({ success: false, error: 'No recovery resolution draft found' });
    }

    res.json({ success: true, data: deliverable });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Edit draft sections (response_draft / submission_guide)
const recoveryDraftEditSchema = z.object({
  responseDraft: z.string().optional(),
  submissionGuide: z.string().optional(),
});

router.patch('/recovery/:campaignId/draft', async (req: any, res: Response) => {
  try {
    const parsed = recoveryDraftEditSchema.parse(req.body);
    const { campaignId } = req.params;

    const deliverable = await prisma.mkt_deliverables_list.findFirst({
      where: {
        campaign_id: campaignId,
        deliverable_type: 'recovery_resolution',
        status: 'drafted',
      },
      orderBy: { generated_at: 'desc' },
    });

    if (!deliverable) {
      return res.status(404).json({ success: false, error: 'No editable recovery resolution draft found' });
    }

    // Update sections
    if (parsed.responseDraft !== undefined) {
      const section = await prisma.mkt_deliverable_section.findFirst({
        where: { deliverable_id: deliverable.id, section_type: 'response_draft' },
      });
      if (section) {
        await prisma.mkt_deliverable_section.update({
          where: { id: section.id },
          data: { content: parsed.responseDraft, source: 'operator_edit', status: 'edited' },
        });
      }
    }

    if (parsed.submissionGuide !== undefined) {
      const section = await prisma.mkt_deliverable_section.findFirst({
        where: { deliverable_id: deliverable.id, section_type: 'submission_guide' },
      });
      if (section) {
        await prisma.mkt_deliverable_section.update({
          where: { id: section.id },
          data: { content: parsed.submissionGuide, source: 'operator_edit', status: 'edited' },
        });
      }
    }

    res.json({ success: true, data: { deliverableId: deliverable.id, updated: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Approve draft → resolved_and_closed (single action, two-step transition)
router.post('/recovery/:campaignId/approve', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await RecoveryResolutionService.approveDraft(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Regenerate draft (re-run the agent)
router.post('/recovery/:campaignId/regenerate', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await RecoveryResolutionService.regenerate(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Recovery Dual-Mode AI Surface (mirrors review pipeline) ──────────────

// Render prompt text for copy-paste bridge (external AI)
router.get('/recovery/:campaignId/prompt-text', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await RecoveryResolutionService.renderPromptText(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Import external AI result (copy-paste bridge)
const importResultSchema = z.object({
  raw_output: z.string().min(10, 'raw_output must be at least 10 characters'),
});

router.post('/recovery/:campaignId/import-result', async (req: any, res: Response) => {
  try {
    const parsed = importResultSchema.parse(req.body || {});
    const { campaignId } = req.params;
    const result = await RecoveryResolutionService.importExternalResult(
      campaignId,
      parsed.raw_output,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Direct execute via API (enqueue + run immediately)
router.post('/recovery/:campaignId/execute', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await RecoveryResolutionService.executeDirect(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get delivery status for a recovery campaign (outreach log + deliverable)
router.get('/recovery/:campaignId/delivery-status', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;

    // Find the most recent delivery-related outreach log entry
    const deliveryLog = await prisma.mkt_outreach_log.findFirst({
      where: {
        campaign_id: campaignId,
        notes: { contains: 'Recovery resolution delivery' },
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        delivery_status: true,
        delivery_attempts: true,
        last_delivery_error: true,
        retry_after: true,
        created_at: true,
        notes: true,
      },
    });

    // Find the approved deliverable
    const deliverable = await prisma.mkt_deliverables_list.findFirst({
      where: {
        campaign_id: campaignId,
        deliverable_type: 'recovery_resolution',
        status: 'approved',
      },
      select: {
        id: true,
        delivery_status: true,
        delivered_at: true,
      },
    });

    res.json({
      success: true,
      data: {
        deliveryLog,
        deliverable,
      },
    });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Manually resend a failed delivery
router.post('/recovery/:campaignId/resend-delivery', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await RecoveryResolutionService.resendDelivery(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Multi-Channel Cascade (Review Campaigns) ─────────────────────────────
// Operator opts-in a review campaign to the email → SMS → DM cascade.

// Enable cascade for a campaign (with optional custom step config)
const cascadeEnableSchema = z.object({
  cascade_config: z.any().optional(),
});

router.post('/:campaignId/cascade/enable', async (req: any, res: Response) => {
  try {
    const parsed = cascadeEnableSchema.parse(req.body || {});
    const { campaignId } = req.params;
    const result = await ReviewCascadeService.enableCascade(
      campaignId,
      parsed.cascade_config,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Disable cascade for a campaign
router.post('/:campaignId/cascade/disable', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await ReviewCascadeService.disableCascade(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Get cascade status for a campaign
router.get('/:campaignId/cascade/status', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const result = await ReviewCascadeService.getCascadeStatus(campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// CAMPAIGN TRIAGE ROUTES (Sprint 3 — Triage Engine)
// ====================
// These use /:campaignId/triage/* (multi-segment) so they are NOT shadowed
// by router.get('/:id', ...) above — Express only matches /:id against a
// single path segment. Safe to declare at the end.

// Evaluate the triage cascade for a campaign. Upserts the triage result row
// but does NOT mutate the campaign — accept/override is a separate step.
router.post('/:campaignId/triage/evaluate', async (req: any, res: Response) => {
  try {
    const parsed = triageEvaluateSchema.parse(req.body ?? {});
    const result = await CampaignTriageService.evaluateTriageForCampaign({
      campaignId: req.params.campaignId,
      bbb: parsed.bbb ? {
        bbbGrade: parsed.bbb.bbb_grade,
        unansweredBbbComplaints: parsed.bbb.unanswered_bbb_complaints,
      } : undefined,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// Read the latest stored triage result for a campaign.
router.get('/:campaignId/triage', async (req: any, res: Response) => {
  try {
    const result = await CampaignTriageService.getTriageResult(req.params.campaignId, getCtx(req));
    if (!result) {
      return res.status(404).json({ success: false, error: 'No triage result found — call /triage/evaluate first' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Accept the recommended playbook. Re-categorizes the campaign + applies FITD fee.
router.post('/:campaignId/triage/accept', async (req: any, res: Response) => {
  try {
    const result = await CampaignTriageService.acceptTriage({
      campaignId: req.params.campaignId,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Override the recommendation with a different playbook.
router.post('/:campaignId/triage/override', async (req: any, res: Response) => {
  try {
    const parsed = triageOverrideSchema.parse(req.body);
    const result = await CampaignTriageService.overrideTriage({
      campaignId: req.params.campaignId,
      playbookCode: parsed.playbook_code,
      reason: parsed.reason,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

export default router;
