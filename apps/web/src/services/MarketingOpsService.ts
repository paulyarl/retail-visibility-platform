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
  | 'dead';

export type RetainerStatus = 'not_pitched' | 'pitched' | 'won' | 'declined';

export type PromptType =
  | 'seek'
  | 'fulfill'
  | 'filter'
  | 'retainer'
  | 'category_analysis'
  | 'city_analysis';

export type ExecutionStatus = 'pending' | 'filtered' | 'reviewed' | 'delivered' | 'archived';

export type FilterFlagStatus = 'pending' | 'fixed' | 'approved_as_is';

export type DeliverableType =
  | 'review_responses'
  | 'service_menu'
  | 'gbp_audit'
  | 'testimonial_cards'
  | 'nap_report'
  | 'seo_content'
  | 'lead_magnet';

export type DeliverableStatus = 'preview' | 'paid' | 'archived';

export interface Campaign {
  id: string;
  display_id: string | null;
  business_name: string;
  category: string;
  city: string;
  neighborhood: string | null;
  contact_method: string | null;
  contact_info: string | null;
  gbp_claimed: boolean | null;
  unaddressed_reviews: number | null;
  last_review_date: string | null;
  has_website: string | null;
  nap_consistent: boolean | null;
  estimated_tier: string | null;
  estimated_fee_cents: number | null;
  pain_score: number | null;
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
}

export interface CampaignDetail extends Campaign {
  audits?: Audit[];
  files?: MarketingFile[];
  stage_history?: StageHistory[];
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
  category: string | null;
  version: number;
  body: string;
  variables: any;
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
  byStage: Record<CampaignStage, number>;
  totalRevenueCents: number;
  totalRetainersWon: number;
  conversionRate: number;
  recentTransitions?: StageHistory[];
}

// ====================
// INPUT TYPES
// ====================

export interface CampaignCreateInput {
  business_name: string;
  category: string;
  city: string;
  neighborhood?: string;
  contact_method?: string;
  contact_info?: string;
  display_id?: string;
  gbp_claimed?: boolean;
  unaddressed_reviews?: number;
  last_review_date?: string;
  has_website?: string;
  nap_consistent?: boolean;
  estimated_tier?: string;
  estimated_fee_cents?: number;
  pain_score?: number;
  assigned_to?: string;
  notes?: string;
}

export interface CampaignUpdateInput extends Partial<CampaignCreateInput> {
  stage?: CampaignStage;
  retainer_status?: RetainerStatus;
  retainer_amount_cents?: number;
  retainer_start_date?: string;
  amount_paid_cents?: number;
  package_delivered?: string;
}

export interface StageTransitionInput {
  to_stage: CampaignStage;
  notes?: string;
  trigger_type?: 'manual' | 'automated' | 'system';
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
  category?: string;
  body: string;
  variables?: any;
  is_default?: boolean;
}

export interface ExecutionCreateInput {
  campaign_id: string;
  template_id?: string;
  variables_used?: any;
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
    category?: string;
    city?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Campaign[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    const url = `${BASE_URL}${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-campaigns-list', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch campaigns');
    }
    const data = result.data;
    return data?.items ? data : { items: data ?? [], total: data?.length ?? 0 };
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
    return result.data;
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
    return result.data;
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
    return result.data;
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
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to transition stage');
    }
    await this.invalidateCachePattern('mkt-ops-campaign');
    return result.data;
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
    return result.data;
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
    return typeof result.data === 'string' ? result.data : '';
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
    const data = result.data;
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
    return result.data;
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
    return result.data;
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
    const data = result.data;
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
    return result.data;
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
    category?: string;
    is_active?: boolean;
  }): Promise<PromptTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.prompt_type) params.set('prompt_type', filters.prompt_type);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
    const query = params.toString();
    const url = `${BASE_URL}/prompts/templates${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-prompt-templates', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch prompt templates');
    }
    const data = result.data;
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
    return result.data;
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
    return result.data;
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
    const data = result.data;
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
    return result.data;
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
    return result.data;
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
    return Array.isArray(result.data) ? result.data : [];
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
    return result.data;
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
    const data = result.data;
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
    return result.data;
  }

  // ─── Scorecards ─────────────────────────────────────────────

  async listScorecards(filters?: {
    user_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Scorecard[]> {
    const params = new URLSearchParams();
    if (filters?.user_id) params.set('user_id', filters.user_id);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    const url = `${BASE_URL}/scorecards${query ? `?${query}` : ''}`;

    const result = await this.makeDefaultRequest<any>(url, {}, 'mkt-ops-scorecards', this.cacheTTL);
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch scorecards');
    }
    const data = result.data;
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
    return result.data;
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
    const data = result.data;
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
    return result.data;
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
    return result.data;
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
    const data = result.data;
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
    return result.data;
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
    return result.data;
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
    const data = result.data;
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
    return result.data ?? null;
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
    return result.data;
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
    return result.data;
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
}

const marketingOpsService = MarketingOpsService.getInstance();
export { marketingOpsService, MarketingOpsService };
export default marketingOpsService;
