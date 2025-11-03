/**
 * Quick Start API Routes
 * 
 * Provides endpoints for the Quick Start wizard that generates
 * starter products for new tenants.
 */

import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { generateQuickStartProducts, getAvailableScenarios, QuickStartScenario } from '../lib/quick-start';

const router = Router();
const prisma = new PrismaClient();

// Rate limiting store (in-memory for now, move to Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for quick start
 * Limit: 1 quick start per tenant per 24 hours
 */
function checkRateLimit(tenantId: string): { allowed: boolean; resetAt?: number } {
  const now = Date.now();
  const key = `quick-start:${tenantId}`;
  const limit = rateLimitStore.get(key);

  if (limit && limit.resetAt > now) {
    return { allowed: false, resetAt: limit.resetAt };
  }

  // Set new rate limit (24 hours)
  const resetAt = now + 24 * 60 * 60 * 1000;
  rateLimitStore.set(key, { count: 1, resetAt });

  // Cleanup old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetAt <= now) {
      rateLimitStore.delete(k);
    }
  }

  return { allowed: true };
}

/**
 * GET /api/v1/quick-start/scenarios
 * Get available quick start scenarios
 */
router.get('/scenarios', async (req, res) => {
  try {
    const scenarios = getAvailableScenarios();
    res.json({ scenarios });
  } catch (error: any) {
    console.error('[Quick Start] Error fetching scenarios:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios', message: error.message });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/quick-start
 * Generate quick start products for a tenant
 * 
 * Body:
 * - scenario: 'grocery' | 'fashion' | 'electronics' | 'general'
 * - productCount: number (25, 50, or 100)
 * - assignCategories: boolean (default: true)
 * - createAsDrafts: boolean (default: true)
 */
const quickStartSchema = z.object({
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']),
  productCount: z.number().int().min(1).max(100),
  assignCategories: z.boolean().optional().default(true),
  createAsDrafts: z.boolean().optional().default(true),
});

router.post('/tenants/:tenantId/quick-start', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // TODO: Add authentication check
    // Verify user has permission to manage this tenant

    // Validate request body
    const parsed = quickStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    const { scenario, productCount, assignCategories, createAsDrafts } = parsed.data;

    // Check rate limit
    const rateLimit = checkRateLimit(tenantId);
    if (!rateLimit.allowed) {
      const hoursRemaining = Math.ceil((rateLimit.resetAt! - Date.now()) / (1000 * 60 * 60));
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Quick Start can only be used once per 24 hours. Try again in ${hoursRemaining} hours.`,
        resetAt: rateLimit.resetAt,
      });
    }

    // Check if tenant already has products (warn if > 10)
    const existingProductCount = await prisma.inventoryItem.count({
      where: { tenantId },
    });

    if (existingProductCount > 10) {
      // Allow but log warning
      console.warn(`[Quick Start] Tenant ${tenantId} already has ${existingProductCount} products`);
    }

    // Generate products
    console.log(`[Quick Start] Generating ${productCount} ${scenario} products for tenant ${tenantId}`);
    
    const result = await generateQuickStartProducts({
      tenantId,
      scenario: scenario as QuickStartScenario,
      productCount,
      assignCategories,
      createAsDrafts,
    });

    console.log(`[Quick Start] Success:`, result);

    res.json({
      success: true,
      ...result,
      message: createAsDrafts
        ? 'Draft products created! Review and activate when ready.'
        : 'Products created successfully!',
    });
  } catch (error: any) {
    console.error('[Quick Start] Error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Tenant not found', message: error.message });
    }
    
    res.status(500).json({
      error: 'Failed to generate products',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/quick-start/eligibility
 * Check if tenant is eligible for quick start
 */
router.get('/tenants/:tenantId/quick-start/eligibility', async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Check rate limit
    const rateLimit = checkRateLimit(tenantId);
    
    // Check existing product count
    const productCount = await prisma.inventoryItem.count({
      where: { tenantId },
    });

    const eligible = rateLimit.allowed && productCount < 100;

    res.json({
      eligible,
      productCount,
      rateLimitReached: !rateLimit.allowed,
      resetAt: rateLimit.resetAt,
      recommendation: productCount === 0
        ? 'Quick Start is perfect for you! Get started with pre-built products.'
        : productCount < 10
        ? 'You have a few products. Quick Start can add more to help you get going.'
        : productCount < 100
        ? 'You already have products. Quick Start will add to your existing inventory.'
        : 'You have a full inventory! Quick Start is not needed.',
    });
  } catch (error: any) {
    console.error('[Quick Start] Error checking eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility', message: error.message });
  }
});

export default router;
