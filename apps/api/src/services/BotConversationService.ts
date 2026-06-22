/**
 * Bot Conversation Service
 *
 * Create/read/close conversations, append messages, session management.
 * Sessions expire after 24h by default.
 */

import { prisma } from '../prisma';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';
import { generateBotConversationSessionId } from '../lib/id-generator';

const SESSION_TTL_HOURS = 24;
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

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
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
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
  createdAt: Date;
}

function toConversation(row: any): BotConversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    source: row.source,
    status: row.status,
    resolvedBy: row.resolved_by,
    pageContext: row.page_context,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

function toMessage(row: any): BotMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    intent: row.intent,
    confidence: row.confidence,
    matchedFaqId: row.matched_faq_id,
    responseType: row.response_type,
    guardrailResult: row.guardrail_result,
    skillName: row.skill_name,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export class BotConversationService {
  private static instance: BotConversationService;

  static getInstance(): BotConversationService {
    if (!BotConversationService.instance) {
      BotConversationService.instance = new BotConversationService();
    }
    return BotConversationService.instance;
  }

  async createConversation(params: {
    tenantId: string;
    customerEmail?: string;
    customerPhone?: string;
    pageContext?: string;
    source?: string;
  }): Promise<{ conversation: BotConversation; greeting: string }> {
    const sessionId = generateBotConversationSessionId(params.tenantId);
    const now = new Date();

    const config = await prisma.bot_configurations.findUnique({
      where: { tenant_id: params.tenantId },
    });

    const greeting = config?.greeting || 'Hi! How can I help you today?';

    const conversation = await prisma.bot_conversations.create({
      data: {
        tenant_id: params.tenantId,
        session_id: sessionId,
        customer_email: params.customerEmail || null,
        customer_phone: params.customerPhone || null,
        source: params.source || 'widget',
        status: 'active',
        page_context: params.pageContext || null,
        created_at: now,
        updated_at: now,
      },
    });

    // Store greeting as first assistant message
    await prisma.bot_messages.create({
      data: {
        conversation_id: conversation.id,
        role: 'assistant',
        content: greeting,
        response_type: 'static',
        created_at: now,
      },
    });

    logger.info('[BotConversationService] Created conversation', undefined, {
      tenantId: params.tenantId,
      sessionId,
    });

    return { conversation: toConversation(conversation), greeting };
  }

  async getConversationBySession(sessionId: string): Promise<BotConversation | null> {
    const conv = await prisma.bot_conversations.findFirst({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
    });
    return conv ? toConversation(conv) : null;
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const conv = await this.getConversationBySession(sessionId);
    if (!conv || conv.status !== 'active') return false;
    const age = Date.now() - conv.createdAt.getTime();
    return age < SESSION_TTL_MS;
  }

  async appendMessage(params: {
    conversationId: string;
    role: string;
    content: string;
    intent?: string;
    confidence?: number;
    matchedFaqId?: string;
    responseType?: string;
    guardrailResult?: string;
    skillName?: string;
    metadata?: any;
  }): Promise<BotMessage> {
    const msg = await prisma.bot_messages.create({
      data: {
        conversation_id: params.conversationId,
        role: params.role,
        content: params.content,
        intent: params.intent || null,
        confidence: params.confidence || null,
        matched_faq_id: params.matchedFaqId || null,
        response_type: params.responseType || 'static',
        guardrail_result: params.guardrailResult || null,
        skill_name: params.skillName || null,
        metadata: params.metadata || null,
      },
    });

    // Update conversation's updated_at
    await prisma.bot_conversations.update({
      where: { id: params.conversationId },
      data: { updated_at: new Date() },
    });

    return toMessage(msg);
  }

  async getMessages(conversationId: string): Promise<BotMessage[]> {
    const messages = await prisma.bot_messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
    });
    return messages.map(toMessage);
  }

  /**
   * Get the last N messages for multi-turn context window.
   * Used by BotDynamicResponseService to provide conversation history to GPT.
   */
  async getContextWindow(conversationId: string, limit: number = 10): Promise<BotMessage[]> {
    const messages = await prisma.bot_messages.findMany({
      where: {
        conversation_id: conversationId,
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return messages.reverse().map(toMessage);
  }

  async closeConversation(conversationId: string, resolvedBy: string): Promise<void> {
    await prisma.bot_conversations.update({
      where: { id: conversationId },
      data: { status: 'closed', closed_at: new Date(), resolved_by: resolvedBy, updated_at: new Date() },
    });
  }

  async updateStatus(conversationId: string, status: 'active' | 'closed' | 'archived'): Promise<BotConversation> {
    const data: any = { status, updated_at: new Date() };
    if (status === 'closed') data.closed_at = new Date();
    if (status === 'active') data.closed_at = null;
    const updated = await prisma.bot_conversations.update({
      where: { id: conversationId },
      data,
    });
    return toConversation(updated);
  }

  async archiveExpiredConversations(tenantId: string): Promise<number> {
    const cutoff = new Date(Date.now() - SESSION_TTL_MS);
    const result = await prisma.bot_conversations.updateMany({
      where: {
        tenant_id: tenantId,
        status: 'active',
        created_at: { lt: cutoff },
      },
      data: { status: 'archived', updated_at: new Date() },
    });
    return result.count;
  }

  async listConversations(tenantId: string, options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<{ conversations: BotConversation[]; total: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };
    if (options.status) where.status = options.status;

    const [conversations, total] = await Promise.all([
      prisma.bot_conversations.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bot_conversations.count({ where }),
    ]);

    return {
      conversations: conversations.map(toConversation),
      total,
    };
  }

  async addFeedback(messageId: string, conversationId: string, rating: string): Promise<void> {
    await prisma.bot_conversation_feedback.create({
      data: {
        message_id: messageId,
        conversation_id: conversationId,
        rating,
      },
    });
  }

  async getDashboardStats(tenantId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    escalatedConversations: number;
    closedConversations: number;
    archivedConversations: number;
    resolvedByFaq: number;
    resolvedBySkill: number;
    resolvedByFallback: number;
    avgRating: number | null;
  }> {
    const pool = getDirectPool();
    const [convStats, feedbackStats] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'active')::text AS active,
          COUNT(*) FILTER (WHERE status = 'escalated')::text AS escalated,
          COUNT(*) FILTER (WHERE status = 'closed')::text AS closed,
          COUNT(*) FILTER (WHERE status = 'archived')::text AS archived,
          COUNT(*) FILTER (WHERE resolved_by = 'faq')::text AS faq_resolved,
          COUNT(*) FILTER (WHERE resolved_by = 'skill')::text AS skill_resolved,
          COUNT(*) FILTER (WHERE resolved_by = 'fallback')::text AS fallback_resolved
        FROM bot_conversations
        WHERE tenant_id = $1`,
        [tenantId]
      ),
      pool.query(
        `SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE rating = 'positive')::text AS positive
        FROM bot_conversation_feedback`
      ),
    ]);

    const conv = convStats.rows[0];
    const fb = feedbackStats.rows[0];
    const totalFeedback = parseInt(fb?.total ?? '0', 10);
    const positiveFeedback = parseInt(fb?.positive ?? '0', 10);

    return {
      totalConversations: parseInt(conv?.total ?? '0', 10),
      activeConversations: parseInt(conv?.active ?? '0', 10),
      escalatedConversations: parseInt(conv?.escalated ?? '0', 10),
      closedConversations: parseInt(conv?.closed ?? '0', 10),
      archivedConversations: parseInt(conv?.archived ?? '0', 10),
      resolvedByFaq: parseInt(conv?.faq_resolved ?? '0', 10),
      resolvedBySkill: parseInt(conv?.skill_resolved ?? '0', 10),
      resolvedByFallback: parseInt(conv?.fallback_resolved ?? '0', 10),
      avgRating: totalFeedback > 0 ? positiveFeedback / totalFeedback : null,
    };
  }

  /**
   * Archive conversations older than 90 days.
   * Called by a scheduled job or admin endpoint.
   */
  async archiveOldConversations(tenantId?: string): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const where: any = {
      status: { in: ['active', 'closed'] },
      created_at: { lt: cutoff },
    };
    if (tenantId) where.tenant_id = tenantId;

    const result = await prisma.bot_conversations.updateMany({
      where,
      data: { status: 'archived' },
    });

    logger.info('[BotConversationService] Archived old conversations', undefined, {
      count: result.count,
      tenantId: tenantId || 'all',
    });

    return result.count;
  }

  /**
   * Hard delete conversations older than 1 year.
   * Called by a scheduled job or admin endpoint.
   */
  async deleteOldConversations(tenantId?: string): Promise<number> {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const where: any = {
      created_at: { lt: cutoff },
    };
    if (tenantId) where.tenant_id = tenantId;

    // Delete associated messages and feedback first
    const oldConversations = await prisma.bot_conversations.findMany({
      where,
      select: { id: true },
    });

    const conversationIds = oldConversations.map(c => c.id);

    if (conversationIds.length === 0) return 0;

    await prisma.bot_conversation_feedback.deleteMany({
      where: { conversation_id: { in: conversationIds } },
    });
    await prisma.bot_messages.deleteMany({
      where: { conversation_id: { in: conversationIds } },
    });
    await prisma.bot_conversations.deleteMany({
      where: { id: { in: conversationIds } },
    });

    logger.info('[BotConversationService] Hard deleted old conversations', undefined, {
      count: conversationIds.length,
      tenantId: tenantId || 'all',
    });

    return conversationIds.length;
  }

  /**
   * GDPR right-to-erase: Delete all conversations and associated data
   * for a specific customer email or phone within a tenant.
   */
  async eraseCustomerData(tenantId: string, opts: { email?: string; phone?: string }): Promise<number> {
    const where: any = { tenant_id: tenantId };
    if (opts.email && opts.phone) {
      where.OR = [
        { customer_email: opts.email },
        { customer_phone: opts.phone },
      ];
    } else if (opts.email) {
      where.customer_email = opts.email;
    } else if (opts.phone) {
      where.customer_phone = opts.phone;
    } else {
      return 0;
    }

    const conversations = await prisma.bot_conversations.findMany({
      where,
      select: { id: true },
    });

    const conversationIds = conversations.map(c => c.id);

    if (conversationIds.length === 0) return 0;

    await prisma.bot_conversation_feedback.deleteMany({
      where: { conversation_id: { in: conversationIds } },
    });
    await prisma.bot_messages.deleteMany({
      where: { conversation_id: { in: conversationIds } },
    });
    await prisma.bot_conversations.deleteMany({
      where: { id: { in: conversationIds } },
    });

    logger.info('[BotConversationService] GDPR erase customer data', undefined, {
      tenantId,
      email: opts.email,
      phone: opts.phone,
      count: conversationIds.length,
    });

    return conversationIds.length;
  }
}

export default BotConversationService;
