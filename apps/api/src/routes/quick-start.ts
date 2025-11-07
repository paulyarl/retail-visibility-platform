/**
 * Quick Start API Routes
 * 
 * Provides endpoints for the Quick Start wizard that generates
 * starter products for new tenants.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { isPlatformAdmin, isPlatformUser, canViewAllTenants } from '../utils/platform-admin';
import { generateQuickStartProducts, QuickStartScenario } from '../lib/quick-start';
import { validateSKULimits } from '../middleware/sku-limits';
import { requireTierFeature } from '../middleware/tier-access';

const router = Router();

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
    const scenarios = [
      { id: 'grocery', name: 'Grocery Store', description: 'Fresh produce, dairy, meat, and packaged goods' },
      { id: 'fashion', name: 'Fashion Retail', description: 'Clothing, accessories, and footwear' },
      { id: 'electronics', name: 'Electronics Store', description: 'Phones, computers, and tech accessories' },
      { id: 'general', name: 'General Retail', description: 'Mixed merchandise for general stores' },
    ];
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

router.post('/tenants/:tenantId/quick-start', authenticateToken, requireTierFeature('quick_start_wizard'), validateSKULimits, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId;

    // Verify user is authenticated
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to use Quick Start',
      });
    }

    // Check if user is a platform user (platform users can use Quick Start on any tenant)
    const user = (req as any).user;
    const userIsPlatformAdmin = isPlatformAdmin(user);
    const userIsPlatformUser = isPlatformUser(user);

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        id: true,
        organizationId: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    // Check if user has access to this tenant's organization
    // Platform users bypass this check
    if (!userIsPlatformUser && tenant.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: tenant.organizationId },
        select: { ownerId: true },
      });

      if (!organization || organization.ownerId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to manage this tenant. Only the organization owner or platform users can use Quick Start.',
        });
      }
    }
    // If tenant has no organization, allow any authenticated user (for backwards compatibility)
    // TODO: In production, all tenants should belong to an organization

    // Validate request body
    const parsed = quickStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    const { scenario, productCount, assignCategories, createAsDrafts } = parsed.data;

    // Check rate limit (all platform users bypass this - they're helping customers)
    if (!userIsPlatformUser) {
      const rateLimit = checkRateLimit(tenantId);
      if (!rateLimit.allowed) {
        const hoursRemaining = Math.ceil((rateLimit.resetAt! - Date.now()) / (1000 * 60 * 60));
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Quick Start can only be used once per 24 hours. Try again in ${hoursRemaining} hours.`,
          resetAt: rateLimit.resetAt,
        });
      }
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
router.get('/tenants/:tenantId/quick-start/eligibility', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId;

    // Verify user is authenticated
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to check eligibility',
      });
    }

    // Check if user is a platform user (platform users bypass all limits)
    const user = (req as any).user;
    const userIsPlatformAdmin = isPlatformAdmin(user);
    const userIsPlatformUser = isPlatformUser(user);
    const userCanView = canViewAllTenants(user);

    // Check rate limit (all platform users bypass this - they're helping customers)
    const rateLimit = userIsPlatformUser ? { allowed: true } : checkRateLimit(tenantId);
    
    // Check existing product count
    const productCount = await prisma.inventoryItem.count({
      where: { tenantId },
    });

    // Configurable product limit (default: 500, allows testing multiple scenarios)
    // Platform users bypass this limit to help multiple stores
    const productLimit = parseInt(process.env.QUICK_START_PRODUCT_LIMIT || '500', 10);
    const eligible = userIsPlatformUser || (rateLimit.allowed && productCount < productLimit);

    res.json({
      eligible,
      productCount,
      productLimit,
      isPlatformAdmin: userIsPlatformAdmin,
      canView: userCanView,
      rateLimitReached: !rateLimit.allowed,
      resetAt: rateLimit.resetAt,
      recommendation: userIsPlatformAdmin
        ? 'Platform Admin: All limits bypassed. You can use Quick Start anytime.'
        : userIsPlatformUser
        ? 'Platform User: All limits bypassed. You can help customers with Quick Start anytime.'
        : userCanView
        ? 'Platform Viewer: You can view eligibility but cannot create products.'
        : productCount === 0
        ? 'Quick Start is perfect for you! Get started with pre-built products.'
        : productCount < 50
        ? 'You have a few products. Quick Start can add more to help you get going.'
        : productCount < productLimit
        ? 'You already have products. Quick Start will add to your existing inventory.'
        : `You have ${productCount} products (limit: ${productLimit}). Quick Start is not available.`,
    });
  } catch (error: any) {
    console.error('[Quick Start] Error checking eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility', message: error.message });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/categories/quick-start
 * Generate starter categories for a tenant
 */
const categoryQuickStartSchema = z.object({
  businessType: z.enum(['grocery', 'fashion', 'electronics', 'general']),
  categoryCount: z.number().int().min(5).max(30).optional().default(15),
});

router.post('/tenants/:tenantId/categories/quick-start', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId;

    // Verify user is authenticated
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to use Category Quick Start',
      });
    }

    // Check if user is a platform admin (admins can use Quick Start on any tenant)
    const user = (req as any).user;
    const userIsPlatformAdmin = isPlatformAdmin(user);

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        id: true,
        organizationId: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    // Check if user has access to this tenant's organization
    // Platform admins bypass this check
    if (!userIsPlatformAdmin && tenant.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: tenant.organizationId },
        select: { ownerId: true },
      });

      if (!organization || organization.ownerId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to manage this tenant. Only the organization owner or platform admins can use Category Quick Start.',
        });
      }
    }

    // Validate request body
    const parsed = categoryQuickStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    const { businessType, categoryCount } = parsed.data;

    // Check if tenant already has categories (optional warning, not blocking)
    const existingCategoryCount = await prisma.tenantCategory.count({
      where: { tenantId },
    });

    // Platform admins bypass category limit
    if (!userIsPlatformAdmin && existingCategoryCount > 50) {
      return res.status(400).json({
        error: 'Too many categories',
        message: 'You already have 50+ categories. Category Quick Start is designed for new stores.',
      });
    }

    // Generate categories based on business type
    const categoryTemplates: Record<string, string[]> = {
      grocery: [
        'Fresh Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Frozen Foods',
        'Beverages', 'Snacks & Candy', 'Canned Goods', 'Pasta & Grains', 'Condiments & Sauces',
        'Health & Beauty', 'Household Supplies', 'Pet Food', 'Baby Products', 'Deli'
      ],
      fashion: [
        'Women\'s Clothing', 'Men\'s Clothing', 'Kids\' Clothing', 'Shoes', 'Accessories',
        'Jewelry', 'Handbags', 'Watches', 'Sunglasses', 'Belts', 'Hats', 'Scarves'
      ],
      electronics: [
        'Mobile Phones', 'Computers & Laptops', 'Tablets', 'Audio & Headphones', 'Cameras',
        'Gaming', 'Smart Home', 'Wearables', 'Accessories', 'Cables & Chargers'
      ],
      general: [
        'Home & Garden', 'Health & Beauty', 'Sports & Outdoors', 'Toys & Games', 'Books',
        'Office Supplies', 'Pet Supplies', 'Automotive', 'Tools & Hardware', 'Arts & Crafts',
        'Party Supplies', 'Seasonal', 'Gifts', 'Electronics', 'Clothing', 'Food & Beverage',
        'Home Improvement', 'Baby & Kids', 'Jewelry & Accessories', 'Furniture'
      ],
    };

    const allCategories = categoryTemplates[businessType] || categoryTemplates.general;
    
    // Limit to requested count
    const categories = allCategories.slice(0, categoryCount);

    // Create categories
    const createdCategories = await Promise.all(
      categories.map((name, index) =>
        prisma.tenantCategory.create({
          data: {
            tenantId,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            sortOrder: index,
            isActive: true,
          },
        })
      )
    );

    console.log(`[Category Quick Start] Created ${createdCategories.length} categories for tenant ${tenantId}`);

    res.json({
      success: true,
      categoriesCreated: createdCategories.length,
      categories: createdCategories.map(c => ({ id: c.id, name: c.name })),
    });
  } catch (error: any) {
    console.error('[Category Quick Start] Error:', error);
    res.status(500).json({
      error: 'Failed to generate categories',
      message: error.message,
    });
  }
});

export default router;
