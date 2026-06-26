/**
 * Public Bot Service — Frontend Singleton (Public/Widget-scoped)
 *
 * Used by the embeddable bot widget and public storefront pages.
 * No authentication required — all endpoints are public.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

// ====================
// TYPES
// ====================

export interface PublicBotConfig {
  botName: string;
  greeting: string;
  widgetPosition: string;
  widgetColor: string;
  widgetOffsetX: number;
  widgetOffsetY: number;
  widgetFont: string;
  widgetAvatarUrl: string | null;
  platformLogoUrl: string | null;
  autoOpen: boolean;
  autoOpenDelay: number;
  afterHoursEnabled: boolean;
  afterHoursMessage: string | null;
  preChatEnabled: boolean;
  preChatEmail: boolean;
  preChatPhone: boolean;
  preChatOrder: boolean;
  status: string;
}

export interface PublicBotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  responseType: string;
  matchedFaqId: string | null;
  skillCard: any;
  skillName: string | null;
  guardrailResult: string;
  createdAt: string;
}

export interface StartConversationResult {
  sessionId: string;
  greeting: string;
}

export interface SteeringChannel {
  type: 'customer_ticket' | 'anonymous_inquiry' | 'help_desk';
  label: string;
  enabled: boolean;
  actionUrl: string;
  description: string;
}

export interface SendMessageResult {
  reply: string;
  responseType: string;
  matchedFaqId: string | null;
  skillCard?: any;
  skillName?: string | null;
  guardrailResult: string;
  messageId: string;
  channels?: SteeringChannel[];
}

export interface SkillResult {
  success: boolean;
  data: any;
  cardSchema: any;
  error?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  config?: T;
  sessionId?: string;
  greeting?: string;
  reply?: string;
  responseType?: string;
  matchedFaqId?: string | null;
  skillCard?: any;
  skillName?: string;
  guardrailResult?: string;
  messageId?: string;
  channels?: SteeringChannel[];
  data?: any;
  cardSchema?: any;
  error?: string;
  message?: string;
}

class PublicBotService extends PublicApiSingleton {
  private static instance: PublicBotService;

  private constructor() {
    super('public-bot-service');
  }

  static getInstance(): PublicBotService {
    if (!PublicBotService.instance) {
      PublicBotService.instance = new PublicBotService();
    }
    return PublicBotService.instance;
  }

  // ====================
  // CONFIG
  // ====================

  async getWidgetConfig(tenantId: string): Promise<PublicBotConfig | null> {
    try {
      const result = await this.makePublicRequest<ApiEnvelope<PublicBotConfig>>(
        `/api/public/bot/config?tenantId=${tenantId}`,
        { method: 'GET' },
        `bot-widget-config-${tenantId}`,
        5 * 60 * 1000
      );
      if (!result.success) return null;
      if (!result.data.success) return null;
      return result.data.config || null;
    } catch {
      return null;
    }
  }

  // ====================
  // CONVERSATIONS
  // ====================

  async startConversation(params: {
    tenantId: string;
    customerEmail?: string;
    customerPhone?: string;
    pageContext?: string;
    contextEntityName?: string;
  }): Promise<StartConversationResult> {
    const result = await this.makePublicRequest<ApiEnvelope<any>>(
      `/api/public/bot/conversations`,
      { method: 'POST', body: JSON.stringify(params) },
      `bot-start-conversation-${params.tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to start conversation');
    return {
      sessionId: result.data.sessionId!,
      greeting: result.data.greeting!,
    };
  }

  async sendMessage(sessionId: string, message: string): Promise<SendMessageResult> {
    const result = await this.makePublicRequest<ApiEnvelope<any>>(
      `/api/public/bot/conversations/${sessionId}/messages`,
      { method: 'POST', body: JSON.stringify({ message }) },
      `bot-send-message-${sessionId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to send message');
    return {
      reply: result.data.reply!,
      responseType: result.data.responseType!,
      matchedFaqId: result.data.matchedFaqId || null,
      skillCard: result.data.skillCard,
      skillName: result.data.skillName,
      guardrailResult: result.data.guardrailResult || 'pass',
      messageId: result.data.messageId!,
      channels: result.data.channels,
    };
  }

  // ====================
  // SKILLS
  // ====================

  async executeSkill(tenantId: string, skillName: string, params?: Record<string, any>): Promise<SkillResult> {
    const query = new URLSearchParams({ tenantId, ...(params || {}) });
    const result = await this.makePublicRequest<ApiEnvelope<any>>(
      `/api/public/bot/skills/${skillName}?${query.toString()}`,
      { method: 'GET' },
      `bot-skill-${tenantId}-${skillName}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return {
      success: result.data.success,
      data: result.data.data,
      cardSchema: result.data.cardSchema,
      error: result.data.error,
    };
  }

  // ====================
  // FEEDBACK
  // ====================

  async submitFeedback(sessionId: string, messageId: string, rating: 'positive' | 'negative'): Promise<void> {
    await this.makePublicRequest<ApiEnvelope<any>>(
      `/api/public/bot/conversations/${sessionId}/feedback`,
      { method: 'POST', body: JSON.stringify({ messageId, rating }) },
      `bot-feedback-${messageId}`
    );
  }

  async previewBot(tenantId: string, message: string, pageContext?: string): Promise<{ reply: string; responseType: string; matchedFaqId: string | null }> {
    const result = await this.makePublicRequest<ApiEnvelope<any>>(
      `/api/public/bot/preview`,
      { method: 'POST', body: JSON.stringify({ tenantId, message, pageContext: pageContext || 'storefront' }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Preview failed');
    return {
      reply: result.data.reply!,
      responseType: result.data.responseType!,
      matchedFaqId: result.data.matchedFaqId ?? null,
    };
  }
}

export const publicBotService = PublicBotService.getInstance();
export default publicBotService;
