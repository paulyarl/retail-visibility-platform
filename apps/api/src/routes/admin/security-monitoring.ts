/**
 * Admin Security Monitoring Routes
 * Platform-wide security monitoring for administrators
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { basePrisma } from '../../prisma';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/security/sessions
 * Get all active sessions across the platform - TEMPORARILY DISABLED
 * Note: user_sessions table was dropped during schema migration
 */
router.get('/sessions', async (req, res) => {
  res.status(503).json({
    error: 'Service temporarily unavailable',
    message: 'Session management is currently unavailable due to database migration. This feature will be restored in a future update.',
    available: false
  });
});

/**
 * GET /api/admin/security/sessions/stats
 * Get session statistics - TEMPORARILY DISABLED
 * Note: user_sessions table was dropped during schema migration
 */
router.get('/sessions/stats', async (req, res) => {
  res.status(503).json({
    error: 'Service temporarily unavailable',
    message: 'Session statistics are currently unavailable due to database migration. This feature will be restored in a future update.',
    available: false
  });
});

/**
 * GET /api/admin/security/alerts
 * Get all security alerts across the platform
 */
router.get('/alerts', async (req, res) => {
  try {
    const { 
      limit = '100', 
      offset = '0', 
      unreadOnly = 'false' 
    } = req.query;

    // Use conditional queries instead of string interpolation
    const alerts = unreadOnly === 'true'
      ? await basePrisma.$queryRaw<any[]>`
          SELECT 
            a.id,
            a.user_id as "userId",
            a.type,
            a.severity,
            a.title,
            a.message,
            a.metadata,
            a.read,
            a.created_at as "createdAt",
            a.read_at as "readAt",
            u.email as "userEmail",
            u.first_name as "userFirstName",
            u.last_name as "userLastName"
          FROM security_alerts a
          JOIN users u ON a.user_id = u.id
          WHERE a.dismissed = false AND a.read = false
          ORDER BY a.created_at DESC
          LIMIT ${parseInt(limit as string)}
          OFFSET ${parseInt(offset as string)}
        `
      : await basePrisma.$queryRaw<any[]>`
          SELECT 
            a.id,
            a.user_id as "userId",
            a.type,
            a.severity,
            a.title,
            a.message,
            a.metadata,
            a.read,
            a.created_at as "createdAt",
            a.read_at as "readAt",
            u.email as "userEmail",
            u.first_name as "userFirstName",
            u.last_name as "userLastName"
          FROM security_alerts a
          JOIN users u ON a.user_id = u.id
          WHERE a.dismissed = false
          ORDER BY a.created_at DESC
          LIMIT ${parseInt(limit as string)}
          OFFSET ${parseInt(offset as string)}
        `;

    const [{ count }] = unreadOnly === 'true'
      ? await basePrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM security_alerts
          WHERE dismissed = false AND read = false
        `
      : await basePrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM security_alerts
          WHERE dismissed = false
        `;

    res.json({
      data: alerts.map(alert => ({
        ...alert,
        metadata: alert.metadata || {},
      })),
      total: Number(count),
    });
  } catch (error) {
    console.error('[GET /api/admin/security/alerts] Error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/admin/security/alerts/stats
 * Get alert statistics
 */
router.get('/alerts/stats', async (req, res) => {
  try {
    const [stats] = await basePrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as "totalAlerts",
        COUNT(*) FILTER (WHERE read = false AND dismissed = false) as "unreadAlerts",
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as "alertsLast24h",
        COUNT(*) FILTER (WHERE severity = 'critical') as "criticalAlerts",
        COUNT(*) FILTER (WHERE severity = 'warning') as "warningAlerts"
      FROM security_alerts
      WHERE dismissed = false
    `;

    // Get alert type breakdown
    const typeStats = await basePrisma.$queryRaw<any[]>`
      SELECT 
        type,
        COUNT(*) as count
      FROM security_alerts
      WHERE dismissed = false
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY type
      ORDER BY count DESC
    `;

    res.json({
      ...stats,
      totalAlerts: Number(stats.totalAlerts),
      unreadAlerts: Number(stats.unreadAlerts),
      alertsLast24h: Number(stats.alertsLast24h),
      criticalAlerts: Number(stats.criticalAlerts),
      warningAlerts: Number(stats.warningAlerts),
      typeBreakdown: typeStats.map(t => ({
        type: t.type,
        count: Number(t.count),
      })),
    });
  } catch (error) {
    console.error('[GET /api/admin/security/alerts/stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
});

/**
 * DELETE /api/admin/security/sessions/:sessionId
 * Admin revoke any user's session - TEMPORARILY DISABLED
 * Note: user_sessions table was dropped during schema migration
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  res.status(503).json({
    error: 'Service temporarily unavailable',
    message: 'Session management is currently unavailable due to database migration. This feature will be restored in a future update.',
    available: false
  });
});

/**
 * GET /api/admin/security/failed-logins
 * Get recent failed login attempts - TEMPORARILY DISABLED
 * Note: failed_login_attempts table was dropped during schema migration
 */
router.get('/failed-logins', async (req, res) => {
  res.status(503).json({
    error: 'Service temporarily unavailable',
    message: 'Failed login tracking is currently unavailable due to database migration. This feature will be restored in a future update.',
    available: false
  });
});

export default router;
