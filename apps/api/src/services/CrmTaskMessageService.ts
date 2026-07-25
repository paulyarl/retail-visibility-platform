/**
 * CrmTaskMessageService — threaded task conversations
 * Mirrors CrmTicketMessageService pattern.
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmTaskMessageId } from '../lib/id-generator';
import { validateContentBlocks, contentBlocksToPlainText } from '../lib/contentBlocks';

export class CrmTaskMessageService extends BaseService {
  private static instance: CrmTaskMessageService;

  private constructor() { super(); }

  static getInstance(): CrmTaskMessageService {
    if (!CrmTaskMessageService.instance) {
      CrmTaskMessageService.instance = new CrmTaskMessageService();
    }
    return CrmTaskMessageService.instance;
  }

  /**
   * List messages for a task, optionally filtering internal notes
   */
  async listByTask(taskId: string, showInternal: boolean = true) {
    const where: any = { task_id: taskId };
    if (!showInternal) {
      where.is_internal = false;
    }
    return prisma.crm_task_messages.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Update an existing task message (only content_blocks / content is mutable)
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

    return prisma.crm_task_messages.update({
      where: { id: messageId },
      data: {
        content_blocks: contentBlocks as any,
        content,
      },
    });
  }

  /**
   * Add a message to a task
   */
  async create(data: {
    task_id: string;
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

    return prisma.crm_task_messages.create({
      data: {
        id: generateCrmTaskMessageId(),
        task_id: data.task_id,
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

export default CrmTaskMessageService;
