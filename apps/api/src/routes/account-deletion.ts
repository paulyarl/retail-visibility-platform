/**
 * Account Deletion Request Routes
 * Handles account deletion requests with 30-day grace period
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { basePrisma } from '../prisma';
import bcrypt from 'bcrypt';

const router = Router();

/**
 * POST /api/gdpr/delete
 * Request account deletion (30-day grace period)
 */
router.post('/delete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason, confirmation, password } = req.body;

    // Validate confirmation
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ 
        error: 'Invalid confirmation',
        message: 'Please type DELETE to confirm' 
      });
    }

    // Verify password
    const user = await basePrisma.$queryRaw<any[]>`
      SELECT password_hash FROM users WHERE id = ${userId}
    `;

    if (!user || user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Password verification failed' 
      });
    }

    // Check for existing pending request
    const existingRequest = await basePrisma.$queryRaw<any[]>`
      SELECT id FROM account_deletion_requests
      WHERE user_id = ${userId} AND status = 'pending'
    `;

    if (existingRequest && existingRequest.length > 0) {
      return res.status(409).json({ 
        error: 'Request already exists',
        message: 'You already have a pending deletion request' 
      });
    }

    // Create deletion request
    const [deletionRequest] = await basePrisma.$queryRaw<any[]>`
      INSERT INTO account_deletion_requests (
        user_id,
        reason,
        status,
        requested_at,
        scheduled_deletion_date,
        ip_address,
        user_agent
      ) VALUES (
        ${userId},
        ${reason || null},
        'pending',
        NOW(),
        NOW() + INTERVAL '30 days',
        ${req.ip || null},
        ${req.headers['user-agent'] || null}
      )
      RETURNING 
        id,
        user_id as "userId",
        reason,
        status,
        requested_at as "requestedAt",
        scheduled_deletion_date as "scheduledDeletionDate"
    `;

    res.json({
      success: true,
      data: deletionRequest,
      message: 'Account deletion scheduled for 30 days from now. You can cancel anytime during this period.'
    });
  } catch (error) {
    console.error('[POST /api/gdpr/delete] Error:', error);
    res.status(500).json({ error: 'Failed to request account deletion' });
  }
});

/**
 * GET /api/gdpr/delete/status
 * Get current deletion request status
 */
router.get('/delete/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [deletionRequest] = await basePrisma.$queryRaw<any[]>`
      SELECT 
        id,
        user_id as "userId",
        reason,
        status,
        requested_at as "requestedAt",
        scheduled_deletion_date as "scheduledDeletionDate",
        cancelled_at as "cancelledAt",
        completed_at as "completedAt"
      FROM account_deletion_requests
      WHERE user_id = ${userId} AND status = 'pending'
      ORDER BY requested_at DESC
      LIMIT 1
    `;

    res.json({
      success: true,
      data: deletionRequest || null
    });
  } catch (error) {
    console.error('[GET /api/gdpr/delete/status] Error:', error);
    res.status(500).json({ error: 'Failed to get deletion status' });
  }
});

/**
 * DELETE /api/gdpr/delete
 * Cancel pending deletion request
 */
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await basePrisma.$executeRaw`
      UPDATE account_deletion_requests
      SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE user_id = ${userId} AND status = 'pending'
    `;

    if (result === 0) {
      return res.status(404).json({ 
        error: 'No pending request',
        message: 'No pending deletion request found' 
      });
    }

    res.json({
      success: true,
      message: 'Account deletion request cancelled successfully'
    });
  } catch (error) {
    console.error('[DELETE /api/gdpr/delete] Error:', error);
    res.status(500).json({ error: 'Failed to cancel deletion request' });
  }
});

/**
 * GET /api/admin/deletion-requests
 * Get all deletion requests (admin only)
 */
router.get('/admin/deletion-requests', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    let whereClause = '';
    if (status && status !== 'all') {
      whereClause = `WHERE dr.status = '${status}'`;
    }

    const requests = await basePrisma.$queryRaw<any[]>`
      SELECT 
        dr.id,
        dr.user_id as "userId",
        dr.reason,
        dr.status,
        dr.requested_at as "requestedAt",
        dr.scheduled_deletion_date as "scheduledDeletionDate",
        dr.cancelled_at as "cancelledAt",
        dr.completed_at as "completedAt",
        dr.ip_address as "ipAddress",
        dr.admin_notes as "adminNotes",
        dr.cancelled_by_admin as "cancelledByAdmin",
        u.email as "userEmail",
        u.first_name as "userFirstName",
        u.last_name as "userLastName",
        u.created_at as "userCreatedAt"
      FROM account_deletion_requests dr
      JOIN users u ON dr.user_id = u.id
      ${whereClause}
      ORDER BY dr.requested_at DESC
      LIMIT ${parseInt(limit as string)}
      OFFSET ${parseInt(offset as string)}
    `;

    const [{ count }] = await basePrisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM account_deletion_requests dr
      ${whereClause}
    `;

    res.json({
      success: true,
      data: requests,
      total: Number(count)
    });
  } catch (error) {
    console.error('[GET /api/admin/deletion-requests] Error:', error);
    res.status(500).json({ error: 'Failed to fetch deletion requests' });
  }
});

/**
 * GET /api/admin/deletion-requests/stats
 * Get deletion request statistics (admin only)
 */
router.get('/admin/deletion-requests/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [stats] = await basePrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as "pendingCount",
        COUNT(*) FILTER (WHERE status = 'cancelled') as "cancelledCount",
        COUNT(*) FILTER (WHERE status = 'completed') as "completedCount",
        COUNT(*) FILTER (WHERE requested_at > NOW() - INTERVAL '7 days') as "last7Days",
        COUNT(*) FILTER (WHERE requested_at > NOW() - INTERVAL '30 days') as "last30Days",
        COUNT(*) FILTER (WHERE scheduled_deletion_date <= NOW() + INTERVAL '7 days' AND status = 'pending') as "expiringIn7Days"
      FROM account_deletion_requests
    `;

    // Get top reasons
    const topReasons = await basePrisma.$queryRaw<any[]>`
      SELECT 
        reason,
        COUNT(*) as count
      FROM account_deletion_requests
      WHERE reason IS NOT NULL AND reason != ''
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 10
    `;

    res.json({
      success: true,
      data: {
        ...stats,
        pendingCount: Number(stats.pendingCount),
        cancelledCount: Number(stats.cancelledCount),
        completedCount: Number(stats.completedCount),
        last7Days: Number(stats.last7Days),
        last30Days: Number(stats.last30Days),
        expiringIn7Days: Number(stats.expiringIn7Days),
        topReasons: topReasons.map(r => ({
          reason: r.reason,
          count: Number(r.count)
        }))
      }
    });
  } catch (error) {
    console.error('[GET /api/admin/deletion-requests/stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch deletion stats' });
  }
});

/**
 * PUT /api/admin/deletion-requests/:id
 * Update deletion request (admin only)
 */
router.put('/admin/deletion-requests/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, action } = req.body;
    const adminUserId = req.user?.user_id || req.user?.userId;

    if (action === 'cancel') {
      // Admin cancels the deletion request
      await basePrisma.$executeRaw`
        UPDATE account_deletion_requests
        SET 
          status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by_admin = true,
          admin_user_id = ${adminUserId},
          admin_notes = ${adminNotes || null},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      // Just update admin notes
      await basePrisma.$executeRaw`
        UPDATE account_deletion_requests
        SET 
          admin_notes = ${adminNotes},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    res.json({
      success: true,
      message: 'Deletion request updated successfully'
    });
  } catch (error) {
    console.error('[PUT /api/admin/deletion-requests/:id] Error:', error);
    res.status(500).json({ error: 'Failed to update deletion request' });
  }
});

export default router;
