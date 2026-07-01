/**
 * ReturnRequestService — Customer returns portal
 * Phase 4B: Customer Returns Portal
 *
 * Manages return requests for orders, including:
 * - Customer-initiated return requests
 * - Merchant review (approve/reject)
 * - Refund tracking
 */

import { BaseService } from './BaseService';
import { generateReturnRequestId } from '../lib/id-generator';
import { logger } from '../logger';

export interface ReturnRequestInput {
  tenantId: string;
  orderId: string;
  customerEmail: string;
  customerName?: string;
  reason: string;
  reasonDetail?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price_cents: number;
  }>;
  customerNotes?: string;
}

class ReturnRequestService extends BaseService {
  private static instance: ReturnRequestService;

  private constructor() {
    super();
  }

  static getInstance(): ReturnRequestService {
    if (!ReturnRequestService.instance) {
      ReturnRequestService.instance = new ReturnRequestService();
    }
    return ReturnRequestService.instance;
  }

  /**
   * Create a return request
   */
  async createRequest(input: ReturnRequestInput) {
    try {
      const order = await this.prisma.orders.findFirst({
        where: { id: input.orderId, tenant_id: input.tenantId },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      const refundAmountCents = input.items.reduce(
        (sum, item) => sum + item.price_cents * item.quantity,
        0
      );

      const id = generateReturnRequestId(input.tenantId);

      return await this.prisma.return_requests.create({
        data: {
          id,
          tenant_id: input.tenantId,
          order_id: input.orderId,
          customer_email: input.customerEmail,
          customer_name: input.customerName || null,
          reason: input.reason,
          reason_detail: input.reasonDetail || null,
          items: input.items as any,
          refund_amount_cents: refundAmountCents,
          customer_notes: input.customerNotes || null,
        },
      });
    } catch (error) {
      logger.warn('ReturnRequestService.createRequest failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get return requests for a tenant (merchant view)
   */
  async getRequests(
    tenantId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { tenant_id: tenantId };
    if (options?.status) where.status = options.status;

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [requests, total] = await Promise.all([
      this.prisma.return_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.return_requests.count({ where }),
    ]);

    return { requests, total };
  }

  /**
   * Get a single return request
   */
  async getRequest(tenantId: string, requestId: string) {
    return await this.prisma.return_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });
  }

  /**
   * Approve a return request
   */
  async approveRequest(tenantId: string, requestId: string, approvedBy: string, adminNotes?: string) {
    return await this.prisma.return_requests.updateMany({
      where: { id: requestId, tenant_id: tenantId, status: 'requested' },
      data: {
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date(),
        admin_notes: adminNotes || null,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Reject a return request
   */
  async rejectRequest(tenantId: string, requestId: string, adminNotes?: string) {
    return await this.prisma.return_requests.updateMany({
      where: { id: requestId, tenant_id: tenantId, status: 'requested' },
      data: {
        status: 'rejected',
        rejected_at: new Date(),
        admin_notes: adminNotes || null,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Mark a return as completed (refund processed)
   */
  async completeRequest(tenantId: string, requestId: string) {
    return await this.prisma.return_requests.updateMany({
      where: { id: requestId, tenant_id: tenantId, status: 'approved' },
      data: {
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get return requests for a specific order (customer lookup)
   */
  async getRequestsByOrder(tenantId: string, orderId: string) {
    return await this.prisma.return_requests.findMany({
      where: { tenant_id: tenantId, order_id: orderId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get summary stats for a tenant
   */
  async getSummary(tenantId: string) {
    const [requested, approved, rejected, completed] = await Promise.all([
      this.prisma.return_requests.count({ where: { tenant_id: tenantId, status: 'requested' } }),
      this.prisma.return_requests.count({ where: { tenant_id: tenantId, status: 'approved' } }),
      this.prisma.return_requests.count({ where: { tenant_id: tenantId, status: 'rejected' } }),
      this.prisma.return_requests.count({ where: { tenant_id: tenantId, status: 'completed' } }),
    ]);

    const totalRefundCents = await this.prisma.return_requests.aggregate({
      where: { tenant_id: tenantId, status: 'completed' },
      _sum: { refund_amount_cents: true },
    });

    return {
      requested,
      approved,
      rejected,
      completed,
      total: requested + approved + rejected + completed,
      totalRefundCents: totalRefundCents._sum.refund_amount_cents || 0,
    };
  }
}

export const returnRequestService = ReturnRequestService.getInstance();
export default ReturnRequestService;
