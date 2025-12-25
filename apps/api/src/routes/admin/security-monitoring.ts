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
 * Get all active sessions across the platform
 */
router.get('/sessions', async (req, res) => {
  try {
    const { limit = '100', offset = '0', activeOnly = 'true' } = req.query;

    // Fetch all sessions with user info
    const sessions = activeOnly === 'true'
      ? await basePrisma.$queryRaw<any[]>`
          SELECT 
            s.id,
            s.user_id as "userId",
            s.device_info as "deviceInfo",
            s.ip_address as "ipAddress",
            s.location,
            s.user_agent as "userAgent",
            s.is_current as "isCurrent",
            s.last_activity as "lastActivity",
            s.created_at as "createdAt",
            s.expires_at as "expiresAt",
            u.email as "userEmail",
            u.first_name as "userFirstName",
            u.last_name as "userLastName",
            u.role as "userRole"
          FROM user_sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.revoked_at IS NULL
            AND (s.expires_at IS NULL OR s.expires_at > NOW())
          ORDER BY s.last_activity DESC
          LIMIT ${parseInt(limit as string)}
          OFFSET ${parseInt(offset as string)}
        `
      : await basePrisma.$queryRaw<any[]>`
          SELECT 
            s.id,
            s.user_id as "userId",
            s.device_info as "deviceInfo",
            s.ip_address as "ipAddress",
            s.location,
            s.user_agent as "userAgent",
            s.is_current as "isCurrent",
            s.last_activity as "lastActivity",
            s.created_at as "createdAt",
            s.expires_at as "expiresAt",
            s.revoked_at as "revokedAt",
            u.email as "userEmail",
            u.first_name as "userFirstName",
            u.last_name as "userLastName",
            u.role as "userRole"
          FROM user_sessions s
          JOIN users u ON s.user_id = u.id
          ORDER BY s.last_activity DESC
          LIMIT ${parseInt(limit as string)}
          OFFSET ${parseInt(offset as string)}
        `;

    // Get total count
    const [{ count }] = activeOnly === 'true'
      ? await basePrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM user_sessions
          WHERE revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
        `
      : await basePrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM user_sessions
        `;

    res.json({
      data: sessions.map(session => ({
        ...session,
        deviceInfo: session.deviceInfo || {},
        location: session.location || {},
      })),
      total: Number(count),
    });
  } catch (error) {
    console.error('[GET /api/admin/security/sessions] Error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/admin/security/sessions/stats
 * Get session statistics
 */
router.get('/sessions/stats', async (req, res) => {
  try {
    const [stats] = await basePrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) FILTER (WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) as "activeSessions",
        COUNT(DISTINCT user_id) FILTER (WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) as "activeUsers",
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as "sessionsLast24h",
        COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as "revokedSessions"
      FROM user_sessions
    `;

    // Get device breakdown
    const deviceStats = await basePrisma.$queryRaw<any[]>`
      SELECT 
        (device_info->>'type') as "deviceType",
        COUNT(*) as count
      FROM user_sessions
      WHERE revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      GROUP BY device_info->>'type'
      ORDER BY count DESC
    `;

    res.json({
      ...stats,
      activeSessions: Number(stats.activeSessions),
      activeUsers: Number(stats.activeUsers),
      sessionsLast24h: Number(stats.sessionsLast24h),
      revokedSessions: Number(stats.revokedSessions),
      deviceBreakdown: deviceStats.map(d => ({
        type: d.deviceType || 'unknown',
        count: Number(d.count),
      })),
    });
  } catch (error) {
    console.error('[GET /api/admin/security/sessions/stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
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
 * Admin revoke any user's session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await basePrisma.$executeRaw`
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE id = ${sessionId}
        AND revoked_at IS NULL
    `;

    if (result === 0) {
      return res.status(404).json({ error: 'Session not found or already revoked' });
    }

    res.json({ success: true, message: 'Session revoked by admin' });
  } catch (error) {
    console.error('[DELETE /api/admin/security/sessions/:sessionId] Error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

/**
 * GET /api/admin/security/failed-logins
 * Get recent failed login attempts
 */
router.get('/failed-logins', async (req, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const attempts = await basePrisma.$queryRaw<any[]>`
      SELECT 
        id,
        email,
        ip_address as "ipAddress",
        user_agent as "userAgent",
        reason,
        metadata,
        created_at as "createdAt"
      FROM failed_login_attempts
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit as string)}
      OFFSET ${parseInt(offset as string)}
    `;

    const [{ count }] = await basePrisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM failed_login_attempts
    `;

    res.json({
      data: attempts.map(attempt => ({
        ...attempt,
        metadata: attempt.metadata || {},
      })),
      total: Number(count),
    });
  } catch (error) {
    console.error('[GET /api/admin/security/failed-logins] Error:', error);
    res.status(500).json({ error: 'Failed to fetch failed login attempts' });
  }
});

export default router;
