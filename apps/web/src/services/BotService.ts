/**
 * Bot Service — Frontend Singleton (Tenant-scoped)
 *
 * Merchant dashboard bot operations: config CRUD, conversation list,
 * skill management, dashboard stats, analytics.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

// ====================
// TYPES
// ====================

export interface BotConfig {
  id: string;
  tenantId: string;
  botName: string;
  tone: string;
  responseLength: string;
  fallbackMessage: string;
  greeting: string;
  widgetPosition: string;
  widgetColor: string;
  widgetOffsetX: number;
  widgetOffsetY: number;
  widgetFont: string;
  widgetAvatarUrl: string | null;
  autoOpen: boolean;
  autoOpenDelay: number;
  afterHoursEnabled: boolean;
  afterHoursMessage: string | null;
  businessHoursSource: string;
  preChatEnabled: boolean;
  preChatEmail: boolean;
  preChatPhone: boolean;
  preChatOrder: boolean;
  status: string;
  escalationEnabled: boolean;
  escalationMessage: string | null;
}

export interface BotConversation {
  id: string;
  tenantId: string;
  sessionId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  source: string;
  status: string;
  resolvedBy: string | null;
  pageContext: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface BotMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  intent: string | null;
  confidence: number | null;
  matchedFaqId: string | null;
  responseType: string;
  guardrailResult: string | null;
  skillName: string | null;
  metadata: any;
  createdAt: string;
}

export interface BotSkill {
  id: string;
  name: string;
  version: string;
  description: string | null;
  endpoint: string;
  requiredCapabilities: string[];
  tierGates: string[];
  capabilityGates: string[];
  tenantStatusGates: string[];
  featuredAware: boolean;
  refreshCadenceMinutes: number;
  status: string;
  skillCardSchema: any;
  defaultConfig: any;
  enabled: boolean;
  config: any;
}

export interface BotDashboardStats {
  totalConversations: number;
  activeConversations: number;
  resolvedByFaq: number;
  resolvedBySkill: number;
  resolvedByFallback: number;
  avgRating: number | null;
}

export interface UpdateBotConfigInput {
  botName?: string;
  tone?: string;
  responseLength?: string;
  fallbackMessage?: string;
  greeting?: string;
  widgetPosition?: string;
  widgetColor?: string;
  widgetOffsetX?: number;
  widgetOffsetY?: number;
  widgetFont?: string;
  widgetAvatarUrl?: string | null;
  autoOpen?: boolean;
  autoOpenDelay?: number;
  afterHoursEnabled?: boolean;
  afterHoursMessage?: string | null;
  businessHoursSource?: string;
  preChatEnabled?: boolean;
  preChatEmail?: boolean;
  preChatPhone?: boolean;
  preChatOrder?: boolean;
  status?: string;
  escalationEnabled?: boolean;
  escalationMessage?: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  config?: T;
  conversations?: T;
  messages?: BotMessage[];
  conversation?: BotConversation;
  skills?: BotSkill[];
  stats?: BotDashboardStats;
  analytics?: any;
  error?: string;
  message?: string;
}

class BotService extends TenantApiSingleton {
  private static instance: BotService;

  private constructor() {
    super('bot-service', { ttl: 2 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'bot-config-*',
      'bot-conversations-*',
      'bot-conversation-detail-*',
      'bot-skills-*',
      'bot-dashboard-*',
      'bot-analytics-*',
    ];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): BotService {
    if (!BotService.instance) {
      BotService.instance = new BotService();
    }
    return BotService.instance;
  }

  // ====================
  // CONFIG
  // ====================

  async getConfig(tenantId: string): Promise<BotConfig> {
    const result = await this.makeDefaultRequest<ApiEnvelope<BotConfig>>(
      `/api/tenants/${tenantId}/bot/config`,
      { method: 'GET' },
      `bot-config-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load bot config');
    return result.data.config!;
  }

  async updateConfig(tenantId: string, data: UpdateBotConfigInput): Promise<BotConfig> {
    const result = await this.makeDefaultRequest<ApiEnvelope<BotConfig>>(
      `/api/tenants/${tenantId}/bot/config`,
      { method: 'PUT', body: JSON.stringify(data) },
      `bot-config-update-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update bot config');
    await this.invalidateServiceCaches(tenantId);
    return result.data.config!;
  }

  // ====================
  // CONVERSATIONS
  // ====================

  async listConversations(tenantId: string, options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<{ conversations: BotConversation[]; total: number }> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.status) params.append('status', options.status);
    const qs = params.toString();

    const result = await this.makeDefaultRequest<ApiEnvelope<BotConversation[]>>(
      `/api/tenants/${tenantId}/bot/conversations${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      `bot-conversations-${tenantId}-${qs}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to list conversations');
    return {
      conversations: result.data.conversations || [],
      total: (result.data as any).total || 0,
    };
  }

  async getConversation(tenantId: string, conversationId: string): Promise<{
    conversation: BotConversation;
    messages: BotMessage[];
  }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<BotConversation>>(
      `/api/tenants/${tenantId}/bot/conversations/${conversationId}`,
      { method: 'GET' },
      `bot-conversation-detail-${tenantId}-${conversationId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to get conversation');
    return {
      conversation: result.data.conversation!,
      messages: result.data.messages || [],
    };
  }

  // ====================
  // SKILLS
  // ====================

  async listSkills(tenantId: string): Promise<BotSkill[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<BotSkill[]>>(
      `/api/tenants/${tenantId}/bot/skills`,
      { method: 'GET' },
      `bot-skills-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to list skills');
    return result.data.skills || [];
  }

  async updateSkillConfig(tenantId: string, skillId: string, data: {
    enabled?: boolean;
    config?: Record<string, any>;
  }): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/skills/${skillId}`,
      { method: 'PUT', body: JSON.stringify(data) },
      `bot-skill-update-${tenantId}-${skillId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update skill config');
    await this.invalidateCache(`bot-skills-${tenantId}`);
  }

  // ====================
  // DASHBOARD & ANALYTICS
  // ====================

  async getDashboardStats(tenantId: string): Promise<BotDashboardStats> {
    const result = await this.makeDefaultRequest<ApiEnvelope<BotDashboardStats>>(
      `/api/tenants/${tenantId}/bot/dashboard`,
      { method: 'GET' },
      `bot-dashboard-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to get dashboard stats');
    return result.data.stats!;
  }

  async getAnalytics(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/analytics`,
      { method: 'GET' },
      `bot-analytics-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to get analytics');
    return result.data.analytics;
  }
}

export const botService = BotService.getInstance();
export default botService;
