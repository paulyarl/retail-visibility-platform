/**
 * Bot Service — Frontend Singleton (Tenant-scoped)
 *
 * Merchant dashboard bot operations: config CRUD, conversation list,
 * skill management, dashboard stats, analytics.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { publicBotService } from './PublicBotService';

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
  escalatedConversations: number;
  closedConversations: number;
  archivedConversations: number;
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
  [key: string]: any;
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
    await publicBotService.invalidateCache(`/api/public/bot/config*${tenantId}*`);
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

  async updateConversationStatus(tenantId: string, conversationId: string, status: 'active' | 'closed' | 'archived'): Promise<BotConversation> {
    const result = await this.makeDefaultRequest<ApiEnvelope<BotConversation>>(
      `/api/tenants/${tenantId}/bot/conversations/${conversationId}/status`,
      { method: 'PUT', body: JSON.stringify({ status }) },
      `bot-conversation-status-${tenantId}-${conversationId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update conversation status');
    await this.invalidateCache(`bot-conversations-${tenantId}`);
    await this.invalidateCache(`bot-conversation-detail-${tenantId}-${conversationId}`);
    await this.invalidateCache(`bot-dashboard-${tenantId}`);
    return result.data.conversation!;
  }

  async escalateConversation(tenantId: string, conversationId: string, reason: string, summary?: string): Promise<{ ticketId: string; ticketTitle: string }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/conversations/${conversationId}/escalate`,
      { method: 'POST', body: JSON.stringify({ reason, summary }) },
      `bot-conversation-escalate-${tenantId}-${conversationId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to escalate conversation');
    await this.invalidateCache(`bot-conversations-${tenantId}`);
    await this.invalidateCache(`bot-conversation-detail-${tenantId}-${conversationId}`);
    await this.invalidateCache(`bot-dashboard-${tenantId}`);
    return {
      ticketId: result.data.ticketId,
      ticketTitle: result.data.ticketTitle,
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

  // ====================
  // DASHBOARD CHAT
  // ====================

  async startDashboardChat(tenantId: string): Promise<{ sessionId: string; conversationId: string; greeting: string }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/dashboard-chat/start`,
      { method: 'POST' },
      `bot-dashboard-chat-start-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to start dashboard chat');
    return {
      sessionId: result.data.sessionId,
      conversationId: result.data.conversationId,
      greeting: result.data.greeting,
    };
  }

  async sendDashboardMessage(tenantId: string, sessionId: string, message: string): Promise<{
    reply: string;
    responseType: string;
    matchedFaqId: string | null;
    messageId: string;
    skillCard?: any;
    skillName?: string | null;
  }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/dashboard-chat/message`,
      { method: 'POST', body: JSON.stringify({ sessionId, message }) },
      `bot-dashboard-chat-msg-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to send message');
    return {
      reply: result.data.reply,
      responseType: result.data.responseType,
      matchedFaqId: result.data.matchedFaqId ?? null,
      messageId: result.data.messageId,
      skillCard: result.data.skillCard,
      skillName: result.data.skillName ?? null,
    };
  }

  async uploadAvatar(tenantId: string, dataUrl: string, contentType: string): Promise<string> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/avatar`,
      { method: 'POST', body: JSON.stringify({ dataUrl, contentType }) },
      `bot-avatar-upload-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to upload avatar');
    await this.invalidateServiceCaches(tenantId);
    await publicBotService.invalidateCache(`/api/public/bot/config*${tenantId}*`);
    return result.data.url;
  }

  async getPlatformGuide(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/bot/platform-guide`,
      { method: 'GET' },
      `bot-platform-guide-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to get platform guide');
    return result.data.guide;
  }

  async getChatbotOptions(tenantId: string): Promise<Record<string, boolean>> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/chatbot-options`,
      { method: 'GET' },
      `bot-options-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) return {};
    if (!result.data?.success) return {};
    return result.data.settings ?? {};
  }

  async updateChatbotOptions(tenantId: string, settings: Record<string, boolean>): Promise<Record<string, boolean>> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/chatbot-options`,
      { method: 'PUT', body: JSON.stringify(settings) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to save');
    await this.invalidateCache(`bot-options-${tenantId}`);
    return result.data.settings ?? settings;
  }
}

export const botService = BotService.getInstance();
export default botService;
