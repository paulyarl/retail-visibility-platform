/**
 * CrmTaskMessageService — threaded task conversations
 * Mirrors CrmTicketMessageService pattern.
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmTaskMessageId } from '../lib/id-generator';

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
   * Add a message to a task
   */
  async create(data: {
    task_id: string;
    author_id: string;
    author_type: string; // platform | tenant | customer
    author_name: string;
    content: string;
    is_internal?: boolean;
  }) {
    return prisma.crm_task_messages.create({ data: { id: generateCrmTaskMessageId(), ...data } });
  }
}

export default CrmTaskMessageService;
