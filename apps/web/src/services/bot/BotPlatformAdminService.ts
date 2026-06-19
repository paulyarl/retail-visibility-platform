/**
 * BotPlatformAdminService — Platform Admin Bot service
 * Extends AdminApiSingleton for Auth0 cookie-based auth with admin headers
 * Endpoints: /api/admin/bot/*
 */
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BotDashboardStats {
  totalConfigs: number;
  activeConfigs: number;
  totalConversations: number;
  activeConversations: number;
  recentConversations: number;
  totalMessages: number;
  totalSkills: number;
  activeSkills: number;
  totalGuardrailRules: number;
  activeGuardrailRules: number;
  totalIntents: number;
  resolutionStats: { resolved_by: string | null; count: number }[];
  topIntents: { intent: string; count: number }[];
}

export interface BotGuardrailRule {
  id: string;
  tenant_id: string | null;
  rule_type: string;
  pattern: string;
  action: string;
  replacement: string | null;
  response_template: string | null;
  severity: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotIntent {
  id: string;
  name: string;
  category: string;
  description: string | null;
  examples: string[];
  confidence_threshold: number;
  mapped_skill: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotSkill {
  id: string;
  name: string;
  version: string;
  description: string | null;
  endpoint: string;
  required_capabilities: string[];
  tier_gates: string[];
  capability_gates: string[];
  tenant_status_gates: string[];
  featured_aware: boolean;
  refresh_cadence_minutes: number;
  status: string;
  skill_card_schema: any;
  default_config: any;
  created_at: string;
  updated_at: string;
  bot_skill_configurations?: { tenant_id: string; enabled: boolean }[];
}

export interface BotKnowledgeStatus {
  tenantId: string;
  botName: string;
  status: string;
  faqEmbeddings: number;
  productEmbeddings: number;
}

export interface BotTenantSummary {
  tenant_id: string;
  bot_name: string;
  status: string;
  tone: string;
  response_length: string;
  escalation_enabled: boolean;
  created_at: string;
  updated_at: string;
  conversationCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

class BotPlatformAdminService extends AdminApiSingleton {
  private static instance: BotPlatformAdminService;

  private constructor() {
    super('bot-platform-admin', { ttl: 2 * 60 * 1000 });
  }

  static getInstance(): BotPlatformAdminService {
    if (!BotPlatformAdminService.instance) {
      BotPlatformAdminService.instance = new BotPlatformAdminService();
    }
    return BotPlatformAdminService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['bot-dashboard', 'bot-guardrails', 'bot-intents', 'bot-skills', 'bot-knowledge', 'bot-tenants'];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  private unwrap<T>(result: { success: boolean; data: any; error?: any }): T {
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data?.data as T;
  }

  // --- Dashboard ---

  async getDashboardStats(): Promise<BotDashboardStats> {
    const result = await this.makeDefaultRequest<BotDashboardStats>(
      '/api/admin/bot/dashboard',
      { method: 'GET' },
      'bot-dashboard',
      2 * 60 * 1000,
    );
    return this.unwrap<BotDashboardStats>(result);
  }

  // --- Guardrails ---

  async listGuardrails(tenantId?: string): Promise<BotGuardrailRule[]> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const result = await this.makeDefaultRequest<BotGuardrailRule[]>(
      `/api/admin/bot/guardrails${qs}`,
      { method: 'GET' },
      'bot-guardrails',
      2 * 60 * 1000,
    );
    return this.unwrap<BotGuardrailRule[]>(result);
  }

  async createGuardrail(data: Partial<BotGuardrailRule>): Promise<BotGuardrailRule> {
    const result = await this.makeDefaultRequest<BotGuardrailRule>(
      '/api/admin/bot/guardrails',
      { method: 'POST', body: JSON.stringify(data) },
    );
    await this.invalidateCache('bot-guardrails');
    return this.unwrap<BotGuardrailRule>(result);
  }

  async updateGuardrail(id: string, data: Partial<BotGuardrailRule>): Promise<BotGuardrailRule> {
    const result = await this.makeDefaultRequest<BotGuardrailRule>(
      `/api/admin/bot/guardrails/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    await this.invalidateCache('bot-guardrails');
    return this.unwrap<BotGuardrailRule>(result);
  }

  async deleteGuardrail(id: string): Promise<void> {
    await this.makeDefaultRequest(
      `/api/admin/bot/guardrails/${id}`,
      { method: 'DELETE' },
    );
    await this.invalidateCache('bot-guardrails');
  }

  // --- Intents ---

  async listIntents(): Promise<BotIntent[]> {
    const result = await this.makeDefaultRequest<BotIntent[]>(
      '/api/admin/bot/intents',
      { method: 'GET' },
      'bot-intents',
      5 * 60 * 1000,
    );
    return this.unwrap<BotIntent[]>(result);
  }

  async createIntent(data: Partial<BotIntent>): Promise<BotIntent> {
    const result = await this.makeDefaultRequest<BotIntent>(
      '/api/admin/bot/intents',
      { method: 'POST', body: JSON.stringify(data) },
    );
    await this.invalidateCache('bot-intents');
    return this.unwrap<BotIntent>(result);
  }

  async updateIntent(id: string, data: Partial<BotIntent>): Promise<BotIntent> {
    const result = await this.makeDefaultRequest<BotIntent>(
      `/api/admin/bot/intents/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    await this.invalidateCache('bot-intents');
    return this.unwrap<BotIntent>(result);
  }

  async deleteIntent(id: string): Promise<void> {
    await this.makeDefaultRequest(
      `/api/admin/bot/intents/${id}`,
      { method: 'DELETE' },
    );
    await this.invalidateCache('bot-intents');
  }

  // --- Skills ---

  async listSkills(): Promise<BotSkill[]> {
    const result = await this.makeDefaultRequest<BotSkill[]>(
      '/api/admin/bot/skills',
      { method: 'GET' },
      'bot-skills',
      5 * 60 * 1000,
    );
    return this.unwrap<BotSkill[]>(result);
  }

  async createSkill(data: Partial<BotSkill>): Promise<BotSkill> {
    const result = await this.makeDefaultRequest<BotSkill>(
      '/api/admin/bot/skills',
      { method: 'POST', body: JSON.stringify(data) },
    );
    await this.invalidateCache('bot-skills');
    return this.unwrap<BotSkill>(result);
  }

  async updateSkill(id: string, data: Partial<BotSkill>): Promise<BotSkill> {
    const result = await this.makeDefaultRequest<BotSkill>(
      `/api/admin/bot/skills/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
    );
    await this.invalidateCache('bot-skills');
    return this.unwrap<BotSkill>(result);
  }

  async deleteSkill(id: string): Promise<void> {
    await this.makeDefaultRequest(
      `/api/admin/bot/skills/${id}`,
      { method: 'DELETE' },
    );
    await this.invalidateCache('bot-skills');
  }

  // --- Knowledge Base ---

  async listKnowledgeStatus(page: number = 1, limit: number = 25): Promise<PaginatedResult<BotKnowledgeStatus>> {
    const result = await this.makeDefaultRequest<PaginatedResult<BotKnowledgeStatus>>(
      `/api/admin/bot/knowledge?page=${page}&limit=${limit}`,
      { method: 'GET' },
      'bot-knowledge',
      2 * 60 * 1000,
    );
    return this.unwrap<PaginatedResult<BotKnowledgeStatus>>(result);
  }

  async refreshEmbeddings(tenantId: string, type: 'faq' | 'product' | 'both' = 'both'): Promise<any> {
    const result = await this.makeDefaultRequest(
      '/api/admin/bot/knowledge/refresh',
      { method: 'POST', body: JSON.stringify({ tenantId, type }) },
    );
    await this.invalidateCache('bot-knowledge');
    return this.unwrap<any>(result);
  }

  // --- Tenants ---

  async listBotTenants(page: number = 1, limit: number = 25, q?: string): Promise<PaginatedResult<BotTenantSummary>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q) params.set('q', q);
    const result = await this.makeDefaultRequest<PaginatedResult<BotTenantSummary>>(
      `/api/admin/bot/tenants?${params}`,
      { method: 'GET' },
      'bot-tenants',
      2 * 60 * 1000,
    );
    return this.unwrap<PaginatedResult<BotTenantSummary>>(result);
  }
}

export const botPlatformAdminService = BotPlatformAdminService.getInstance();
export default BotPlatformAdminService;
