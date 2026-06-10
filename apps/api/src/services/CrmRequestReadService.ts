/**
 * CrmRequestReadService — per-user read state management for Requests Hub
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmRequestReadId } from '../lib/id-generator';

export class CrmRequestReadService extends BaseService {
  private static instance: CrmRequestReadService;

  private constructor() { super(); }

  static getInstance(): CrmRequestReadService {
    if (!CrmRequestReadService.instance) {
      CrmRequestReadService.instance = new CrmRequestReadService();
    }
    return CrmRequestReadService.instance;
  }

  /**
   * Mark a single request as read
   */
  async markRead(userId: string, requestId: string, requestType: string) {
    return prisma.crm_request_reads.upsert({
      where: {
        user_id_request_id_request_type: {
          user_id: userId,
          request_id: requestId,
          request_type: requestType,
        },
      },
      update: { read_at: new Date() },
      create: {
        id: generateCrmRequestReadId(),
        user_id: userId,
        request_id: requestId,
        request_type: requestType,
        read_at: new Date(),
      },
    });
  }

  /**
   * Bulk mark all open requests as read for a user
   */
  async markAllRead(userId: string, requestIds: Array<{ id: string; type: string }>) {
    const operations = requestIds.map(r =>
      prisma.crm_request_reads.upsert({
        where: {
          user_id_request_id_request_type: {
            user_id: userId,
            request_id: r.id,
            request_type: r.type,
          },
        },
        update: { read_at: new Date() },
        create: {
          id: generateCrmRequestReadId(),
          user_id: userId,
          request_id: r.id,
          request_type: r.type,
          read_at: new Date(),
        },
      })
    );
    return Promise.all(operations);
  }

  /**
   * Get read state for a set of requests (returns Set of read request IDs)
   */
  async getReadStates(userId: string): Promise<Set<string>> {
    const reads = await prisma.crm_request_reads.findMany({
      where: { user_id: userId },
      select: { request_id: true },
    });
    return new Set(reads.map(r => r.request_id));
  }

  /**
   * Check if a specific request is read
   */
  async isRead(userId: string, requestId: string, requestType: string): Promise<boolean> {
    const read = await prisma.crm_request_reads.findUnique({
      where: {
        user_id_request_id_request_type: {
          user_id: userId,
          request_id: requestId,
          request_type: requestType,
        },
      },
    });
    return !!read;
  }
}

export default CrmRequestReadService;
