/**
 * Bot CRM Integration Service
 *
 * Bridges bot conversations with CRM support tickets:
 * - Escalations from bot conversations create CRM tickets
 * - Links tickets to originating conversation for analytics
 * - Creates initial ticket message with conversation context
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

export interface EscalationInput {
  tenantId: string;
  conversationId: string;
  sessionId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  reason: string;
  summary: string;
}

export interface EscalationResult {
  ticketId: string;
  ticketTitle: string;
}

class BotCrmIntegrationService {
  private static instance: BotCrmIntegrationService;

  private constructor() {}

  static getInstance(): BotCrmIntegrationService {
    if (!BotCrmIntegrationService.instance) {
      BotCrmIntegrationService.instance = new BotCrmIntegrationService();
    }
    return BotCrmIntegrationService.instance;
  }

  /**
   * Create a CRM support ticket from a bot conversation escalation.
   * Includes recent conversation messages as context.
   */
  async escalateToTicket(input: EscalationInput): Promise<EscalationResult> {
    const { tenantId, conversationId, sessionId, customerEmail, customerPhone, reason, summary } = input;

    // Fetch recent messages for context (last 10)
    const recentMessages = await prisma.bot_messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const messageLog = recentMessages
      .reverse()
      .map(m => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`)
      .join('\n');

    const ticketTitle = `Bot escalation: ${reason}`.slice(0, 255);
    const ticketDescription = `${summary}\n\n--- Conversation Log ---\n${messageLog}`;

    const ticket = await prisma.crm_support_tickets.create({
      data: {
        id: uuidv4(),
        tenant_id: tenantId,
        title: ticketTitle,
        description: ticketDescription,
        status: 'open',
        priority: 'medium',
        category: 'bot_escalation',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create initial message with conversation context
    await prisma.crm_ticket_messages.create({
      data: {
        id: uuidv4(),
        ticket_id: ticket.id,
        author_id: customerEmail || 'anonymous',
        author_type: 'customer',
        author_name: customerEmail || customerPhone || 'Chatbot User',
        content: `Escalated from chatbot conversation (Session: ${sessionId})\n\nReason: ${reason}\n\n${summary}\n\n--- Conversation Log ---\n${messageLog}`,
        created_at: new Date(),
      },
    });

    // Log activity
    await prisma.crm_activities.create({
      data: {
        id: uuidv4(),
        tenant_id: tenantId,
        ticket_id: ticket.id,
        actor_id: 'bot_system',
        actor_type: 'system',
        actor_name: 'Chatbot',
        activity_type: 'note',
        content: `Ticket created from bot escalation: ${reason}`,
        metadata: {
          conversation_id: conversationId,
          session_id: sessionId,
          source: 'bot_escalation',
        },
        created_at: new Date(),
      },
    });

    // Mark conversation as escalated
    await prisma.bot_conversations.update({
      where: { id: conversationId },
      data: {
        resolved_by: 'escalated',
        status: 'escalated',
        closed_at: new Date(),
      },
    });

    logger.info('[BotCrmIntegration] Escalated to ticket', undefined, {
      tenantId,
      conversationId,
      ticketId: ticket.id,
    });

    return { ticketId: ticket.id, ticketTitle };
  }

  /**
   * Check if a conversation has already been escalated.
   */
  async isEscalated(conversationId: string): Promise<boolean> {
    const conv = await prisma.bot_conversations.findUnique({
      where: { id: conversationId },
      select: { status: true },
    });
    return conv?.status === 'escalated';
  }
}

export default BotCrmIntegrationService;
