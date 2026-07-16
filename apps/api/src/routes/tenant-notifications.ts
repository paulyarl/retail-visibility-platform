/**
 * Tenant Notifications Routes
 * API endpoints for tenant-specific billing notifications
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../prisma';
import { logger } from '../logger';

const router = Router();

// Schema definitions
const notificationFiltersSchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(20),
  type: z.string().optional(),
  read: z.string().transform(val => val === 'true').optional(),
  severity: z.string().optional(),
});

const markAsReadSchema = z.object({
  read: z.boolean().default(true),
});

/**
 * GET /api/tenants/:tenantId/notifications
 * Get tenant notifications with filtering and pagination
 */
router.get('/:tenantId/notifications', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const filters = notificationFiltersSchema.parse(req.query);

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    // Note: 'sent' tracks delivery status, not user read status
    // For now, we treat all delivered notifications as "notifications"
    if (filters.read !== undefined) {
      // Map 'read' filter to 'sent' for compatibility
      where.sent = filters.read;
    }

    // Get pagination info - ensure take is a number
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    // Fetch notifications and count
    const [notifications, total] = await Promise.all([
      prisma.notification_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.notification_logs.count({ where }),
    ]);

    // Get count of notifications (using sent=true as proxy for "active" notifications)
    const unreadCount = await prisma.notification_logs.count({
      where: {
        tenant_id: tenantId,
        sent: true,
      },
    });

    // Transform to match expected format
    // console.log(`[TenantNotifications] Found ${notifications.length} notifications`);
    // console.log(`[TenantNotifications] Notifications:`, notifications);
    const transformedNotifications = notifications.map(log => ({
      id: log.id,
      type: log.type,
      title: generateNotificationTitle(log.type, log.metadata),
      message: generateNotificationMessage(log.type, log.metadata),
      severity: inferSeverity(log.type, log.sent, log.error_message),
      created_at: log.created_at?.toISOString() || new Date().toISOString(),
      read: log.sent, // Using 'sent' as proxy for "processed"
      action_url: generateActionUrl(log.type, log.metadata, tenantId),
      action_text: generateActionText(log.type),
      metadata: log.metadata,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      notifications: transformedNotifications,
      unread_count: unreadCount,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    logger.error('Error fetching tenant notifications:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/tenants/:tenantId/notifications/:notificationId/read
 * Mark notification as read (using sent field as proxy)
 */
router.patch('/:tenantId/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { tenantId, notificationId } = req.params;

    const notification = await prisma.notification_logs.findFirst({
      where: {
        id: notificationId,
        tenant_id: tenantId,
      },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Note: We're using 'sent' field as proxy since there's no 'read' field
    // In a real implementation, you'd add a 'read' field to the schema
    const updatedNotification = await prisma.notification_logs.update({
      where: { id: notificationId },
      data: { sent: true },
    });

    res.json({ success: true, notification: updatedNotification });
  } catch (error) {
    logger.error('Error marking notification as read:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PATCH /api/tenants/:tenantId/notifications/mark-all-read
 * Mark all notifications as read for tenant
 */
router.patch('/:tenantId/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Note: Using 'sent' as proxy for read status
    const result = await prisma.notification_logs.updateMany({
      where: {
        tenant_id: tenantId,
        sent: false,
      },
      data: { 
        sent: true,
      },
    });

    res.json({ 
      success: true, 
      updated_count: result.count 
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /api/tenants/:tenantId/notifications/:notificationId
 * Delete notification
 */
router.delete('/:tenantId/notifications/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { tenantId, notificationId } = req.params;

    const notification = await prisma.notification_logs.findFirst({
      where: {
        id: notificationId,
        tenant_id: tenantId,
      },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification_logs.delete({
      where: { id: notificationId },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting notification:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * GET /api/tenants/:tenantId/notifications/stats
 * Get notification statistics for tenant
 */
router.get('/:tenantId/notifications/stats', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const [total, sent, byType] = await Promise.all([
      prisma.notification_logs.count({
        where: { tenant_id: tenantId },
      }),
      prisma.notification_logs.count({
        where: { tenant_id: tenantId, sent: true },
      }),
      prisma.notification_logs.groupBy({
        by: ['type'],
        where: { tenant_id: tenantId },
        _count: { type: true },
      }),
    ]);

    const by_type = byType.reduce((acc, item) => {
      acc[item.type] = item._count.type;
      return acc;
    }, {} as Record<string, number>);

    // Infer severity from types
    const by_severity: Record<string, number> = {};
    byType.forEach(item => {
      const severity = inferSeverity(item.type, true, null);
      by_severity[severity] = (by_severity[severity] || 0) + item._count.type;
    });

    res.json({
      total,
      unread: total - sent,
      by_type,
      by_severity,
    });
  } catch (error) {
    logger.error('Error fetching notification stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

/**
 * GET /api/tenants/:tenantId/notifications/unread-count
 * Get unread count for tenant
 */
router.get('/:tenantId/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Count notifications that haven't been sent (as proxy for unread)
    const unreadCount = await prisma.notification_logs.count({
      where: {
        tenant_id: tenantId,
        sent: false,
      },
    });

    res.json({ count: unreadCount });
  } catch (error) {
    logger.error('Error fetching unread count:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Helper functions
function generateNotificationTitle(type: string, metadata: any): string {
  switch (type) {
    case 'payment_reminder':
      return 'Payment Due Soon';
    case 'payment_failed':
      return 'Payment Failed';
    case 'new_invoice':
      return 'New Invoice Available';
    case 'monthly_statement':
      return 'Monthly Statement Available';
    case 'risk_alert':
      return 'Payment Method Alert';
    case 'payment_success':
      return 'Payment Successful';
    case 'subscription_reactivated':
      return 'Subscription Reactivated';
    case 'tier_changed':
      return 'Subscription Tier Changed';
    case 'grace_period_warning':
      return 'Grace Period Warning';
    case 'order_placed':
      return 'New Order Placed';
    case 'order_cancelled':
      return 'Order Cancelled';
    default:
      return 'Notification';
  }
}

function generateNotificationMessage(type: string, metadata: any): string {
  switch (type) {
    case 'payment_reminder':
      return `Your monthly subscription payment of ${formatCurrency(metadata.amount)} is due in 3 days`;
    case 'payment_failed':
      return `Your payment of ${formatCurrency(metadata.amount)} failed. Please update your payment method.`;
    case 'new_invoice':
      return `Your monthly invoice is now available for download.`;
    case 'monthly_statement':
      return `Your monthly statement is now available.`;
    case 'risk_alert':
      if (metadata.reason === 'expiring_card') {
        return `Your payment method ending in ${metadata.last4} expires on ${metadata.expiry}.`;
      }
      return 'Action required on your payment method.';
    case 'payment_success':
      return `Your monthly subscription payment of ${formatCurrency(metadata.amount)} has been processed successfully.`;
    case 'subscription_reactivated':
      return `Your subscription has been reactivated successfully.`;
    case 'tier_changed':
      return `Your subscription has been changed to ${metadata.newTier}.`;
    case 'grace_period_warning':
      return `Your subscription will expire in ${metadata.daysLeft} days. Please update your payment method.`;
    case 'order_placed':
      return `New order #${metadata.orderNumber} for ${formatCurrency(metadata.amount)}.`;
    case 'order_cancelled':
      return `Order #${metadata.orderNumber} has been cancelled: ${metadata.reason}.`;
    default:
      return 'You have a new notification.';
  }
}

function generateActionUrl(type: string, metadata: any, tenantId: string): string | undefined {
  switch (type) {
    case 'payment_reminder':
    case 'payment_failed':
    case 'risk_alert':
    case 'grace_period_warning':
    case 'grace_period_final':
      return `/t/${tenantId}/settings/billing/payment-methods`;
    case 'new_invoice':
    case 'monthly_statement':
      return `/t/${tenantId}/settings/billing/invoices`;
    case 'order_placed':
    case 'order_cancelled':
      return `/t/${tenantId}/orders`;
    default:
      return undefined;
  }
}

function generateActionText(type: string): string | undefined {
  switch (type) {
    case 'payment_reminder':
    case 'payment_failed':
    case 'grace_period_warning':
    case 'grace_period_final':
      return 'Update Payment Method';
    case 'risk_alert':
      return 'Update Card';
    case 'new_invoice':
      return 'View Invoice';
    case 'monthly_statement':
      return 'View Statement';
    case 'order_placed':
    case 'order_cancelled':
      return 'View Orders';
    default:
      return undefined;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function inferSeverity(type: string, sent: boolean, errorMessage: string | null): 'info' | 'warning' | 'error' | 'success' {
  // If there's an error message, it's an error
  if (errorMessage) return 'error';
  
  // Map notification types to severity
  switch (type) {
    case 'payment_failed':
      return 'error';
    case 'payment_reminder':
    case 'grace_period_warning':
    case 'risk_alert':
      return 'warning';
    case 'payment_success':
    case 'subscription_reactivated':
      return 'success';
    case 'order_placed':
    case 'order_cancelled':
    case 'new_invoice':
    case 'monthly_statement':
    case 'tier_changed':
    default:
      return 'info';
  }
}

export default router;
