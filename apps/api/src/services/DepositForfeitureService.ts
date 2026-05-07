/**
 * Deposit Forfeiture Service
 * 
 * Handles abandonment tracking and fee distribution for Tier 3 commitment orders:
 * - Checks for expired pickup deadlines
 * - Marks deposits as forfeited
 * - Distributes fees (platform 20-25%, retailer 75-80%)
 * - Releases reserved inventory
 */

import { prisma } from '../prisma';
import { calculateForfeiture, isEligibleForForfeiture } from '../utils/deposit-calculator';

export class DepositForfeitureService {
  /**
   * Process all eligible deposit forfeitures
   * Called by scheduled job (cron)
   */
  async processForfeitures(): Promise<{
    processed: number;
    failed: number;
    totalPlatformFees: number;
    totalRetailerCompensation: number;
  }> {
    console.log('[DepositForfeitureService] Starting forfeiture processing...');
    
    const result = {
      processed: 0,
      failed: 0,
      totalPlatformFees: 0,
      totalRetailerCompensation: 0,
    };

    try {
      // Find all orders with expired pickup deadlines that haven't been forfeited
      const eligibleOrders = await prisma.orders.findMany({
        where: {
          checkout_mode: 'deposit',
          payment_status: 'paid',
          fulfillment_status: 'unfulfilled',
          deposit_forfeited_at: null,
          pickup_deadline: {
            lt: new Date(), // Deadline has passed
          },
          cancelled_at: null,
        },
        include: {
          payments: {
            where: {
              is_deposit_payment: true,
              deposit_forfeited: false,
            },
          },
        },
      });

      console.log(`[DepositForfeitureService] Found ${eligibleOrders.length} eligible orders`);

      for (const order of eligibleOrders) {
        try {
          const forfeiture = await this.processForfeiture(order.id);
          
          if (forfeiture) {
            result.processed++;
            result.totalPlatformFees += forfeiture.platformFeeCents;
            result.totalRetailerCompensation += forfeiture.retailerCompensationCents;
          }
        } catch (error) {
          console.error(`[DepositForfeitureService] Failed to process order ${order.id}:`, error);
          result.failed++;
        }
      }

      console.log('[DepositForfeitureService] Forfeiture processing complete:', result);
      return result;
    } catch (error) {
      console.error('[DepositForfeitureService] Error in forfeiture processing:', error);
      throw error;
    }
  }

  /**
   * Process forfeiture for a single order
   */
  async processForfeiture(orderId: string): Promise<{
    depositCents: number;
    platformFeeCents: number;
    retailerCompensationCents: number;
  } | null> {
    console.log(`[DepositForfeitureService] Processing forfeiture for order ${orderId}`);

    // Get order with payment details
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            is_deposit_payment: true,
          },
        },
      },
    });

    if (!order) {
      console.error(`[DepositForfeitureService] Order ${orderId} not found`);
      return null;
    }

    // Validate eligibility
    if (!order.pickup_deadline || !isEligibleForForfeiture(order.pickup_deadline, order.fulfilled_at, order.cancelled_at)) {
      console.log(`[DepositForfeitureService] Order ${orderId} not eligible for forfeiture`);
      return null;
    }

    const depositPayment = order.payments[0];
    if (!depositPayment) {
      console.error(`[DepositForfeitureService] No deposit payment found for order ${orderId}`);
      return null;
    }

    const depositCents = depositPayment.amount_cents;

    // Calculate forfeiture distribution
    const forfeiture = calculateForfeiture(depositCents);

    // Use transaction to update order, payment, and inventory
    await prisma.$transaction(async (tx) => {
      // Update order
      await tx.orders.update({
        where: { id: orderId },
        data: {
          deposit_forfeited_at: forfeiture.forfeitedAt,
          order_status: 'cancelled',
          cancelled_at: forfeiture.forfeitedAt,
          internal_notes: `Deposit forfeited due to non-pickup. Platform fee: $${(forfeiture.platformFeeCents / 100).toFixed(2)}, Retailer compensation: $${(forfeiture.retailerCompensationCents / 100).toFixed(2)}`,
        },
      });

      // Update payment
      await tx.payments.update({
        where: { id: depositPayment.id },
        data: {
          deposit_forfeited: true,
          forfeited_at: forfeiture.forfeitedAt,
          platform_forfeit_fee_cents: forfeiture.platformFeeCents,
          retailer_forfeit_amount_cents: forfeiture.retailerCompensationCents,
        },
      });

      // Release reserved inventory
      const orderItems = await tx.order_items.findMany({
        where: { order_id: orderId },
      });

      for (const item of orderItems) {
        if (item.inventory_item_id) {
          await tx.inventory_items.update({
            where: { id: item.inventory_item_id },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      // Create audit log entry
      await tx.audit_log.create({
        data: {
          id: `audit_${orderId}_${Date.now()}`,
          tenant_id: order.tenant_id,
          actor_id: 'system',
          actor_type: 'system',
          entity_id: orderId,
          entity_type: 'other', // Using 'other' since 'order' is not in enum
          action: 'update', // Using 'update' since 'deposit_forfeited' is not in enum
          diff: {
            action: 'deposit_forfeited',
            depositCents,
            platformFeeCents: forfeiture.platformFeeCents,
            retailerCompensationCents: forfeiture.retailerCompensationCents,
            forfeitedAt: forfeiture.forfeitedAt,
          },
        },
      });
    });

    console.log(`[DepositForfeitureService] Forfeiture processed for order ${orderId}:`, forfeiture);
    
    return forfeiture;
  }

  /**
   * Get forfeiture statistics for a tenant
   */
  async getForfeitureStats(tenantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalForfeitures: number;
    totalDepositAmount: number;
    totalPlatformFees: number;
    totalRetailerCompensation: number;
    averageDepositPercentage: number;
  }> {
    const where: any = {
      tenant_id: tenantId,
      checkout_mode: 'deposit',
      deposit_forfeited_at: { not: null },
    };

    if (startDate || endDate) {
      where.deposit_forfeited_at = {};
      if (startDate) where.deposit_forfeited_at.gte = startDate;
      if (endDate) where.deposit_forfeited_at.lte = endDate;
    }

    const forfeitedOrders = await prisma.orders.findMany({
      where,
      include: {
        payments: {
          where: { is_deposit_payment: true },
        },
      },
    });

    const stats = {
      totalForfeitures: forfeitedOrders.length,
      totalDepositAmount: 0,
      totalPlatformFees: 0,
      totalRetailerCompensation: 0,
      averageDepositPercentage: 0,
    };

    for (const order of forfeitedOrders) {
      const payment = order.payments[0];
      if (payment) {
        stats.totalDepositAmount += payment.amount_cents;
        stats.totalPlatformFees += payment.platform_forfeit_fee_cents || 0;
        stats.totalRetailerCompensation += payment.retailer_forfeit_amount_cents || 0;
        stats.averageDepositPercentage += Number(payment.deposit_percentage || 0);
      }
    }

    if (stats.totalForfeitures > 0) {
      stats.averageDepositPercentage = stats.averageDepositPercentage / stats.totalForfeitures;
    }

    return stats;
  }

  /**
   * Check if an order is approaching pickup deadline
   * Returns hours remaining or null if not applicable
   */
  async getPickupDeadlineStatus(orderId: string): Promise<{
    hasDeadline: boolean;
    deadline?: Date;
    hoursRemaining?: number;
    isExpired: boolean;
    isForfeited: boolean;
  }> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        checkout_mode: true,
        pickup_deadline: true,
        deposit_forfeited_at: true,
        fulfilled_at: true,
        cancelled_at: true,
      },
    });

    if (!order || order.checkout_mode !== 'deposit') {
      return { hasDeadline: false, isExpired: false, isForfeited: false };
    }

    const now = new Date();
    const deadline = order.pickup_deadline;
    const isExpired = deadline ? now > deadline : false;
    const isForfeited = !!order.deposit_forfeited_at;

    let hoursRemaining: number | undefined;
    if (deadline && !isExpired) {
      const diff = deadline.getTime() - now.getTime();
      hoursRemaining = Math.round(diff / (1000 * 60 * 60));
    }

    return {
      hasDeadline: !!deadline,
      deadline: deadline || undefined,
      hoursRemaining,
      isExpired,
      isForfeited,
    };
  }
}

export const depositForfeitureService = new DepositForfeitureService();
