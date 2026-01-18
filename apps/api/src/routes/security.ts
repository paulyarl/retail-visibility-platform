/**
 * Security Monitoring Routes - Phase 3 Advanced Security
 * API endpoints for security monitoring and threat intelligence
 */

import { Router } from 'express';
import { threatDetectionService } from '../services/threat-detection';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// All security routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /security/metrics
 * Get security metrics and threat statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await threatDetectionService.getSecurityMetrics(hours);

    res.json({
      success: true,
      data: {
        metrics,
        timeRange: `${hours} hours`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get security metrics', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security metrics'
    });
  }
});

/**
 * GET /security/threats
 * Get recent security threats and events
 */
router.get('/threats', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    const hours = parseInt(req.query.hours as string) || 24;
    const resolved = req.query.resolved === 'true';

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get total count for pagination
    const totalCount = await require('../prisma').prisma.security_threats.count({
      where: {
        created_at: { gte: since },
        resolved: resolved ? undefined : false
      }
    });

    // Get paginated threats
    const threats = await require('../prisma').prisma.security_threats.findMany({
      where: {
        created_at: { gte: since },
        resolved: resolved ? undefined : false
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        threats,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: offset + limit < totalCount,
          hasPrev: page > 1
        },
        timeRange: `${hours} hours`,
        resolved: resolved
      }
    });

  } catch (error) {
    logger.error('Failed to get security threats', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security threats'
    });
  }
});

/**
 * POST /security/threats/:id/resolve
 * Mark a security threat as resolved
 */
router.post('/threats/:id/resolve', async (req, res) => {
  try {
    const threatId = req.params.id;
    const notes = req.body.notes || 'Manually resolved by admin';

    const updatedThreat = await require('../prisma').prisma.security_threats.update({
      where: { id: threatId },
      data: {
        resolved: true,
        resolved_at: new Date(),
        metadata: {
          resolution_notes: notes,
          resolved_by: (req.user?.userId || req.user?.id),
          resolved_at: new Date().toISOString()
        }
      }
    });

    logger.info('Security threat resolved', undefined, { threatId, resolvedBy: req.user?.userId || req.user?.id });

    res.json({
      success: true,
      message: 'Security threat marked as resolved',
      data: updatedThreat
    });

  } catch (error) {
    logger.error('Failed to resolve security threat', undefined, { threatId: req.params.id, error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to resolve security threat'
    });
  }
});

/**
 * GET /security/blocked-ips
 * Get list of currently blocked IP addresses
 */
router.get('/blocked-ips', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get total count for pagination
    const totalCount = await require('../prisma').prisma.security_threats.count({
      where: {
        type: 'brute_force_attempt',
        resolved: false,
        created_at: { gte: since }
      }
    });

    // Get paginated blocked IPs
    const blockedIPs = await require('../prisma').prisma.security_threats.findMany({
      where: {
        type: 'brute_force_attempt',
        resolved: false,
        created_at: { gte: since }
      },
      select: {
        id: true,
        ip_address: true,
        metadata: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });

    res.json({
      success: true,
      data: {
        blockedIPs,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: offset + limit < totalCount,
          hasPrev: page > 1
        },
        timeRange: `${hours} hours`
      }
    });

  } catch (error) {
    logger.error('Failed to get blocked IPs', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blocked IP addresses'
    });
  }
});

/**
 * POST /security/blocked-ips/:ip/unblock
 * Unblock a specific IP address
 */
router.post('/blocked-ips/:ip/unblock', async (req, res) => {
  try {
    const ipAddress = req.params.ip;
    const notes = req.body.notes || 'Manually unblocked by admin';

    // Mark the IP block as resolved
    const updatedThreat = await require('../prisma').prisma.security_threats.updateMany({
      where: {
        ip_address: ipAddress,
        type: 'brute_force_attempt',
        resolved: false
      },
      data: {
        resolved: true,
        resolved_at: new Date(),
        metadata: {
          resolution_notes: notes,
          unblocked_by: (req.user?.userId || req.user?.id),
          unblocked_at: new Date().toISOString()
        }
      }
    });

    logger.info('IP address unblocked', undefined, { ipAddress, unblockedBy: req.user?.userId || req.user?.id });

    res.json({
      success: true,
      message: `IP address ${ipAddress} has been unblocked`,
      data: { updatedRecords: updatedThreat.count }
    });

  } catch (error) {
    logger.error('Failed to unblock IP address', undefined, { ipAddress: req.params.ip, error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to unblock IP address'
    });
  }
});

/**
 * GET /security/health
 * Security health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Quick security health check
    const metrics = await threatDetectionService.getSecurityMetrics(1); // Last hour
    const isHealthy = metrics.activeThreats < 10 && metrics.failedLogins < 50;

    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'warning',
        metrics,
        timestamp: new Date().toISOString(),
        checks: {
          threatCount: metrics.activeThreats < 10,
          loginFailures: metrics.failedLogins < 50
        }
      }
    });

  } catch (error) {
    logger.error('Security health check failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Security health check failed',
      data: { status: 'error' }
    });
  }
});

export default router;
