import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Get all security alerts with pagination and stats
router.get('/alerts', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;

    // Get alerts with user info
    const alerts = await prisma.security_alerts.findMany({
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // Format for frontend
    const formattedAlerts = alerts.map((alert) => ({
      id: alert.id,
      userId: alert.user_id,
      userEmail: alert.user_email || alert.users?.email,
      userFirstName: alert.user_first_name || alert.users?.first_name,
      userLastName: alert.user_last_name || alert.users?.last_name,
      type: alert.type,
      severity: alert.severity as 'info' | 'warning' | 'critical',
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      read: alert.read,
      createdAt: alert.created_at.toISOString(),
      readAt: alert.read_at?.toISOString(),
    }));

    res.json({
      data: formattedAlerts,
      total: await prisma.security_alerts.count(),
    });
  } catch (error) {
    console.error('Failed to fetch security alerts:', error);
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

// Get security alerts stats
router.get('/alerts/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalAlerts, unreadAlerts, alertsLast24h, criticalAlerts, warningAlerts] = await Promise.all([
      prisma.security_alerts.count(),
      prisma.security_alerts.count({ where: { read: false } }),
      prisma.security_alerts.count({ where: { created_at: { gte: last24h } } }),
      prisma.security_alerts.count({ where: { severity: 'critical' } }),
      prisma.security_alerts.count({ where: { severity: 'warning' } }),
    ]);

    // Get type breakdown
    const typeBreakdown = await prisma.security_alerts.groupBy({
      by: ['type'],
      _count: { type: true },
      orderBy: { _count: { type: 'desc' } },
    });

    res.json({
      totalAlerts,
      unreadAlerts,
      alertsLast24h,
      criticalAlerts,
      warningAlerts,
      typeBreakdown: typeBreakdown.map(item => ({
        type: item.type,
        count: item._count.type,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch alert stats:', error);
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
});

// Mark alert as read
router.patch('/alerts/:id/read', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.security_alerts.update({
      where: { id },
      data: {
        read: true,
        read_at: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to mark alert as read:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Create a security alert (internal use)
export async function createSecurityAlert(data: {
  userId?: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  try {
    await prisma.security_alerts.create({
      data: {
        user_id: data.userId,
        user_email: data.userEmail,
        user_first_name: data.userFirstName,
        user_last_name: data.userLastName,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
      },
    });
  } catch (error) {
    console.error('Failed to create security alert:', error);
  }
}

export default router;
