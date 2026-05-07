import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { clear } from '../lib/cache-service';

const router = Router();

/**
 * POST /api/cache/invalidate
 * Invalidate API cache for specific patterns
 * This helps clear both Redis cache and forces browser cache refresh
 */
router.post('/invalidate', authenticateToken, async (req, res) => {
  try {
    const { patterns } = req.body;
    
    if (!patterns || !Array.isArray(patterns)) {
      return res.status(400).json({ error: 'patterns array is required' });
    }

    console.log('[Cache Invalidation] Clearing cache patterns:', patterns);
    
    // Clear Redis cache for each pattern
    const results = [];
    for (const pattern of patterns) {
      try {
        await clear(pattern);
        results.push({ pattern, status: 'success' });
        console.log(`[Cache Invalidation] Cleared pattern: ${pattern}`);
      } catch (error) {
        console.error(`[Cache Invalidation] Failed to clear pattern ${pattern}:`, error);
        results.push({ pattern, status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Response with no-cache headers to force browser refresh
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      cleared: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    });
    
  } catch (error) {
    console.error('[Cache Invalidation] Error:', error);
    res.status(500).json({ error: 'Cache invalidation failed' });
  }
});

/**
 * POST /api/cache/invalidate/tenants
 * Specifically invalidate tenant-related caches
 */
router.post('/invalidate/tenants', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    console.log('[Cache Invalidation] Clearing tenant caches for:', tenantId || 'all tenants');
    
    // Common tenant cache patterns
    const patterns = [
      'admin:tenants',
      'tenant:*',
      'tenants:*',
      'directory:*',
      'featured:*'
    ];
    
    // If specific tenant, add tenant-specific patterns
    if (tenantId) {
      patterns.push(
        `tenant:${tenantId}:*`,
        `*:${tenantId}:*`,
        `tenants:*${tenantId}*`
      );
    }
    
    // Clear all patterns
    const results = [];
    for (const pattern of patterns) {
      try {
        await clear(pattern);
        results.push({ pattern, status: 'success' });
        console.log(`[Cache Invalidation] Cleared pattern: ${pattern}`);
      } catch (error) {
        console.error(`[Cache Invalidation] Failed to clear pattern ${pattern}:`, error);
        results.push({ pattern, status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Response with no-cache headers to force browser refresh
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      tenantId,
      cleared: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      patterns: patterns.length,
      results
    });
    
  } catch (error) {
    console.error('[Cache Invalidation] Tenant cache error:', error);
    res.status(500).json({ error: 'Tenant cache invalidation failed' });
  }
});

export default router;
