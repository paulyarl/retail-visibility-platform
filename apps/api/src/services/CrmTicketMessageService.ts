/**
 * CrmTicketMessageService — structured ticket conversations
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmTicketMessageId } from '../lib/id-generator';

export class CrmTicketMessageService extends BaseService {
  private static instance: CrmTicketMessageService;

  private constructor() { super(); }

  static getInstance(): CrmTicketMessageService {
    if (!CrmTicketMessageService.instance) {
      CrmTicketMessageService.instance = new CrmTicketMessageService();
    }
    return CrmTicketMessageService.instance;
  }

  /**
   * List messages for a ticket, optionally filtering internal notes for customer view
   */
  async listByTicket(ticketId: string, showInternal: boolean = true) {
    const where: any = { ticket_id: ticketId };
    if (!showInternal) {
      where.is_internal = false;
    }
    return prisma.crm_ticket_messages.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Add a message to a ticket
   */
  async create(data: {
    ticket_id: string;
    author_id: string;
    author_type: string; // platform | tenant | customer
    author_name: string;
    content: string;
    is_internal?: boolean;
  }) {
    return prisma.crm_ticket_messages.create({ data: { id: generateCrmTicketMessageId(), ...data } });
  }
}

export default CrmTicketMessageService;
