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
 *   Outreach Intelligence (Sprint 1 — Outreach Intelligence Prep):
 *     GET    /:campaignId/outreach-intelligence  — fetch worksheet (with sibling inheritance)
 *     PUT    /:campaignId/outreach-intelligence  — upsert (validates + computes salutation)
 *     DELETE /:campaignId/outreach-intelligence  — remove worksheet
 *
 *   Hook Suggestions (Sprint 2 — Light-Score Hook Library):
 *     GET    /:campaignId/hook-suggestions  — ranked hooks with merge fields resolved
 *
 *   Cold Call Script (Sprint 1 — Cold Call Channel):
 *     GET    /:campaignId/call-script       — assembled five-stage script (Verify → Hook → Bridge → Ask → Close)
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
 *     POST   /openers/preview-slots/generate    — Archetype-aware slot draft (A3 listing fix, A4 CTA fix, A6 visibility fix; A1/A2/A5 → review response)
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
import multer from 'multer';
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
import { OutreachOpenerService, resolveCampaignArchetype } from '../services/OutreachOpenerService';
import { selectArchetype, type BusinessAnalysisAuditData } from '../services/outreach-openers/archetype-selection';
import { resolveGalleryArchetypeDefaults } from '../services/marketing/GalleryArchetypeDefaults';
import galleryAnalyticsService from '../services/GalleryAnalyticsService';
import { GalleryMultiService } from '../services/marketing/GalleryMultiService';
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
import ProfileRepairPromptService, {
  PROFILE_REPAIR_TRIAGE_TEMPLATE_ID,
  PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID,
} from '../services/ProfileRepairPromptService';
import disputeIntakeService from '../services/DisputeIntakeService';
import ReviewCascadeService from '../services/ReviewCascadeService';
import MarketingPlaybookCatalogService from '../services/MarketingPlaybookCatalogService';
import MarketingSignalRegistryService from '../services/MarketingSignalRegistryService';
import PlaybookChecklistService from '../services/PlaybookChecklistService';
import CampaignTriageService from '../services/CampaignTriageService';
import { BusinessProspectService } from '../services/BusinessProspectService';
import MarketingProspectQueueService from '../services/MarketingProspectQueueService';
import OutreachIntelligenceService, { UpsertInput } from '../services/OutreachIntelligenceService';
import HookSuggestionService from '../services/HookSuggestionService';
import CallScriptService from '../services/CallScriptService';
import { IntelligenceProfileService } from '../services/intelligence/IntelligenceProfileService';
import { IntelligenceRunService } from '../services/intelligence/IntelligenceRunService';
import { HOOK_ANGLE_KEYS, isValidHookAngle } from '../services/outreach-openers/hook-library';
import { MarketingCustomerService } from '../services/MarketingCustomerService';
import { MarketingReceiptEmailService } from '../services/marketing/MarketingReceiptEmailService';
import { unifiedConfig } from '../config/unifiedConfig';
import { prisma } from '../prisma';
import { PLATFORM_SCOPE } from '../lib/platform-scope';

const router = Router();

// All routes require auth + platform admin
router.use(authenticateToken);
router.use(requirePlatformAdmin);

// ====================
// ZOD SCHEMAS
// ====================

const campaignBaseSchema = z.object({
  scope: z.enum(['business', 'category', 'city', 'intelligence']).optional(),
  title: z.string().max(255).optional(),
  business_name: z.string().max(255).optional(),
  category: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  contact_method: z.string().max(50).optional(),
  contact_info: z.string().max(255).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(255).optional(),
  website_url: z.string().max(500).optional(),
  social_profiles: z.array(z.object({ platform: z.string().max(500), url: z.string().max(500) })).optional(),
  owner_names: z.array(z.string().max(255)).optional(),
  phones: z.array(z.object({ label: z.string().max(50), number: z.string().max(40) })).optional(),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  address_city: z.string().max(100).optional(),
  address_state: z.string().max(50).optional(),
  address_zip: z.string().max(20).optional(),
  address_country: z.string().max(2).optional(),
  directory_profiles: z.array(z.object({
    platform: z.string().max(50),
    url: z.string().max(500),
    claim_status: z.enum(['claimed', 'unclaimed', 'unknown']),
    star_rating: z.number().min(0).max(5).nullable().optional(),
    review_count: z.number().int().min(0).nullable().optional(),
    category: z.string().max(100).optional(),
  })).optional(),
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
  // Intelligence scope fields (Sprint 3 — Migration 200)
  intelligence_focus: z.enum(['emerging', 'competitive']).optional(),
  intelligence_zip_codes: z.string().max(500).optional(),
  intelligence_search_radius_miles: z.number().min(0).max(500).optional(),
  // Migration 201 — discriminator for intelligence-scope campaigns
  intelligence_campaign_kind: z.enum(['discovery', 'establishment']).optional(),
  // Migration 204 — diaspora / heritage-origin categorization
  business_origin_country: z.string().max(100).optional(),
  business_origin_region: z.string().max(100).optional(),
});

const campaignCreateSchema = campaignBaseSchema
  .refine((data) => data.scope !== 'business' || (data.business_name && data.business_name.trim().length > 0), {
    message: 'business_name is required for business-scoped campaigns',
    path: ['business_name'],
  })
  .refine((data) => data.scope !== 'intelligence' || (data.state && data.state.trim().length > 0), {
    message: 'state is required for intelligence-scoped campaigns',
    path: ['state'],
  });

const campaignUpdateSchema = campaignBaseSchema.partial().extend({
  stage: z.enum(['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded']).optional(),
  tone: z.string().max(50).optional(),
  retainer: z.enum(['Fast', 'Medium', 'Slow']).nullable().optional(),
  attributes: z.array(z.string()).optional(),
  retainer_status: z.enum(['not_pitched', 'pitched', 'won', 'declined']).nullable().optional(),
  retainer_amount_cents: z.number().int().optional(),
  retainer_start_date: z.string().datetime().nullable().optional(),
  amount_paid_cents: z.number().int().optional(),
  package_delivered: z.string().optional(),
  campaign_origin: z.enum(['prospect', 'upsell']).optional(),
  last_review_date: z.string().datetime().nullable().optional(),
}).refine((data) => !data.scope || data.scope !== 'business' || (data.business_name && data.business_name.trim().length > 0), {
  message: 'business_name is required for business-scoped campaigns',
  path: ['business_name'],
}).refine((data) => !data.scope || data.scope !== 'intelligence' || (data.state && data.state.trim().length > 0), {
  message: 'state is required for intelligence-scoped campaigns',
  path: ['state'],
});

const stageTransitionSchema = z.object({
  to_stage: z.enum(['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded']),
  notes: z.string().optional(),
  trigger_type: z.enum(['manual', 'automated', 'system']).optional(),
  acknowledge_incomplete: z.boolean().optional(),
});

const linkTenantSchema = z.object({
  tenant_id: z.string().min(1),
});

// Outreach log schemas (Sprint 2)
const contactChannelEnum = z.enum(['phone', 'email', 'website', 'social', 'in_person', 'other']);
const contactOutcomeEnum = z.enum(['reached', 'no_answer', 'left_message', 'interested', 'not_interested', 'callback_scheduled', 'other', 'auto_follow_up_scheduled', 'wrong_number', 'disconnected_number']);

// ─── Call details schema (Sprint 1 — Cold Call Channel) ────────────────
const callResultEnum = z.enum(['connected', 'voicemail', 'no_answer', 'wrong_number', 'disconnected_number']);

// Per-channel contact results for non-phone channels (§Log Contact — Result options).
const contactResultEnum = z.enum([
  // shared
  'replied', 'sent_no_reply', 'refused', 'failed_to_send', 'bad_contact_info',
  // email
  'bounced', 'unsubscribed', 'marked_spam',
  // website
  'form_submitted', 'awaiting_response', 'form_error', 'no_contact_form', 'page_not_found',
  // social
  'comment_left', 'profile_not_found', 'no_dm_access',
  // in_person
  'met_owner', 'met_staff', 'not_available', 'left_message_with_staff', 'closed_permanently', 'wrong_location',
]);

// Subtype for the "other" channel.
const otherSubtypeEnum = z.enum(['dm', 'text', 'email', 'fax_mail']);

// Maps a contact_result → required ContactOutcome (mirrors the frontend
// CONTACT_RESULT_OPTIONS outcome mapping).
const CONTACT_RESULT_TO_OUTCOME: Record<string, string> = {
  replied: 'interested',
  sent_no_reply: 'reached',
  refused: 'not_interested',
  failed_to_send: 'other',
  bad_contact_info: 'wrong_number',
  bounced: 'wrong_number',
  unsubscribed: 'not_interested',
  marked_spam: 'not_interested',
  form_submitted: 'reached',
  awaiting_response: 'no_answer',
  form_error: 'other',
  no_contact_form: 'wrong_number',
  page_not_found: 'wrong_number',
  comment_left: 'left_message',
  profile_not_found: 'wrong_number',
  no_dm_access: 'other',
  met_owner: 'reached',
  met_staff: 'reached',
  not_available: 'no_answer',
  left_message_with_staff: 'left_message',
  closed_permanently: 'disconnected_number',
  wrong_location: 'wrong_number',
};

// Per-channel allowed contact_result values.
const CHANNEL_CONTACT_RESULTS: Record<string, string[]> = {
  email: ['replied', 'sent_no_reply', 'bounced', 'unsubscribed', 'marked_spam', 'failed_to_send'],
  website: ['form_submitted', 'awaiting_response', 'form_error', 'no_contact_form', 'page_not_found'],
  social: ['replied', 'sent_no_reply', 'comment_left', 'profile_not_found', 'no_dm_access'],
  in_person: ['met_owner', 'met_staff', 'not_available', 'left_message_with_staff', 'refused', 'closed_permanently', 'wrong_location'],
  other: ['replied', 'sent_no_reply', 'bad_contact_info', 'refused', 'failed_to_send'],
};

const callDetailsSchema = z.object({
  call_result: callResultEnum.optional(),
  contact_result: contactResultEnum.nullable().default(null),
  other_subtype: otherSubtypeEnum.nullable().default(null),
  identity_verified: z.boolean().nullable().default(null),
  operating_status_confirmed: z.boolean().nullable().default(null),
  angle_used: z.string().max(40).nullable().default(null),
  hook_response_notes: z.string().max(2000).nullable().default(null),
  objections_raised: z.array(z.string().max(120)).max(10).default([]),
  email_obtained: z.boolean().nullable().default(null),
  email_value: z.string().email().nullable().default(null),
  callback_number_left: z.boolean().nullable().default(null),
  owner_name_confirmed: z.string().max(255).nullable().default(null),
  team_signal_confirmed: z.enum(['sole_owner', 'family_team', 'small_staff', 'unknown']).nullable().default(null),
  preferred_channel_confirmed: z.string().max(50).nullable().default(null),
});

const outreachLogBaseSchema = z.object({
  contact_channel: contactChannelEnum,
  contact_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'contact_date must be YYYY-MM-DD'),
  outcome: contactOutcomeEnum,
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'follow_up_date must be YYYY-MM-DD').optional(),
  notes: z.string().optional(),
  message_snapshot: z.string().optional(),
  message_subject: z.string().max(255).optional(),
  preview_token: z.string().max(255).optional(),
  // Cold-call channel (Sprint 1)
  call_details: callDetailsSchema.nullable().optional(),
  update_worksheet: z.boolean().optional(),
});

const outreachLogSchema = outreachLogBaseSchema.superRefine((data, ctx) => {
  // Coherence validation (§5.3)
  if (data.call_details) {
    const cd = data.call_details;
    const isPhone = data.contact_channel === 'phone';

    // ─── Channel/result field gating ───────────────────────────────────
    // call_result is phone-only; contact_result is non-phone-only.
    if (cd.call_result != null && !isPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'call_result requires contact_channel = "phone"',
        path: ['call_details', 'call_result'],
      });
    }
    if (cd.contact_result != null && isPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'contact_result requires a non-phone contact_channel',
        path: ['call_details', 'contact_result'],
      });
    }
    // other_subtype is only valid for the "other" channel.
    if (cd.other_subtype != null && data.contact_channel !== 'other') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'other_subtype requires contact_channel = "other"',
        path: ['call_details', 'other_subtype'],
      });
    }

    // ─── Phone-mode call_result validation (existing) ──────────────────
    if (isPhone) {
      const cr = cd.call_result;
      if (cr === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'call_result is required when contact_channel = "phone"',
          path: ['call_details', 'call_result'],
        });
      }
      // call_result: 'connected' ⇒ outcome ∈ human-contact set
      if (cr === 'connected' && !['reached', 'interested', 'not_interested', 'callback_scheduled', 'other'].includes(data.outcome)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'call_result "connected" requires a human-contact outcome (reached, interested, not_interested, callback_scheduled, other)',
          path: ['outcome'],
        });
      }
      if (cr === 'wrong_number' && data.outcome !== 'wrong_number') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'call_result "wrong_number" requires outcome "wrong_number"', path: ['outcome'] });
      }
      if (cr === 'disconnected_number' && data.outcome !== 'disconnected_number') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'call_result "disconnected_number" requires outcome "disconnected_number"', path: ['outcome'] });
      }
      if (cr === 'no_answer' && data.outcome !== 'no_answer') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'call_result "no_answer" requires outcome "no_answer"', path: ['outcome'] });
      }
      if (cr === 'voicemail' && data.outcome !== 'left_message') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'call_result "voicemail" requires outcome "left_message"', path: ['outcome'] });
      }
      // Write-back fields require call_result: 'connected'
      const writeBackFields = [cd.owner_name_confirmed, cd.team_signal_confirmed, cd.preferred_channel_confirmed];
      const hasWriteBack = writeBackFields.some((v) => v !== null && v !== undefined && v !== '');
      if (hasWriteBack && cr !== 'connected') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Confirmation fields (owner_name_confirmed, team_signal_confirmed, preferred_channel_confirmed) require call_result "connected"',
          path: ['call_details'],
        });
      }
    }

    // ─── Non-phone-mode contact_result validation ──────────────────────
    if (!isPhone && cd.contact_result != null) {
      const cr = cd.contact_result;
      const allowed = CHANNEL_CONTACT_RESULTS[data.contact_channel];
      if (allowed && !allowed.includes(cr)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `contact_result "${cr}" is not valid for contact_channel "${data.contact_channel}"`,
          path: ['call_details', 'contact_result'],
        });
      }
      // Outcome must match the contact_result mapping (auto-mapped in UI).
      const expectedOutcome = CONTACT_RESULT_TO_OUTCOME[cr];
      if (expectedOutcome && data.outcome !== expectedOutcome) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `contact_result "${cr}" requires outcome "${expectedOutcome}"`,
          path: ['outcome'],
        });
      }
    }

    // ─── Shared: email_obtained ⇒ email_value ──────────────────────────
    if (cd.email_obtained === true && !cd.email_value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'email_obtained = true requires email_value',
        path: ['call_details', 'email_value'],
      });
    }
  }
});

const outreachEditSchema = outreachLogBaseSchema.partial();

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
  scope: z.enum(['business', 'category', 'city', 'intelligence']).optional(),
  category: z.string().max(100).optional(),
  tone: z.string().max(50).optional(),
  body: z.string().min(1),
  variables: z.any().optional(),
  output_schema: z.any().optional(),
  is_default: z.boolean().optional(),
  intelligence_focus: z.enum(['emerging', 'competitive']).nullable().optional(),
  intelligence_campaign_kind: z.enum(['discovery', 'establishment']).nullable().optional(),
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
  // Free-form metadata recorded on the audit so operators can tell apart
  // which AI model produced an imported audit. Conventionally:
  //   { model, provider, run_id, notes }
  metadata: z.object({
    model: z.string().max(200).optional(),
    provider: z.string().max(100).optional(),
    run_id: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  }).passthrough().optional(),
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
  scope_focus: z.enum(['business', 'category', 'city', 'intelligence']).optional(),
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
  scope_focus: z.enum(['business', 'category', 'city', 'intelligence']).optional(),
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
const playbookCodeEnum = z.enum(['PB-01', 'PB-02', 'PB-03', 'PB-04', 'PB-05', 'PB-06', 'PB-07']);
const playbookCategoryEnum = z.enum(['review_management', 'recovery_management', 'profile_repair', 'triage_management']);
const archetypeEnum = z.enum(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);

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

// ─── Checklist step schemas (Operator Checklist Sprint) ───────────────────

const checklistStepTypeEnum = z.enum(['manual', 'url_check', 'ai_prompt', 'deliverable', 'outreach', 'credentials']);

const checklistStageTagEnum = z.enum([
  'seek', 'preview_built', 'shown', 'paid', 'delivered',
  'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded',
]);

const checklistStepCreateSchema = z.object({
  title: z.string().min(1).max(255),
  instructions: z.string().optional(),
  step_type: checklistStepTypeEnum.optional(),
  action_config: z.record(z.string(), z.any()).optional(),
  is_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
  stage_tag: checklistStageTagEnum.nullable().optional(),
});

const checklistStepUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  instructions: z.string().nullable().optional(),
  step_type: checklistStepTypeEnum.optional(),
  action_config: z.record(z.string(), z.any()).optional(),
  is_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
  step_order: z.number().int().min(0).optional(),
  stage_tag: checklistStageTagEnum.nullable().optional(),
});

const checklistReorderSchema = z.object({
  rankings: z.array(z.object({
    id: z.string().min(1),
    step_order: z.number().int().min(0),
  })).min(1),
});

const checklistProgressToggleSchema = z.object({
  completed: z.boolean(),
  note: z.string().nullable().optional(),
});

const checklistSuggestionKindEnum = z.enum(['add', 'modify', 'remove']);
const checklistSuggestionPositionEnum = z.enum(['before', 'after', 'supersede']);

const checklistSuggestionSubmitSchema = z.object({
  step_id: z.string().min(1).nullable().optional(),
  suggestion_kind: checklistSuggestionKindEnum,
  position: checklistSuggestionPositionEnum.nullable().optional(),
  proposed_step: z.record(z.string(), z.any()),
  rationale: z.string().min(1, 'Rationale is required — a suggestion without a why is unreviewable'),
});

const checklistSuggestionAcceptSchema = z.object({
  proposed_step: z.record(z.string(), z.any()).optional(),
});

const checklistSuggestionRejectSchema = z.object({
  review_note: z.string().nullable().optional(),
});

const triageEvaluateSchema = z.object({
  bbb: z.object({
    bbb_grade: z.string().max(5).optional(),
    unanswered_bbb_complaints: z.number().int().min(0).optional(),
  }).optional(),
  operator_added_signals: z.array(z.string()).optional(),
  operator_removed_signals: z.array(z.string()).optional(),
});

const triageOverrideSchema = z.object({
  playbook_code: playbookCodeEnum,
  reason: z.string().max(500).optional(),
});

// ─── Multi-archetype sibling + cycling schemas ───────────────────────────

const createSiblingSchema = z.object({
  archetype: archetypeEnum,
  playbook_code: playbookCodeEnum.optional(),
  campaign_category: playbookCategoryEnum.optional(),
  repair_track: z.enum(['standard', 'escalated']).optional(),
  repair_issue_type: z.string().max(255).optional(),
  assigned_to: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => data.playbook_code || data.campaign_category,
  { message: 'At least one of playbook_code or campaign_category must be provided' },
);

const cycleEngagementSchema = z.object({
  reset_to_stage: z.enum(['seek', 'preview_built']).optional(),
  notes: z.string().max(2000).optional(),
});

const deliverableTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  deliverable_type: z.enum(['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet', 'product_visibility_preview']),
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
  deliverable_type: z.enum(['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet', 'product_visibility_preview']),
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
      intelligenceCampaignKind: req.query.intelligence_campaign_kind,
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

    const headers = 'id,display_id,scope,title,business_name,category,city,stage,date_entered,date_paid,amount_paid_cents,retainer_status\n';
    const rows = result.items.map((c: any) =>
      `${c.id},${c.display_id || ''},${c.scope},${(c.title || '').replace(/,/g, ';')},${c.business_name || ''},${c.category},${c.city},${c.stage},${c.date_entered?.toISOString() || ''},${c.date_paid?.toISOString() || ''},${c.amount_paid_cents},${c.retainer_status}`
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
      title: parsed.title,
      businessName: parsed.business_name,
      category: parsed.category,
      city: parsed.city,
      state: parsed.state,
      neighborhood: parsed.neighborhood,
      contactMethod: parsed.contact_method,
      contactInfo: parsed.contact_info,
      phone: parsed.phone,
      email: parsed.email,
      websiteUrl: parsed.website_url,
      socialProfiles: parsed.social_profiles,
      ownerNames: parsed.owner_names,
      phones: parsed.phones,
      addressLine1: parsed.address_line1,
      addressLine2: parsed.address_line2,
      addressCity: parsed.address_city,
      addressState: parsed.address_state,
      addressZip: parsed.address_zip,
      addressCountry: parsed.address_country,
      directoryProfiles: parsed.directory_profiles,
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
      intelligenceFocus: parsed.intelligence_focus,
      intelligenceZipCodes: parsed.intelligence_zip_codes,
      intelligenceSearchRadiusMiles: parsed.intelligence_search_radius_miles,
      intelligenceCampaignKind: parsed.intelligence_campaign_kind,
      businessOriginCountry: parsed.business_origin_country,
      businessOriginRegion: parsed.business_origin_region,
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
      title: parsed.title,
      businessName: parsed.business_name,
      category: parsed.category,
      city: parsed.city,
      state: parsed.state,
      neighborhood: parsed.neighborhood,
      contactMethod: parsed.contact_method,
      contactInfo: parsed.contact_info,
      phone: parsed.phone,
      email: parsed.email,
      websiteUrl: parsed.website_url,
      socialProfiles: parsed.social_profiles,
      ownerNames: parsed.owner_names,
      phones: parsed.phones,
      addressLine1: parsed.address_line1,
      addressLine2: parsed.address_line2,
      addressCity: parsed.address_city,
      addressState: parsed.address_state,
      addressZip: parsed.address_zip,
      addressCountry: parsed.address_country,
      directoryProfiles: parsed.directory_profiles,
      gbpClaimed: parsed.gbp_claimed,
      unaddressedReviews: parsed.unaddressed_reviews,
      lastReviewDate: parsed.last_review_date === null ? null : parsed.last_review_date ? new Date(parsed.last_review_date) : undefined,
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
      retainerStartDate: parsed.retainer_start_date === null ? null : parsed.retainer_start_date ? new Date(parsed.retainer_start_date) : undefined,
      amountPaidCents: parsed.amount_paid_cents,
      packageDelivered: parsed.package_delivered,
      campaignOrigin: parsed.campaign_origin,
      intelligenceFocus: parsed.intelligence_focus,
      intelligenceZipCodes: parsed.intelligence_zip_codes,
      intelligenceSearchRadiusMiles: parsed.intelligence_search_radius_miles,
      intelligenceCampaignKind: parsed.intelligence_campaign_kind,
      businessOriginCountry: parsed.business_origin_country,
      businessOriginRegion: parsed.business_origin_region,
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

    // Soft gate: if the campaign has an effective playbook with incomplete
    // required checklist steps at or before the campaign's current stage,
    // warn unless acknowledge_incomplete is true. Steps tagged with later
    // stages (e.g. fulfillment work) do not gate early pre-sale transitions.
    // Never hard-blocks — the operator may acknowledge and proceed.
    if (!parsed.acknowledge_incomplete) {
      const incomplete = await PlaybookChecklistService.getIncompleteRequiredSteps(req.params.id, getCtx(req));
      if (incomplete.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'checklist_incomplete',
          incomplete_steps: incomplete.map((s) => ({ id: s.id, title: s.title, stage_tag: s.stageTag })),
        });
      }
    }

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
      callDetails: parsed.call_details ?? null,
      updateWorksheet: parsed.update_worksheet ?? false,
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
// OUTREACH INTELLIGENCE ROUTES (Sprint 1 — Outreach Intelligence Prep)
// ====================
// Two-segment /:campaignId/outreach-intelligence routes — safe from the
// GET /:id catch-all (Express only matches /:id against a single segment).
// Registered here alongside the other /:campaignId/* routes (audits, files).

const confidenceEnum = z.enum(['confirmed', 'inferred_low_risk', 'unavailable']);
const sourcedFieldSchema = z.object({
  value: z.string().max(500).nullable(),
  source: z.string().max(500).nullable(),
  source_confidence: confidenceEnum,
});
const teamSignalFieldSchema = z.object({
  value: z.enum(['sole_owner', 'family_team', 'small_staff', 'unknown']),
  quoted_description: z.string().max(500).nullable(),
  source: z.string().max(500).nullable(),
  source_confidence: confidenceEnum,
});

const outreachIntelligenceSchema = z.object({
  linked_audit_reference: z.string().max(255).nullish(),
  prepared_by: z.string().max(255),
  research_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  owner_name: sourcedFieldSchema,
  business_email: sourcedFieldSchema.refine(
    (f) => !f.value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value),
    'business_email must be a valid email when provided',
  ),
  team_signal: teamSignalFieldSchema,
  preferred_contact_channel: sourcedFieldSchema,
  researcher_notes: z.string().max(4000).default(''),
}).superRefine((data, ctx) => {
  // Guardrail: confirmed requires a source citation
  for (const [fieldName, field] of [
    ['owner_name', data.owner_name],
    ['business_email', data.business_email],
    ['preferred_contact_channel', data.preferred_contact_channel],
  ] as const) {
    if (field.source_confidence === 'confirmed' && (!field.source || field.source.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldName, 'source'],
        message: 'A confirmed field must include a source citation',
      });
    }
    // Guardrail: unavailable requires null value
    if (field.source_confidence === 'unavailable' && field.value != null && field.value.trim().length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldName, 'value'],
        message: 'An unavailable field must have a null value',
      });
    }
  }
  // team_signal source_confidence guardrail (same rules, value can be 'unknown')
  const ts = data.team_signal;
  if (ts.source_confidence === 'confirmed' && (!ts.source || ts.source.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['team_signal', 'source'],
      message: 'A confirmed field must include a source citation',
    });
  }
});

// GET /:campaignId/outreach-intelligence — fetch worksheet (with sibling inheritance)
router.get('/:campaignId/outreach-intelligence', async (req: any, res: Response) => {
  try {
    const result = await OutreachIntelligenceService.getForCampaign(req.params.campaignId, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// PUT /:campaignId/outreach-intelligence — upsert (validates + computes salutation)
router.put('/:campaignId/outreach-intelligence', async (req: any, res: Response) => {
  try {
    const parsed = outreachIntelligenceSchema.parse(req.body);
    const result = await OutreachIntelligenceService.upsert(
      req.params.campaignId,
      { payload: { ...parsed, linked_audit_reference: parsed.linked_audit_reference ?? null } as UpsertInput['payload'] },
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

// DELETE /:campaignId/outreach-intelligence — remove worksheet
router.delete('/:campaignId/outreach-intelligence', async (req: any, res: Response) => {
  try {
    await OutreachIntelligenceService.delete(req.params.campaignId, getCtx(req));
    res.json({ success: true });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// HOOK SUGGESTION ROUTES (Sprint 2 — Light-Score Hook Library)
// ====================
// Two-segment /:campaignId/hook-suggestions — safe from the GET /:id
// catch-all (Express only matches /:id against a single segment).

// GET /:campaignId/hook-suggestions — ranked hooks with merge fields resolved
router.get('/:campaignId/hook-suggestions', async (req: any, res: Response) => {
  try {
    const result = await HookSuggestionService.suggestForCampaign(
      req.params.campaignId,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// COLD CALL SCRIPT ROUTES (Sprint 1 — Cold Call Channel)
// ====================
// Two-segment /:campaignId/call-script — safe from the GET /:id
// catch-all (Express only matches /:id against a single segment).

// GET /:campaignId/call-script?angle= — assembled five-stage script
router.get('/:campaignId/call-script', async (req: any, res: Response) => {
  try {
    const result = await CallScriptService.assembleForCampaign(
      req.params.campaignId,
      req.query.angle as string | undefined,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// DEAD-NUMBER DATA-QUALITY LOOP (Sprint 2 — §13.3)
// ====================
// Two-segment routes — safe from the GET /:id catch-all.

// GET /:campaignId/dead-number-status — check for un-acked dead-number logs
router.get('/:campaignId/dead-number-status', async (req: any, res: Response) => {
  try {
    const result = await outreachService.hasDeadNumber(
      req.params.campaignId,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /:campaignId/dead-number/confirm — null the phone + audit
const deadNumberConfirmSchema = z.object({
  log_id: z.string().min(1),
});
router.post('/:campaignId/dead-number/confirm', async (req: any, res: Response) => {
  try {
    const parsed = deadNumberConfirmSchema.parse(req.body);
    const result = await outreachService.confirmDeadNumber(
      req.params.campaignId,
      parsed.log_id,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /:campaignId/dead-number/keep — ack the log without nulling phone
router.post('/:campaignId/dead-number/keep', async (req: any, res: Response) => {
  try {
    const parsed = deadNumberConfirmSchema.parse(req.body);
    const result = await outreachService.keepNumber(
      req.params.campaignId,
      parsed.log_id,
      getCtx(req),
    );
    res.json({ success: true, data: result });
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

// Multipart upload config for diagnostic screenshots — memory storage, 10MB cap.
const diagnosticScreenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: unifiedConfig.recoveryMaxAttachmentBytes },
});

/**
 * POST /:campaignId/files/upload
 *
 * One-step multipart upload for diagnostic screenshots. Accepts a single
 * file field named "file", uploads to the Supabase disputes bucket, and
 * creates an mkt_files_list record with file_type='diagnostic_screenshot'.
 *
 * Mirrors the DisputeIntakeService upload pattern (line 588).
 */
router.post('/:campaignId/files/upload', diagnosticScreenshotUpload.single('file'), async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'no_file', message: 'A file named "file" is required.' });
    }

    // Validate MIME type — screenshots only (PNG, JPEG, WebP)
    const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_file_type',
        message: `Only PNG, JPEG, and WebP screenshots are accepted (got: ${file.mimetype}).`,
      });
    }

    // Verify campaign exists
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    // Upload to Supabase disputes bucket
    const { createClient } = await import('@supabase/supabase-js');
    const { StorageBuckets } = await import('../storage-config');
    const supabaseUrl = unifiedConfig.supabaseUrl;
    const supabaseKey = unifiedConfig.supabaseServiceRoleKey;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: 'storage_not_configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const pathKey = `diagnostic-${campaignId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from(StorageBuckets.DISPUTES.name)
      .upload(pathKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      logger.error('Diagnostic screenshot upload failed', getCtx(req), { error: uploadError.message, campaignId });
      return res.status(500).json({ success: false, error: 'upload_failed', message: uploadError.message });
    }

    // Create mkt_files_list record
    const fileRecord = await MarketingFileService.createFile({
      campaignId,
      fileType: 'diagnostic_screenshot',
      fileName: file.originalname,
      storagePath: pathKey,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user?.id,
    }, getCtx(req));

    logger.info('Diagnostic screenshot uploaded', getCtx(req), { campaignId, fileId: fileRecord.id, fileName: file.originalname });

    return res.status(201).json({ success: true, data: fileRecord });
  } catch (error) {
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
    const intelligenceFocus = req.query.intelligence_focus as string | undefined;
    const intelligenceCampaignKind = req.query.intelligence_campaign_kind as string | undefined;
    const templates = await MarketingPromptService.listTemplates({
      promptType: req.query.prompt_type,
      scope: req.query.scope,
      category: req.query.category,
      isActive: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      intelligenceFocus: (intelligenceFocus === 'emerging' || intelligenceFocus === 'competitive') ? intelligenceFocus : undefined,
      intelligenceCampaignKind: (intelligenceCampaignKind === 'discovery' || intelligenceCampaignKind === 'establishment') ? intelligenceCampaignKind : undefined,
      includeNullFocusKind: req.query.include_null_focus_kind === 'true',
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
      intelligenceFocus: parsed.intelligence_focus,
      intelligenceCampaignKind: parsed.intelligence_campaign_kind,
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
      intelligenceFocus: parsed.intelligence_focus,
      intelligenceCampaignKind: parsed.intelligence_campaign_kind,
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
      metadata: parsed.metadata,
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
  deliverable_type: z.enum(['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet', 'product_visibility_preview']),
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
  // Hook angle attribution (Sprint 2 — Light-Score Hook Library).
  // Validated against HOOK_LIBRARY keys; unknown → 400.
  hook_angle: z.enum(HOOK_ANGLE_KEYS as any as [string, ...string[]]).optional().nullable(),
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
      hookAngle: parsed.hook_angle ?? null,
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

// ─── Outreach Pitch — Preview-Slot Drafts (archetype-aware) ──────────────
// Generalizes the review-response draft path to archetype-aware preview
// slots. A1/A2 draft owner responses (legacy behavior); A3 drafts corrected
// listing entries; A4 drafts CTA fixes; A6 drafts product-visibility fixes.
// The wire format (ReviewResponseDraft) is reused so the assemble path is
// unchanged. The frontend picks this endpoint when the campaign archetype is
// anything other than A1/A2/A5.
const previewSlotGenerateSchema = z.object({
  campaign_id: z.string().min(1),
  evidence_text: z.string().min(1),
  archetype: z.string().min(1),
  slot_label: z.string().optional(),
});

router.post('/openers/preview-slots/generate', async (req: any, res: Response) => {
  try {
    const parsed = previewSlotGenerateSchema.parse(req.body);
    const draft = await ReviewResponseDraftService.generateSlotFix({
      campaignId: parsed.campaign_id,
      evidenceText: parsed.evidence_text,
      archetype: parsed.archetype,
      slotLabel: parsed.slot_label,
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
      // Free-text evidence/fix (required for non-footprint archetypes;
      // optional when structured footprint fields are supplied instead).
      review_text: z.string().optional(),
      response_text: z.string().optional(),
      response_source: z.enum(['ai', 'external']),
      response_ai_provider: z.string().nullable().optional(),
      response_ai_model: z.string().nullable().optional(),
      response_tokens_used: z.number().optional(),
      is_negative_first: z.boolean(),
      // Archetype-aware preview-slot labels (additive, optional). When
      // present, the renderer uses them instead of the review-centric
      // defaults so the assembled pitch reads appropriately for the
      // campaign's archetype.
      evidence_label: z.string().optional(),
      fix_label: z.string().optional(),
      slot_label: z.string().optional(),
      slot_label_prefix: z.string().optional(),
      section_title: z.string().optional(),
      first_slot_label: z.string().optional(),
      // ── Structured footprint fields (A5 Multi-Signal, A3 Listing) ──
      // When platform_name + focus_attribute are present, the renderer
      // emits a structured Current State → Proposed Fix block and the
      // free-text review_text/response_text are ignored. Stored in the
      // review_pairs JSON column; queryable via the footprint-diff
      // endpoint for before/after reporting on completed work.
      platform_name: z.string().optional(),
      profile_url: z.string().optional(),
      focus_attribute: z.enum(['name', 'address', 'phone', 'website', 'claim_status']).optional(),
      current_value: z.string().optional(),
      correct_value: z.string().optional(),
      summary: z.string().optional(),
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

// Footprint before/after diff — structured platform/profile/focus pairs
// from a persisted pitch's review_pairs JSON. Used for completed-work
// reporting (A5 Multi-Signal Footprint, A3 Listing Inconsistency). Returns
// only the pairs that carry structured footprint fields; free-text-only
// pairs are omitted.
router.get('/openers/pitches/:id/footprint-diff', async (req: any, res: Response) => {
  try {
    const diff = await PitchService.getFootprintDiff(req.params.id, getCtx(req));
    if (!diff) {
      return res.status(404).json({ success: false, error: 'Pitch not found' });
    }
    res.json({ success: true, data: diff });
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

// Bulk priority_rank reorder — must be BEFORE /:id to avoid shadowing.
// Reordering IS retuning the cascade (Sprint 3 route + Sprint 4 UI).
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
      derivedRule: parsed.derived_rule as { field: string; op: string; threshold: number | boolean } | null | undefined,
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
      derivedRule: parsed.derived_rule as { field: string; op: string; threshold: number | boolean } | null | undefined,
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

// ====================
// PLAYBOOK CHECKLIST ROUTES (Operator Checklist Sprint)
// ====================
// IMPORTANT: These routes MUST be declared before router.get('/:id', ...)
// below, otherwise Express matches /playbooks as a campaign ID param.
// Same hazard as /signals and /playbooks above.

// ─── Step template CRUD (builder tab) ─────────────────────────────────────

router.get('/playbooks/:id/checklist', async (req: any, res: Response) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const steps = includeInactive
      ? await PlaybookChecklistService.listAllSteps(req.params.id, getCtx(req))
      : await PlaybookChecklistService.listSteps(req.params.id, getCtx(req));
    res.json({ success: true, data: steps });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/playbooks/:id/checklist', async (req: any, res: Response) => {
  try {
    const parsed = checklistStepCreateSchema.parse(req.body);
    const step = await PlaybookChecklistService.createStep(req.params.id, {
      title: parsed.title,
      instructions: parsed.instructions,
      stepType: parsed.step_type ?? 'manual',
      actionConfig: parsed.action_config,
      isRequired: parsed.is_required,
      isActive: parsed.is_active,
      stageTag: parsed.stage_tag,
    }, getCtx(req));
    res.status(201).json({ success: true, data: step });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/playbooks/:id/checklist/reorder', async (req: any, res: Response) => {
  try {
    const parsed = checklistReorderSchema.parse(req.body);
    const updated = await PlaybookChecklistService.reorderSteps(
      req.params.id,
      parsed.rankings.map((r) => ({ id: r.id, stepOrder: r.step_order })),
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

router.put('/checklist-steps/:id', async (req: any, res: Response) => {
  try {
    const parsed = checklistStepUpdateSchema.parse(req.body);
    const step = await PlaybookChecklistService.updateStep(req.params.id, {
      title: parsed.title,
      instructions: parsed.instructions,
      stepType: parsed.step_type,
      actionConfig: parsed.action_config,
      isRequired: parsed.is_required,
      isActive: parsed.is_active,
      stepOrder: parsed.step_order,
      stageTag: parsed.stage_tag,
    }, getCtx(req));
    res.json({ success: true, data: step });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.delete('/checklist-steps/:id', async (req: any, res: Response) => {
  try {
    await PlaybookChecklistService.deleteStep(req.params.id, getCtx(req));
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'step_has_progress' || error?.statusCode === 409) {
      return res.status(409).json({ success: false, error: error.code ?? 'step_has_progress', message: error.message });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Campaign checklist (resolved view + progress toggle) ─────────────────

router.get('/:id/checklist', async (req: any, res: Response) => {
  try {
    const view = await PlaybookChecklistService.getCampaignChecklist(req.params.id, getCtx(req));
    res.json({ success: true, data: view });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.put('/:id/checklist/:stepId', async (req: any, res: Response) => {
  try {
    const parsed = checklistProgressToggleSchema.parse(req.body);
    const actor = req.user?.id || req.user?.email || 'unknown';
    const view = await PlaybookChecklistService.setStepProgress(
      req.params.id,
      req.params.stepId,
      parsed.completed,
      parsed.note,
      actor,
      getCtx(req),
    );
    res.json({ success: true, data: view });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    if ((error as any)?.code === 'no_effective_playbook' || (error as any)?.code === 'stale_step' || (error as any)?.statusCode === 409) {
      return res.status(409).json({ success: false, error: (error as any).code, message: (error as any).message });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Outreach state (bridge sprint) ──────────────────────────────────────

router.get('/:id/outreach-state', async (req: any, res: Response) => {
  try {
    const { default: bridgeService } = await import('../services/OutreachChecklistBridgeService');
    const state = await bridgeService.getOutreachState(req.params.id, getCtx(req));
    res.json({ success: true, data: state });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Suggestions (operator feedback loop) ─────────────────────────────────

router.post('/:id/checklist/suggestions', async (req: any, res: Response) => {
  try {
    const parsed = checklistSuggestionSubmitSchema.parse(req.body);
    const actor = req.user?.id || req.user?.email || 'unknown';
    const suggestion = await PlaybookChecklistService.submitSuggestion(
      req.params.id,
      {
        stepId: parsed.step_id,
        suggestionKind: parsed.suggestion_kind,
        position: parsed.position,
        proposedStep: parsed.proposed_step,
        rationale: parsed.rationale,
      },
      actor,
      getCtx(req),
    );
    res.status(201).json({ success: true, data: suggestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    if ((error as any)?.code === 'no_effective_playbook' || (error as any)?.statusCode === 409) {
      return res.status(409).json({ success: false, error: (error as any).code, message: (error as any).message });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/:id/checklist/suggestions', async (req: any, res: Response) => {
  try {
    const suggestions = await PlaybookChecklistService.listCampaignSuggestions(req.params.id, getCtx(req));
    res.json({ success: true, data: suggestions });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.get('/playbooks/:id/checklist/suggestions', async (req: any, res: Response) => {
  try {
    const status = req.query.status as 'pending' | 'accepted' | 'rejected' | undefined;
    const suggestions = await PlaybookChecklistService.listPlaybookSuggestions(req.params.id, status, getCtx(req));
    res.json({ success: true, data: suggestions });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/checklist-suggestions/:id/accept', async (req: any, res: Response) => {
  try {
    const parsed = checklistSuggestionAcceptSchema.parse(req.body);
    const reviewer = req.user?.id || req.user?.email || 'unknown';
    const suggestion = await PlaybookChecklistService.acceptSuggestion(
      req.params.id,
      parsed.proposed_step,
      reviewer,
      getCtx(req),
    );
    res.json({ success: true, data: suggestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    if ((error as any)?.code === 'suggestion_stale' || (error as any)?.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: (error as any).code ?? 'suggestion_stale',
        message: (error as any).message,
        currentValues: (error as any).currentValues,
      });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

router.post('/checklist-suggestions/:id/reject', async (req: any, res: Response) => {
  try {
    const parsed = checklistSuggestionRejectSchema.parse(req.body);
    const reviewer = req.user?.id || req.user?.email || 'unknown';
    const suggestion = await PlaybookChecklistService.rejectSuggestion(
      req.params.id,
      parsed.review_note,
      reviewer,
      getCtx(req),
    );
    res.json({ success: true, data: suggestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// PROSPECT QUEUE ROUTES (Add to Queue Sprint)
// ====================
// IMPORTANT: These routes MUST be declared before router.get('/:id', ...) below,
// otherwise Express matches /prospect-queue against /:id. All /prospect-queue
// routes are single-segment literals and are matched before the catch-all.

const prospectQueueAddSchema = z.object({
  // business_name is required only for business-scope entries (enforced in
  // superRefine below). Optional for category/city-scope entries.
  business_name: z.string().max(255).optional(),
  // Title is required — it is the primary dedup key for the campaign-exists
  // check (title + city + state) and prevents false positives where different
  // businesses in the same city+category would match each other.
  title: z.string().min(1).max(255),
  category: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  source_kind: z.enum(['category_analysis', 'city_category_audit', 'scan_unmatched', 'manual', 'intelligence_seek']),
  // source_campaign_id is required for audit-derived entries; optional for
  // manual entries added directly from the queue page (no parent campaign).
  source_campaign_id: z.string().min(1).optional(),
  source_audit_id: z.string().optional(),
  source_execution_id: z.string().optional(),
  audit_date: z.string().datetime().optional(),
  business_snapshot: z.record(z.string(), z.any()).default({}),
  priority: z.enum(['high', 'normal']).default('normal'),
  note: z.string().max(2000).optional(),
  // Operator-chosen campaign scope for manual entries (default 'business').
  // Ignored for audit-derived entries (scope inherited from parent campaign).
  scope: z.enum(['business', 'category', 'city', 'intelligence']).optional(),
  // ─── Intelligence discovery fields (Sprint §5.10) ───────────────────
  // Populated when source_kind = 'intelligence_seek'. Stored on the
  // dedicated intelligence columns for denormalized queue rendering.
  category_fit: z.enum(['verified', 'probable', 'insufficient']).optional(),
  identity_confidence: z.enum(['high', 'medium', 'low']).optional(),
  location_status: z.enum(['inside_city', 'adjacent_city', 'metro_area', 'outside_market']).optional(),
  discovery_provenance: z.array(z.record(z.string(), z.any())).optional(),
  discovery_signals: z.array(z.string()).optional(),
  business_seek_priority: z.enum(['high', 'medium', 'low', 'hold']).optional(),
  intelligence_run_id: z.string().max(64).optional(),
}).superRefine((data, ctx) => {
  if (data.source_kind !== 'manual' && !data.source_campaign_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source_campaign_id'],
      message: 'source_campaign_id is required for non-manual source kinds',
    });
  }
  // business_name is required for business-scope manual entries. For
  // audit-derived entries the scope is inherited from the parent campaign, so
  // we can't validate here — the service enforces it after resolving scope.
  const resolvedScope = data.source_kind === 'manual' && !data.source_campaign_id
    ? (data.scope ?? 'business')
    : null;
  if (resolvedScope === 'business' && !(data.business_name && data.business_name.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['business_name'],
      message: 'business_name is required for business-scope entries',
    });
  }
});

// POST /prospect-queue — add a business to the queue (no navigation).
router.post('/prospect-queue', async (req: any, res: Response) => {
  try {
    const parsed = prospectQueueAddSchema.parse(req.body);
    const result = await MarketingProspectQueueService.addToQueue({
      business_name: parsed.business_name,
      title: parsed.title,
      category: parsed.category,
      city: parsed.city,
      state: parsed.state,
      source_kind: parsed.source_kind,
      source_campaign_id: parsed.source_campaign_id,
      source_audit_id: parsed.source_audit_id,
      source_execution_id: parsed.source_execution_id,
      audit_date: parsed.audit_date ? new Date(parsed.audit_date) : undefined,
      business_snapshot: parsed.business_snapshot,
      priority: parsed.priority,
      note: parsed.note,
      queuedBy: req.user?.id,
      scope: parsed.scope,
      // Intelligence discovery fields (Sprint §5.10)
      category_fit: parsed.category_fit,
      identity_confidence: parsed.identity_confidence,
      location_status: parsed.location_status,
      discovery_provenance: parsed.discovery_provenance,
      discovery_signals: parsed.discovery_signals,
      business_seek_priority: parsed.business_seek_priority,
      intelligence_run_id: parsed.intelligence_run_id,
    }, getCtx(req));

    if (result.kind === 'campaign_exists') {
      // 200 with a kind discriminator — the operation succeeded in
      // determining the prospect is already in the pipeline. (We avoid 409
      // because the web client's makeDefaultRequest discards the body on
      // non-2xx, which would lose the campaignId link.)
      return res.status(200).json({
        success: true,
        data: { kind: 'campaign_exists', campaignId: result.campaignId },
        created: false,
      });
    }
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: result.entry,
      created: result.created,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /prospect-queue — list entries (filters: status, category, city,
// source_kind, assigned_to, limit, include). status accepts comma-separated
// values (e.g. ?status=queued,campaign_created for the board view).
router.get('/prospect-queue', async (req: any, res: Response) => {
  try {
    const statusRaw = req.query.status as string | undefined;
    const status = statusRaw
      ? (statusRaw.split(',').map((s) => s.trim()).filter(Boolean) as any)
      : undefined;
    const assignedTo = req.query.assigned_to as string | undefined;
    // 'me' resolves to the caller's id and includes unassigned entries
    // (matches the "Assigned to me + unassigned" checkbox label);
    // 'unassigned' → null filter; any other value is a literal user id.
    const isMeFilter = assignedTo === 'me';
    const resolvedAssignedTo =
      isMeFilter ? req.user?.id :
      assignedTo === 'unassigned' ? 'unassigned' :
      assignedTo;

    const result = await MarketingProspectQueueService.list({
      status,
      category: req.query.category as string | undefined,
      city: req.query.city as string | undefined,
      source_kind: req.query.source_kind as any,
      assigned_to: resolvedAssignedTo,
      include_unassigned: isMeFilter,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      includeCampaigns: req.query.include === 'campaigns',
    }, getCtx(req));

    res.json({ success: true, data: result.entries, queuedCount: result.queuedCount });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

const prospectQueuePatchSchema = z.object({
  priority: z.enum(['high', 'normal']).optional(),
  note: z.string().max(2000).nullable().optional(),
  assigned_to: z.string().min(1).nullable().optional(),
});

// PATCH /prospect-queue/:id — update priority / note / assigned_to (claim semantics).
router.patch('/prospect-queue/:id', async (req: any, res: Response) => {
  try {
    const parsed = prospectQueuePatchSchema.parse(req.body);
    const updated = await MarketingProspectQueueService.update(req.params.id, {
      priority: parsed.priority,
      note: parsed.note,
      assigned_to: parsed.assigned_to,
    }, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /prospect-queue/:id/create-campaign — replay snapshot through the
// existing derive services; idempotent on repeat calls.
router.post('/prospect-queue/:id/create-campaign', async (req: any, res: Response) => {
  try {
    const result = await MarketingProspectQueueService.createCampaignFromQueue({
      queueEntryId: req.params.id,
      actingUserId: req.user?.id,
    }, getCtx(req));
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: result.campaign,
      created: result.created,
      queueEntry: result.queueEntry,
    });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

const prospectQueueDismissSchema = z.object({
  reason: z.enum(['already_customer', 'bad_fit', 'duplicate', 'other']).optional(),
});

// POST /prospect-queue/:id/dismiss — mark entry dismissed (idempotent).
router.post('/prospect-queue/:id/dismiss', async (req: any, res: Response) => {
  try {
    const parsed = prospectQueueDismissSchema.parse(req.body ?? {});
    const updated = await MarketingProspectQueueService.dismiss({
      queueEntryId: req.params.id,
      reason: parsed.reason,
    }, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// CATEGORY-TONE PRESET ROUTES
// IMPORTANT: These routes MUST be declared before router.get('/:id', ...) below,
// otherwise Express will match /category-tone-presets against /:id.
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

// NOTE: router.get('/:id') was moved to the END of this file to avoid shadowing
// static 1-segment GET routes (e.g. /alerts, /category-tone-presets, /signals).
// All static GET routes must be declared before it.

// ====================
// (category-tone preset routes moved above where router.get('/:id', ...) used to be)
// ====================

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

// Get full intake + attachments for a campaign.
// Returns all intakes for the campaign (composite unique on campaign_id + intake_kind
// means a campaign can have multiple intakes of different kinds).
router.get('/recovery/:campaignId/intake', async (req: any, res: Response) => {
  try {
    const { campaignId } = req.params;
    const intakeKind = req.query.intakeKind as string | undefined;
    if (intakeKind) {
      // Specific kind — return the single matching intake
      const intake = await prisma.mkt_dispute_intake.findFirst({
        where: { campaign_id: campaignId, intake_kind: intakeKind },
        include: { mkt_dispute_attachments: true },
      });
      if (!intake) {
        return res.status(404).json({ success: false, error: 'No intake found for this campaign + kind' });
      }
      return res.json({ success: true, data: intake });
    }
    // No kind filter — return all intakes for the campaign
    const intakes = await prisma.mkt_dispute_intake.findMany({
      where: { campaign_id: campaignId },
      include: { mkt_dispute_attachments: true },
      orderBy: { created_at: 'asc' },
    });
    if (intakes.length === 0) {
      return res.status(404).json({ success: false, error: 'No dispute intake found for this campaign' });
    }
    res.json({ success: true, data: intakes });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// Download an intake attachment (admin/operator) — streams bytes from Supabase.
// Auth: authenticateToken + requirePlatformAdmin (applied at router top).
router.get('/recovery/:campaignId/intake/attachments/:id', async (req: any, res: Response) => {
  try {
    const { campaignId, id } = req.params;
    const intakeKind = req.query.intakeKind as string | undefined;
    const result = await disputeIntakeService.downloadAttachmentByCampaign(campaignId, id, intakeKind, getCtx(req));
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
    const intakeKind = (req.body?.intakeKind as string) || 'dispute';
    const result = await disputeIntakeService.reissueLink(campaignId, intakeKind, getCtx(req));
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
      operatorAddedSignals: parsed.operator_added_signals,
      operatorRemovedSignals: parsed.operator_removed_signals,
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

// ====================
// MULTI-ARCHETYPE SIBLING + CYCLING ROUTES
// ====================
// These use /:campaignId/{siblings,cycle,triage/alternatives} (multi-segment)
// so they are NOT shadowed by router.get('/:id', ...) below.

// GET /:campaignId/triage/alternatives — list all matching playbooks for sibling creation
router.get('/:campaignId/triage/alternatives', async (req: any, res: Response) => {
  try {
    const result = await CampaignTriageService.evaluateAllForCampaign({
      campaignId: req.params.campaignId,
    }, getCtx(req));
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /:campaignId/siblings — create a sibling campaign from a chosen archetype
router.post('/:campaignId/siblings', async (req: any, res: Response) => {
  try {
    const parsed = createSiblingSchema.parse(req.body ?? {});
    const sibling = await BusinessProspectService.getInstance().createSiblingCampaign({
      sourceCampaignId: req.params.campaignId,
      archetype: parsed.archetype,
      playbookCode: parsed.playbook_code,
      campaignCategory: parsed.campaign_category,
      repairTrack: parsed.repair_track,
      repairIssueType: parsed.repair_issue_type,
      assignedTo: parsed.assigned_to,
      notes: parsed.notes,
    }, getCtx(req));
    res.status(201).json({ success: true, data: sibling });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /:campaignId/siblings — list sibling campaigns for this prospect
router.get('/:campaignId/siblings', async (req: any, res: Response) => {
  try {
    const campaign = await MarketingCampaignService.getCampaign(req.params.campaignId, getCtx(req));
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    const prospectId = (campaign as any).business_prospect_id;
    if (!prospectId) {
      return res.json({ success: true, data: [] });
    }
    const siblings = await BusinessProspectService.getInstance().listSiblings(prospectId, getCtx(req));
    res.json({ success: true, data: siblings });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /:campaignId/cycle — cycle to next engagement (sequential)
router.post('/:campaignId/cycle', async (req: any, res: Response) => {
  try {
    const parsed = cycleEngagementSchema.parse(req.body ?? {});
    const updated = await BusinessProspectService.getInstance().cycleToNextEngagement({
      campaignId: req.params.campaignId,
      resetToStage: parsed.reset_to_stage,
      notes: parsed.notes,
      changedBy: (req as any).user?.id,
    }, getCtx(req));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// PAYMENT LINK PANEL (§8.1) + SEND CLAIM INVITE (§8.2)
// ====================

const payLinkCreateSchema = z.object({
  token_type: z.enum(['deliverable', 'demo_storefront']).default('deliverable'),
  deliverable_id: z.string().optional(),
  expires_in_days: z.number().int().min(1).max(365).default(30),
});

/**
 * GET /campaigns/:id/pay-links
 *
 * Returns all preview tokens for the campaign with status fields + resolved
 * pay URLs. Powers the Payment Link panel (§8.1).
 */
router.get('/campaigns/:id/pay-links', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id },
      select: { id: true, business_name: true, package_price_cents: true },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    const tokens = await prisma.mkt_deliverable_preview_tokens.findMany({
      where: { campaign_id: id },
      orderBy: { created_at: 'desc' },
    });

    const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl;
    const data = tokens.map((t: any) => {
      const now = new Date();
      const isExpired = t.expires_at && t.expires_at < now;
      const isPaid = !!t.paid_at;
      const isConverted = !!t.converted_at;
      // Lifecycle status: created → viewed → paid (or expired/converted)
      let lifecycleStatus: 'created' | 'viewed' | 'paid' | 'expired' | 'converted' = 'created';
      if (isPaid) lifecycleStatus = 'paid';
      else if (isConverted) lifecycleStatus = 'converted';
      else if (isExpired) lifecycleStatus = 'expired';
      else if (t.viewed_at) lifecycleStatus = 'viewed';

      return {
        id: t.id,
        token: t.token,
        tokenType: t.token_type,
        deliverableId: t.deliverable_id || null,
        payUrl: `${baseUrl}/marketing/pay?ptoken=${t.token}`,
        qrPayload: `${baseUrl}/marketing/pay?ptoken=${t.token}`,
        shortCode: t.short_code || null,
        shortUrl: t.short_code ? `${baseUrl}/g/${t.short_code}` : null,
        lifecycleStatus,
        viewedAt: t.viewed_at || null,
        paidAt: t.paid_at || null,
        convertedAt: t.converted_at || null,
        expiresAt: t.expires_at,
        createdAt: t.created_at,
        isExpired: !!isExpired,
        isPaid,
      };
    });

    return res.json({
      success: true,
      campaign: {
        id: campaign.id,
        businessName: campaign.business_name,
        packagePriceCents: campaign.package_price_cents,
        hasPrice: campaign.package_price_cents != null && campaign.package_price_cents > 0,
      },
      tokens: data,
    });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

/**
 * POST /campaigns/:id/pay-links
 *
 * Mint/regenerate a preview token. Returns the new URL + QR payload.
 * Per §8.1: supersedes expired tokens (marks them converted) so only one
 * active token per type remains.
 */
router.post('/campaigns/:id/pay-links', async (req: any, res: Response) => {
  try {
    const parsed = payLinkCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }
    const { id } = req.params;
    const { token_type, deliverable_id, expires_in_days } = parsed.data;

    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id },
      select: { id: true, package_price_cents: true },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    // Price guard (§8.1): warn but still allow minting (operator may have a
    // custom-priced follow-on). The frontend panel hides the link when unset.
    // Supersede prior unconverted tokens of the same type for this campaign
    // so only one active token per type remains.
    await prisma.mkt_deliverable_preview_tokens.updateMany({
      where: {
        campaign_id: id,
        token_type: token_type,
        converted_at: null,
        paid_at: null,
      },
      data: { converted_at: new Date() },
    });

    const token = await MarketingDeliverableService.generateCampaignToken(
      id,
      token_type,
      deliverable_id,
      expires_in_days,
      getCtx(req),
    );

    const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl;
    const payUrl = `${baseUrl}/marketing/pay?ptoken=${token.token}`;

    return res.status(201).json({
      success: true,
      token: {
        id: token.id,
        token: token.token,
        tokenType: token.token_type,
        deliverableId: token.deliverable_id || null,
        payUrl,
        qrPayload: payUrl,
        expiresAt: token.expires_at,
        createdAt: token.created_at,
      },
      priceWarning: campaign.package_price_cents == null || campaign.package_price_cents <= 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// DIAGNOSTIC GALLERY TOKEN (§12 Sprint 2)
// ====================

const galleryTokenCreateSchema = z.object({
  gallery_title: z.string().max(255).optional(),
  gallery_subtitle: z.string().optional(),
  friction_summary: z.any().optional(),
  cta_label: z.string().max(255).optional(),
  cta_amount_cents: z.number().int().min(0).optional(),
  expires_in_days: z.number().int().min(1).max(365).default(7),
});

/**
 * POST /campaigns/:id/gallery-token
 *
 * Mint a diagnostic gallery token for a campaign at the preview_built or
 * shown stage. The token doubles as the pay token (Option A in spec §4.4) —
 * the pay endpoint resolves the campaign from the token regardless of type.
 *
 * Stage gate: only preview_built + shown can generate gallery tokens.
 * Screenshot gate: campaign must have at least 1 file with file_type='screenshot'.
 * Archetype: resolved via resolveCampaignArchetype (honors operator-accepted
 * triage). For A2, the theme is re-extracted via selectArchetype so the
 * gallery title can include it. Defaults are archetype-aware (§5).
 *
 * Supersedes prior unconverted diagnostic_gallery tokens for this campaign
 * (marks them converted_at = now()) so only one active gallery token remains.
 */
router.post('/campaigns/:id/gallery-token', async (req: any, res: Response) => {
  try {
    const parsed = galleryTokenCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }
    const { id } = req.params;
    const ctx = getCtx(req);

    // 1. Load campaign + stage gate
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id },
      select: {
        id: true,
        stage: true,
        package_price_cents: true,
        mkt_files_list: {
          where: { file_type: 'diagnostic_screenshot' },
          select: { id: true, file_name: true },
        },
      },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    const ALLOWED_STAGES = ['preview_built', 'shown'];
    if (!ALLOWED_STAGES.includes(campaign.stage)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_stage',
        message: `Gallery tokens can only be generated for campaigns at the preview_built or shown stage (current: ${campaign.stage}).`,
      });
    }

    // 2. Screenshot gate
    if (campaign.mkt_files_list.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'no_screenshots',
        message: 'Upload at least one screenshot before generating a gallery token.',
      });
    }

    // 3. Resolve archetype (honors operator-accepted triage overrides)
    let archetype: string;
    let theme: any = null;
    try {
      const resolved = await resolveCampaignArchetype(id, ctx);
      archetype = resolved.archetype;
      // For A2, re-run selectArchetype to get the theme (HeaderService pattern).
      // resolveCampaignArchetype does not return the theme field.
      if (resolved.archetype === 'A2') {
        // Need the audit data to re-run selectArchetype — fetch via BusinessContextService
        const BusinessContextService = (await import('../services/deliverable/BusinessContextService')).default;
        const auditResult = await BusinessContextService.getLatestAuditData(id, ctx);
        if (auditResult) {
          const autoSel = selectArchetype(auditResult.auditData as BusinessAnalysisAuditData);
          theme = autoSel.theme ?? null;
        }
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'archetype_unresolved',
        message: 'Could not resolve campaign archetype. Ensure a business_analysis audit exists or triage is accepted.',
      });
    }

    // 4. Build archetype-aware defaults
    const defaults = resolveGalleryArchetypeDefaults(archetype as any, theme);

    // 5. Merge operator overrides (if any) with defaults
    const galleryMeta = {
      galleryTitle: parsed.data.gallery_title ?? defaults.galleryTitle,
      gallerySubtitle: parsed.data.gallery_subtitle ?? defaults.gallerySubtitle,
      frictionSummary: parsed.data.friction_summary ?? defaults.frictionSummary,
      ctaLabel: parsed.data.cta_label ?? defaults.ctaLabel,
      ctaAmountCents: parsed.data.cta_amount_cents ?? campaign.package_price_cents ?? undefined,
      galleryArchetype: archetype,
    };

    // 6. Supersede prior unconverted diagnostic_gallery tokens
    await prisma.mkt_deliverable_preview_tokens.updateMany({
      where: {
        campaign_id: id,
        token_type: 'diagnostic_gallery',
        converted_at: null,
        paid_at: null,
      },
      data: { converted_at: new Date() },
    });

    // 7. Mint the new token
    const token = await MarketingDeliverableService.generateCampaignToken(
      id,
      'diagnostic_gallery',
      undefined,
      parsed.data.expires_in_days,
      ctx,
      galleryMeta,
    );

    const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl;
    const galleryUrl = `${baseUrl}/preview/${token.token}`;
    const shortCode = token.short_code as string | null;
    const shortUrl = shortCode ? `${baseUrl}/g/${shortCode}` : null;

    logger.info('Gallery token generated', ctx, {
      campaignId: id,
      archetype,
      screenshotCount: campaign.mkt_files_list.length,
      expiresAt: token.expires_at,
      shortCode,
    });

    return res.status(201).json({
      success: true,
      token: {
        id: token.id,
        token: token.token,
        tokenType: token.token_type,
        galleryUrl,
        shortUrl,
        shortCode,
        expiresAt: token.expires_at,
        createdAt: token.created_at,
        archetype,
        galleryTitle: galleryMeta.galleryTitle,
        gallerySubtitle: galleryMeta.gallerySubtitle,
        ctaLabel: galleryMeta.ctaLabel,
        ctaAmountCents: galleryMeta.ctaAmountCents ?? null,
        screenshotCount: campaign.mkt_files_list.length,
      },
      priceWarning: campaign.package_price_cents == null || campaign.package_price_cents <= 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// MULTI-DIAGNOSTIC GALLERY TOKEN (Sprint 2 — Multi-Archetype)
// ====================

const multiGalleryTokenSchema = z.object({
  expires_in_days: z.number().int().min(1).max(365).default(7),
});

/**
 * POST /prospects/:prospectId/multi-gallery-token
 *
 * Issue a multi-diagnostic gallery token for a business prospect. The token
 * references the primary sibling campaign and stores the prospect ID +
 * sibling campaign IDs in the metadata JSONB column.
 *
 * Gates:
 * - At least 1 sibling must be at preview_built/shown stage
 * - At least 1 sibling must have diagnostic screenshots
 *
 * The public API (GET /api/public/gallery/multi/:token) assembles the full
 * multi-gallery data from all eligible siblings at view time.
 */
router.post('/prospects/:prospectId/multi-gallery-token', async (req: any, res: Response) => {
  try {
    const { prospectId } = req.params;
    const parsed = multiGalleryTokenSchema.parse(req.body ?? {});
    const ctx = getCtx(req);

    // 1. Check eligibility — at least 1 sibling at preview_built/shown with screenshots
    const eligibility = await GalleryMultiService.getInstance().checkEligibility(prospectId, ctx);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        error: 'no_eligible_siblings',
        message: `No siblings at preview_built/shown stage with diagnostic screenshots. Total siblings: ${eligibility.siblingCount}, eligible: ${eligibility.eligibleCount}`,
      });
    }

    // 2. Load the primary sibling campaign (token references it)
    const { BusinessProspectService } = await import('../services/BusinessProspectService.js');
    const primarySibling = await BusinessProspectService.getInstance().getPrimarySibling(prospectId, ctx);
    if (!primarySibling) {
      return res.status(404).json({ success: false, error: 'prospect_not_found', message: 'No campaigns found for this prospect' });
    }

    // 3. Load all sibling campaign IDs for metadata
    const siblings = await BusinessProspectService.getInstance().listSiblings(prospectId, ctx);
    const siblingCampaignIds = siblings.map((s) => s.id);

    // 4. Supersede prior multi-gallery tokens for this prospect
    await prisma.mkt_deliverable_preview_tokens.updateMany({
      where: {
        token_type: 'multi_diagnostic_gallery',
        converted_at: null,
        expires_at: { gt: new Date() },
      } as any,
      data: { converted_at: new Date() },
    });

    // 5. Mint the multi-gallery token (references primary sibling campaign)
    const token = await MarketingDeliverableService.generateCampaignToken(
      primarySibling.id,
      'multi_diagnostic_gallery',
      undefined,
      parsed.expires_in_days,
      ctx,
    );

    // 6. Store metadata (prospect ID + sibling campaign IDs)
    await prisma.mkt_deliverable_preview_tokens.update({
      where: { id: token.id },
      data: {
        metadata: {
          business_prospect_id: prospectId,
          sibling_campaign_ids: siblingCampaignIds,
        } as any,
      } as any,
    });

    logger.info('Multi-gallery token issued', ctx, {
      prospectId,
      primaryCampaignId: primarySibling.id,
      siblingCount: siblingCampaignIds.length,
      tokenId: token.id,
    });

    const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl;
    const multiGalleryUrl = `${baseUrl}/preview/${token.token}?prospect=true`;
    const shortCode = token.short_code as string | null;
    const shortUrl = shortCode ? `${baseUrl}/g/${shortCode}` : null;

    res.status(201).json({
      success: true,
      data: {
        ...token,
        galleryUrl: multiGalleryUrl,
        shortUrl,
        shortCode,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// DIAGNOSTIC GALLERY — ADMIN ANALYTICS (§12 Sprint 4)
// ====================

/**
 * GET /campaigns/:id/gallery-analytics
 *
 * Per-campaign gallery analytics summary with per-token breakdown.
 * Admin auth required.
 */
router.get('/campaigns/:id/gallery-analytics', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = getCtx(req);

    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id },
      select: { id: true, business_name: true, stage: true },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    const analytics = await galleryAnalyticsService.getCampaignAnalytics(id, ctx);
    return res.json({ success: true, data: { ...analytics, businessName: campaign.business_name, stage: campaign.stage } });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

/**
 * GET /gallery-analytics/dashboard
 *
 * Cross-campaign dashboard with byArchetype breakdown.
 * Admin auth required. Optional ?daysBack= query param (default 30).
 */
router.get('/gallery-analytics/dashboard', async (req: any, res: Response) => {
  try {
    const daysBack = parseInt(req.query.daysBack as string, 10);
    const validDaysBack = Number.isFinite(daysBack) && daysBack > 0 && daysBack <= 365 ? daysBack : 30;

    const dashboard = await galleryAnalyticsService.getDashboardAnalytics({ daysBack: validDaysBack }, getCtx(req));
    return res.json({ success: true, data: dashboard });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

/**
 * POST /campaigns/:id/send-claim-invite
 *
 * Operator "Send claim invite" action (§8.2). Triggers the Path B claim email
 * to campaign.email. Only allowed when the campaign is paid but unclaimed
 * (no customer_id). Returns 400 if already claimed or unpaid.
 */
router.post('/campaigns/:id/send-claim-invite', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id },
      select: { id: true, email: true, customer_id: true, date_paid: true, business_name: true },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    if (campaign.customer_id) {
      return res.status(400).json({
        success: false,
        error: 'already_claimed',
        message: 'This campaign is already linked to a customer account.',
      });
    }

    if (!campaign.date_paid) {
      return res.status(400).json({
        success: false,
        error: 'not_paid',
        message: 'Cannot send a claim invite for an unpaid campaign.',
      });
    }

    const email = (campaign.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'no_email',
        message: 'This campaign has no email address on file.',
      });
    }

    // Issue a claim token (voids prior unclaimed tokens for this email) and
    // send the invite email. Uses the same Path B plumbing as the public
    // /claim/request endpoint so the operator-driven invite records path
    // 'operator_invite' in the audit log via claimAllEligible when the
    // customer eventually completes the claim.
    const issued = await MarketingCustomerService.issueClaimToken(email);
    if (!issued) {
      // No eligible campaigns — shouldn't happen since we checked above, but
      // guard against races.
      return res.status(409).json({
        success: false,
        error: 'no_eligible_campaigns',
        message: 'No unclaimed paid campaigns found for this email.',
      });
    }

    const emailResult = await MarketingReceiptEmailService.sendClaimInviteEmail(email, issued.token);

    // Audit the operator-initiated invite
    try {
      const { audit } = await import('../audit');
      await audit({
        tenantId: 'platform',
        actor: req.user?.id || 'unknown',
        actorType: 'system',
        action: 'create',
        payload: {
          entity_type: 'other',
          id: issued.token,
          campaign_id: id,
          action_description: 'operator_send_claim_invite',
          email,
          campaigns_linked: issued.campaignIds.length,
        },
      });
    } catch (e) {
      logger.error('[marketing-ops] send-claim-invite audit failed', getCtx(req), { error: (e as Error).message });
    }

    logger.info('[marketing-ops] Operator sent claim invite', getCtx(req), {
      campaignId: id,
      email,
      campaignIds: issued.campaignIds.length,
      emailSent: emailResult.sent,
    });

    return res.json({
      success: true,
      message: emailResult.sent
        ? `Claim invite sent to ${email}.`
        : `Claim link generated, but the email could not be sent (${emailResult.error || 'unknown error'}). Share the link manually.`,
      emailSent: emailResult.sent,
      campaignCount: issued.campaignIds.length,
    });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ─── Customer Alerts (§8.3) ──────────────────────────────────────────────
// Operator composer for targeted / broadcast / campaign-scoped alerts to
// marketing customers. Alerts are stored as crm_alerts with tenant_id =
// PLATFORM_SCOPE; the customer-side reader (marketing-customer.ts /alerts)
// filters by metadata.customer_id / metadata.campaign_id at read time.

const alertCreateSchema = z.object({
  type: z.enum(['mkt_direct', 'mkt_broadcast', 'mkt_campaign']),
  alertType: z.string().default('info'),
  title: z.string().min(1).max(255),
  body: z.string().optional(),
  icon: z.string().max(10).optional(),
  customerId: z.string().optional(),
  campaignId: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
});

/**
 * GET /api/admin/marketing-ops/alerts/customers
 * List marketing customers (customers with ≥1 claimed campaign) for the
 * recipient picker. Returns id, email, name, customer_number, claimed
 * campaign count, last campaign business name.
 */
router.get('/alerts/customers', async (req: any, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    // Customers with at least one claimed campaign (customer_id IS NOT NULL)
    const customers = await prisma.customers.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
              { customer_number: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        customer_number: true,
        mkt_campaigns_list: {
          where: { customer_id: { not: null } },
          select: { id: true, business_name: true, stage: true },
        },
      },
      take: 500,
      orderBy: { created_at: 'desc' },
    });

    // Filter to only customers with claimed campaigns (platform context)
    const marketingCustomers = customers
      .filter((c) => c.mkt_campaigns_list.length > 0)
      .map((c) => {
        const campaigns = c.mkt_campaigns_list;
        const lastCampaign = campaigns[0];
        return {
          id: c.id,
          email: c.email,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
          customerNumber: c.customer_number,
          campaignCount: campaigns.length,
          lastBusinessName: lastCampaign?.business_name || null,
        };
      });

    res.json({ success: true, data: marketingCustomers });
  } catch (error: any) {
    logger.error('[marketing-ops] GET /alerts/customers error', getCtx(req), { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load marketing customers' });
  }
});

/**
 * GET /api/admin/marketing-ops/alerts/recipient-count
 * Pre-send recipient estimate for the confirmation dialog.
 * Query params: type=mkt_broadcast | mkt_campaign (with campaignId)
 */
router.get('/alerts/recipient-count', async (req: any, res: Response) => {
  try {
    const type = (req.query.type as string) || 'mkt_broadcast';
    const campaignId = req.query.campaignId as string | undefined;

    if (type === 'mkt_direct') {
      // Single customer — count is 1 if customer has platform context
      const customerId = req.query.customerId as string;
      if (!customerId) return res.json({ success: true, data: { count: 0 } });
      const campaigns = await prisma.mkt_campaigns_list.count({
        where: { customer_id: customerId },
      });
      return res.json({ success: true, data: { count: campaigns > 0 ? 1 : 0 } });
    }

    if (type === 'mkt_campaign' && campaignId) {
      // Count customers who have claimed this specific campaign
      const campaign = await prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        select: { customer_id: true },
      });
      if (!campaign?.customer_id) {
        return res.json({ success: true, data: { count: 0 } });
      }
      return res.json({ success: true, data: { count: 1 } });
    }

    // Broadcast: all customers with ≥1 claimed campaign
    const count = await prisma.mkt_campaigns_list.groupBy({
      by: ['customer_id'],
      where: { customer_id: { not: null } },
      _count: { id: true },
    });
    res.json({ success: true, data: { count: count.length } });
  } catch (error: any) {
    logger.error('[marketing-ops] GET /alerts/recipient-count error', getCtx(req), { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to count recipients' });
  }
});

/**
 * POST /api/admin/marketing-ops/alerts
 * Create a targeted / broadcast / campaign-scoped alert for marketing customers.
 *
 * - mkt_direct: requires customerId (a platform-context customer)
 * - mkt_campaign: requires campaignId (campaign with a claimed customer)
 * - mkt_broadcast: no target — all platform-context customers see it
 *
 * Alerts are informational only — no payment demands or card-link phishing (§9).
 */
router.post('/alerts', async (req: any, res: Response) => {
  try {
    const parsed = alertCreateSchema.parse(req.body);
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';

    // Validate target per type
    if (parsed.type === 'mkt_direct') {
      if (!parsed.customerId) {
        return res.status(400).json({ success: false, error: 'invalid_input', message: 'customerId is required for mkt_direct' });
      }
      const hasCampaigns = await prisma.mkt_campaigns_list.count({
        where: { customer_id: parsed.customerId },
      });
      if (hasCampaigns === 0) {
        return res.status(400).json({ success: false, error: 'no_platform_context', message: 'Customer has no claimed marketing campaigns' });
      }
    } else if (parsed.type === 'mkt_campaign') {
      if (!parsed.campaignId) {
        return res.status(400).json({ success: false, error: 'invalid_input', message: 'campaignId is required for mkt_campaign' });
      }
      const campaign = await prisma.mkt_campaigns_list.findUnique({
        where: { id: parsed.campaignId },
        select: { customer_id: true },
      });
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
      }
      if (!campaign.customer_id) {
        return res.status(400).json({ success: false, error: 'not_claimed', message: 'Campaign has no claimed customer' });
      }
    }

    // Build metadata for read-time targeting (§7.9)
    const metadata: Record<string, any> = {};
    if (parsed.type === 'mkt_direct' && parsed.customerId) {
      metadata.customer_id = parsed.customerId;
    }
    if (parsed.type === 'mkt_campaign' && parsed.campaignId) {
      metadata.campaign_id = parsed.campaignId;
    }
    if (parsed.ctaLabel) {
      metadata.cta_label = parsed.ctaLabel;
      metadata.cta_href = parsed.ctaHref || undefined;
    }

    const alert = await prisma.crm_alerts.create({
      data: {
        tenant_id: PLATFORM_SCOPE,
        type: parsed.alertType,
        title: parsed.title,
        body: parsed.body || null,
        icon: parsed.icon || null,
        metadata,
      },
    });

    // Audit
    const { audit } = await import('../audit');
    await audit({
      tenantId: PLATFORM_SCOPE,
      actor: actorId,
      actorType: 'user',
      action: 'create',
      payload: {
        entity_type: 'mkt_customer_alert',
        id: alert.id,
        alert_type: parsed.type,
        title: parsed.title,
        customer_id: parsed.customerId,
        campaign_id: parsed.campaignId,
      },
    });

    res.json({ success: true, data: { id: alert.id, createdAt: alert.created_at } });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'invalid_input', message: error.message });
    }
    logger.error('[marketing-ops] POST /alerts error', getCtx(req), { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

/**
 * GET /api/admin/marketing-ops/alerts
 * List sent platform-scope alerts with recipient/read/dismissed counts.
 */
router.get('/alerts', async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      prisma.crm_alerts.findMany({
        where: { tenant_id: PLATFORM_SCOPE },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
        include: {
          crm_customer_alert_states: true,
        },
      }),
      prisma.crm_alerts.count({ where: { tenant_id: PLATFORM_SCOPE } }),
    ]);

    // Compute recipient/read/dismissed counts per alert
    const result = alerts.map((alert) => {
      const meta = alert.metadata as any;
      const targetType = !meta || Object.keys(meta).length === 0
        ? 'mkt_broadcast'
        : meta.customer_id
          ? 'mkt_direct'
          : meta.campaign_id
            ? 'mkt_campaign'
            : 'mkt_broadcast';

      const states = alert.crm_customer_alert_states || [];
      const readCount = states.filter((s) => s.read_at).length;
      const dismissedCount = states.filter((s) => s.dismissed_at).length;

      return {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        body: alert.body,
        icon: alert.icon,
        targetType,
        customerId: meta?.customer_id || null,
        campaignId: meta?.campaign_id || null,
        createdAt: alert.created_at,
        readCount,
        dismissedCount,
        recipientCount: states.length,
      };
    });

    res.json({ success: true, data: result, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    logger.error('[marketing-ops] GET /alerts error', getCtx(req), { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load alerts' });
  }
});

// ====================
// INTELLIGENCE PROFILES (Sprint 1 — Seek Intelligence Scope)
// ====================

const intelligenceProfileCreateSchema = z.object({
  id: z.string().max(64).optional(),
  categoryKey: z.string().min(1).max(100),
  categoryName: z.string().min(1).max(100),
  configurationJson: z.record(z.string(), z.any()),
  status: z.enum(['draft', 'active', 'retired']).optional(),
  intelligenceFocus: z.enum(['emerging', 'competitive']).default('emerging'),
  referenceCity: z.string().max(100).nullable().optional(),
  referenceState: z.string().max(50).nullable().optional(),
});

const intelligenceProfilePublishSchema = z.object({
  categoryName: z.string().min(1).max(100).optional(),
  configurationJson: z.record(z.string(), z.any()),
});

// GET /intelligence-profiles — list active profiles
router.get('/intelligence-profiles', async (req, res) => {
  try {
    const profiles = await IntelligenceProfileService.getInstance().listActive(getCtx(req));
    res.json({ success: true, data: profiles });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /intelligence-profiles/drafts — list draft profiles awaiting activation
router.get('/intelligence-profiles/drafts', async (req, res) => {
  try {
    const profiles = await IntelligenceProfileService.getInstance().listDrafts(getCtx(req));
    res.json({ success: true, data: profiles });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /intelligence-profiles/resolve/:category?focus=emerging|competitive&city=...
// NOTE: Must be registered BEFORE /:id/:version, otherwise the literal "resolve"
// segment is captured as :id and the category is parsed as :version (→ "Invalid version").
router.get('/intelligence-profiles/resolve/:category', async (req, res) => {
  try {
    const focus = req.query.focus as 'emerging' | 'competitive' | undefined;
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;
    const profile = await IntelligenceProfileService.getInstance().resolve(
      req.params.category,
      focus,
      city,
      getCtx(req),
    );
    res.json({ success: true, data: profile });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /intelligence-profiles/:id — get profile with all versions
router.get('/intelligence-profiles/:id', async (req, res) => {
  try {
    const profiles = await IntelligenceProfileService.getInstance().getProfileWithVersions(req.params.id, getCtx(req));
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    res.json({ success: true, data: profiles });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /intelligence-profiles/:id/:version — get specific version
router.get('/intelligence-profiles/:id/:version', async (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    if (isNaN(version)) {
      return res.status(400).json({ success: false, error: 'Invalid version' });
    }
    const profile = await IntelligenceProfileService.getInstance().getVersion(req.params.id, version, getCtx(req));
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile version not found' });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /intelligence-profiles — create a new profile (draft by default)
router.post('/intelligence-profiles', async (req, res) => {
  try {
    const parsed = intelligenceProfileCreateSchema.parse(req.body);
    const profile = await IntelligenceProfileService.getInstance().createProfile({
      id: parsed.id,
      categoryKey: parsed.categoryKey,
      categoryName: parsed.categoryName,
      configurationJson: parsed.configurationJson,
      status: parsed.status,
      intelligenceFocus: parsed.intelligenceFocus,
      referenceCity: parsed.referenceCity,
      referenceState: parsed.referenceState,
    }, getCtx(req));
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /intelligence-profiles/:id/publish — publish a new active version
router.post('/intelligence-profiles/:id/publish', async (req, res) => {
  try {
    const parsed = intelligenceProfilePublishSchema.parse(req.body);
    const profile = await IntelligenceProfileService.getInstance().publishVersion(req.params.id, {
      categoryName: parsed.categoryName,
      configurationJson: parsed.configurationJson,
    }, getCtx(req));
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// POST /intelligence-profiles/:id/:version/activate — activate a draft version
router.post('/intelligence-profiles/:id/:version/activate', async (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    if (isNaN(version)) {
      return res.status(400).json({ success: false, error: 'Invalid version' });
    }
    const profile = await IntelligenceProfileService.getInstance().activateDraft(req.params.id, version, getCtx(req));
    res.json({ success: true, data: profile });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// DELETE /intelligence-profiles/:id/:version — delete a draft version
// Only drafts may be deleted; active/retired versions are immutable history.
router.delete('/intelligence-profiles/:id/:version', async (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    if (isNaN(version)) {
      return res.status(400).json({ success: false, error: 'Invalid version' });
    }
    const result = await IntelligenceProfileService.getInstance().deleteDraft(req.params.id, version, getCtx(req));
    // Audit the operator-initiated draft deletion
    try {
      const { audit } = await import('../audit');
      await audit({
        tenantId: PLATFORM_SCOPE,
        actor: req.user?.id || 'unknown',
        actorType: 'user',
        action: 'delete',
        payload: {
          entity_type: 'other',
          id: `${result.id}@${result.version}`,
          action_description: 'operator_delete_intelligence_profile_draft',
          profile_id: result.id,
          profile_version: result.version,
        },
      });
    } catch (e) {
      logger.error('[marketing-ops] intelligence-profile draft delete audit failed', getCtx(req), { error: (e as Error).message });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ====================
// INTELLIGENCE RUNS (Sprint 2 — Seek Intelligence Scope)
// ====================

// GET /intelligence-runs?campaignId= — list runs for a campaign
router.get('/intelligence-runs', async (req, res) => {
  try {
    const campaignId = z.string().parse(req.query.campaignId);
    const runs = await IntelligenceRunService.getInstance().listRunsForCampaign(campaignId, getCtx(req));
    res.json({ success: true, data: runs });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// GET /intelligence-runs/:id — get single run
router.get('/intelligence-runs/:id', async (req, res) => {
  try {
    const run = await IntelligenceRunService.getInstance().getRun(req.params.id, getCtx(req));
    if (!run) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    res.json({ success: true, data: run });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
});

// ============================================================================
// PROFILE REPAIR PROMPTS & TRIAGE (§4.5)
// ============================================================================

const repairTriageInputSchema = z.object({
  templateId: z.string().optional(),
});

const repairTriageImportSchema = z.object({
  templateId: z.string().optional(),
  raw_output: z.string().min(10, 'raw_output must be at least 10 characters'),
});

const repairResolutionInputSchema = z.object({
  intakeId: z.string().optional(),
});

// Run Triage Analysis synchronously (executeSeekSync)
const handleRepairTriage = async (req: any, res: Response) => {
  try {
    const campaignId = req.params.id || req.params.campaignId;
    const parsed = repairTriageInputSchema.parse(req.body || {});
    const result = await ProfileRepairPromptService.executeSeekSync(
      campaignId,
      parsed.templateId,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
};
router.post('/campaigns/:id/repair-triage', handleRepairTriage);
router.post('/:id/repair-triage', handleRepairTriage);

// Render Triage Prompt Text (Copy-Paste Bridge)
const handleRepairTriageRender = async (req: any, res: Response) => {
  try {
    const campaignId = req.params.id || req.params.campaignId;
    const templateId = req.body?.templateId || req.query?.templateId || PROFILE_REPAIR_TRIAGE_TEMPLATE_ID;
    const result = await ProfileRepairPromptService.renderPromptText(
      campaignId,
      templateId,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
};
router.post('/campaigns/:id/repair-triage/render', handleRepairTriageRender);
router.post('/:id/repair-triage/render', handleRepairTriageRender);

// Import External Triage Result
const handleRepairTriageImport = async (req: any, res: Response) => {
  try {
    const campaignId = req.params.id || req.params.campaignId;
    const parsed = repairTriageImportSchema.parse(req.body || {});
    const targetTemplateId = parsed.templateId || PROFILE_REPAIR_TRIAGE_TEMPLATE_ID;
    const result = await ProfileRepairPromptService.importExternalResult(
      campaignId,
      targetTemplateId,
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
};
router.post('/campaigns/:id/repair-triage/import', handleRepairTriageImport);
router.post('/:id/repair-triage/import', handleRepairTriageImport);

// Enqueue Track B Resolution (Async)
const handleRepairResolution = async (req: any, res: Response) => {
  try {
    const campaignId = req.params.id || req.params.campaignId;
    const parsed = repairResolutionInputSchema.parse(req.body || {});

    let intakeId = parsed.intakeId;
    if (!intakeId) {
      const intake = await prisma.mkt_dispute_intake.findFirst({
        where: { campaign_id: campaignId, intake_kind: 'profile_repair' },
        orderBy: { created_at: 'desc' },
      });
      if (!intake) {
        return res.status(400).json({ success: false, error: 'no_intake_found', message: 'No profile repair intake found for this campaign' });
      }
      intakeId = intake.id;
    }

    const result = await ProfileRepairPromptService.enqueueResolution(
      campaignId,
      intakeId,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'validation_error', details: error.issues });
    }
    handleServiceError(res, error, getCtx(req));
  }
};
router.post('/campaigns/:id/repair-resolution', handleRepairResolution);
router.post('/:id/repair-resolution', handleRepairResolution);

// Render Resolution Prompt Text (Copy-Paste Bridge)
const handleRepairResolutionRender = async (req: any, res: Response) => {
  try {
    const campaignId = req.params.id || req.params.campaignId;
    const result = await ProfileRepairPromptService.renderPromptText(
      campaignId,
      PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID,
      getCtx(req),
    );
    res.json({ success: true, data: result });
  } catch (error) {
    handleServiceError(res, error, getCtx(req));
  }
};
router.post('/campaigns/:id/repair-resolution/render', handleRepairResolutionRender);
router.post('/:id/repair-resolution/render', handleRepairResolutionRender);

// ====================
// CATCH-ALL: GET /:id
// IMPORTANT: This MUST be the last GET route in this file. It matches any
// 1-segment GET path, so any static 1-segment GET route declared after it
// (e.g. /alerts, /category-tone-presets, /signals) would be shadowed.
// Multi-segment /:id/... routes (e.g. /:id/review-response/pipelines) are
// not affected by ordering relative to this route.
// ====================
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

export default router;
