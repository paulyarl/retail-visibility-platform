/**
 * Security Alerts Routes
 * Manages security notifications and alerts for users
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { basePrisma } from '../prisma';

const router = Router();

console.log('[Security Alerts Router] Initializing security-alerts routes');

/**
 * GET /api/user/security-alerts
 * Get all security alerts for the current user
 */
router.get('/security-alerts', authenticateToken, async (req, res) => {
  console.log('[GET /api/user/security-alerts] Route handler called');
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = '50', offset = '0', unreadOnly = 'false' } = req.query;

    // Fetch alerts with proper parameterized query
    const alerts = unreadOnly === 'true'
      ? await basePrisma.$queryRaw<any[]>`
          SELECT 
            id,
            type,
            severity,
            title,
            message,
            metadata,
            read,
            created_at as "createdAt",
            read_at as "readAt"
          FROM security_alerts
          WHERE user_id = ${userId} AND read = false AND dismissed = false
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit as string)}
          OFFSET ${parseInt(offset as string)}
        `
      : await basePrisma.$queryRaw<any[]>`
          SELECT 
            id,
            type,
            severity,
            title,
            message,
            metadata,
            read,
            created_at as "createdAt",
            read_at as "readAt"
          FROM security_alerts
          WHERE user_id = ${userId} AND dismissed = false
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit as string)}
          OFFSET ${parseInt(offset as string)}
        `;

    // Get total count
    const [{ count }] = unreadOnly === 'true'
      ? await basePrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM security_alerts
          WHERE user_id = ${userId} AND read = false AND dismissed = false
        `
      : await basePrisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM security_alerts
          WHERE user_id = ${userId} AND dismissed = false
        `;

    res.json({
      data: alerts.map(alert => ({
        ...alert,
        metadata: alert.metadata || {},
      })),
      total: Number(count),
      unread: alerts.filter(a => !a.read).length,
    });
  } catch (error) {
    console.error('[GET /api/user/security-alerts] Error:', error);
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

/**
 * PUT /api/user/security-alerts/:alertId/read
 * Mark a security alert as read
 */
router.put('/security-alerts/:alertId/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { alertId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await basePrisma.$executeRaw`
      UPDATE security_alerts
      SET read = true, read_at = NOW()
      WHERE id = ${alertId}
        AND user_id = ${userId}
        AND read = false
    `;

    if (result === 0) {
      return res.status(404).json({ error: 'Alert not found or already read' });
    }

    res.json({ success: true, message: 'Alert marked as read' });
  } catch (error) {
    console.error('[PUT /api/user/security-alerts/:alertId/read] Error:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

/**
 * POST /api/user/security-alerts/mark-all-read
 * Mark all security alerts as read
 */
router.post('/security-alerts/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await basePrisma.$executeRaw`
      UPDATE security_alerts
      SET read = true, read_at = NOW()
      WHERE user_id = ${userId}
        AND read = false
        AND dismissed = false
    `;

    res.json({ 
      success: true, 
      message: `${result} alert(s) marked as read`,
      markedCount: result 
    });
  } catch (error) {
    console.error('[POST /api/user/security-alerts/mark-all-read] Error:', error);
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
});

/**
 * DELETE /api/user/security-alerts/:alertId
 * Dismiss (soft delete) a security alert
 */
router.delete('/security-alerts/:alertId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { alertId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await basePrisma.$executeRaw`
      UPDATE security_alerts
      SET dismissed = true, dismissed_at = NOW()
      WHERE id = ${alertId}
        AND user_id = ${userId}
        AND dismissed = false
    `;

    if (result === 0) {
      return res.status(404).json({ error: 'Alert not found or already dismissed' });
    }

    res.json({ success: true, message: 'Alert dismissed' });
  } catch (error) {
    console.error('[DELETE /api/user/security-alerts/:alertId] Error:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

/**
 * GET /api/user/security-alerts/preferences
 * Get user's alert preferences
 */
router.get('/security-alerts/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get preferences from user metadata or return defaults
    const user = await basePrisma.$queryRaw<any[]>`
      SELECT metadata
      FROM "User"
      WHERE id = ${userId}
    `;

    const preferences = user[0]?.metadata?.securityAlertPreferences || {
      failedLogin: true,
      newDevice: true,
      passwordChange: true,
      suspiciousActivity: true,
      accountChange: true,
    };

    res.json({ data: preferences });
  } catch (error) {
    console.error('[GET /api/user/security-alerts/preferences] Error:', error);
    res.status(500).json({ error: 'Failed to fetch alert preferences' });
  }
});

/**
 * PUT /api/user/security-alerts/preferences
 * Update user's alert preferences
 */
router.put('/security-alerts/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preferences = req.body;

    // Update user metadata with new preferences
    await basePrisma.$executeRaw`
      UPDATE "User"
      SET metadata = COALESCE(metadata, '{}'::jsonb) || 
        jsonb_build_object('securityAlertPreferences', ${JSON.stringify(preferences)}::jsonb)
      WHERE id = ${userId}
    `;

    res.json({ success: true, message: 'Preferences updated', data: preferences });
  } catch (error) {
    console.error('[PUT /api/user/security-alerts/preferences] Error:', error);
    res.status(500).json({ error: 'Failed to update alert preferences' });
  }
});

/**
 * POST /api/user/security-alerts/test
 * Create a test security alert (for development/testing)
 */
router.post('/security-alerts/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test alerts not allowed in production' });
    }

    const { type = 'new_device', severity = 'info' } = req.body;

    const testMessages: Record<string, { title: string; message: string }> = {
      new_device: {
        title: 'New Device Login',
        message: 'You signed in from a new device.',
      },
      failed_login: {
        title: 'Failed Login Attempt',
        message: 'Someone tried to access your account with an incorrect password.',
      },
      password_change: {
        title: 'Password Changed',
        message: 'Your password was successfully changed.',
      },
      suspicious_activity: {
        title: 'Suspicious Activity Detected',
        message: 'Multiple failed login attempts detected from an unknown location.',
      },
      account_change: {
        title: 'Account Settings Changed',
        message: 'Your account settings were recently modified.',
      },
    };

    const { title, message } = testMessages[type] || testMessages.new_device;

    await basePrisma.$executeRaw`
      INSERT INTO security_alerts (user_id, type, severity, title, message, metadata)
      VALUES (
        ${userId},
        ${type},
        ${severity},
        ${title},
        ${message},
        ${JSON.stringify({ test: true, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    res.json({ success: true, message: 'Test alert created' });
  } catch (error) {
    console.error('[POST /api/user/security-alerts/test] Error:', error);
    res.status(500).json({ error: 'Failed to create test alert' });
  }
});

export default router;
