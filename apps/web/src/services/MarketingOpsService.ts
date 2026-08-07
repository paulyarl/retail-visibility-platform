/**
 * Marketing Ops Service
 *
 * Extends AdminApiSingleton to provide admin CRUD operations
 * for the marketing ops module (campaigns, audits, prompts, files,
 * scorecards, deliverables, branding).
 *
 * Base URL: /api/admin/marketing-ops
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

// ====================
// TYPES
// ====================

export type CampaignStage =
  | 'seek'
  | 'preview_built'
  | 'shown'
  | 'paid'
  | 'delivered'
  | 'retainer_pitched'
  | 'retainer_won'
  | 'lost'
  | 'dead'
  | 'tenant_onboarded';

// Recovery Management stages run on the same stage column; literals are
// app-layer-enforced (no DB enum). See recoveryStages.ts on the API side.
export type CampaignCategory = 'review_management' | 'recovery_management' | 'profile_repair' | 'triage_management';
export type RepairTrack = 'standard' | 'escalated';

export type ConversionSource =
  | 'qr_deliverable'
  | 'demo_storefront'
  | 'gbp_enhancer'
  | 'directory_preview'
  | 'manual'
  | 'external';

export type CampaignOrigin = 'prospect' | 'upsell';

export type CampaignScope = 'business' | 'category' | 'city';

export type RetainerStatus = 'not_pitched' | 'pitched' | 'won' | 'declined';

export type PromptType =
  | 'seek'
  | 'fulfill'
  | 'filter'
  | 'retainer'
  | 'category_analysis'
  | 'city_analysis';

export type ExecutionStatus = 'pending' | 'completed' | 'failed' | 'filtered' | 'reviewed' | 'delivered' | 'archived';

export type FilterFlagStatus = 'pending' | 'fixed' | 'approved_as_is';

export type DeliverableType =
  | 'review_responses'
  | 'service_menu'
  | 'gbp_audit'
  | 'testimonial_cards'
  | 'nap_report'
  | 'seo_content'
  | 'lead_magnet'
  | 'recovery_resolution'
  | 'reinstatement_appeal'
  | 'citation_repair_package'
  | 'product_visibility_preview';

export type DeliverableStatus = 'preview' | 'paid' | 'archived';

export interface DirectoryProfileEntry {
  platform: string;
  url: string;
  claim_status: 'claimed' | 'unclaimed' | 'unknown';
  star_rating?: number | null;
  review_count?: number | null;
  category?: string;
}

export interface Campaign {
  id: string;
  display_id: string | null;
  scope: CampaignScope;
  campaign_category?: CampaignCategory;
  repair_track?: RepairTrack | null;
  repair_issue_type?: string | null;
  pipeline?: 'review' | 'recovery';
  business_name: string | null;
  category: string;
  city: string;
  neighborhood: string | null;
  contact_method: string | null;
  contact_info: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  social_profiles: { platform: string; url: string }[] | null;
  owner_names: string[] | null;
  phones: { label: string; number: string }[] | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  directory_profiles: DirectoryProfileEntry[] | null;
  gbp_claimed: boolean | null;
  unaddressed_reviews: number | null;
  last_review_date: string | null;
  has_website: string | null;
  nap_consistent: boolean | null;
  estimated_tier: string | null;
  estimated_fee_cents: number | null;
  pain_score: number | null;
  tone: string | null;
  retainer: 'Fast' | 'Medium' | 'Slow' | null;
  attributes: string[];
  stage: CampaignStage;
  stage_entered_at: string | null;
  date_entered: string | null;
  date_preview_built: string | null;
  date_shown: string | null;
  date_paid: string | null;
  date_delivered: string | null;
  date_retainer_pitched: string | null;
  date_retainer_won: string | null;
  amount_paid_cents: number | null;
  package_delivered: string | null;
  retainer_status: RetainerStatus | null;
  retainer_amount_cents: number | null;
  retainer_start_date: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tenant_id?: string | null;
  date_tenant_onboarded?: string | null;
  first_touch_source?: ConversionSource | null;
  last_touch_source?: ConversionSource | null;
  campaign_origin?: CampaignOrigin;
  demo_tenant_id?: string | null;
  package_price_cents?: number | null;
  subscription_tier_id?: string | null;
  coupon_code?: string | null;
  service_category?: string | null;
  service_category_label?: string | null;
  parent_campaign_id?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  last_contact_channel?: string | null;
  state?: string | null;
  is_hot_prospect?: boolean;
  hot_prospect_reason?: string | null;
  hot_prospect_set_at?: string | null;
  hot_prospect_deprioritized?: boolean;
  auto_followup_count?: number;
  customer_id?: string | null;
}

export interface CampaignLineageEntry {
  id: string;
  business_name: string | null;
  scope: CampaignScope;
  stage: CampaignStage;
  created_at?: string;
  category?: string | null;
  city?: string | null;
}

export interface CampaignDetail extends Campaign {
  audits?: Audit[];
  files?: MarketingFile[];
  stage_history?: StageHistory[];
  parent_campaign?: CampaignLineageEntry | null;
  children?: CampaignLineageEntry[];
  outreach_log?: OutreachLogEntry[];
}

export type ContactChannel = 'phone' | 'email' | 'website' | 'social' | 'in_person' | 'other';
export type ContactOutcome = 'reached' | 'no_answer' | 'left_message' | 'interested' | 'not_interested' | 'callback_scheduled' | 'other' | 'auto_follow_up_scheduled';

export interface OutreachLogEntry {
  id: string;
  campaign_id: string;
  stage_at_time: string;
  contact_channel: ContactChannel;
  contact_date: string;
  outcome: ContactOutcome;
  follow_up_date: string | null;
  follow_up_completed_at: string | null;
  notes: string | null;
  contacted_by: string | null;
  message_snapshot: string | null;
  message_subject: string | null;
  data_snapshot: {
    review_count?: number;
    average_rating?: number | null;
    unaddressed_reviews?: number;
    last_review_date?: string | null;
    gbp_claimed?: boolean;
    photo_count?: number;
  } | null;
  data_fresh_at: string | null;
  preview_token: string | null;
  created_at: string;
}

export interface FreshSnapshot {
  dataSnapshot: OutreachLogEntry['data_snapshot'];
  dataFreshAt: string;
}

// ─── Review Response Pipeline types ──────────────────────────────────────
export type ReviewPipelineStage = 'backlog' | 'responding' | 'follow_up' | 'closed' | 'monitoring';
export type ReviewResponseType = 'first_response' | 'follow_up' | 'public_reply' | 'private_message';
export type ReviewLogStatus = 'scheduled' | 'completed' | 'skipped';
export type FollowUpOutcome = 'converted_paid' | 'customer_responded' | 'no_response' | 'duplicate' | 'out_of_scope' | 'other';

// ─── Outreach Opener Types ──────────────────────────────────────────────
export type OpenerArchetype = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
export type OpenerSource = 'ai' | 'external';
export type CloseVariant = 'soft' | 'direct_paid';

export interface OpenerArchetypeSelection {
  archetype: OpenerArchetype;
  reason: string;
  theme?: { theme: string; summary: string; supporting_review_count: number };
}

export interface OpenerResolution {
  selection: OpenerArchetypeSelection;
  extractedFields: Record<string, any>;
  resolvedPrompt: string;
  closeVariant: CloseVariant;
}

export interface QualityGateResult {
  passed: boolean;
  issues: string[];
}

export interface OpenerResult {
  opener: OutreachOpener;
  selection: OpenerArchetypeSelection;
  extractedFields: Record<string, any>;
  qualityGate: QualityGateResult;
  resolvedPrompt: string;
}

export interface OutreachOpener {
  id: string;
  campaign_id: string;
  archetype: OpenerArchetype;
  close_variant: CloseVariant | null;
  opener_text: string | null;
  quality_gate_passed: boolean;
  quality_gate_issues: string[] | null;
  source: OpenerSource;
  ai_provider: string | null;
  ai_model: string | null;
  tokens_used: number;
  cost_cents: number;
  extracted_fields: Record<string, any> | null;
  executed_by: string | null;
  operator_name: string | null;
  executed_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Split-Test Analytics Types ─────────────────────────────────────────
// Cohort comparison by close_variant. See OutreachOpenerService.getSplitTestStats.

export interface SplitTestCampaignRow {
  campaign_id: string;
  business_name: string;
  stage: string;
  city: string | null;
  service_category: string | null;
  archetype: string;
  close_variant: string;
  opener_source: string;
  quality_gate_passed: boolean;
  sent: boolean;
  replied: boolean;
  latest_outcome: string | null;
  date_shown: string | null;
}

export interface SplitTestCohort {
  variant: string;
  openers: number;
  campaigns: number;
  sent: number;
  replies: number;
  replyRate: number;
  outcomeBreakdown: Record<string, number>;
  campaignRows: SplitTestCampaignRow[];
}

export interface SplitTestStats {
  cohorts: SplitTestCohort[];
  totals: { openers: number; sent: number; replies: number; replyRate: number };
}

// ─── Outreach Follow-Up Types ───────────────────────────────────────────
// Follow-up messages for prospects who didn't reply to the opener.
// Stored in the same table as openers (mkt_outreach_openers_list) with
// message_type='follow_up'. Inherits the opener's close_variant.

export type FollowUpType = 'doing' | 'telling';

export interface FollowUpDataDiff {
  new_review_count?: number;
  new_negative_count?: number;
  new_themes?: string[];
  new_platforms?: string[];
  opener_theme?: string;
  opener_archetype?: string;
}

export interface OutreachFollowUp {
  id: string;
  campaign_id: string;
  archetype: string;
  opener_text: string | null;
  quality_gate_passed: boolean;
  quality_gate_issues: string[] | null;
  source: string;
  ai_provider: string | null;
  ai_model: string | null;
  tokens_used: number;
  cost_cents: number;
  extracted_fields: Record<string, any> | null;
  executed_by: string | null;
  operator_name: string | null;
  executed_at: string;
  created_at: string;
  updated_at: string;
  close_variant: string | null;
  message_type: string | null;
  followup_type: FollowUpType | null;
  followup_number: number | null;
  opener_id: string | null;
  data_diff: FollowUpDataDiff | null;
}

export interface FollowUpResolution {
  opener: OutreachOpener;
  selection: { archetype: string; reason: string; theme: string };
  extractedFields: Record<string, any>;
  followUpType: FollowUpType;
  dataDiff: FollowUpDataDiff | null;
  freshSnapshot: any;
  resolvedPrompt: string;
  closeVariant: CloseVariant;
  followUpNumber: number;
}

export interface FollowUpResult {
  followUp: OutreachFollowUp;
  opener: OutreachOpener;
  selection: { archetype: string; reason: string; theme: string };
  extractedFields: Record<string, any>;
  followUpType: FollowUpType;
  qualityGate: { passed: boolean; issues: string[] };
  resolvedPrompt: string;
}

// ─── Outreach Pitch Types ───────────────────────────────────────────────
// Header / Closer / Contact / ReviewResponseDraft / Pitch — mirrors the
// opener types above. See docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md

export interface OutreachHeader {
  id: string;
  campaign_id: string;
  header_text: string | null;
  quality_gate_passed: boolean;
  quality_gate_issues: string[] | null;
  source: OpenerSource;
  ai_provider: string | null;
  ai_model: string | null;
  tokens_used: number;
  cost_cents: number;
  extracted_fields: Record<string, any> | null;
  executed_by: string | null;
  executed_at: string;
  created_at: string;
  updated_at: string;
}

export interface OutreachCloser {
  id: string;
  campaign_id: string;
  closer_text: string | null;
  quality_gate_passed: boolean;
  quality_gate_issues: string[] | null;
  source: OpenerSource;
  ai_provider: string | null;
  ai_model: string | null;
  tokens_used: number;
  cost_cents: number;
  extracted_fields: Record<string, any> | null;
  executed_by: string | null;
  executed_at: string;
  created_at: string;
  updated_at: string;
}

export interface OutreachContact {
  id: string;
  campaign_id: string;
  contact_text: string | null;
  label: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeaderResolution {
  selection: OpenerArchetypeSelection;
  extractedFields: Record<string, any>;
  resolvedPrompt: string;
}

export interface CloserResolution extends HeaderResolution {
  remaining: number;
  defaultTemplate: string;
}

export interface HeaderResult {
  header: OutreachHeader;
  selection: OpenerArchetypeSelection;
  extractedFields: Record<string, any>;
  qualityGate: QualityGateResult;
  resolvedPrompt: string;
}

export interface CloserResult extends HeaderResult {
  remaining: number;
  defaultTemplate: string;
}

export interface ReviewResponseDraft {
  review_text: string;
  response_text: string;
  response_source: OpenerSource;
  response_ai_provider: string | null;
  response_ai_model: string | null;
  response_tokens_used: number;
}

export interface ReviewPair {
  review_text: string;
  response_text: string;
  response_source: OpenerSource;
  response_ai_provider?: string | null;
  response_ai_model?: string | null;
  response_tokens_used?: number;
  is_negative_first: boolean;
  // ── Archetype-aware preview-slot labels (additive, optional) ──
  // Mirror the backend pitch-renderer fields. When present, the assembled
  // pitch renders with archetype-appropriate labels instead of the
  // review-centric defaults. Passed straight through to assemblePitch.
  evidence_label?: string;
  fix_label?: string;
  slot_label?: string;
  slot_label_prefix?: string;
  section_title?: string;
  first_slot_label?: string;
}

export interface AssemblePitchInput {
  campaignId: string;
  openerId: string;
  headerId?: string | null;
  closerId?: string | null;
  contactId?: string | null;
  reviewPairs: ReviewPair[];
}

export interface OutreachPitch {
  id: string;
  campaign_id: string;
  opener_id: string;
  header_id: string | null;
  closer_id: string | null;
  contact_id: string | null;
  review_pairs: ReviewPair[] | null;
  assembled_text: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PitchResult {
  pitch: OutreachPitch;
  assembledText: string;
}

export interface ReviewResponsePipeline {
  id: string;
  campaign_id: string;
  platform: string;
  stage: ReviewPipelineStage;
  priority: number;
  total_reviews: number;
  unanswered_count: number;
  response_rate: number;
  average_rating: number | null;
  follow_ups_open: number;
  follow_ups_completed: number;
  gate_met: boolean;
  gate_met_at: string | null;
  next_follow_up_at: string | null;
  last_activity_at: string | null;
  stale_thread_cutoff_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface ReviewResponseLogEntry {
  id: string;
  pipeline_id: string;
  platform_review_id: string | null;
  response_text: string | null;
  response_type: ReviewResponseType;
  responded_at: string;
  responded_by: string | null;
  customer_replied: boolean;
  customer_reply_at: string | null;
  thread_closed: boolean;
  thread_closed_at: string | null;
  notes: string | null;
  scheduled_for: string | null;
  status: ReviewLogStatus;
  outcome: FollowUpOutcome | null;
  created_at: string;
}

export interface ReviewGateResult {
  gateMet: boolean;
  reasons: string[];
  metrics: {
    unansweredCount: number;
    responseRate: number;
    followUpsOpen: number;
    thresholdUnanswered: number;
    thresholdResponseRate: number;
  };
}

export interface LogReviewResponseInput {
  platform_review_id?: string;
  response_text?: string;
  response_type: ReviewResponseType;
  notes?: string;
}

export interface ReviewFollowUpsDueResult {
  overdue: ReviewResponsePipeline[];
  dueToday: ReviewResponsePipeline[];
  thisWeek: ReviewResponsePipeline[];
}

export interface FollowUpEntry {
  campaign_id: string;
  business_name: string | null;
  next_follow_up_at: string;
  days_overdue?: number;
  assigned_to: string | null;
}

export interface FollowUpsDueResult {
  overdue: FollowUpEntry[];
  dueToday: FollowUpEntry[];
  thisWeek: FollowUpEntry[];
}

// ─── Hot-prospect (Sprint 3) ────────────────────────────────────────────
export interface HotProspectEntry {
  campaign_id: string;
  business_name: string | null;
  stage: string;
  city: string | null;
  state: string | null;
  category: string | null;
  pain_score: number | null;
  estimated_tier: string | null;
  hot_prospect_reason: string | null;
  hot_prospect_set_at: string | null;
  auto_followup_count: number;
  max_auto_followups: number;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
}

export interface HotProspectsResult {
  prospects: HotProspectEntry[];
}

// ─── Business analysis audit sync (Sprint 4) ────────────────────────────
export interface AuditSyncReport {
  campaignId: string;
  auditId: string;
  fieldsSynced: string[];
  contactsSynced: string[];
  hotProspectMarked: boolean;
  hotProspectReason: string | null;
  identityStatus: string | null;
  skipped: boolean;
  skipReason?: string;
}

// ─── Sprint 5: Scan-to-Campaign Spawning ────────────────────────────────
export interface SyncReport {
  executionId?: string;
  city?: string;
  state?: string;
  businessesInOutput?: number;
  matched: Array<{ campaignId: string; businessName: string; hot: boolean }>;
  unmatched: Array<{ businessName: string; reason: string }>;
  skippedChains: number;
  hotProspectsMarked: number;
  summaryStored: boolean;
  syncedAt?: string;
}

export interface DeriveAllUnmatchedResult {
  created: Array<{ campaignId: string; businessName: string }>;
  failed: Array<{ businessName: string; error: string }>;
  message?: string;
}

// ─── Prospect Queue types (Add to Queue sprint) ──────────────────────────

export type ProspectSourceKind = 'category_analysis' | 'city_category_audit' | 'scan_unmatched' | 'manual';
export type ProspectStatus = 'queued' | 'campaign_created' | 'dismissed';
export type ProspectPriority = 'high' | 'normal';
export type ProspectDismissReason = 'already_customer' | 'bad_fit' | 'duplicate' | 'other';

export interface AddToQueueInput {
  business_name: string;
  category?: string;
  city?: string;
  state?: string;
  source_kind: ProspectSourceKind;
  // Optional for manual entries added directly from the queue page.
  source_campaign_id?: string;
  source_audit_id?: string;
  source_execution_id?: string;
  audit_date?: string; // ISO datetime
  business_snapshot?: Record<string, any>;
  priority?: ProspectPriority;
  note?: string;
}

export type AddToQueueResult =
  | { kind: 'created'; entry: ProspectQueueEntry; created: true }
  | { kind: 'already_queued'; entry: ProspectQueueEntry; created: false }
  | { kind: 'campaign_exists'; campaignId: string };

export interface ProspectQueueListFilters {
  status?: ProspectStatus | ProspectStatus[];
  category?: string;
  city?: string;
  source_kind?: ProspectSourceKind;
  assigned_to?: string; // 'me' | 'unassigned' | <userId>
  limit?: number;
  includeCampaigns?: boolean;
}

export interface ProspectQueuePatch {
  priority?: ProspectPriority;
  note?: string | null;
  assigned_to?: string | null;
}

export interface ProspectQueueEntry {
  id: string;
  business_name: string;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  source_kind: ProspectSourceKind;
  source_scope?: string | null;
  source_campaign_id?: string | null;
  source_audit_id?: string | null;
  source_execution_id?: string | null;
  audit_date?: string | null;
  business_snapshot?: Record<string, any>;
  detected_signals?: string[];
  signal_count: number;
  rating?: number | null;
  review_count?: number | null;
  status: ProspectStatus;
  priority: ProspectPriority;
  note?: string | null;
  queued_by?: string | null;
  assigned_to?: string | null;
  assigned_at?: string | null;
  processed_campaign_id?: string | null;
  processed_at?: string | null;
  dismissed_reason?: ProspectDismissReason | null;
  created_at: string;
  updated_at: string;
  // Board-view decoration (present when includeCampaigns=true)
  campaign_stage?: string | null;
  campaign_category?: string | null;
  repair_track?: string | null;
  is_hot_prospect?: boolean | null;
  stage_entered_at?: string | null;
}

export interface LogContactInput {
  contact_channel: ContactChannel;
  contact_date: string;
  outcome: ContactOutcome;
  follow_up_date?: string;
  notes?: string;
  message_snapshot?: string;
  message_subject?: string;
  preview_token?: string;
}

export interface Audit {
  id: string;
  campaign_id: string;
  platform: string;
  review_count: number | null;
  average_rating: number | null;
  unaddressed_reviews: number | null;
  owner_response_rate: number | null;
  photo_count: number | null;
  claimed: boolean | null;
  active_page: boolean | null;
  has_booking: boolean | null;
  has_contact_form: boolean | null;
  mobile_friendly: boolean | null;
  audit_data: any;
  created_at: string;
}

export interface StageHistory {
  id: string;
  campaign_id: string;
  from_stage: CampaignStage | null;
  to_stage: CampaignStage;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
  trigger_type: string;
}

export interface MarketingFile {
  id: string;
  campaign_id: string;
  file_type: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt_type: PromptType;
  scope: CampaignScope;
  category: string | null;
  tone: string | null;
  version: number;
  body: string;
  variables: any;
  output_schema: { name: string; description?: string; schema?: any } | null;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptExecution {
  id: string;
  campaign_id: string;
  template_id: string | null;
  variables_used: any;
  raw_output: string | null;
  filtered_output: string | null;
  pass_rate: number | null;
  flagged_count: number | null;
  status: ExecutionStatus;
  executed_by: string | null;
  executed_at: string;
  ai_provider: string | null;
  ai_model: string | null;
  tokens_used: number | null;
  cost_cents: number | null;
  filter_flags?: FilterFlag[];
  // Sprint 5: persisted sync report (for city_analysis executions)
  sync_report?: SyncReport | null;
  // Template info (joined from prompt template)
  prompt_type?: string;
  output_schema?: { name: string } | null;
}

export interface FilterFlag {
  id: string;
  execution_id: string;
  response_number: number | null;
  failed_checks: any;
  suggested_fix: string | null;
  human_override: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: FilterFlagStatus;
}

export interface Scorecard {
  id: string;
  user_id: string | null;
  date: string;
  category_focus: string | null;
  neighborhood_focus: string | null;
  scope_focus: CampaignScope | null;
  stage_focus: string | null;
  previews_built: number;
  previews_shown: number;
  packages_paid: number;
  packages_delivered: number;
  revenue_collected_cents: number;
  retainers_pitched: number;
  retainers_won: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliverableTemplate {
  id: string;
  name: string;
  deliverable_type: DeliverableType;
  category: string | null;
  layout_spec: any;
  page_size: string | null;
  orientation: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  campaign_id: string;
  execution_id: string | null;
  template_id: string | null;
  deliverable_type: DeliverableType;
  status: DeliverableStatus;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  is_watermarked: boolean;
  branding_applied: boolean;
  sent_at: string | null;
  sent_method: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandingConfig {
  id: string;
  operator_name: string;
  operator_logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  text_color: string | null;
  font_family: string | null;
  footer_disclaimer: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  stageCounts: Record<string, number>;
  byStage?: Record<CampaignStage, number>;
  totalRevenueCents: number;
  marketingRevenueCents?: number;
  marketingRevenueCount?: number;
  totalRetainerRevenueCents: number;
  totalRetainersWon: number;
  conversionRate: number;
  weeklyRevenueCents: number;
  weeklyMarketingRevenueCents?: number;
  weeklyPreviews: number;
  weeklyDelivered: number;
  recentTransitions?: StageHistory[];
  totalConversions?: number;
  resurrectedConversions?: number;
}

export interface ConversionStats {
  totalConversions: number;
  conversionRate: number;
  byLastTouchSource: Record<string, number>;
  byFirstTouchSource: Record<string, number>;
  byOrigin: Record<string, number>;
  resurrectedConversions: number;
  tokensIssued: number;
  tokensViewed: number;
  tokensConverted: number;
  qrViewRate: number;
  qrConversionRate: number;
  demoTokensIssued: number;
  demoClaimRate: number;
  avgDaysToConvert: number;
}

export interface DemoStorefrontResult {
  demoTenantId: string;
  slug: string;
  template: string;
  expiresAt: string;
  previewToken: string;
  previewUrl: string;
  demoUrl: string;
}

export interface MarketingRevenue {
  id: string;
  campaign_id: string;
  order_id: string | null;
  amount_cents: number;
  discount_cents: number;
  gateway_type: string;
  gateway_transaction_id: string | null;
  source: string;
  subscription_tier_id: string | null;
  service_category: string | null;
  recorded_at: string;
}

export interface ServiceCategory {
  value: string;
  label: string;
}

// ====================
// INPUT TYPES
// ====================

export interface CampaignCreateInput {
  scope?: CampaignScope;
  campaign_category?: CampaignCategory;
  repair_track?: RepairTrack | null;
  repair_issue_type?: string;
  business_name?: string;
  category: string;
  city: string;
  neighborhood?: string;
  contact_method?: string;
  contact_info?: string;
  phone?: string;
  email?: string;
  website_url?: string;
  social_profiles?: { platform: string; url: string }[];
  owner_names?: string[];
  phones?: { label: string; number: string }[];
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  directory_profiles?: DirectoryProfileEntry[];
  display_id?: string;
  gbp_claimed?: boolean;
  unaddressed_reviews?: number;
  last_review_date?: string;
  has_website?: string;
  nap_consistent?: boolean;
  estimated_tier?: string;
  estimated_fee_cents?: number;
  pain_score?: number;
  tone?: string;
  retainer?: 'Fast' | 'Medium' | 'Slow';
  attributes?: string[];
  assigned_to?: string;
  notes?: string;
  service_category?: string;
}

export interface CampaignUpdateInput extends Partial<CampaignCreateInput> {
  stage?: CampaignStage;
  retainer_status?: RetainerStatus;
  retainer_amount_cents?: number;
  retainer_start_date?: string;
  amount_paid_cents?: number;
  package_delivered?: string;
  campaign_origin?: CampaignOrigin;
  package_price_cents?: number;
  subscription_tier_id?: string;
  coupon_code?: string;
  service_category?: string;
}

export interface StageTransitionInput {
  to_stage: CampaignStage;
  notes?: string;
  trigger_type?: 'manual' | 'automated' | 'system';
  acknowledge_incomplete?: boolean;
}

export interface ChecklistIncompleteError {
  code: 'checklist_incomplete';
  incompleteSteps: { id: string; title: string; stage_tag?: string | null }[];
  message: string;
}

export interface ContactReadiness {
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasSocial: boolean;
  complete: boolean;
}

export interface EnrichContactResult {
  phone: string | null;
  websiteUrl: string | null;
  source: 'places_api' | 'cache' | 'audit_fallback' | 'no_match' | 'already_populated';
  populated: string[];
}

export interface AuditCreateInput {
  platform: string;
  review_count?: number;
  average_rating?: number;
  unaddressed_reviews?: number;
  owner_response_rate?: number;
  photo_count?: number;
  claimed?: boolean;
  active_page?: boolean;
  has_booking?: boolean;
  has_contact_form?: boolean;
  mobile_friendly?: boolean;
  audit_data?: any;
}

export interface FileCreateInput {
  file_type: string;
  file_name: string;
  storage_path: string;
  file_size?: number;
  mime_type?: string;
}

export interface PromptTemplateCreateInput {
  name: string;
  prompt_type: PromptType;
  scope?: CampaignScope;
  category?: string;
  tone?: string;
  body: string;
  variables?: any;
  output_schema?: { name: string; description?: string; schema?: any } | null;
  is_default?: boolean;
}

export interface ExecutionCreateInput {
  campaign_id: string;
  template_id?: string;
  variables_used?: any;
}

export interface ExternalExecutionCreateInput {
  campaign_id: string;
  template_id: string;
  raw_output: string;
  source?: string;
  cost_cents?: number;
}

export interface ExternalExecutionResult {
  execution: PromptExecution;
  audit: any | null;
}

export interface ExecutionUpdateInput {
  raw_output?: string;
  filtered_output?: string;
  pass_rate?: number;
  flagged_count?: number;
  status?: string;
  ai_provider?: string;
  ai_model?: string;
  tokens_used?: number;
  cost_cents?: number;
}

export interface BatchExecutionInput {
  campaign_ids: string[];
  template_id: string;
  variables?: any;
}

export interface FilterFlagUpdateInput {
  human_override?: string;
  status?: FilterFlagStatus;
}

export interface ScorecardUpsertInput {
  user_id: string;
  date: string;
  category_focus?: string;
  neighborhood_focus?: string;
  scope_focus?: CampaignScope;
  stage_focus?: string;
  previews_built?: number;
  previews_shown?: number;
  packages_paid?: number;
  packages_delivered?: number;
  revenue_collected_cents?: number;
  retainers_pitched?: number;
  retainers_won?: number;
  notes?: string;
}

export interface ScorecardUpdateInput {
  user_id?: string;
  date?: string;
  category_focus?: string;
  neighborhood_focus?: string;
  scope_focus?: CampaignScope;
  stage_focus?: string;
  previews_built?: number;
  previews_shown?: number;
  packages_paid?: number;
  packages_delivered?: number;
  revenue_collected_cents?: number;
  retainers_pitched?: number;
  retainers_won?: number;
  notes?: string;
}

export interface DeliverableTemplateCreateInput {
  name: string;
  deliverable_type: DeliverableType;
  category?: string;
  layout_spec: any;
  page_size?: string;
  orientation?: string;
  is_default?: boolean;
}

export interface DeliverableCreateInput {
  execution_id?: string;
  template_id?: string;
  deliverable_type: DeliverableType;
  status: DeliverableStatus;
  file_name: string;
  storage_path: string;
  file_size?: number;
  mime_type?: string;
  is_watermarked?: boolean;
  branding_applied?: boolean;
  sent_at?: string;
  sent_method?: string;
}

export interface DeliverableUpdateInput extends Partial<DeliverableCreateInput> {}

export interface BrandingCreateInput {
  operator_name: string;
  operator_logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  text_color?: string;
  font_family?: string;
  footer_disclaimer?: string;
  is_active?: boolean;
}

// ====================
// SERVICE
// ====================

const BASE_URL = '/api/admin/marketing-ops';

class MarketingOpsService extends AdminApiSingleton {
  private static instance: MarketingOpsService;

  private constructor() {
    super('MarketingOpsService');
  }

  static getInstance(): MarketingOpsService {
    if (!MarketingOpsService.instance) {
      MarketingOpsService.instance = new MarketingOpsService();
    }
    return MarketingOpsService.instance;
  }

  // ─── Campaigns ──────────────────────────────────────────────

  async listCampaigns(filters?: {
    stage?: CampaignStage;
    scope?: CampaignScope;
    campaignCategory?: CampaignCategory;
    category?: string;
    city?: string;
    assignedTo?: string;
    tone?: string;
    retainer?: 'Fast' | 'Medium' | 'Slow';
    attributes?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Campaign[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.scope) params.set('scope', filters.scope);
    if (filters?.campaignCategory) params.set('campaignCategory', filters.campaignCategory);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters?.tone) params.set('tone', filters.tone);
    if (filters?.retainer) params.set('retainer', filters.retainer);
    if (filters?.attributes && filters.attributes.length > 0) params.set('attributes', filters.attributes.join(','));
    if (filters?.search) params.set('search', filters.search);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    const url = `${BASE_URL}${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-campaigns-list', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch campaigns');
    }
    const data = result.data?.data ?? result.data;
    return data?.items ? data : { items: Array.isArray(data) ? data : [], total: data?.length ?? 0 };
  }

  async getCampaign(id: string): Promise<CampaignDetail> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}`,
      {},
      `mkt-ops-campaign-${id}`,
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch campaign');
    }
    return result.data?.data ?? result.data;
  }

  async createCampaign(input: CampaignCreateInput): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      BASE_URL,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-campaign-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create campaign');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  /**
   * Derive a business-scope child campaign from a discovered competitor.
   * Seeds business_name + estimated_tier from the payload; inherits category,
   * city, neighborhood, tone, attributes from the parent. Child starts at `seek`.
   * Returns the created child campaign.
   */
  async deriveBusinessCampaign(parentId: string, input: {
    business_name: string;
    rating?: number;
    review_count?: number;
    location?: string;
    detected_signals?: string[];
    assigned_to?: string;
  }): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${parentId}/derive-business`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-campaign-derive-${parentId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to derive business campaign');
    }
    // Invalidate the parent campaign cache so lineage (children) updates.
    await this.invalidateCachePattern(`mkt-ops-campaign-${parentId}`);
    await this.invalidateCachePattern('mkt-ops-campaigns-list');
    return result.data?.data ?? result.data;
  }

  async updateCampaign(id: string, input: CampaignUpdateInput): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-campaign-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update campaign');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async deleteCampaign(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}`,
      { method: 'DELETE' },
      `mkt-ops-campaign-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete campaign');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
  }

  async transitionStage(id: string, input: StageTransitionInput): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/transition`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-campaign-transition-${id}`,
      0,
    );
    if (!result.success) {
      // Surface the checklist_incomplete 409 payload so the UI can show the soft-gate dialog.
      const err = result as any;
      if (err?.error === 'checklist_incomplete' && Array.isArray(err?.incomplete_steps)) {
        const checklistErr: ChecklistIncompleteError & { message: string } = {
          code: 'checklist_incomplete',
          incompleteSteps: err.incomplete_steps,
          message: 'Required checklist steps are incomplete',
        };
        throw checklistErr;
      }
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to transition stage');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async switchRepairTrack(id: string, input: {
    to_track: RepairTrack;
    issue_type?: string;
    reason: string;
  }): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/switch-track`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-campaign-switch-track-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to switch repair track');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async enrichContact(id: string, opts: { force?: boolean } = {}): Promise<EnrichContactResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/enrich-contact`,
      { method: 'POST', body: JSON.stringify({ force: opts.force ?? false }) },
      `mkt-ops-campaign-enrich-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to enrich contact from GBP');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async getContactReadiness(id: string): Promise<ContactReadiness> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/contact-readiness`,
      { method: 'GET' },
      `mkt-ops-campaign-readiness-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get contact readiness');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Outreach log (Sprint 2) ────────────────────────────────────────────
  async logContact(campaignId: string, input: LogContactInput): Promise<OutreachLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/outreach`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-campaign-outreach-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to log contact');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async listOutreach(campaignId: string): Promise<OutreachLogEntry[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/outreach`,
      { method: 'GET' },
      `mkt-ops-campaign-outreach-list-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list outreach log');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async getFreshSnapshot(campaignId: string): Promise<FreshSnapshot> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/fresh-snapshot`,
      { method: 'GET' },
      `mkt-ops-campaign-fresh-snapshot-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get fresh snapshot');
    }
    return result.data?.data ?? result.data;
  }

  async editOutreach(logId: string, input: Partial<LogContactInput>): Promise<OutreachLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/outreach/${logId}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-outreach-edit-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to edit outreach log');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async deleteOutreach(logId: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/outreach/${logId}`,
      { method: 'DELETE' },
      `mkt-ops-outreach-delete-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete outreach log');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
  }

  async completeFollowUp(logId: string): Promise<OutreachLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/outreach/${logId}/complete`,
      { method: 'POST' },
      `mkt-ops-outreach-complete-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to complete follow-up');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async getFollowUpsDue(opts: { from?: string; to?: string; assignedTo?: string } = {}): Promise<FollowUpsDueResult> {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.assignedTo) params.set('assigned_to', opts.assignedTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/follow-ups-due${qs}`,
      { method: 'GET' },
      `mkt-ops-follow-ups-due`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get follow-ups due');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Hot-prospect (Sprint 3) ────────────────────────────────────────────
  async setHotProspect(campaignId: string, opts: { isHot: boolean; reason?: string }): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/hot-prospect`,
      { method: 'PUT', body: JSON.stringify({ isHot: opts.isHot, reason: opts.reason }) },
      `mkt-ops-campaign-hot-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to set hot prospect');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async clearDeprioritized(campaignId: string): Promise<{ is_hot_prospect: boolean; hot_prospect_deprioritized: boolean; auto_followup_count: number }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/clear-deprioritized`,
      { method: 'POST' },
      `mkt-ops-campaign-clear-deprio-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to clear deprioritization');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async listHotProspects(filters: { stage?: string; city?: string; state?: string; category?: string } = {}): Promise<HotProspectsResult> {
    const params = new URLSearchParams();
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.city) params.set('city', filters.city);
    if (filters.state) params.set('state', filters.state);
    if (filters.category) params.set('category', filters.category);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/hot-prospects${qs}`,
      { method: 'GET' },
      `mkt-ops-hot-prospects`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list hot prospects');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Business analysis audit sync (Sprint 4) ────────────────────────────
  async syncAuditToCampaign(campaignId: string, auditId: string): Promise<AuditSyncReport> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/audits/${auditId}/sync`,
      { method: 'POST' },
      `mkt-ops-audit-sync-${auditId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to sync audit to campaign');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  // ─── Sprint 5: Scan-to-Campaign Spawning ────────────────────────────────
  async getSyncReport(executionId: string): Promise<SyncReport | null> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/executions/${executionId}/sync-report`,
      { method: 'GET' },
      `mkt-ops-sync-report-${executionId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch sync report');
    }
    return result.data?.data ?? null;
  }

  async deriveFromScan(parentId: string, business: any): Promise<{ campaign: Campaign; created: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${parentId}/derive-from-scan`,
      { method: 'POST', body: JSON.stringify({ business }) },
      `mkt-ops-derive-from-scan-${parentId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to derive campaign from scan');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    await this.invalidateCachePattern('mkt-ops-campaigns-list');
    return {
      campaign: result.data?.data ?? result.data,
      created: result.data?.created ?? true,
    };
  }

  async deriveAllUnmatched(parentId: string, executionId: string): Promise<DeriveAllUnmatchedResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${parentId}/derive-all-unmatched`,
      { method: 'POST', body: JSON.stringify({ executionId }) },
      `mkt-ops-derive-all-unmatched-${parentId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to derive all unmatched');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    await this.invalidateCachePattern('mkt-ops-campaigns-list');
    return result.data?.data ?? result.data;
  }

  async linkTenant(id: string, tenantId: string): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/link-tenant`,
      { method: 'POST', body: JSON.stringify({ tenant_id: tenantId }) },
      `mkt-ops-campaign-link-tenant-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to link tenant');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async generateDemoStorefront(id: string): Promise<DemoStorefrontResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/demo-storefront`,
      {},
      `mkt-ops-campaign-demo-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate demo storefront');
    }
    await this.invalidateCachePattern(`mkt-ops-campaign-${id}`);
    return result.data?.data ?? result.data;
  }

  async getConversionStats(): Promise<ConversionStats> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/conversion-stats`,
      {},
      'mkt-ops-conversion-stats',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch conversion stats');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Dashboard ──────────────────────────────────────────────

  async getDashboard(): Promise<DashboardStats> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/dashboard`,
      {},
      'mkt-ops-dashboard',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch dashboard');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Export ─────────────────────────────────────────────────

  async exportCsv(filters?: {
    stage?: CampaignStage;
    category?: string;
    city?: string;
  }): Promise<string> {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.city) params.set('city', filters.city);
    const query = params.toString();
    const url = `${BASE_URL}/export${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-export', 0);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to export campaigns');
    }
    const data = result.data?.data ?? result.data;
    return typeof data === 'string' ? data : '';
  }

  // ─── Audits ─────────────────────────────────────────────────

  async listAudits(campaignId: string): Promise<Audit[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/audits`,
      {},
      `mkt-ops-audits-${campaignId}`,
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch audits');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async createAudit(campaignId: string, input: AuditCreateInput): Promise<Audit> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/audits`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-audit-create-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create audit');
    }
    await this.invalidateCachePattern(`mkt-ops-audits-${campaignId}`);
    await this.invalidateCachePattern(`mkt-ops-campaign-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  async updateAudit(id: string, input: Partial<AuditCreateInput>): Promise<Audit> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/audits/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-audit-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update audit');
    }
    await this.invalidateCachePattern('mkt-ops-audits');
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data?.data ?? result.data;
  }

  async deleteAudit(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/audits/${id}`,
      { method: 'DELETE' },
      `mkt-ops-audit-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete audit');
    }
    await this.invalidateCachePattern('mkt-ops-audits');
    await this.invalidateCachePattern('mkt-ops-campaign');
  }

  // ─── Files ──────────────────────────────────────────────────

  async listFiles(campaignId: string): Promise<MarketingFile[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/files`,
      {},
      `mkt-ops-files-${campaignId}`,
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch files');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async createFile(campaignId: string, input: FileCreateInput): Promise<MarketingFile> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/files`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-file-create-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create file');
    }
    await this.invalidateCachePattern(`mkt-ops-files-${campaignId}`);
    await this.invalidateCachePattern(`mkt-ops-campaign-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  async deleteFile(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/files/${id}`,
      { method: 'DELETE' },
      `mkt-ops-file-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete file');
    }
    await this.invalidateCachePattern('mkt-ops-files');
    await this.invalidateCachePattern('mkt-ops-campaign');
  }

  // ─── Prompt Templates ───────────────────────────────────────

  async listPromptTemplates(filters?: {
    prompt_type?: PromptType;
    scope?: CampaignScope;
    category?: string;
    tone?: string;
    is_active?: boolean;
  }): Promise<PromptTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.prompt_type) params.set('prompt_type', filters.prompt_type);
    if (filters?.scope) params.set('scope', filters.scope);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.tone) params.set('tone', filters.tone);
    if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
    const query = params.toString();
    const url = `${BASE_URL}/prompts/templates${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-prompt-templates', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch prompt templates');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async createPromptTemplate(input: PromptTemplateCreateInput): Promise<PromptTemplate> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/templates`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-prompt-template-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create prompt template');
    }
    await this.invalidateCachePattern('mkt-ops-prompt-templates');
    return result.data?.data ?? result.data;
  }

  async updatePromptTemplate(id: string, input: Partial<PromptTemplateCreateInput>): Promise<PromptTemplate> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/templates/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-prompt-template-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update prompt template');
    }
    await this.invalidateCachePattern('mkt-ops-prompt-templates');
    return result.data?.data ?? result.data;
  }

  async deletePromptTemplate(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/templates/${id}`,
      { method: 'DELETE' },
      `mkt-ops-prompt-template-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete prompt template');
    }
    await this.invalidateCachePattern('mkt-ops-prompt-templates');
  }

  async clonePromptTemplate(id: string, name?: string): Promise<PromptTemplate> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/templates/${id}/clone`,
      { method: 'POST', body: JSON.stringify({ name }) },
      `mkt-ops-prompt-template-clone-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to clone prompt template');
    }
    await this.invalidateCachePattern('mkt-ops-prompt-templates');
    return result.data?.data ?? result.data;
  }

  async renderPrompt(templateId: string, campaignId: string, variables?: Record<string, string>): Promise<string> {
    const params = new URLSearchParams();
    params.set('campaignId', campaignId);
    if (variables && Object.keys(variables).length > 0) {
      params.set('variables', JSON.stringify(variables));
    }
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/templates/${templateId}/render?${params.toString()}`,
      {},
      `mkt-ops-prompt-render-${templateId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to render prompt');
    }
    const data = result.data?.data ?? result.data;
    return data?.rendered_prompt ?? '';
  }

  // ─── Prompt Executions ──────────────────────────────────────

  async listExecutions(campaignId?: string): Promise<PromptExecution[]> {
    const params = new URLSearchParams();
    if (campaignId) params.set('campaign_id', campaignId);
    const query = params.toString();
    const url = `${BASE_URL}/prompts/executions${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-executions', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch executions');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async getExecution(id: string): Promise<PromptExecution> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/executions/${id}`,
      {},
      `mkt-ops-execution-${id}`,
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch execution');
    }
    return result.data?.data ?? result.data;
  }

  async createExecution(input: ExecutionCreateInput): Promise<PromptExecution> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/executions`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-execution-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create execution');
    }
    await this.invalidateCachePattern('mkt-ops-executions');
    return result.data?.data ?? result.data;
  }

  async createExternalExecution(input: ExternalExecutionCreateInput): Promise<ExternalExecutionResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/executions/external`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-execution-external',
      0,
    );
    if (!result.success) {
      const msg = typeof result.error === 'string'
        ? result.error
        : (result.error?.message ?? 'Failed to import external result');
      throw new Error(msg);
    }
    await this.invalidateCachePattern('mkt-ops-executions');
    await this.invalidateCachePattern(`mkt-ops-audits-${input.campaign_id}`);
    await this.invalidateCachePattern(`mkt-ops-campaign-${input.campaign_id}`);
    return result.data?.data ?? result.data;
  }

  async batchExecution(input: BatchExecutionInput): Promise<{ campaignId: string; success: boolean; error?: string }[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/executions/batch`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-execution-batch',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to batch execute');
    }
    await this.invalidateCachePattern('mkt-ops-executions');
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async updateExecution(id: string, input: ExecutionUpdateInput): Promise<PromptExecution> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/executions/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-execution-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update execution');
    }
    await this.invalidateCachePattern('mkt-ops-executions');
    await this.invalidateCachePattern(`mkt-ops-execution-${id}`);
    return result.data?.data ?? result.data;
  }

  // ─── Filter Flags ───────────────────────────────────────────

  async listFilterFlags(filters?: {
    execution_id?: string;
    status?: FilterFlagStatus;
  }): Promise<FilterFlag[]> {
    const params = new URLSearchParams();
    if (filters?.execution_id) params.set('execution_id', filters.execution_id);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    const url = `${BASE_URL}/prompts/filter-flags${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-filter-flags', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch filter flags');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async updateFilterFlag(id: string, input: FilterFlagUpdateInput): Promise<FilterFlag> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prompts/filter-flags/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-filter-flag-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update filter flag');
    }
    await this.invalidateCachePattern('mkt-ops-filter-flags');
    return result.data?.data ?? result.data;
  }

  // ─── Scorecards ─────────────────────────────────────────────

  async listScorecards(filters?: {
    user_id?: string;
    start_date?: string;
    end_date?: string;
    scope?: CampaignScope;
    stage?: string;
  }): Promise<Scorecard[]> {
    const params = new URLSearchParams();
    if (filters?.user_id) params.set('user_id', filters.user_id);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    if (filters?.scope) params.set('scope', filters.scope);
    if (filters?.stage) params.set('stage', filters.stage);
    const query = params.toString();
    const url = `${BASE_URL}/scorecards${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-scorecards', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch scorecards');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async upsertScorecard(input: ScorecardUpsertInput): Promise<Scorecard> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/scorecards`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-scorecard-upsert',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to save scorecard');
    }
    await this.invalidateCachePattern('mkt-ops-scorecards');
    return result.data?.data ?? result.data;
  }

  async updateScorecard(id: string, input: ScorecardUpdateInput): Promise<Scorecard> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/scorecards/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-scorecard-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update scorecard');
    }
    await this.invalidateCachePattern('mkt-ops-scorecards');
    return result.data?.data ?? result.data;
  }

  async deleteScorecard(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/scorecards/${id}`,
      { method: 'DELETE' },
      `mkt-ops-scorecard-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete scorecard');
    }
    await this.invalidateCachePattern('mkt-ops-scorecards');
  }

  // ─── Deliverable Templates ──────────────────────────────────

  async listDeliverableTemplates(filters?: {
    deliverable_type?: DeliverableType;
    category?: string;
    is_active?: boolean;
  }): Promise<DeliverableTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.deliverable_type) params.set('deliverable_type', filters.deliverable_type);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
    const query = params.toString();
    const url = `${BASE_URL}/deliverable-templates${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-deliverable-templates', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch deliverable templates');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async createDeliverableTemplate(input: DeliverableTemplateCreateInput): Promise<DeliverableTemplate> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable-templates`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-deliverable-template-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create deliverable template');
    }
    await this.invalidateCachePattern('mkt-ops-deliverable-templates');
    return result.data?.data ?? result.data;
  }

  async updateDeliverableTemplate(id: string, input: Partial<DeliverableTemplateCreateInput>): Promise<DeliverableTemplate> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable-templates/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-deliverable-template-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update deliverable template');
    }
    await this.invalidateCachePattern('mkt-ops-deliverable-templates');
    return result.data?.data ?? result.data;
  }

  async deleteDeliverableTemplate(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable-templates/${id}`,
      { method: 'DELETE' },
      `mkt-ops-deliverable-template-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete deliverable template');
    }
    await this.invalidateCachePattern('mkt-ops-deliverable-templates');
  }

  // ─── Deliverables ───────────────────────────────────────────

  async listDeliverables(campaignId: string, filters?: {
    status?: DeliverableStatus;
    deliverable_type?: DeliverableType;
  }): Promise<Deliverable[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.deliverable_type) params.set('deliverable_type', filters.deliverable_type);
    const query = params.toString();
    const url = `${BASE_URL}/${campaignId}/deliverables${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, `mkt-ops-deliverables-${campaignId}`, this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch deliverables');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async createDeliverable(campaignId: string, input: DeliverableCreateInput): Promise<Deliverable> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/deliverables`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-deliverable-create-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create deliverable');
    }
    await this.invalidateCachePattern(`mkt-ops-deliverables-${campaignId}`);
    await this.invalidateCachePattern(`mkt-ops-campaign-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  async updateDeliverable(id: string, input: DeliverableUpdateInput): Promise<Deliverable> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverables/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-deliverable-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update deliverable');
    }
    await this.invalidateCachePattern('mkt-ops-deliverables');
    return result.data?.data ?? result.data;
  }

  async deleteDeliverable(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverables/${id}`,
      { method: 'DELETE' },
      `mkt-ops-deliverable-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete deliverable');
    }
    await this.invalidateCachePattern('mkt-ops-deliverables');
  }

  async generateDeliverable(campaignId: string, input: {
    templateId?: string;
    executionId?: string;
    deliverableType: DeliverableType;
    isPreview: boolean;
    content?: string;
  }): Promise<Deliverable> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/deliverables/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          template_id: input.templateId,
          execution_id: input.executionId,
          deliverable_type: input.deliverableType,
          is_preview: input.isPreview,
          content: input.content,
        }),
      },
      `mkt-ops-deliverable-generate-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate deliverable');
    }
    await this.invalidateCachePattern(`mkt-ops-deliverables-${campaignId}`);
    await this.invalidateCachePattern(`mkt-ops-campaign-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  getDeliverableDownloadUrl(deliverableId: string): string {
    return `${BASE_URL}/deliverables/${deliverableId}/download`;
  }

  async sendDeliverable(deliverableId: string, sentMethod: string): Promise<Deliverable> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverables/${deliverableId}/send`,
      { method: 'POST', body: JSON.stringify({ sent_method: sentMethod }) },
      `mkt-ops-deliverable-send-${deliverableId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to mark deliverable as sent');
    }
    await this.invalidateCachePattern('mkt-ops-deliverables');
    return result.data?.data ?? result.data;
  }

  // ─── Branding ───────────────────────────────────────────────

  async listBrandingConfigs(): Promise<BrandingConfig[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/branding`,
      {},
      'mkt-ops-branding',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch branding configs');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async getActiveBrandingConfig(): Promise<BrandingConfig | null> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/branding/active`,
      {},
      'mkt-ops-branding-active',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch active branding config');
    }
    return result.data?.data ?? null;
  }

  async createBrandingConfig(input: BrandingCreateInput): Promise<BrandingConfig> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/branding`,
      { method: 'POST', body: JSON.stringify(input) },
      'mkt-ops-branding-create',
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create branding config');
    }
    await this.invalidateCachePattern('mkt-ops-branding');
    return result.data?.data ?? result.data;
  }

  async updateBrandingConfig(id: string, input: Partial<BrandingCreateInput>): Promise<BrandingConfig> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/branding/${id}`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-branding-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update branding config');
    }
    await this.invalidateCachePattern('mkt-ops-branding');
    return result.data?.data ?? result.data;
  }

  async deleteBrandingConfig(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/branding/${id}`,
      { method: 'DELETE' },
      `mkt-ops-branding-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete branding config');
    }
    await this.invalidateCachePattern('mkt-ops-branding');
  }

  // ====================
  // PRICING & REVENUE (Payment Collection Sprint)
  // ====================

  async updatePricing(id: string, input: {
    packagePriceCents?: number;
    subscriptionTierId?: string;
    couponCode?: string;
    serviceCategory?: string;
  }): Promise<Campaign> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/pricing`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-campaign-pricing-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update pricing');
    }
    await this.invalidateCachePattern(`mkt-ops-campaign-${id}`);
    return result.data?.data ?? result.data;
  }

  async getCampaignRevenue(id: string): Promise<MarketingRevenue[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${id}/revenue`,
      {},
      `mkt-ops-campaign-revenue-${id}`,
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch revenue');
    }
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  async getServiceCategories(): Promise<ServiceCategory[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/pricing/service-categories`,
      {},
      'mkt-ops-service-categories',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch service categories');
    }
    return result.data?.data ?? [];
  }

  /**
   * Fetch the canonical list of tone values from the category-tone presets
   * table. These are always available in every Tone dropdown (campaign form,
   * campaign list filter, prompt library filter, prompt modal) — even when
   * no existing record uses them yet.
   *
   * Returns the distinct, sorted list of `tone` strings.
   */
  async listTonePresets(): Promise<string[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/category-tone-presets`,
      {},
      'mkt-ops-category-tone-presets',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch tone presets');
    }
    const rows: any[] = result.data?.data ?? [];
    const set = new Set<string>();
    for (const r of rows) {
      const t = typeof r === 'string' ? r : r?.tone;
      if (t && typeof t === 'string') set.add(t.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  async createServiceCategory(value: string, label: string): Promise<ServiceCategory> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/pricing/service-categories`,
      {
        method: 'POST',
        body: JSON.stringify({ value, label }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create service category');
    }
    return result.data?.data;
  }

  // ====================
  // PUBLIC PAYMENT (no auth — ptoken gated)
  // Moved to MarketingPayPublicService (extends PublicApiSingleton) —
  // raw fetch is forbidden per deploy-service-extending-base-singleton.
  // ====================

  // ─── Review Response Pipeline (Sprint 4) ─────────────────────────────────
  async listReviewPipelines(campaignId: string): Promise<ReviewResponsePipeline[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${encodeURIComponent(campaignId)}/review-response/pipelines`,
      { method: 'GET' },
      `mkt-ops-review-pipelines-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list review pipelines');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async getReviewPipeline(pipelineId: string): Promise<ReviewResponsePipeline> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}`,
      { method: 'GET' },
      `mkt-ops-review-pipeline-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get review pipeline');
    }
    return result.data?.data ?? result.data;
  }

  async createReviewPipeline(input: { campaignId: string; platform: string }): Promise<ReviewResponsePipeline> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${encodeURIComponent(input.campaignId)}/review-response/pipelines`,
      { method: 'POST', body: JSON.stringify({ platform: input.platform }) },
      `mkt-ops-review-pipeline-create-${input.campaignId}-${input.platform}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create review pipeline');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async updateReviewMetrics(pipelineId: string, input: Partial<ReviewResponsePipeline>): Promise<ReviewResponsePipeline> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}/metrics`,
      { method: 'PUT', body: JSON.stringify(input) },
      `mkt-ops-review-pipeline-metrics-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update review metrics');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async checkReviewGate(pipelineId: string): Promise<ReviewGateResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}/gate`,
      { method: 'GET' },
      `mkt-ops-review-gate-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to check review gate');
    }
    return result.data?.data ?? result.data;
  }

  async advanceReviewStage(pipelineId: string, force = false): Promise<ReviewResponsePipeline> {
    const forceQuery = force ? '?force=true' : '';
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}/advance${forceQuery}`,
      { method: 'POST' },
      `mkt-ops-review-advance-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to advance review stage');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async logReviewResponse(pipelineId: string, input: LogReviewResponseInput): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}/log`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-review-log-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to log review response');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async listReviewLog(pipelineId: string): Promise<ReviewResponseLogEntry[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}/log`,
      { method: 'GET' },
      `mkt-ops-review-log-list-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list review log');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async markCustomerReply(logId: string): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/log/${logId}/customer-reply`,
      { method: 'POST' },
      `mkt-ops-review-reply-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to mark customer reply');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async closeReviewThread(logId: string): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/log/${logId}/close`,
      { method: 'POST' },
      `mkt-ops-review-close-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to close review thread');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async scheduleReviewFollowUp(pipelineId: string, input: { scheduledFor: string; notes?: string }): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/pipelines/${pipelineId}/schedule-follow-up`,
      { method: 'POST', body: JSON.stringify({ scheduled_for: input.scheduledFor, notes: input.notes }) },
      `mkt-ops-review-schedule-${pipelineId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to schedule review follow-up');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async updateScheduledFollowUp(logId: string, input: { scheduledFor?: string; notes?: string }): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/log/${logId}`,
      { method: 'PUT', body: JSON.stringify({ scheduled_for: input.scheduledFor, notes: input.notes }) },
      `mkt-ops-review-update-fu-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update scheduled follow-up');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async completeScheduledFollowUp(logId: string, responseText?: string, outcome?: FollowUpOutcome): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/log/${logId}/complete`,
      { method: 'POST', body: JSON.stringify({ response_text: responseText, outcome }) },
      `mkt-ops-review-complete-fu-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to complete scheduled follow-up');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async skipScheduledFollowUp(logId: string, reason?: string, outcome?: FollowUpOutcome): Promise<ReviewResponseLogEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/log/${logId}/skip`,
      { method: 'POST', body: JSON.stringify({ reason, outcome }) },
      `mkt-ops-review-skip-fu-${logId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to skip scheduled follow-up');
    }
    await this.invalidateCachePattern('mkt-ops-review-pipeline');
    return result.data?.data ?? result.data;
  }

  async getReviewFollowUpsDue(): Promise<ReviewFollowUpsDueResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/review-response/follow-ups-due`,
      { method: 'GET' },
      `mkt-ops-review-follow-ups-due`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get review follow-ups due');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Outreach Openers ──────────────────────────────────────────────────
  async resolveOpener(
    campaignId: string,
    closeVariant?: CloseVariant,
    operatorName?: string,
  ): Promise<OpenerResolution> {
    const params = new URLSearchParams();
    params.set('campaignId', campaignId);
    if (closeVariant) params.set('close_variant', closeVariant);
    if (operatorName && operatorName.trim()) params.set('operator_name', operatorName.trim());
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/resolve?${params.toString()}`,
      { method: 'GET' },
      `mkt-ops-opener-resolve-${campaignId}-${closeVariant ?? 'default'}-${operatorName ?? ''}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to resolve opener');
    }
    return result.data?.data ?? result.data;
  }

  async executeOpener(
    campaignId: string,
    closeVariant?: CloseVariant,
    operatorName?: string,
  ): Promise<OpenerResult> {
    const body: Record<string, any> = { campaign_id: campaignId };
    if (closeVariant) body.close_variant = closeVariant;
    if (operatorName && operatorName.trim()) body.operator_name = operatorName.trim();
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/execute`,
      { method: 'POST', body: JSON.stringify(body) },
      `mkt-ops-opener-execute-${campaignId}-${closeVariant ?? 'default'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to execute opener');
    }
    return result.data?.data ?? result.data;
  }

  async importOpener(
    campaignId: string,
    openerText: string,
    closeVariant?: CloseVariant,
    operatorName?: string,
  ): Promise<OpenerResult> {
    const body: Record<string, any> = { campaign_id: campaignId, opener_text: openerText };
    if (closeVariant) body.close_variant = closeVariant;
    if (operatorName && operatorName.trim()) body.operator_name = operatorName.trim();
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/import`,
      { method: 'POST', body: JSON.stringify(body) },
      `mkt-ops-opener-import-${campaignId}-${closeVariant ?? 'default'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to import opener');
    }
    return result.data?.data ?? result.data;
  }

  async listOpeners(campaignId?: string): Promise<OutreachOpener[]> {
    const url = campaignId
      ? `${BASE_URL}/openers?campaignId=${encodeURIComponent(campaignId)}`
      : `${BASE_URL}/openers`;
    const result = await this.makeDefaultRequest<any>(
      url,
      { method: 'GET' },
      `mkt-ops-openers-${campaignId ?? 'all'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list openers');
    }
    return result.data?.data ?? result.data ?? [];
  }

  // ─── Split-Test Analytics ──────────────────────────────────────────────
  async getSplitTestStats(): Promise<SplitTestStats> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/split-tests`,
      { method: 'GET' },
      `mkt-ops-split-tests`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to load split-test stats');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Outreach Follow-Ups ───────────────────────────────────────────────
  async resolveFollowUp(
    campaignId: string,
    closeVariant?: CloseVariant,
    operatorName?: string,
  ): Promise<FollowUpResolution> {
    const params = new URLSearchParams();
    params.set('campaignId', campaignId);
    if (closeVariant) params.set('close_variant', closeVariant);
    if (operatorName && operatorName.trim()) params.set('operator_name', operatorName.trim());
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/follow-ups/resolve?${params.toString()}`,
      { method: 'GET' },
      `mkt-ops-followup-resolve-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to resolve follow-up');
    }
    return result.data?.data ?? result.data;
  }

  async executeFollowUp(
    campaignId: string,
    closeVariant?: CloseVariant,
    operatorName?: string,
  ): Promise<FollowUpResult> {
    const body: Record<string, any> = { campaign_id: campaignId };
    if (closeVariant) body.close_variant = closeVariant;
    if (operatorName && operatorName.trim()) body.operator_name = operatorName.trim();
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/follow-ups/execute`,
      { method: 'POST', body: JSON.stringify(body) },
      `mkt-ops-followup-execute-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to execute follow-up');
    }
    return result.data?.data ?? result.data;
  }

  async importFollowUp(
    campaignId: string,
    followUpText: string,
    closeVariant?: CloseVariant,
    followUpType?: FollowUpType,
    operatorName?: string,
  ): Promise<FollowUpResult> {
    const body: Record<string, any> = { campaign_id: campaignId, followup_text: followUpText };
    if (closeVariant) body.close_variant = closeVariant;
    if (followUpType) body.followup_type = followUpType;
    if (operatorName && operatorName.trim()) body.operator_name = operatorName.trim();
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/follow-ups/import`,
      { method: 'POST', body: JSON.stringify(body) },
      `mkt-ops-followup-import-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to import follow-up');
    }
    return result.data?.data ?? result.data;
  }

  async listFollowUps(campaignId?: string): Promise<OutreachFollowUp[]> {
    const url = campaignId
      ? `${BASE_URL}/follow-ups?campaignId=${encodeURIComponent(campaignId)}`
      : `${BASE_URL}/follow-ups`;
    const result = await this.makeDefaultRequest<any>(
      url,
      { method: 'GET' },
      `mkt-ops-followups-${campaignId ?? 'all'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list follow-ups');
    }
    return result.data?.data ?? result.data ?? [];
  }

  // ─── Outreach Pitch — Headers ──────────────────────────────────────────
  async resolveHeader(campaignId: string): Promise<HeaderResolution> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/headers/resolve?campaignId=${encodeURIComponent(campaignId)}`,
      { method: 'GET' },
      `mkt-ops-header-resolve-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to resolve header');
    }
    return result.data?.data ?? result.data;
  }

  async executeHeader(campaignId: string): Promise<HeaderResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/headers/execute`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId }) },
      `mkt-ops-header-execute-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to execute header');
    }
    return result.data?.data ?? result.data;
  }

  async importHeader(campaignId: string, headerText: string): Promise<HeaderResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/headers/import`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId, header_text: headerText }) },
      `mkt-ops-header-import-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to import header');
    }
    return result.data?.data ?? result.data;
  }

  async listHeaders(campaignId?: string): Promise<OutreachHeader[]> {
    const url = campaignId
      ? `${BASE_URL}/openers/headers?campaignId=${encodeURIComponent(campaignId)}`
      : `${BASE_URL}/openers/headers`;
    const result = await this.makeDefaultRequest<any>(
      url,
      { method: 'GET' },
      `mkt-ops-headers-${campaignId ?? 'all'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list headers');
    }
    return result.data?.data ?? result.data ?? [];
  }

  // ─── Outreach Pitch — Closers ──────────────────────────────────────────
  async resolveCloser(campaignId: string): Promise<CloserResolution> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/closers/resolve?campaignId=${encodeURIComponent(campaignId)}`,
      { method: 'GET' },
      `mkt-ops-closer-resolve-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to resolve closer');
    }
    return result.data?.data ?? result.data;
  }

  async executeCloser(campaignId: string): Promise<CloserResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/closers/execute`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId }) },
      `mkt-ops-closer-execute-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to execute closer');
    }
    return result.data?.data ?? result.data;
  }

  async importCloser(campaignId: string, closerText: string): Promise<CloserResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/closers/import`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId, closer_text: closerText }) },
      `mkt-ops-closer-import-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to import closer');
    }
    return result.data?.data ?? result.data;
  }

  async listClosers(campaignId?: string): Promise<OutreachCloser[]> {
    const url = campaignId
      ? `${BASE_URL}/openers/closers?campaignId=${encodeURIComponent(campaignId)}`
      : `${BASE_URL}/openers/closers`;
    const result = await this.makeDefaultRequest<any>(
      url,
      { method: 'GET' },
      `mkt-ops-closers-${campaignId ?? 'all'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list closers');
    }
    return result.data?.data ?? result.data ?? [];
  }

  // ─── Outreach Pitch — Contacts (optional footer, no AI) ────────────────
  async listContacts(campaignId?: string): Promise<OutreachContact[]> {
    const url = campaignId
      ? `${BASE_URL}/openers/contacts?campaignId=${encodeURIComponent(campaignId)}`
      : `${BASE_URL}/openers/contacts`;
    const result = await this.makeDefaultRequest<any>(
      url,
      { method: 'GET' },
      `mkt-ops-contacts-${campaignId ?? 'all'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list contacts');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async createContact(
    campaignId: string,
    contactText: string,
    label?: string,
  ): Promise<OutreachContact> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/contacts`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId, contact_text: contactText, label }) },
      `mkt-ops-contact-create-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create contact');
    }
    return result.data?.data ?? result.data;
  }

  async updateContact(
    id: string,
    input: { contactText?: string; label?: string },
  ): Promise<OutreachContact> {
    const body: any = {};
    if (input.contactText !== undefined) body.contact_text = input.contactText;
    if (input.label !== undefined) body.label = input.label;
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/contacts/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      `mkt-ops-contact-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update contact');
    }
    return result.data?.data ?? result.data;
  }

  async deleteContact(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/contacts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      `mkt-ops-contact-delete-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete contact');
    }
  }

  // ─── Outreach Pitch — Review Response Drafts (no persistence) ──────────
  async generateReviewResponse(
    campaignId: string,
    reviewText: string,
  ): Promise<ReviewResponseDraft> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/review-responses/generate`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId, review_text: reviewText }) },
      `mkt-ops-review-response-generate-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate review response');
    }
    return result.data?.data ?? result.data;
  }

  async importReviewResponse(
    campaignId: string,
    reviewText: string,
    responseText: string,
  ): Promise<ReviewResponseDraft> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/review-responses/import`,
      { method: 'POST', body: JSON.stringify({ campaign_id: campaignId, review_text: reviewText, response_text: responseText }) },
      `mkt-ops-review-response-import-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to import review response');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Outreach Pitch — Preview-Slot Drafts (archetype-aware) ────────────
  // Generalizes generateReviewResponse to archetype-aware preview slots.
  // The frontend calls this when the campaign archetype is anything other
  // than A1/A2/A5 (review-response). Returns the same ReviewResponseDraft
  // shape so the slot wiring in PitchConstructionPanel is unchanged.
  async generatePreviewSlot(
    campaignId: string,
    evidenceText: string,
    archetype: string,
    slotLabel?: string,
  ): Promise<ReviewResponseDraft> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/preview-slots/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: campaignId,
          evidence_text: evidenceText,
          archetype,
          slot_label: slotLabel,
        }),
      },
      `mkt-ops-preview-slot-generate-${campaignId}-${archetype}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate preview-slot fix');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Outreach Pitch — Assembly ─────────────────────────────────────────
  async assemblePitch(input: AssemblePitchInput): Promise<PitchResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/pitches`,
      {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: input.campaignId,
          opener_id: input.openerId,
          header_id: input.headerId ?? null,
          closer_id: input.closerId ?? null,
          contact_id: input.contactId ?? null,
          review_pairs: input.reviewPairs,
        }),
      },
      `mkt-ops-pitch-assemble-${input.campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to assemble pitch');
    }
    return result.data?.data ?? result.data;
  }

  async listPitches(campaignId?: string): Promise<OutreachPitch[]> {
    const url = campaignId
      ? `${BASE_URL}/openers/pitches?campaignId=${encodeURIComponent(campaignId)}`
      : `${BASE_URL}/openers/pitches`;
    const result = await this.makeDefaultRequest<any>(
      url,
      { method: 'GET' },
      `mkt-ops-pitches-${campaignId ?? 'all'}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list pitches');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async getPitch(id: string): Promise<OutreachPitch> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/openers/pitches/${encodeURIComponent(id)}`,
      { method: 'GET' },
      `mkt-ops-pitch-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get pitch');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Deliverable Construction ──────────────────────────────────────────

  // Owner Voice
  async getOwnerVoiceProfile(campaignId: string): Promise<OwnerVoiceProfile | null> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/voice/${campaignId}`,
      { method: 'GET' },
      `mkt-ops-voice-${campaignId}`,
      0,
    );
    if (!result.success) return null;
    return result.data?.data ?? result.data ?? null;
  }

  async inferOwnerVoice(campaignId: string): Promise<VoiceInferenceResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/voice/${campaignId}/infer`,
      { method: 'POST' },
      `mkt-ops-voice-infer-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to infer owner voice');
    }
    await this.invalidateCachePattern('mkt-ops-voice');
    return result.data?.data ?? result.data;
  }

  async upsertOwnerVoice(campaignId: string, input: OwnerVoiceInput): Promise<OwnerVoiceProfile> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/voice/${campaignId}`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-voice-upsert-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to save owner voice profile');
    }
    await this.invalidateCachePattern('mkt-ops-voice');
    return result.data?.data ?? result.data;
  }

  // Review Slots
  async listReviewSlots(campaignId: string): Promise<ReviewSlot[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/slots`,
      { method: 'GET' },
      `mkt-ops-slots-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list review slots');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async ingestReviews(campaignId: string): Promise<{ ingested: number; slots: ReviewSlot[] }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/slots/ingest`,
      { method: 'POST' },
      `mkt-ops-slots-ingest-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to ingest reviews');
    }
    await this.invalidateCachePattern('mkt-ops-slots');
    return result.data?.data ?? result.data;
  }

  async generateAllResponses(campaignId: string): Promise<{ generated: number; errors: string[] }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/slots/generate`,
      { method: 'POST' },
      `mkt-ops-slots-generate-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate responses');
    }
    await this.invalidateCachePattern('mkt-ops-slots');
    return result.data?.data ?? result.data;
  }

  async regenerateSlot(slotId: string): Promise<ReviewSlot> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/slots/${slotId}/regenerate`,
      { method: 'POST' },
      `mkt-ops-slot-regen-${slotId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to regenerate slot');
    }
    await this.invalidateCachePattern('mkt-ops-slots');
    return result.data?.data ?? result.data;
  }

  async updateSlotResponse(slotId: string, responseText: string): Promise<ReviewSlot> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/slots/${slotId}`,
      { method: 'PUT', body: JSON.stringify({ response_text: responseText }) },
      `mkt-ops-slot-edit-${slotId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update slot');
    }
    await this.invalidateCachePattern('mkt-ops-slots');
    return result.data?.data ?? result.data;
  }

  async approveSlot(slotId: string): Promise<ReviewSlot> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/slots/${slotId}/approve`,
      { method: 'POST' },
      `mkt-ops-slot-approve-${slotId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to approve slot');
    }
    await this.invalidateCachePattern('mkt-ops-slots');
    return result.data?.data ?? result.data;
  }

  async skipSlot(slotId: string): Promise<ReviewSlot> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/slots/${slotId}/skip`,
      { method: 'POST' },
      `mkt-ops-slot-skip-${slotId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to skip slot');
    }
    await this.invalidateCachePattern('mkt-ops-slots');
    return result.data?.data ?? result.data;
  }

  // Deliverable Sections
  async listDeliverableSections(campaignId: string): Promise<DeliverableSection[]> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/sections`,
      { method: 'GET' },
      `mkt-ops-sections-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list sections');
    }
    return result.data?.data ?? result.data ?? [];
  }

  async generateAllSections(campaignId: string): Promise<{ generated: string[]; errors: string[] }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/sections/generate`,
      { method: 'POST' },
      `mkt-ops-sections-gen-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate sections');
    }
    await this.invalidateCachePattern('mkt-ops-sections');
    return result.data?.data ?? result.data;
  }

  async updateSection(sectionId: string, content: string): Promise<DeliverableSection> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/sections/${sectionId}`,
      { method: 'PUT', body: JSON.stringify({ content }) },
      `mkt-ops-section-edit-${sectionId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update section');
    }
    await this.invalidateCachePattern('mkt-ops-sections');
    return result.data?.data ?? result.data;
  }

  async approveSection(sectionId: string): Promise<DeliverableSection> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/sections/${sectionId}/approve`,
      { method: 'POST' },
      `mkt-ops-section-approve-${sectionId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to approve section');
    }
    await this.invalidateCachePattern('mkt-ops-sections');
    return result.data?.data ?? result.data;
  }

  async skipSection(sectionId: string): Promise<DeliverableSection> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/sections/${sectionId}/skip`,
      { method: 'POST' },
      `mkt-ops-section-skip-${sectionId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to skip section');
    }
    await this.invalidateCachePattern('mkt-ops-sections');
    return result.data?.data ?? result.data;
  }

  // Render
  async getRenderStatus(campaignId: string): Promise<AssemblyStatus> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/render/status`,
      { method: 'GET' },
      `mkt-ops-render-status-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to get render status');
    }
    return result.data?.data ?? result.data;
  }

  async renderDeliverable(campaignId: string): Promise<RenderResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/deliverable/${campaignId}/render`,
      { method: 'POST' },
      `mkt-ops-render-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to render deliverable');
    }
    await this.invalidateCachePattern('mkt-ops-render');
    return result.data?.data ?? result.data;
  }

  // ─── Cascade methods ───────────────────────────────────────────

  async enableCascade(campaignId: string, config?: any): Promise<any> {
    const res = await fetch(`${BASE_URL}/${campaignId}/cascade/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cascade_config: config }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to enable cascade (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async disableCascade(campaignId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/${campaignId}/cascade/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to disable cascade (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async getCascadeStatus(campaignId: string): Promise<CascadeStatus> {
    const res = await fetch(`${BASE_URL}/${campaignId}/cascade/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to get cascade status (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  // ─── Signal registry + triage methods (Sprint 3.5) ──────────────────

  async listSignals(): Promise<SignalRegistryEntry[]> {
    const res = await fetch(`${BASE_URL}/signals`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to list signals (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async getTriage(campaignId: string): Promise<TriageResult | null> {
    const res = await fetch(`${BASE_URL}/${campaignId}/triage`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to get triage (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async evaluateTriage(
    campaignId: string,
    input: {
      bbb?: { bbb_grade?: string; unanswered_bbb_complaints?: number };
      operator_added_signals?: string[];
      operator_removed_signals?: string[];
    },
  ): Promise<TriageResult> {
    const res = await fetch(`${BASE_URL}/${campaignId}/triage/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to evaluate triage (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async acceptTriage(campaignId: string): Promise<TriageResult> {
    const res = await fetch(`${BASE_URL}/${campaignId}/triage/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to accept triage (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async overrideTriage(campaignId: string, playbookCode: string, reason?: string): Promise<TriageResult> {
    const res = await fetch(`${BASE_URL}/${campaignId}/triage/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ playbook_code: playbookCode, reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to override triage (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  // ─── Playbook catalog CRUD (Sprint 4) ────────────────────────────────

  async listPlaybooks(filters?: { category?: string; isActive?: boolean }): Promise<PlaybookCatalogEntry[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.isActive !== undefined) params.set('is_active', String(filters.isActive));
    const qs = params.toString();
    const res = await fetch(`${BASE_URL}/playbooks${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to list playbooks (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  async createPlaybook(input: PlaybookCreateInput): Promise<PlaybookCatalogEntry> {
    const res = await fetch(`${BASE_URL}/playbooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to create playbook (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async updatePlaybook(id: string, input: Partial<PlaybookCreateInput>): Promise<PlaybookCatalogEntry> {
    const res = await fetch(`${BASE_URL}/playbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to update playbook (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async deletePlaybook(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/playbooks/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to delete playbook (${res.status})`);
  }

  async reorderPlaybooks(rankings: { id: string; priority_rank: number }[]): Promise<PlaybookCatalogEntry[]> {
    const res = await fetch(`${BASE_URL}/playbooks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rankings }),
    });
    if (!res.ok) throw new Error(`Failed to reorder playbooks (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  // ─── Signal registry CRUD (Sprint 4) ─────────────────────────────────

  async createSignal(input: {
    code: string;
    family: string;
    label: string;
    description?: string;
    detection_source?: string;
    is_active?: boolean;
  }): Promise<SignalRegistryEntry> {
    const res = await fetch(`${BASE_URL}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to create signal (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async updateSignal(id: string, input: Partial<{
    family: string;
    label: string;
    description: string | null;
    detection_source: string;
    is_active: boolean;
  }>): Promise<SignalRegistryEntry> {
    const res = await fetch(`${BASE_URL}/signals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to update signal (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async deleteSignal(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/signals/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to delete signal (${res.status})`);
  }

  // ─── Playbook checklist CRUD (Operator Checklist Sprint) ──────────────

  async listChecklistSteps(playbookId: string, includeInactive = false): Promise<PlaybookChecklistStep[]> {
    const qs = includeInactive ? '?include_inactive=true' : '';
    const res = await fetch(`${BASE_URL}/playbooks/${playbookId}/checklist${qs}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to list checklist steps (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  async createChecklistStep(playbookId: string, input: ChecklistStepInput): Promise<PlaybookChecklistStep> {
    const res = await fetch(`${BASE_URL}/playbooks/${playbookId}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: input.title,
        instructions: input.instructions,
        step_type: input.stepType,
        action_config: input.actionConfig,
        is_required: input.isRequired,
        is_active: input.isActive,
        stage_tag: input.stageTag,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to create checklist step (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async updateChecklistStep(id: string, input: Partial<ChecklistStepInput> & { stepOrder?: number }): Promise<PlaybookChecklistStep> {
    const res = await fetch(`${BASE_URL}/checklist-steps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: input.title,
        instructions: input.instructions,
        step_type: input.stepType,
        action_config: input.actionConfig,
        is_required: input.isRequired,
        is_active: input.isActive,
        step_order: input.stepOrder,
        stage_tag: input.stageTag,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Failed to update checklist step (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async deleteChecklistStep(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/checklist-steps/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || `Failed to delete checklist step (${res.status})`);
    }
  }

  async reorderChecklistSteps(playbookId: string, rankings: { id: string; step_order: number }[]): Promise<PlaybookChecklistStep[]> {
    const res = await fetch(`${BASE_URL}/playbooks/${playbookId}/checklist/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rankings }),
    });
    if (!res.ok) throw new Error(`Failed to reorder checklist steps (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  // ─── Campaign checklist (resolved view + progress toggle) ────────────

  async getCampaignChecklist(campaignId: string): Promise<CampaignChecklistView> {
    const res = await fetch(`${BASE_URL}/${campaignId}/checklist`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get campaign checklist (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  async setChecklistStepProgress(campaignId: string, stepId: string, input: { completed: boolean; note?: string | null }): Promise<CampaignChecklistView> {
    const res = await fetch(`${BASE_URL}/${campaignId}/checklist/${stepId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || `Failed to toggle checklist step (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  // ─── Checklist suggestions (operator feedback loop) ───────────────────

  async submitChecklistSuggestion(campaignId: string, input: ChecklistSuggestionInput): Promise<PlaybookChecklistSuggestion> {
    const res = await fetch(`${BASE_URL}/${campaignId}/checklist/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        step_id: input.stepId,
        suggestion_kind: input.suggestionKind,
        position: input.position,
        proposed_step: input.proposedStep,
        rationale: input.rationale,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || `Failed to submit suggestion (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async listCampaignChecklistSuggestions(campaignId: string): Promise<PlaybookChecklistSuggestion[]> {
    const res = await fetch(`${BASE_URL}/${campaignId}/checklist/suggestions`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to list campaign suggestions (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  async listPlaybookChecklistSuggestions(playbookId: string, status?: 'pending' | 'accepted' | 'rejected'): Promise<PlaybookChecklistSuggestion[]> {
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`${BASE_URL}/playbooks/${playbookId}/checklist/suggestions${qs}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to list playbook suggestions (${res.status})`);
    const json = await res.json();
    return json.data;
  }

  async acceptChecklistSuggestion(id: string, amendedStep?: Record<string, any>): Promise<PlaybookChecklistSuggestion> {
    const res = await fetch(`${BASE_URL}/checklist-suggestions/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ proposed_step: amendedStep }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || `Failed to accept suggestion (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  async rejectChecklistSuggestion(id: string, reviewNote?: string): Promise<PlaybookChecklistSuggestion> {
    const res = await fetch(`${BASE_URL}/checklist-suggestions/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ review_note: reviewNote }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || `Failed to reject suggestion (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  }

  // ─── Prospect Queue (Add to Queue sprint) ──────────────────────────────
  // Capture businesses from audit surfaces for later campaign creation
  // without navigating away. Mirrors the backend service's lifecycle:
  // queued → campaign_created / dismissed.

  async addToQueue(input: AddToQueueInput): Promise<AddToQueueResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prospect-queue`,
      { method: 'POST', body: JSON.stringify(input) },
      `mkt-ops-prospect-queue-add`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to add to queue');
    }
    await this.invalidateCachePattern('mkt-ops-prospect-queue');
    const data = result.data?.data ?? result.data;
    const created = result.data?.created ?? true;
    // campaign_exists is returned as 200 with a kind discriminator (the
    // backend avoids 409 so the client can read the campaignId link).
    if (data?.kind === 'campaign_exists') {
      return { kind: 'campaign_exists', campaignId: data.campaignId };
    }
    return {
      kind: created ? 'created' : 'already_queued',
      entry: data,
      created,
    };
  }

  async listProspectQueue(filters?: ProspectQueueListFilters): Promise<{ entries: ProspectQueueEntry[]; queuedCount: number }> {
    const params = new URLSearchParams();
    if (filters?.status) {
      const s = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      params.set('status', s);
    }
    if (filters?.category) params.set('category', filters.category);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.source_kind) params.set('source_kind', filters.source_kind);
    if (filters?.assigned_to) params.set('assigned_to', filters.assigned_to);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.includeCampaigns) params.set('include', 'campaigns');
    const query = params.toString();
    const url = `${BASE_URL}/prospect-queue${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-prospect-queue', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to list prospect queue');
    }
    const data = result.data?.data ?? result.data;
    return {
      entries: Array.isArray(data) ? data : [],
      queuedCount: result.data?.queuedCount ?? 0,
    };
  }

  async updateProspectQueue(id: string, patch: ProspectQueuePatch): Promise<ProspectQueueEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prospect-queue/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      `mkt-ops-prospect-queue-update-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update queue entry');
    }
    await this.invalidateCachePattern('mkt-ops-prospect-queue');
    return result.data?.data ?? result.data;
  }

  async createCampaignFromQueue(id: string): Promise<{ campaign: Campaign; created: boolean; queueEntry: ProspectQueueEntry }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prospect-queue/${id}/create-campaign`,
      { method: 'POST', body: JSON.stringify({}) },
      `mkt-ops-prospect-queue-create-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create campaign from queue');
    }
    // Invalidate both the queue and the campaign list — the new campaign
    // appears in the list, and the queue entry graduates to campaign_created.
    await this.invalidateCachePattern('mkt-ops-prospect-queue');
    await this.invalidateCachePattern('mkt-ops-campaigns-list');
    return {
      campaign: result.data?.data ?? result.data,
      created: result.data?.created ?? true,
      queueEntry: result.data?.queueEntry ?? (result.data?.data?.queueEntry ?? null),
    };
  }

  async dismissProspectQueue(id: string, reason?: ProspectDismissReason): Promise<ProspectQueueEntry> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/prospect-queue/${id}/dismiss`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      `mkt-ops-prospect-queue-dismiss-${id}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to dismiss queue entry');
    }
    await this.invalidateCachePattern('mkt-ops-prospect-queue');
    return result.data?.data ?? result.data;
  }

  // ─── Customer Alerts (§8.3) ──────────────────────────────────────────────

  async sendClaimInvite(campaignId: string): Promise<{ claimUrl: string; emailSent: boolean; campaignCount: number }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/marketing-ops/campaigns/${campaignId}/send-claim-invite`,
      { method: 'POST' },
    );
    if (!result.success) throw new Error(typeof result.error === 'string' ? result.error : 'Failed to send claim invite');
    return result.data?.data ?? result.data;
  }

  async listMarketingAlertCustomers(search?: string): Promise<MarketingAlertCustomer[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/marketing-ops/alerts/customers${qs}`,
      { method: 'GET' },
    );
    if (!result.success) throw new Error('Failed to load marketing customers');
    return result.data?.data ?? result.data;
  }

  async getAlertRecipientCount(params: { type: string; customerId?: string; campaignId?: string }): Promise<number> {
    const qs = new URLSearchParams({
      type: params.type,
      ...(params.customerId && { customerId: params.customerId }),
      ...(params.campaignId && { campaignId: params.campaignId }),
    }).toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/marketing-ops/alerts/recipient-count?${qs}`,
      { method: 'GET' },
    );
    if (!result.success) throw new Error('Failed to count recipients');
    return (result.data?.data ?? result.data)?.count ?? 0;
  }

  async createMarketingAlert(data: {
    type: 'mkt_direct' | 'mkt_broadcast' | 'mkt_campaign';
    alertType?: string;
    title: string;
    body?: string;
    icon?: string;
    customerId?: string;
    campaignId?: string;
    ctaLabel?: string;
    ctaHref?: string;
  }): Promise<{ id: string; createdAt: string }> {
    const result = await this.makeDefaultRequest<any>(
      '/api/admin/marketing-ops/alerts',
      { method: 'POST', body: JSON.stringify(data) },
    );
    if (!result.success) throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create alert');
    return result.data?.data ?? result.data;
  }

  async listMarketingAlerts(page?: number): Promise<{ alerts: MarketingAlertHistory[]; total: number; totalPages: number }> {
    const qs = page ? `?page=${page}` : '';
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/marketing-ops/alerts${qs}`,
      { method: 'GET' },
    );
    if (!result.success) throw new Error('Failed to load alerts');
    const unwrapped = result.data?.data ?? result.data;
    return { alerts: unwrapped?.data ?? unwrapped ?? [], total: unwrapped?.total ?? 0, totalPages: unwrapped?.totalPages ?? 0 };
  }
}

export interface CascadeStatus {
  campaignId: string;
  cascadeEnabled: boolean;
  cascadeConfig: any;
  stepsFired: number;
  stepsRemaining: number;
  totalSteps: number;
  contacts: Array<{
    id: string;
    contactDate: string;
    channel: string;
    outcome: string;
    notes: string;
  }>;
}

// ─── Deliverable Construction Types ──────────────────────────────────────

export interface OwnerVoiceProfile {
  id: string;
  campaignId: string;
  person: string | null;
  formality: string | null;
  humor: string | null;
  apologyStyle: string | null;
  signoffStyle: string | null;
  signature: string | null;
  inferredFromCount: number;
  inferredSample: string | null;
  operatorOverrides: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerVoiceInput {
  person?: string;
  formality?: string;
  humor?: string;
  apologyStyle?: string;
  signoffStyle?: string;
  signature?: string;
}

export interface VoiceInferenceResult {
  person: string;
  formality: string;
  humor: string;
  apologyStyle: string;
  signoffStyle: string;
  signature: string | null;
  inferredFromCount: number;
  inferredSample: string;
}

export interface ReviewSlot {
  id: string;
  deliverableId: string | null;
  campaignId: string;
  platform: string | null;
  reviewText: string | null;
  reviewRating: number | null;
  reviewDate: string | null;
  reviewAuthor: string | null;
  sentiment: string | null;
  theme: string | null;
  isNegativeFirst: boolean;
  responseText: string | null;
  responseSource: string | null;
  responseAiProvider: string | null;
  responseAiModel: string | null;
  responseTokensUsed: number;
  qualityGatePassed: boolean | null;
  qualityGateIssues: string[] | null;
  status: string;
  slotIndex: number;
  createdAt: string;
  updatedAt: string;
}

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

export interface RenderResult {
  deliverableId: string;
  pdfPath: string;
  txtPath: string;
  fileName: string;
  fileSize: number;
}

export interface MarketingAlertCustomer {
  id: string;
  email: string;
  name: string;
  customerNumber: string;
  campaignCount: number;
  lastBusinessName: string | null;
}

export interface MarketingAlertHistory {
  id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  targetType: 'mkt_direct' | 'mkt_broadcast' | 'mkt_campaign';
  customerId: string | null;
  campaignId: string | null;
  createdAt: string;
  readCount: number;
  dismissedCount: number;
  recipientCount: number;
}

const marketingOpsService = MarketingOpsService.getInstance();
export { marketingOpsService, MarketingOpsService };
export default marketingOpsService;

// ─── Cascade methods (added to the prototype for use by CascadePanel) ──────

export interface CascadeStatus {
  campaignId: string;
  cascadeEnabled: boolean;
  cascadeConfig: any;
  stepsFired: number;
  stepsRemaining: number;
  totalSteps: number;
  contacts: Array<{
    id: string;
    contactDate: string;
    channel: string;
    outcome: string;
    notes: string;
  }>;
}

MarketingOpsService.prototype.enableCascade = async function (campaignId: string, config?: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/${campaignId}/cascade/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ cascade_config: config }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to enable cascade (${res.status})`);
  }
  const json = await res.json();
  return json.data;
};

MarketingOpsService.prototype.disableCascade = async function (campaignId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/${campaignId}/cascade/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to disable cascade (${res.status})`);
  }
  const json = await res.json();
  return json.data;
};

MarketingOpsService.prototype.getCascadeStatus = async function (campaignId: string): Promise<CascadeStatus> {
  const res = await fetch(`${BASE_URL}/${campaignId}/cascade/status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to get cascade status (${res.status})`);
  }
  const json = await res.json();
  return json.data;
};

// ─── Signal registry + triage methods (Sprint 3.5) ───────────────────────

export interface SignalRegistryEntry {
  id: string;
  code: string;
  family: string;
  label: string;
  description?: string | null;
  detectionSource: 'model_emitted' | 'derived' | 'operator_input';
  isActive: boolean;
}

export interface DetectedSignal {
  code: string;
  label: string;
  family: string;
  contributedToRule: boolean;
}

export interface TriageSourceAudit {
  id: string;
  platform: string;
  createdAt: string;
}

export interface TriageResult {
  id: string;
  campaignId: string;
  recommendedPlaybook: {
    id: string;
    code: string;
    name: string;
    category: string;
    archetype: string;
    archetypeLabel: string;
    fitdOfferTitle: string;
    fitdDefaultFeeCents: number;
    retainerPitchTitle: string;
    retainerFeeCents: number;
    previewDeliverableType?: string | null;
  };
  overriddenPlaybook: TriageResult['recommendedPlaybook'] | null;
  confidenceScore: number;
  triageReasoning: string;
  detectedSignals: DetectedSignal[];
  isOperatorAccepted: boolean | null;
  evaluatedAt: string;
  sourceAudit: TriageSourceAudit | null;
}

// ─── Playbook catalog types (Sprint 4) ───────────────────────────────────

export interface MatchingRules {
  any: string[];
  all: string[];
  none: string[];
  dual: { groupA: string[]; groupB: string[] } | null;
  confidence: number;
}

export interface PlaybookCatalogEntry {
  id: string;
  code: string;
  name: string;
  category: string;
  archetype: string;
  archetypeLabel: string;
  description: string | null;
  matchingRules: MatchingRules;
  priorityRank: number;
  fitdOfferTitle: string;
  fitdDefaultFeeCents: number;
  retainerPitchTitle: string;
  retainerFeeCents: number;
  openerPromptTemplateId: string | null;
  previewDeliverableType: string | null;
  isActive: boolean;
}

export interface PlaybookCreateInput {
  code: string;
  name: string;
  category: string;
  archetype: string;
  description?: string;
  matching_rules?: MatchingRules;
  priority_rank?: number;
  fitd_offer_title: string;
  fitd_default_fee_cents: number;
  retainer_pitch_title: string;
  retainer_fee_cents: number;
  opener_prompt_template_id?: string;
  preview_deliverable_type?: string;
  is_active?: boolean;
}

// ─── Playbook checklist types (Operator Checklist Sprint) ────────────────

export const CHECKLIST_STEP_TYPES = ['manual', 'url_check', 'ai_prompt', 'deliverable', 'outreach', 'credentials'] as const;
export type ChecklistStepType = (typeof CHECKLIST_STEP_TYPES)[number];

export const SUGGESTION_KINDS = ['add', 'modify', 'remove'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_POSITIONS = ['before', 'after', 'supersede'] as const;
export type SuggestionPosition = (typeof SUGGESTION_POSITIONS)[number];

/**
 * Stage tags — which campaign stage a checklist step belongs to (migration 175).
 * The checklist is visible at every stage; the tag shows what each stage
 * expects. Steps tagged at or before the campaign's current stage feed the
 * transition soft gate; later-stage and null-tagged steps do not restrict
 * early transitions (null = untagged, always gates).
 */
export const CHECKLIST_STAGE_TAGS = [
  'seek',
  'preview_built',
  'shown',
  'paid',
  'delivered',
  'retainer_pitched',
  'retainer_won',
  'lost',
  'dead',
  'tenant_onboarded',
] as const;
export type ChecklistStageTag = (typeof CHECKLIST_STAGE_TAGS)[number];

export const CHECKLIST_STAGE_TAG_LABELS: Record<ChecklistStageTag, string> = {
  seek: 'Seek',
  preview_built: 'Preview Built',
  shown: 'Shown',
  paid: 'Paid',
  delivered: 'Delivered',
  retainer_pitched: 'Retainer Pitched',
  retainer_won: 'Retainer Won',
  lost: 'Lost',
  dead: 'Dead',
  tenant_onboarded: 'Tenant Onboarded',
};

export interface ChecklistStepInput {
  title: string;
  instructions?: string;
  stepType: ChecklistStepType;
  actionConfig?: Record<string, any>;
  isRequired?: boolean;
  isActive?: boolean;
  stageTag?: ChecklistStageTag | null;
}

export interface PlaybookChecklistStep {
  id: string;
  playbookId: string;
  stepOrder: number;
  title: string;
  instructions: string | null;
  stepType: ChecklistStepType;
  actionConfig: Record<string, any>;
  isRequired: boolean;
  isActive: boolean;
  stageTag: ChecklistStageTag | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistStepView extends PlaybookChecklistStep {
  progress: {
    completedAt: string | null;
    completedBy: string | null;
    note: string | null;
  } | null;
}

export interface CampaignChecklistView {
  playbook: {
    id: string;
    code: string;
    name: string;
    category: string;
    isOverride: boolean;
  } | null;
  steps: ChecklistStepView[];
  completedCount: number;
  requiredTotal: number;
  requiredCompleted: number;
}

export interface ChecklistSuggestionInput {
  stepId?: string | null;
  suggestionKind: SuggestionKind;
  position?: SuggestionPosition | null;
  proposedStep: Record<string, any>;
  rationale: string;
}

export interface PlaybookChecklistSuggestion {
  id: string;
  playbookId: string;
  campaignId: string;
  stepId: string | null;
  suggestionKind: SuggestionKind;
  position: SuggestionPosition | null;
  proposedStep: Record<string, any>;
  rationale: string;
  status: 'pending' | 'accepted' | 'rejected';
  submittedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}
