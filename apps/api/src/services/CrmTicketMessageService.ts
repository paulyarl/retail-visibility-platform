/**
 * CrmTicketMessageService — structured ticket conversations
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmTicketMessageId } from '../lib/id-generator';
import { validateContentBlocks, contentBlocksToPlainText } from '../lib/contentBlocks';

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
   * Update an existing ticket message (only content_blocks / content is mutable)
   */
  async update(messageId: string, data: { content_blocks?: unknown }) {
    let contentBlocks: any = undefined;
    let content = '';

    if (data.content_blocks) {
      const parsed = validateContentBlocks(data.content_blocks);
      if (!parsed) {
        throw new Error('Invalid content_blocks');
      }
      content = contentBlocksToPlainText(parsed);
      contentBlocks = parsed;
    }

    return prisma.crm_ticket_messages.update({
      where: { id: messageId },
      data: {
        content_blocks: contentBlocks as any,
        content,
      },
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
    content?: string;
    content_blocks?: unknown;
    is_internal?: boolean;
  }) {
    const isInternal = data.is_internal ?? false;
    let content = data.content ?? '';
    let contentBlocks: any = undefined;

    if (!isInternal && data.content_blocks) {
      const parsed = validateContentBlocks(data.content_blocks);
      if (!parsed) {
        throw new Error('Invalid content_blocks');
      }
      content = contentBlocksToPlainText(parsed);
      contentBlocks = parsed;
    }

    return prisma.crm_ticket_messages.create({
      data: {
        id: generateCrmTicketMessageId(),
        ticket_id: data.ticket_id,
        author_id: data.author_id,
        author_type: data.author_type,
        author_name: data.author_name,
        content,
        content_blocks: contentBlocks as any,
        is_internal: isInternal,
      },
    });
  }
}

export default CrmTicketMessageService;
