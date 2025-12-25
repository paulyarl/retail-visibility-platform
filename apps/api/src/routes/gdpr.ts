/**
 * GDPR Compliance Routes
 * Provides API endpoints for data subject rights and consent management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { gdprService } from '../services/gdpr-compliance';
import { logger } from '../logger';
import { prisma } from '../prisma';
import type { Request, Response } from 'express';

// Helper function to log GDPR actions to security audit log
async function logGDPRAction(
  userId: string,
  action: string,
  ipAddress: string,
  userAgent: string,
  metadata: Record<string, any> = {}
) {
  try {
    await prisma.security_audit_log.create({
      data: {
        user_id: userId,
        action,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata
      }
    });
  } catch (error) {
    logger.error('Failed to log GDPR action to audit log', undefined, { userId, action, error });
  }
}

const router = Router();

// All GDPR routes require authentication
router.use(authenticateToken);

/**
 * GET /api/gdpr/data-export
 * Export all user data (GDPR Article 15 - Right of Access)
 */
router.get('/data-export', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = (req.user!.userId || req.user!.user_id)!;
    const format = (req.query.format as 'json' | 'csv') || 'json';

    const exportData = await gdprService.exportUserData(userId, {
      tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
      region: 'us-east-1', // Add required region property
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const exportFile = gdprService.generateExportFile(exportData, format);

    // Set appropriate headers for file download
    const filename = `gdpr-data-export-${userId}-${new Date().toISOString().split('T')[0]}.${format}`;
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Log the export for compliance
    logger.info('GDPR data export served', {
      tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
      region: 'us-east-1', // Add required region property
      userId,
      ip: req.ip,
    }, {
      format,
      filename,
      dataSize: exportFile.length,
    });

    res.send(exportFile);

  } catch (error: any) {
    logger.error('GDPR data export failed', {
      tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
      region: 'us-east-1', // Add required region property
      userId: req.user?.userId || req.user?.user_id,
      ip: req.ip,
    }, { error: error.message });

    res.status(500).json({
      error: 'data_export_failed',
      message: 'Failed to export your data. Please try again later.',
    });
  }
});

/**
 * DELETE /api/gdpr/data-delete
 * Delete all user data (GDPR Article 17 - Right to Erasure)
 */
router.delete('/data-delete', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    const confirmation = req.body.confirmation;

    // Require explicit confirmation
    if (confirmation !== 'DELETE_ALL_MY_DATA') {
      return res.status(400).json({
        error: 'confirmation_required',
        message: 'Please confirm by sending {"confirmation": "DELETE_ALL_MY_DATA"}',
      });
    }

    // Audit log: Account deletion requested (CRITICAL ACTION)
    logger.warn('GDPR account deletion requested', {
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      metadata: { action: 'gdpr_account_deletion' },
    } as any);

    await gdprService.deleteUserData(userId, {
      tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
      region: 'us-east-1', // Add required region property
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Audit log: Account deletion completed
    logger.warn('GDPR account deletion completed', {
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      metadata: { action: 'gdpr_account_deleted' },
    } as any);

    // Return success but don't provide logout - let client handle
    res.json({
      success: true,
      message: 'Your data has been successfully deleted. You will be logged out.',
      deletedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    logger.error('GDPR data deletion failed', {
      userId: req.user?.userId || req.user?.user_id,
      metadata: { action: 'gdpr_account_deletion_failed', error: error.message },
      stack: error.stack,
    } as any);

    res.status(500).json({
      error: 'data_deletion_failed',
      message: error.message || 'Failed to delete your data. Please contact support.',
    });
  }
});

/**
 * GET /api/gdpr/consents
 * Get user's consent records
 */
router.get('/consents', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    const consents = await gdprService.getUserConsents(userId);

    res.json({
      success: true,
      consents,
    });

  } catch (error: any) {
    logger.error('Failed to retrieve user consents', {
      tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
      region: 'us-east-1', // Add required region property
      userId: req.user?.userId || req.user?.user_id,
      ip: req.ip,
    }, { error: error.message } as any);

    res.status(500).json({
      error: 'consents_retrieval_failed',
      message: 'Failed to retrieve your consent records.',
    });
  }
});

/**
 * POST /api/gdpr/consents
 * Record user consent
 */
router.post('/consents', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    const { type, consented, source = 'web' } = req.body;

    if (!type || typeof consented !== 'boolean') {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Consent type and boolean consented value are required.',
      });
    }

    // Audit log: Consent recorded
    logger.info('GDPR consent recorded', {
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      metadata: { action: 'gdpr_consent_update', consentType: type, granted: consented },
    } as any);

    const consentRecord = await gdprService.recordConsent(
      userId,
      type,
      consented,
      req.ip || req.connection.remoteAddress || 'unknown',
      req.headers['user-agent'] || 'unknown',
      source,
      {
        tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
        region: 'us-east-1', // Add required region property
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      success: true,
      consent: consentRecord,
    });

  } catch (error: any) {
    logger.error('Failed to record user consent', {
      userId: req.user?.userId || req.user?.user_id,
      metadata: { action: 'gdpr_consent_update_failed', error: error.message },
      stack: error.stack,
    } as any);

    res.status(500).json({
      error: 'consent_record_failed',
      message: 'Failed to record your consent.',
    });
  }
});

/**
 * GET /api/gdpr/has-consent
 * Check if user has consent for specific types
 */
router.get('/has-consent', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    const { type } = req.query;

    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Consent type is required as a query parameter.',
      });
    }

    const hasConsent = await gdprService.hasConsent(userId, type as any);

    res.json({
      success: true,
      type,
      hasConsent,
    });

  } catch (error: any) {
    logger.error('Failed to check user consent', {
      tenantId: req.user?.tenantIds?.[0], // Use first tenant ID from array
      region: 'us-east-1', // Add required region property
      userId: req.user?.userId || req.user?.user_id,
      ip: req.ip,
    }, { error: error.message } as any);

    res.status(500).json({
      error: 'consent_check_failed',
      message: 'Failed to check your consent status.',
    });
  }
});

/**
 * POST /api/gdpr/export
 * Request a data export - immediately generates and returns completed export
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    const format = req.body.format || 'json';
    const exportId = `export_${Date.now()}`;
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Log to security audit log
    await logGDPRAction(userId, 'gdpr_export_request', ipAddress, userAgent, {
      exportId,
      format,
      timestamp: new Date().toISOString(),
    });
    
    // Audit log: Data export requested
    logger.info('GDPR data export requested', {
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      metadata: { action: 'gdpr_export_request', exportId },
    } as any);
    
    // For now, create a completed export immediately
    // In production, this would queue a background job
    const exportRequest = {
      id: exportId,
      userId,
      status: 'completed',
      requestedAt: new Date(),
      completedAt: new Date(),
      format,
      downloadUrl: `/api/gdpr/export/${exportId}/download`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    res.json({
      success: true,
      data: exportRequest,
    });

  } catch (error: any) {
    logger.error('Failed to create export request', {
      userId: req.user?.userId || req.user?.user_id,
      metadata: { action: 'gdpr_export_request_failed', error: error.message },
      stack: error.stack,
    } as any);

    res.status(500).json({
      error: 'export_request_failed',
      message: 'Failed to create export request.',
    });
  }
});

/**
 * GET /api/gdpr/export/:exportId/download
 * Download an export file with real user data
 */
router.get('/export/:exportId/download', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    const { exportId } = req.params;
    
    // Fetch real user data from database
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        created_at: true,
        last_login: true,
        email_verified: true,
        mfa_enabled: true,
        mfa_method: true,
        mfa_verified_at: true,
      }
    });

    // Fetch user's tenants
    const userTenants = await prisma.user_tenants.findMany({
      where: { user_id: userId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            created_at: true,
          }
        }
      }
    });

    // Generate comprehensive export data
    const exportData = {
      userId,
      exportId,
      exportedAt: new Date().toISOString(),
      gdprCompliance: {
        rightToAccess: 'GDPR Article 15',
        dataController: 'Retail Visibility Platform',
        retentionPeriod: '7 days',
      },
      data: {
        profile: {
          id: user?.id,
          email: user?.email,
          firstName: user?.first_name,
          lastName: user?.last_name,
          role: user?.role,
          createdAt: user?.created_at,
          lastLogin: user?.last_login,
          emailVerified: user?.email_verified,
        },
        security: {
          mfaEnabled: user?.mfa_enabled || false,
          mfaMethod: user?.mfa_method,
          mfaVerifiedAt: user?.mfa_verified_at,
        },
        tenants: userTenants.map(ut => ({
          tenantId: ut.tenants.id,
          tenantName: ut.tenants.name,
          role: ut.role,
          joinedAt: ut.created_at,
        })),
        preferences: [],
        consents: [],
        sessions: [],
      }
    };

    const filename = `gdpr-export-${exportId}.json`;
    
    // Audit log the export download
    logger.info('GDPR data export downloaded', {
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      metadata: { exportId },
    } as any);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

  } catch (error: any) {
    logger.error('Failed to download export', { 
      userId: req.user?.userId || req.user?.user_id,
      metadata: { error: error.message },
      stack: error.stack,
    } as any);
    res.status(500).json({
      error: 'download_failed',
      message: 'Failed to download export.',
    });
  }
});

/**
 * GET /api/gdpr/exports
 * Get export history for user
 */
router.get('/exports', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    
    // Mock data for now - replace with actual export history service
    const exports: any[] = [];

    res.json({
      success: true,
      data: exports,
    });

  } catch (error: any) {
    logger.error('Failed to get export history', { metadata: { error: error.message } } as any);
    res.status(500).json({
      error: 'exports_retrieval_failed',
      message: 'Failed to retrieve export history.',
    });
  }
});

/**
 * GET /api/gdpr/delete/status
 * Get account deletion status
 */
router.get('/delete/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.user!.userId || req.user!.user_id)!;
    
    // Mock data for now - no pending deletion
    res.json({
      success: true,
      data: null,
    });

  } catch (error: any) {
    logger.error('Failed to get deletion status', { metadata: { error: error.message } } as any);
    res.status(500).json({
      error: 'deletion_status_failed',
      message: 'Failed to retrieve deletion status.',
    });
  }
});

export default router;
