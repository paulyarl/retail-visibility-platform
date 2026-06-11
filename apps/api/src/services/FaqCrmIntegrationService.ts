/**
 * FAQ-CRM Integration Service
 *
 * Bridges FAQ knowledge base with CRM support tickets:
 * - Search relevant FAQs for ticket deflection
 * - Create tickets from FAQ negative feedback
 * - Track FAQ-ticket linkage
 */

import { prisma } from '../prisma';
import { v4 as uuidv4 } from 'uuid';

export interface FaqSuggestion {
  id: string;
  question: string;
  answer: string;
  category_name?: string;
  relevance: number;
}

export interface CreateTicketFromFeedbackInput {
  tenant_id: string;
  faq_id: string;
  customer_id?: string;
  title?: string;
  description?: string;
  email?: string;
  source?: string;
}

class FaqCrmIntegrationService {
  private static instance: FaqCrmIntegrationService;

  private constructor() {}

  static getInstance(): FaqCrmIntegrationService {
    if (!FaqCrmIntegrationService.instance) {
      FaqCrmIntegrationService.instance = new FaqCrmIntegrationService();
    }
    return FaqCrmIntegrationService.instance;
  }

  /**
   * Search active storefront FAQs relevant to a customer query.
   * Returns up to `limit` results ordered by text match relevance.
   */
  async searchRelevantFAQs(tenantId: string, query: string, limit: number = 5): Promise<FaqSuggestion[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const words = normalized.split(/\s+/).filter(w => w.length > 2);

    const faqs = await prisma.faqs.findMany({
      where: {
        tenant_id: tenantId,
        scope: 'storefront',
        status: 'active',
      },
      include: {
        faq_categories: { select: { name: true } },
      },
      orderBy: { display_order: 'asc' },
      take: 100,
    });

    // Simple relevance scoring
    const scored = faqs.map(faq => {
      const q = faq.question.toLowerCase();
      const a = faq.answer.toLowerCase();
      const tags = (faq.tags || []).map(t => t.toLowerCase());

      let relevance = 0;
      for (const word of words) {
        if (q.includes(word)) relevance += 3;
        if (a.includes(word)) relevance += 1;
        if (tags.some(t => t.includes(word))) relevance += 2;
      }
      // Exact substring match bonus
      if (q.includes(normalized)) relevance += 10;
      if (a.includes(normalized)) relevance += 5;

      return {
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category_name: faq.faq_categories?.name,
        relevance,
      };
    });

    return scored
      .filter(s => s.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Create a support ticket from FAQ negative feedback.
   * Links the ticket to the originating FAQ for analytics.
   */
  async createTicketFromFeedback(input: CreateTicketFromFeedbackInput) {
    const { tenant_id, faq_id, customer_id, title, description, email, source } = input;

    // Verify FAQ exists and is active
    const faq = await prisma.faqs.findFirst({
      where: { id: faq_id, tenant_id, status: 'active' },
    });

    if (!faq) {
      throw new Error('FAQ not found or not active');
    }

    const ticketTitle = title || `Question about: ${faq.question}`;
    const ticketDescription = description || `Customer needs more help after viewing FAQ: "${faq.question}"`;

    const ticket = await prisma.crm_support_tickets.create({
      data: {
        id: uuidv4(),
        tenant_id,
        customer_id: customer_id || null,
        title: ticketTitle.slice(0, 255),
        description: ticketDescription,
        status: 'open',
        priority: 'medium',
        category: 'faq_feedback',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create an initial message with context
    await prisma.crm_ticket_messages.create({
      data: {
        id: uuidv4(),
        ticket_id: ticket.id,
        author_id: customer_id || 'unknown',
        author_type: 'customer',
        author_name: email || 'Customer',
        content: `Customer viewed FAQ: "${faq.question}" and indicated they still need help.\n\n${description || ''}`,
        created_at: new Date(),
      },
    });

    // Log activity
    await prisma.crm_activities.create({
      data: {
        id: uuidv4(),
        tenant_id,
        ticket_id: ticket.id,
        actor_id: customer_id || 'unknown',
        actor_type: 'customer',
        actor_name: email || 'Customer',
        activity_type: 'note',
        content: `Ticket created from FAQ feedback: ${faq.question}`,
        metadata: { faq_id, source: source || 'faq_feedback' },
        created_at: new Date(),
      },
    });

    return ticket;
  }

  /**
   * Get FAQ linked to a given ticket.
   */
  async getLinkedFAQ(ticketId: string) {
    // FAQ link is now stored in crm_activities metadata (direct relation removed)
    const activities = await prisma.crm_activities.findMany({
      where: {
        ticket_id: ticketId,
        activity_type: 'note',
      },
      select: {
        metadata: true,
      },
      orderBy: { created_at: 'asc' },
    });
    const faqId = activities.find(a => !!(a.metadata as any)?.faq_id)?.metadata as any;
    if (!faqId?.faq_id) return null;
    const faq = await prisma.faqs.findUnique({
      where: { id: faqId.faq_id },
      select: {
        id: true,
        question: true,
        answer: true,
        status: true,
      },
    });
    return faq;
  }
}

export default FaqCrmIntegrationService;
