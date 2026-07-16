/**
 * Rate Limiting API Routes
 * Integrates RateLimitingService with Express API
 */

import { Router } from 'express';
import RateLimitingService from '../services/RateLimitingService';

const router = Router();

// Get singleton instance
const rateLimitService = RateLimitingService.getInstance();

/**
 * Check rate limit status for an IP
 * GET /api/rate-limit/status/:ip
 */
router.get('/status/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { routeType = 'default' } = req.query;
    
    const status = await rateLimitService.checkRateLimit(ip as string, routeType as string, req.path || '/unknown');
    
    res.json({
      success: true,
      data: {
        ip,
        routeType,
        status,
        timestamp: new Date().toISOString()
      },
      message: 'Rate limit status retrieved successfully'
    });
  } catch (error) {
    console.error('Rate limit status check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check rate limit status',
      error: (error as Error).message
    });
  }
});

/**
 * Check if request is allowed
 * POST /api/rate-limit/check
 */
router.post('/check', async (req, res) => {
  try {
    const { ip, routeType = 'default', path } = req.body;
    
    const isAllowed = await rateLimitService.checkRateLimit(ip, routeType, path);
    
    res.json({
      success: true,
      data: {
        ip,
        routeType,
        path,
        allowed: isAllowed,
        timestamp: new Date().toISOString()
      },
      message: 'Rate limit check completed'
    });
  } catch (error) {
    console.error('Rate limit check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check rate limit',
      error: (error as Error).message
    });
  }
});

/**
 * Get rate limiting rules
 * GET /api/rate-limit/rules
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = await rateLimitService.getRules();
    
    res.json({
      success: true,
      data: {
        rules,
        count: rules.length,
        timestamp: new Date().toISOString()
      },
      message: 'Rate limiting rules retrieved successfully'
    });
  } catch (error) {
    console.error('Rate limiting rules retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate limiting rules',
      error: (error as Error).message
    });
  }
});

/**
 * Create rate limiting rule
 * POST /api/rate-limit/rules
 */
router.post('/rules', async (req, res) => {
  try {
    const rule = req.body;
    
    const createdRule = await rateLimitService.createRule(rule);
    
    res.status(201).json({
      success: true,
      data: {
        rule: createdRule,
        timestamp: new Date().toISOString()
      },
      message: 'Rate limiting rule created successfully'
    });
  } catch (error) {
    console.error('Rate limiting rule creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rate limiting rule',
      error: (error as Error).message
    });
  }
});

/**
 * Update rate limiting rule
 * PUT /api/rate-limit/rules/:id
 */
router.put('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedRule = await rateLimitService.updateRule(id, updates);
    
    res.json({
      success: true,
      data: {
        rule: updatedRule,
        timestamp: new Date().toISOString()
      },
      message: 'Rate limiting rule updated successfully'
    });
  } catch (error) {
    console.error('Rate limiting rule update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate limiting rule',
      error: (error as Error).message
    });
  }
});

/**
 * Delete rate limiting rule
 * DELETE /api/rate-limit/rules/:id
 */
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await rateLimitService.deleteRule(id);
    
    res.json({
      success: true,
      message: 'Rate limiting rule deleted successfully'
    });
  } catch (error) {
    console.error('Rate limiting rule deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rate limiting rule',
      error: (error as Error).message
    });
  }
});

/**
 * Get rate limiting metrics
 * GET /api/rate-limit/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await rateLimitService.getRateLimitMetrics(hours);
    
    res.json({
      success: true,
      data: {
        metrics,
        timeRange: `${hours} hours`,
        timestamp: new Date().toISOString()
      },
      message: 'Rate limiting metrics retrieved successfully'
    });
  } catch (error) {
    console.error('Rate limiting metrics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rate limiting metrics',
      error: (error as Error).message
    });
  }
});

/**
 * Add a rate limit rule
 * POST /api/rate-limit/rules
 */
export async function addRateLimitRule(req: any, res: any) {
  try {
    const rule = {
      routeType: req.body.routeType,
      maxRequests: req.body.maxRequests,
      windowMinutes: req.body.windowMinutes,
      enabled: req.body.enabled !== false,
      priority: req.body.priority || 1,
      exemptPaths: req.body.exemptPaths || [],
      strictPaths: req.body.strictPaths || []
    };
    
    const createdRule = await rateLimitService.addRule(rule);
    
    res.status(201).json({
      success: true,
      rule: createdRule,
      message: 'Rate limit rule created successfully'
    });
  } catch (error) {
    console.error('Rate limit rule creation failed:', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to create rate limit rule',
      details: (error as Error).message
    });
  }
}

/**
 * Get all rate limit rules
 * GET /api/rate-limit/rules
 */
export async function getRateLimitRules(req: any, res: any) {
  try {
    const rules = await rateLimitService.getRules();
    
    res.json({
      success: true,
      rules,
      count: rules.length,
      message: 'Rate limit rules retrieved successfully'
    });
  } catch (error) {
    console.error('Rate limit rules retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit rules',
      message: (error as Error).message
    });
  }
}

/**
 * Update a rate limit rule
 * PUT /api/rate-limit/rules/:routeType
 */
export async function updateRateLimitRule(req: any, res: any) {
  try {
    const { routeType } = req.params;
    const updates = req.body;
    
    const updatedRule = await rateLimitService.updateRule(routeType, updates);
    
    res.json({
      success: true,
      rule: updatedRule,
      message: 'Rate limit rule updated successfully'
    });
  } catch (error) {
    console.error('Rate limit rule update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rate limit rule',
      message: (error as Error).message
    });
  }
}

/**
 * Remove a rate limit rule
 * DELETE /api/rate-limit/rules/:routeType
 */
export async function removeRateLimitRule(req: any, res: any) {
  try {
    const { routeType } = req.params;
    
    await rateLimitService.removeRule(routeType);
    
    res.json({
      success: true,
      message: `Rate limit rule for ${routeType} removed successfully`
    });
  } catch (error) {
    console.error('Rate limit rule removal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove rate limit rule',
      message: (error as Error).message
    });
  }
}

/**
 * Block an IP address
 * POST /api/rate-limit/block-ip
 */
export async function blockIP(req: any, res: any) {
  try {
    const { ip, durationMinutes = 60, reason = 'Rate limit violation' } = req.body;
    
    const blockedIP = await rateLimitService.blockIP(ip, durationMinutes, reason);
    
    res.json({
      success: true,
      blockedIP,
      message: `IP ${ip} blocked for rate limiting`
    });
  } catch (error) {
    console.error('IP blocking failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to block IP',
      message: (error as Error).message
    });
  }
}

/**
 * Unblock an IP address
 * POST /api/rate-limit/unblock-ip
 */
export async function unblockIP(req: any, res: any) {
  try {
    const { ip } = req.body;
    
    await rateLimitService.unblockIP(ip);
    
    res.json({
      success: true,
      message: `IP ${ip} unblocked successfully`
    });
  } catch (error) {
    console.error('IP unblocking failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock IP',
      message: (error as Error).message
    });
  }
}

/**
 * Get blocked IPs
 * GET /api/rate-limit/blocked-ips
 */
export async function getBlockedIPs(req: any, res: any) {
  try {
    const blockedIPs = await rateLimitService.getBlockedIPs();
    
    res.json({
      success: true,
      blockedIPs,
      count: blockedIPs.length,
      message: 'Blocked IPs retrieved successfully'
    });
  } catch (error) {
    console.error('Blocked IPs retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blocked IPs',
      message: (error as Error).message
    });
  }
}

/**
 * Get rate limiting metrics
 * GET /api/rate-limit/metrics
 */
export async function getRateLimitMetrics(req: any, res: any) {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const metrics = await rateLimitService.getRateLimitMetrics(hours);
    
    res.json({
      success: true,
      metrics,
      message: 'Rate limiting metrics retrieved successfully'
    });
  } catch (error) {
    console.error('Rate limiting metrics retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limiting metrics',
      message: (error as Error).message
    });
  }
}

/**
 * Check rate limit for a specific request
 * POST /api/rate-limit/check
 */
export async function checkRateLimit(req: any, res: any) {
  try {
    const { ip, routeType, path } = req.body;
    
    if (!ip || !routeType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ip, routeType'
      });
    }
    
    const isAllowed = await rateLimitService.checkRateLimit(ip, routeType, path);
    
    res.json({
      success: true,
      data: {
        allowed: isAllowed,
        ip,
        routeType,
        path: path || 'N/A',
        timestamp: new Date().toISOString()
      },
      message: `Rate limit check completed: ${isAllowed ? 'Allowed' : 'Blocked'}`
    });
  } catch (error) {
    console.error('Rate limit check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check rate limit',
      error: (error as Error).message
    });
  }
}

export default router;
