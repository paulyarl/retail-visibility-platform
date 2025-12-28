/**
 * Auth Sessions Routes
 * Manages user login sessions and device tracking
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { basePrisma } from '../prisma';
import crypto from 'crypto';

const router = Router();

/**
 * GET /api/auth/sessions
 * Get all active sessions for the current user
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current token hash for comparison
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    const currentTokenHash = currentToken 
      ? crypto.createHash('sha256').update(currentToken).digest('hex')
      : null;

    // Fetch active sessions from database
    const sessions = await basePrisma.$queryRaw<any[]>`
      SELECT
        id,
        device_info as "deviceInfo",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        created_at as "createdAt",
        expires_at as "expiresAt"
      FROM user_sessions_list
      WHERE user_id = ${userId}
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
    `;

    // Mark current session
    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      isCurrent: session.isCurrent || (currentTokenHash && session.id.includes(currentTokenHash.substring(0, 8))),
      deviceInfo: session.deviceInfo || {},
      location: session.location || {},
    }));

    res.json({
      data: sessionsWithCurrent,
      total: sessionsWithCurrent.length,
    });
  } catch (error) {
    console.error('[GET /api/auth/sessions] Error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify session belongs to user and revoke it
    const result = await basePrisma.$executeRaw`
      UPDATE user_sessions_list
      SET is_active = false
      WHERE id = ${sessionId}
        AND user_id = ${userId}
        AND is_active = true
    `;

    if (result === 0) {
      return res.status(404).json({ error: 'Session not found or already revoked' });
    }

    // Create security alert
    await basePrisma.$executeRaw`
      INSERT INTO security_alerts (user_id, type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'account_change',
        'info',
        'Session Revoked',
        'You manually revoked a login session.',
        ${JSON.stringify({ sessionId, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    console.error('[DELETE /api/auth/sessions/:sessionId] Error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

/**
 * POST /api/auth/sessions/revoke-all
 * Revoke all sessions except the current one
 */
router.post('/sessions/revoke-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current token hash
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    const currentTokenHash = currentToken 
      ? crypto.createHash('sha256').update(currentToken).digest('hex')
      : null;

    // Revoke all sessions except current
    const result = await basePrisma.$executeRaw`
      UPDATE user_sessions_list
      SET is_active = false
      WHERE user_id = ${userId}
        AND is_active = true
        AND id NOT IN (
          SELECT id FROM user_sessions_list
          WHERE user_id = ${userId}
            AND is_active = true
            AND expires_at > NOW()
          LIMIT 1
        )
    `;

    // Create security alert
    await basePrisma.$executeRaw`
      INSERT INTO security_alerts (user_id, type, severity, title, message, metadata)
      VALUES (
        ${userId},
        'account_change',
        'warning',
        'All Sessions Revoked',
        'You revoked all other login sessions. Only your current session remains active.',
        ${JSON.stringify({ revokedCount: result, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    res.json({ 
      success: true, 
      message: `${result} session(s) revoked successfully`,
      revokedCount: result 
    });
  } catch (error) {
    console.error('[POST /api/auth/sessions/revoke-all] Error:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

/**
 * PUT /api/auth/sessions/:sessionId/activity
 * Update last activity timestamp for a session
 */
router.put('/sessions/:sessionId/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await basePrisma.$executeRaw`
      UPDATE user_sessions_list
      SET last_activity = NOW()
      WHERE id = ${sessionId}
        AND user_id = ${userId}
        AND is_active = true
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/auth/sessions/:sessionId/activity] Error:', error);
    res.status(500).json({ error: 'Failed to update session activity' });
  }
});

export default router;
