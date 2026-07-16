/**
 * Auth Sessions Routes
 * Manages user login sessions and device tracking
 * Migrated to Auth0 cookie-based authentication
 */

import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { basePrisma } from '../prisma';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/auth/sessions
 * Get all active sessions for the current user
 */
router.get('/sessions', optionalAuth, async (req, res) => {
  try {
    let userId = req.user?.user_id;
    
    // If no user from JWT, try to get from Auth0 session via auth0_id, email header, or cookie
    if (!userId) {
      // First try by auth0_id (most reliable)
      const auth0Id = req.headers['x-auth0-id'] as string;
      if (auth0Id) {
        const user = await basePrisma.users.findUnique({
          where: { auth0_id: auth0Id },
          select: { id: true }
        });
        userId = user?.id;
      }
      
      // Then try by email
      if (!userId) {
        const auth0Email = req.headers['x-auth0-email'] as string || req.cookies?.auth0_email as string;
        if (auth0Email) {
          const user = await basePrisma.users.findUnique({
            where: { email: auth0Email.toLowerCase() },
            select: { id: true }
          });
          userId = user?.id;
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current Auth0 session ID for comparison
    const currentAuth0SessionId = req.cookies?.auth0_session || req.cookies?.appSession;
    const currentSessionIdentifier = currentAuth0SessionId 
      ? `auth0_${currentAuth0SessionId}`
      : null;

    // Fetch active sessions from database
    const sessions = await basePrisma.$queryRaw<any[]>`
      SELECT
        id,
        token_hash,
        device_info as "deviceInfo",
        ip_address as "ipAddress",
        location,
        user_agent as "userAgent",
        created_at as "createdAt",
        expires_at as "expiresAt",
        last_activity as "lastActivity"
      FROM user_sessions_list
      WHERE user_id = ${userId}
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
    `;

    // Mark current session and parse JSON fields
    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      isCurrent: currentSessionIdentifier && session.token_hash === currentSessionIdentifier,
      deviceInfo: typeof session.deviceInfo === 'string' ? JSON.parse(session.deviceInfo) : (session.deviceInfo || {}),
      location: typeof session.location === 'string' ? JSON.parse(session.location) : (session.location || {}),
    }));

    res.json({
      success: true,
      data: sessionsWithCurrent,
      total: sessionsWithCurrent.length,
    });
  } catch (error) {
    logger.error('[GET /api/auth/sessions] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', optionalAuth, async (req, res) => {
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
    logger.error('[DELETE /api/auth/sessions/:sessionId] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

/**
 * POST /api/auth/sessions/revoke-all
 * Revoke all sessions except the current one
 */
router.post('/sessions/revoke-all', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current Auth0 session ID
    const currentAuth0SessionId = req.cookies?.auth0_session || req.cookies?.appSession;
    const currentSessionIdentifier = currentAuth0SessionId 
      ? `auth0_${currentAuth0SessionId}`
      : null;

    // Revoke all sessions except current
    const result = await basePrisma.$executeRaw`
      UPDATE user_sessions_list
      SET is_active = false
      WHERE user_id = ${userId}
        AND is_active = true
        AND (${currentSessionIdentifier}::text IS NULL OR token_hash != ${currentSessionIdentifier}::text)
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
    logger.error('[POST /api/auth/sessions/revoke-all] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

/**
 * PUT /api/auth/sessions/:sessionId/activity
 * Update last activity timestamp for a session
 */
router.put('/sessions/:sessionId/activity', optionalAuth, async (req, res) => {
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
    logger.error('[PUT /api/auth/sessions/:sessionId/activity] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Failed to update session activity' });
  }
});

export default router;
