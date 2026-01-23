/**
 * Security Monitoring Routes - UniversalSingleton Integration
 * API endpoints for security monitoring using SecurityMonitoringService
 */

import { Router } from 'express';
import SecurityMonitoringService from '../services/SecurityMonitoringService';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const securityService = SecurityMonitoringService.getInstance();

// Set authentication context for all requests
router.use((req, res, next) => {
  if (req.user) {
    securityService.setAuthContext({
      userId: req.user.userId,
      tenantId: req.user.tenantIds?.[0],
      sessionId: undefined, // Session not available in this context
      roles: req.user.role ? [req.user.role] : [],
      permissions: [],
      token: req.headers.authorization?.replace('Bearer ', '')
    });
  }
  next();
});

/**
 * POST /security/events
 * Record a security event
 */
router.post('/events', async (req, res) => {
  try {
    const eventData = {
      type: req.body.type,
      severity: req.body.severity || 'medium',
      source: {
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        userId: req.user?.userId || 'anonymous',
        tenantId: req.user?.tenantIds?.[0] || 'unknown'
      },
      details: req.body.details || {}
    };

    const event = await securityService.processSecurityEvent(eventData);
    
    logger.info('Security event recorded', undefined, { 
      eventId: event.id, 
      type: event.type,
      severity: event.severity,
      userId: req.user?.userId 
    });

    res.status(201).json({
      success: true,
      data: {
        event,
        timestamp: new Date().toISOString()
      },
      message: 'Security event recorded successfully'
    });
  } catch (error) {
    logger.error('Security event recording failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to record security event',
      error: (error as Error).message
    });
  }
});

/**
 * GET /security/metrics
 * Get security metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await securityService.getSecurityMetrics(hours);
    
    res.json({
      success: true,
      data: {
        metrics,
        timeRange: `${hours} hours`,
        timestamp: new Date().toISOString()
      },
      message: 'Security metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Security metrics retrieval failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security metrics',
      error: (error as Error).message
    });
  }
});

/**
 * POST /security/block-ip
 * Block an IP address (admin only)
 */
router.post('/block-ip', requireAdmin, async (req, res) => {
  try {
    const { ip, durationMinutes = 60, reason = 'Manual block' } = req.body;
    
    const blockedIP = await securityService.blockIP(ip, durationMinutes, reason);
    
    logger.warn('IP blocked by admin', undefined, { 
      ip, 
      durationMinutes, 
      reason, 
      adminId: req.user?.id 
    });
    
    res.json({
      success: true,
      data: {
        blockedIP,
        timestamp: new Date().toISOString()
      },
      message: `IP ${ip} blocked successfully`
    });
  } catch (error) {
    logger.error('IP blocking failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to block IP address',
      error: (error as Error).message
    });
  }
});

/**
 * POST /security/unblock-ip
 * Unblock an IP address (admin only)
 */
router.post('/unblock-ip', requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    
    await securityService.unblockIP(ip);
    
    logger.info('IP unblocked by admin', undefined, { 
      ip, 
      adminId: req.user?.id 
    });
    
    res.json({
      success: true,
      message: `IP ${ip} unblocked successfully`
    });
  } catch (error) {
    logger.error('IP unblocking failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to unblock IP address',
      error: (error as Error).message
    });
  }
});

/**
 * GET /security/blocked-ips
 * Get blocked IPs (admin only)
 */
router.get('/blocked-ips', requireAdmin, async (req, res) => {
  try {
    const blockedIPs = await securityService.getBlockedIPs();
    
    res.json({
      success: true,
      data: {
        blockedIPs,
        count: blockedIPs.length,
        timestamp: new Date().toISOString()
      },
      message: 'Blocked IPs retrieved successfully'
    });
  } catch (error) {
    logger.error('Blocked IPs retrieval failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blocked IPs',
      error: (error as Error).message
    });
  }
});

/**
 * POST /security/sensitive-data
 * Store sensitive security data (encrypted)
 */
router.post('/sensitive-data', async (req, res) => {
  try {
    const { key, data, ttl = 3600, encrypt = true } = req.body;
    
    await securityService.storeSensitiveSecurityData(key, data, { ttl, encrypt });
    
    logger.info('Sensitive data stored securely', undefined, { 
      key, 
      ttl, 
      encrypted: encrypt,
      userId: req.user?.userId 
    });
    
    res.json({
      success: true,
      message: 'Sensitive data stored securely'
    });
  } catch (error) {
    logger.error('Sensitive data storage failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to store sensitive data',
      error: (error as Error).message
    });
  }
});

/**
 * GET /security/sensitive-data/:key
 * Get sensitive security data (decrypted)
 */
router.get('/sensitive-data/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const data = await securityService.getSensitiveSecurityData(key);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: `No data found for key: ${key}`
      });
    }
    
    logger.info('Sensitive data retrieved securely', undefined, { 
      key, 
      userId: req.user?.userId 
    });
    
    res.json({
      success: true,
      data,
      message: 'Sensitive data retrieved securely'
    });
  } catch (error) {
    logger.error('Sensitive data retrieval failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sensitive data',
      error: (error as Error).message
    });
  }
});

export default router;
