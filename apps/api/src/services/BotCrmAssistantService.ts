/**
 * Bot CRM Assistant Service
 *
 * BSaaS skill that bridges bot conversations with the CRM system:
 * - Look up open support tickets by customer email
 * - Create support tickets from bot conversations
 * - Check inquiry status
 * - Format ticket data for GPT prompt injection
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

export interface TicketSummary {
  ticket_id: string;
  title: string;
  status: string;
  priority: string;
  last_updated: string;
}

export interface TicketCreatedResult {
  ticket_id: string;
  title: string;
  status: string;
  estimated_response: string;
}

export interface InquirySummary {
  inquiry_id: string;
  subject: string;
  status: string;
  created_at: string;
}

class BotCrmAssistantService {
  private static instance: BotCrmAssistantService;

  private constructor() {}

  static getInstance(): BotCrmAssistantService {
    if (!BotCrmAssistantService.instance) {
      BotCrmAssistantService.instance = new BotCrmAssistantService();
    }
    return BotCrmAssistantService.instance;
  }

  /**
   * Look up open support tickets for a customer by email.
   */
  async lookupTickets(tenantId: string, customerEmail: string): Promise<TicketSummary[]> {
    const tickets = await prisma.crm_support_tickets.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['open', 'in_progress', 'waiting'] },
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updated_at: true,
      },
    });

    return tickets.map(t => ({
      ticket_id: t.id,
      title: t.title,
      status: t.status ?? 'unknown',
      priority: t.priority ?? 'unknown',
      last_updated: t.updated_at ? t.updated_at.toISOString() : new Date().toISOString(),
    }));
  }

  /**
   * Create a support ticket from a bot conversation.
   * Includes recent conversation messages as context.
   */
  async createTicket(
    tenantId: string,
    conversationId: string,
    sessionId: string,
    customerEmail: string | null,
    issueSummary: string
  ): Promise<TicketCreatedResult> {
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

    const ticketTitle = `Bot chat: ${issueSummary}`.slice(0, 255);
    const ticketDescription = `${issueSummary}\n\n--- Conversation Log ---\n${messageLog}`;

    const ticket = await prisma.crm_support_tickets.create({
      data: {
        id: uuidv4(),
        tenant_id: tenantId,
        title: ticketTitle,
        description: ticketDescription,
        status: 'open',
        priority: 'medium',
        category: 'bot_chat',
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
        author_name: customerEmail || 'Chatbot User',
        content: `Created from chatbot conversation (Session: ${sessionId})\n\n${issueSummary}\n\n--- Conversation Log ---\n${messageLog}`,
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
        content: `Ticket created from bot chat: ${issueSummary}`,
        metadata: {
          conversation_id: conversationId,
          session_id: sessionId,
          source: 'bot_crm_assistant',
        },
        created_at: new Date(),
      },
    });

    logger.info('[BotCrmAssistant] Created ticket from chat', undefined, {
      tenantId,
      conversationId,
      ticketId: ticket.id,
    });

    return {
      ticket_id: ticket.id,
      title: ticketTitle,
      status: 'open',
      estimated_response: 'Within 24 hours',
    };
  }

  /**
   * Look up inquiry status by sender email.
   */
  async lookupInquiries(tenantId: string, senderEmail: string): Promise<InquirySummary[]> {
    const inquiries = await prisma.crm_inquiries.findMany({
      where: {
        tenant_id: tenantId,
        sender_email: senderEmail,
      },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        id: true,
        subject: true,
        status: true,
        created_at: true,
      },
    });

    return inquiries.map(i => ({
      inquiry_id: i.id,
      subject: i.subject,
      status: i.status ?? 'unknown',
      created_at: i.created_at ? i.created_at.toISOString() : new Date().toISOString(),
    }));
  }

  /**
   * Format ticket data for GPT prompt injection.
   */
  formatTicketContext(tickets: TicketSummary[]): string {
    if (tickets.length === 0) return '';

    const lines = tickets.map((t, i) =>
      `${i + 1}. Ticket ${t.ticket_id.slice(0, 8)} — ${t.title} (Status: ${t.status}, Priority: ${t.priority}, Updated: ${t.last_updated})`
    );

    return '\n\nOpen support tickets for this customer:\n' + lines.join('\n');
  }

  /**
   * Format ticket creation confirmation for card display.
   */
  formatTicketCreatedConfirmation(ticket: TicketCreatedResult): Record<string, any> {
    return {
      ticket_id: ticket.ticket_id,
      title: ticket.title,
      status: ticket.status,
      estimated_response: ticket.estimated_response,
    };
  }
}

export default BotCrmAssistantService;
