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
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get active sessions with user information
    const sessions = await basePrisma.$queryRaw<any[]>`
      SELECT
        s.id,
        s.user_id as "userId",
        u.email as "userEmail",
        u.first_name as "userFirstName",
        u.last_name as "userLastName",
        u.role as "userRole",
        s.device_info as "deviceInfo",
        s.ip_address as "ipAddress",
        s.location,
        s.user_agent as "userAgent",
        s.created_at as "createdAt",
        s.expires_at as "expiresAt",
        s.last_activity as "lastActivity"
      FROM user_sessions_list s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true
        AND s.expires_at > NOW()
      ORDER BY s.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [{ count }] = await basePrisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM user_sessions_list WHERE is_active = true AND expires_at > NOW()`;

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
 * Get session statistics and user session counts
 */
router.get('/sessions/stats', async (req, res) => {
  try {
    // Get overall session stats
    const [overallStats] = await basePrisma.$queryRaw<any[]>`SELECT COUNT(*) as totalSessions FROM user_sessions_list WHERE is_active = true AND expires_at > NOW()`;

    // Get sessions per user (top 20 users with most sessions)
    const userSessionCounts = await basePrisma.$queryRaw<any[]>`SELECT u.email, COUNT(s.id) as session_count FROM user_sessions_list s JOIN users u ON s.user_id = u.id WHERE s.is_active = true AND s.expires_at > NOW() GROUP BY u.email ORDER BY session_count DESC LIMIT 20`;

    // Get users exceeding session limits
    const usersOverLimit = await basePrisma.$queryRaw<any[]>`
      SELECT
        u.email,
        u.role,
        COUNT(s.id) as active_sessions,
        CASE
          WHEN u.role IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT') THEN 50
          ELSE 10
        END as session_limit
      FROM user_sessions_list s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true AND s.expires_at > NOW()
      GROUP BY u.id, u.email, u.role
      HAVING COUNT(s.id) >= CASE
        WHEN u.role IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT') THEN 50
        ELSE 10
      END
      ORDER BY active_sessions DESC
    `;

    res.json({
      overall: {
        totalActiveSessions: Number(overallStats.totalSessions),
        usersOverLimit: usersOverLimit.length,
      },
      topUsers: userSessionCounts.map(u => ({
        email: u.email,
        sessionCount: Number(u.session_count),
      })),
      overLimit: usersOverLimit.map(u => ({
        email: u.email,
        role: u.role,
        activeSessions: Number(u.active_sessions),
        sessionLimit: u.session_limit,
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
 * GET /api/admin/security/alerts/by-type
 * Get alerts grouped by type with counts and recent examples
 */
router.get('/alerts/by-type', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10); // Max 10 examples per type
    const hours = parseInt(req.query.hours as string) || 168; // Default 7 days

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get alert counts by type
    const typeCounts = await basePrisma.$queryRaw<any[]>`
      SELECT
        type,
        COUNT(*) as count,
        MAX(created_at) as latest_alert,
        COUNT(*) FILTER (WHERE read = false) as unread_count
      FROM security_alerts
      WHERE dismissed = false
        AND created_at >= ${since}
      GROUP BY type
      ORDER BY count DESC
    `;

    // Get recent examples for each type
    const alertsByType = await Promise.all(
      typeCounts.map(async (typeInfo: any) => {
        const recentAlerts = await basePrisma.$queryRaw<any[]>`
          SELECT
            a.id,
            a.type,
            a.severity,
            a.title,
            a.message,
            a.created_at as "createdAt",
            a.read,
            u.email as "userEmail",
            u.first_name as "userFirstName",
            u.last_name as "userLastName"
          FROM security_alerts a
          LEFT JOIN users u ON a.user_id = u.id
          WHERE a.type = ${typeInfo.type}
            AND a.dismissed = false
            AND a.created_at >= ${since}
          ORDER BY a.created_at DESC
          LIMIT ${limit}
        `;

        return {
          type: typeInfo.type,
          count: Number(typeInfo.count),
          unreadCount: Number(typeInfo.unread_count),
          latestAlert: typeInfo.latest_alert,
          recentAlerts: recentAlerts.map(alert => ({
            ...alert,
            createdAt: alert.createdAt.toISOString(),
          })),
        };
      })
    );

    res.json({
      data: alertsByType,
      totalTypes: alertsByType.length,
      timeRange: `${hours} hours`,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/admin/security/alerts/by-type] Error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts by type' });
  }
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

/**
 * DELETE /api/admin/security/sessions/:sessionId
 * Revoke a specific session (admin only)
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify session exists and belongs to a user
    const [session] = await basePrisma.$queryRaw<any[]>`
      SELECT s.id, s.user_id, u.email as user_email
      FROM user_sessions_list s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${sessionId}
        AND s.is_active = true
    `;

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The specified session does not exist or has already been revoked'
      });
    }

    // Revoke the session
    const result = await basePrisma.$executeRaw`
      UPDATE user_sessions_list
      SET is_active = false
      WHERE id = ${sessionId}
    `;

    // Create security alert for session revocation
    await basePrisma.$executeRaw`
      INSERT INTO security_alerts (
        user_id,
        type,
        severity,
        title,
        message,
        metadata
      ) VALUES (
        ${session.user_id},
        'account_change',
        'warning',
        'Session Revoked by Admin',
        'Your session was revoked by a platform administrator.',
        ${JSON.stringify({
          sessionId,
          revokedBy: req.user?.user_id || 'system',
          revokedAt: new Date().toISOString(),
          reason: 'Admin revocation'
        })}::jsonb
      )
    `;

    res.json({
      success: true,
      message: 'Session revoked successfully',
      sessionId,
      userEmail: session.user_email
    });
  } catch (error) {
    console.error('[DELETE /api/admin/security/sessions/:sessionId] Error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      message: 'An internal error occurred while revoking the session'
    });
  }
});

export default router;
