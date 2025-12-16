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
import { user_role } from '@prisma/client';
import { isPlatformAdmin, isPlatformUser, canViewAllTenants, canPerformSupportActions } from '../utils/platform-admin';
import { generateQuickStartProducts, QuickStartScenario } from '../lib/quick-start';
import { validateSKULimits } from '../middleware/sku-limits';
import { requireTierFeature, requireWritableSubscription } from '../middleware/tier-access';
import { generateProductCatId, generateQsCatId, generateQuickStart } from '../lib/id-generator';

const router = Router();

// Rate limiting store (in-memory for now, move to Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for quick start (read-only, does not consume)
 * Limit: 1 quick start per tenant per 24 hours
 */
function checkRateLimit(tenantId: string): { allowed: boolean; resetAt?: number } {
  const now = Date.now();
  const key = `quick-start:${tenantId}`;
  const limit = rateLimitStore.get(key);

  if (limit && limit.resetAt > now) {
    return { allowed: false, resetAt: limit.resetAt };
  }

  return { allowed: true };
}

/**
 * Consume rate limit for quick start (call after successful quick start)
 * Sets the 24-hour cooldown
 */
function consumeRateLimit(tenantId: string): void {
  const now = Date.now();
  const key = `quick-start:${tenantId}`;
  
  // Set new rate limit (24 hours)
  const resetAt = now + 24 * 60 * 60 * 1000;
  rateLimitStore.set(key, { count: 1, resetAt });

  // Cleanup old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetAt <= now) {
      rateLimitStore.delete(k);
    }
  }
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
  scenario: z.enum([
    'grocery',
    'pharmacy',
    'fashion', 
    'electronics',
    'home_garden',
    'health_beauty',
    'sports_outdoors',
    'toys_games',
    'automotive',
    'books_media',
    'pet_supplies',
    'office_supplies',
    'jewelry',
    'baby_kids',
    'arts_crafts',
    'hardware_tools',
    'furniture',
    'restaurant',
    'general'
  ]),
  productCount: z.number().int().min(5).max(200).default(50),
  assignCategories: z.boolean().optional().default(true),
  createAsDrafts: z.boolean().optional().default(true),
  generateImages: z.boolean().optional().default(false), // NEW: Generate AI images
  imageQuality: z.enum(['standard', 'hd']).optional().default('standard'), // NEW: Image quality
  textModel: z.enum(['openai', 'google']).optional().default('openai'), // NEW: AI model for text/product generation
  imageModel: z.enum(['openai', 'google']).optional().default('openai'), // NEW: AI model for image generation
});

router.post('/tenants/:tenantId/quick-start', authenticateToken, requireWritableSubscription, requireTierFeature('quick_start_wizard_full'), validateSKULimits, async (req, res) => {
  try {
    console.log('[Quick Start] POST request received');
    const { tenantId } = req.params;
    const userId = (req as any).user?.userId;
    console.log('[Quick Start] Tenant ID:', tenantId, 'User ID:', userId);

    // Verify user is authenticated
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to use Quick Start',
      });
    }

    // Check permissions: platform support OR tenant owner/admin
    const user = (req as any).user;
    const userIsPlatformAdmin = isPlatformAdmin(user);
    const userCanPerformSupport = canPerformSupportActions(user);

    // Verify tenant exists and user has access
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        id: true,
        organization_id: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    // Platform admin/support can use Quick Start on any tenant
    if (userCanPerformSupport) {
      // Allowed - platform-level support
    }
    // Check tenant-level permissions (owner or admin)
    else {
      const { prisma: prismaClient } = await import('../prisma');
      const userTenant = await prismaClient.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id:userId,
            tenant_id:tenantId,
          },
        },
      });

      const isTenantOwnerOrAdmin = userTenant && (userTenant.role === 'OWNER' || userTenant.role === 'ADMIN');

      // If not tenant owner/admin, check org ownership (legacy)
      if (!isTenantOwnerOrAdmin && tenant.organization_id) {
        const organization = await prismaClient.organizations_list.findUnique({
          where: { id: tenant.organization_id },
          select: { owner_id: true },
        });

        if (!organization || organization.owner_id !== userId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to use Quick Start. Only platform support, tenant owners, or tenant admins can use this feature.',
          });
        }
      } else if (!isTenantOwnerOrAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to use Quick Start. Only platform support, tenant owners, or tenant admins can use this feature.',
        });
      }
    }
    // If tenant has no organization, allow any authenticated user (for backwards compatibility)
    // TODO: In production, all tenants should belong to an organization

    // Validate request body - handle both camelCase and snake_case due to universal transform middleware
    console.log('[Quick Start] Request body:', req.body);
    
    // Normalize the request body to handle both naming conventions
    const normalizedBody = {
      scenario: req.body.scenario,
      productCount: req.body.productCount || req.body.product_count,
      assignCategories: req.body.assignCategories || req.body.assign_categories,
      createAsDrafts: req.body.createAsDrafts || req.body.create_as_drafts,
      generateImages: req.body.generateImages || req.body.generate_images,
      imageQuality: req.body.imageQuality || req.body.image_quality,
      textModel: req.body.textModel || req.body.text_model,
      imageModel: req.body.imageModel || req.body.image_model,
    };
    
    console.log('[Quick Start] Normalized body:', normalizedBody);
    
    const parsed = quickStartSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      console.log('[Quick Start] Validation errors:', parsed.error.issues);
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    const { scenario, productCount, assignCategories, createAsDrafts, generateImages, imageQuality, textModel, imageModel } = quickStartSchema.parse(normalizedBody);

    // Check rate limit (platform support bypasses - they're helping multiple customers)
    // Tenant owners/admins are subject to rate limits on their own tenant
    if (!userCanPerformSupport) {
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
    const existingProductCount = await prisma.inventory_items.count({
      where: { tenant_id:tenantId },
    });

    if (existingProductCount > 10) {
      // Allow but log warning
      console.warn(`[Quick Start] Tenant ${tenantId} already has ${existingProductCount} products`);
    }

    // Generate products
    console.log(`[Quick Start] Generating ${productCount} ${scenario} products for tenant ${tenantId}`);
    if (generateImages) {
      console.log(`[Quick Start] ⏳ This may take 2-3 minutes. AI is generating products with images (${imageQuality} quality)...`);
      console.log(`[Quick Start] 💡 Images: Using ${imageModel === 'google' ? 'Google Imagen 3' : 'OpenAI DALL-E 3'} for professional product photography`);
      console.log(`[Quick Start] 💡 Text: Using ${textModel === 'google' ? 'Google Gemini' : 'OpenAI GPT-4'} for product generation`);
    } else {
      console.log(`[Quick Start] ⏳ This may take 30-60 seconds. AI is generating realistic products with detailed descriptions...`);
      console.log(`[Quick Start] 💡 Text: Using ${textModel === 'google' ? 'Google Gemini' : 'OpenAI GPT-4'} for product generation`);
    }
    
    const result = await generateQuickStartProducts({
      tenant_id: tenantId,
      scenario: scenario as QuickStartScenario,
      productCount,
      assignCategories,
      createAsDrafts,
      generateImages,
      imageQuality,
      textModel,
      imageModel,
    }, prisma);

    console.log(`[Quick Start] Success:`, result);

    // Consume rate limit after successful quick start (only for non-support users)
    if (!userCanPerformSupport) {
      consumeRateLimit(tenantId);
    }

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

    // Check if user can perform support actions (admin/support can create, viewer cannot)
    const user = (req as any).user;
    const userIsPlatformAdmin = isPlatformAdmin(user);
    const userCanPerformSupport = canPerformSupportActions(user);
    const userIsPlatformViewer = user.role === user_role.PLATFORM_VIEWER;
    const userCanView = canViewAllTenants(user);

    // Check rate limit (admin/support bypass this - they're helping customers)
    const rateLimit = userCanPerformSupport ? { allowed: true } : checkRateLimit(tenantId);
    
    // Check existing product count
    const productCount = await prisma.inventory_items.count({
      where: { tenant_id:tenantId },
    });

    // Configurable product limit (default: 500, allows testing multiple scenarios)
    // Platform admin/support bypass this limit to help multiple stores
    const productLimit = parseInt(process.env.QUICK_START_PRODUCT_LIMIT || '500', 10);
    const eligible = userCanPerformSupport || (rateLimit.allowed && productCount < productLimit);

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
        : userCanPerformSupport
        ? 'Platform Support: All limits bypassed. You can help customers with Quick Start anytime.'
        : userIsPlatformViewer
        ? 'Platform Viewer: You can view eligibility but cannot create products (read-only role).'
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
  businessType: z.enum([
    'grocery',
    'fashion', 
    'electronics',
    'home_garden',
    'health_beauty',
    'sports_outdoors',
    'toys_games',
    'automotive',
    'books_media',
    'pet_supplies',
    'office_supplies',
    'jewelry',
    'baby_kids',
    'arts_crafts',
    'hardware_tools',
    'furniture',
    'restaurant',
    'pharmacy',
    'general'
  ]),
  categoryCount: z.number().int().min(5).max(30).optional().default(15),
});

router.post('/tenants/:tenantId/categories/quick-start', authenticateToken, requireWritableSubscription, requireTierFeature('category_quick_start'), async (req, res) => {
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

    // Check permissions: platform support OR tenant owner/admin
    const user = (req as any).user;
    const userIsPlatformAdmin = isPlatformAdmin(user);
    const userCanPerformSupport = canPerformSupportActions(user);

    // Verify tenant exists and user has access
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        id: true,
        organization_id: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    // Platform admin/support can use Category Quick Start on any tenant
    if (userCanPerformSupport) {
      // Allowed - platform-level support
    }
    // Check tenant-level permissions (owner or admin)
    else {
      const { prisma: prismaClient } = await import('../prisma');
      const userTenant = await prismaClient.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id:userId,
            tenant_id:tenantId,
          },
        },
      });

      const isTenantOwnerOrAdmin = userTenant && (userTenant.role === 'OWNER' || userTenant.role === 'ADMIN');

      // If not tenant owner/admin, check org ownership (legacy)
      if (!isTenantOwnerOrAdmin && tenant.organization_id) {
        const organization = await prismaClient.organizations_list.findUnique({
          where: { id: tenant.organization_id },
          select: { owner_id: true },
        });

        if (!organization || organization.owner_id !== userId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to use Category Quick Start. Only platform support, tenant owners, or tenant admins can use this feature.',
          });
        }
      } else if (!isTenantOwnerOrAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to use Category Quick Start. Only platform support, tenant owners, or tenant admins can use this feature.',
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
    const existingCategoryCount = await prisma.directory_category.count({
      where: { tenantId: tenantId },
    });

    // Platform admin/support bypass category limit (viewer cannot create)
    if (!userCanPerformSupport && existingCategoryCount > 50) {
      return res.status(400).json({
        error: 'Too many categories',
        message: 'You already have 50+ categories. Category Quick Start is designed for new stores.',
      });
    }

    // Define taxonomy branches for each business type
    // These are the root paths in the Google Product Taxonomy hierarchy
    const taxonomyBranches: Record<string, string[][]> = {
      grocery: [
        ['Food, Beverages & Tobacco', 'Food Items'],
        ['Food, Beverages & Tobacco', 'Beverages'],
      ],
      fashion: [
        ['Apparel & Accessories', 'Clothing'],
        ['Apparel & Accessories', 'Shoes'],
        ['Apparel & Accessories', 'Clothing Accessories'],
      ],
      electronics: [
        ['Electronics', 'Computers'],
        ['Electronics', 'Audio'],
        ['Electronics', 'Cameras & Optics'],
        ['Electronics', 'Communications'],
      ],
      home_garden: [
        ['Home & Garden', 'Home Decor'],
        ['Home & Garden', 'Kitchen & Dining'],
        ['Home & Garden', 'Furniture'],
        ['Home & Garden', 'Lawn & Garden'],
      ],
      health_beauty: [
        ['Health & Beauty', 'Personal Care'],
        ['Health & Beauty', 'Health Care'],
        ['Health & Beauty', 'Bath & Body'],
      ],
      sports_outdoors: [
        ['Sporting Goods', 'Exercise & Fitness'],
        ['Sporting Goods', 'Outdoor Recreation'],
        ['Sporting Goods', 'Athletics'],
      ],
      toys_games: [
        ['Toys & Games', 'Toys'],
        ['Toys & Games', 'Games'],
        ['Toys & Games', 'Puzzles'],
      ],
      automotive: [
        ['Vehicles & Parts', 'Vehicle Parts & Accessories'],
        ['Vehicles & Parts', 'Motor Vehicle Care & Cleaning'],
      ],
      books_media: [
        ['Media', 'Books'],
        ['Media', 'Music & Sound Recordings'],
        ['Media', 'DVDs & Videos'],
      ],
      pet_supplies: [
        ['Animals & Pet Supplies', 'Pet Supplies'],
        ['Animals & Pet Supplies', 'Pet Food'],
      ],
      office_supplies: [
        ['Office Supplies', 'General Office Supplies'],
        ['Office Supplies', 'Paper Products'],
        ['Office Supplies', 'Presentation Supplies'],
      ],
      jewelry: [
        ['Apparel & Accessories', 'Jewelry'],
        ['Apparel & Accessories', 'Watches'],
      ],
      baby_kids: [
        ['Baby & Toddler', 'Baby Care'],
        ['Baby & Toddler', 'Baby Toys & Activity Equipment'],
        ['Baby & Toddler', 'Baby Transport'],
      ],
      arts_crafts: [
        ['Arts & Entertainment', 'Hobbies & Creative Arts'],
        ['Arts & Entertainment', 'Party & Celebration'],
      ],
      hardware_tools: [
        ['Hardware', 'Building Materials'],
        ['Hardware', 'Power & Hand Tools'],
        ['Hardware', 'Plumbing'],
      ],
      furniture: [
        ['Furniture', 'Living Room Furniture'],
        ['Furniture', 'Bedroom Furniture'],
        ['Furniture', 'Office Furniture'],
      ],
      restaurant: [
        ['Food, Beverages & Tobacco', 'Food Items', 'Prepared Foods'],
        ['Food, Beverages & Tobacco', 'Beverages'],
      ],
      pharmacy: [
        ['Health & Beauty', 'Health Care'],
        ['Health & Beauty', 'Personal Care'],
        ['Health & Beauty', 'Vitamins & Supplements'],
      ],
      general: [
        ['Home & Garden'],
        ['Health & Beauty'],
        ['Sporting Goods'],
        ['Toys & Games'],
        ['Office Supplies'],
        ['Arts & Entertainment'],
      ],
    };

    // Generate categories based on business type with Google taxonomy alignment
    const categoryTemplates: Record<string, Array<{ name: string; searchTerm: string }>> = {
      grocery: [
        { name: 'Fresh Produce', searchTerm: 'fresh produce fruits vegetables' },
        { name: 'Dairy & Eggs', searchTerm: 'dairy eggs milk cheese yogurt' },
        { name: 'Meat & Seafood', searchTerm: 'meat seafood fish chicken beef pork' },
        { name: 'Bakery', searchTerm: 'bakery bread pastries cakes' },
        { name: 'Frozen Foods', searchTerm: 'frozen food ice cream pizza meals' },
        { name: 'Beverages', searchTerm: 'beverages drinks juice soda coffee tea' },
        { name: 'Snacks & Candy', searchTerm: 'snacks candy chips cookies sweets' },
        { name: 'Canned Goods', searchTerm: 'canned goods preserved food' },
        { name: 'Pasta & Grains', searchTerm: 'pasta grains rice noodles cereal' },
        { name: 'Condiments & Sauces', searchTerm: 'condiments sauces spices seasonings' },
        { name: 'Health & Beauty', searchTerm: 'health beauty personal care cosmetics' },
        { name: 'Household Supplies', searchTerm: 'household cleaning supplies detergent' },
        { name: 'Pet Food', searchTerm: 'pet food dog cat animal supplies' },
        { name: 'Baby Products', searchTerm: 'baby products infant diapers formula' },
        { name: 'Deli', searchTerm: 'deli prepared food sandwiches salads' }
      ],
      fashion: [
        { name: 'Women\'s Clothing', searchTerm: 'women clothing apparel dresses tops' },
        { name: 'Men\'s Clothing', searchTerm: 'men clothing apparel shirts pants' },
        { name: 'Kids\' Clothing', searchTerm: 'kids children clothing apparel' },
        { name: 'Shoes', searchTerm: 'shoes footwear sneakers boots sandals' },
        { name: 'Accessories', searchTerm: 'fashion accessories bags purses' },
        { name: 'Jewelry', searchTerm: 'jewelry rings necklaces earrings' },
        { name: 'Handbags', searchTerm: 'handbags purses bags totes' },
        { name: 'Watches', searchTerm: 'watches timepieces wristwatches' },
        { name: 'Sunglasses', searchTerm: 'sunglasses eyewear shades' },
        { name: 'Belts', searchTerm: 'belts leather accessories' },
        { name: 'Hats', searchTerm: 'hats caps headwear' },
        { name: 'Scarves', searchTerm: 'scarves wraps shawls' }
      ],
      electronics: [
        { name: 'Mobile Phones', searchTerm: 'mobile phones smartphones cell' },
        { name: 'Computers & Laptops', searchTerm: 'computers laptops notebooks desktops' },
        { name: 'Tablets', searchTerm: 'tablets ipad android slate' },
        { name: 'Audio & Headphones', searchTerm: 'audio headphones speakers earbuds' },
        { name: 'Cameras', searchTerm: 'cameras photography digital dslr' },
        { name: 'Gaming', searchTerm: 'gaming video games consoles' },
        { name: 'Smart Home', searchTerm: 'smart home automation devices' },
        { name: 'Wearables', searchTerm: 'wearables smartwatch fitness tracker' },
        { name: 'Accessories', searchTerm: 'electronics accessories peripherals' },
        { name: 'Cables & Chargers', searchTerm: 'cables chargers adapters power' }
      ],
      general: [
        { name: 'Home & Garden', searchTerm: 'home garden furniture decor' },
        { name: 'Health & Beauty', searchTerm: 'health beauty cosmetics skincare' },
        { name: 'Sports & Outdoors', searchTerm: 'sports outdoors fitness camping' },
        { name: 'Toys & Games', searchTerm: 'toys games puzzles board games' },
        { name: 'Books', searchTerm: 'books reading literature magazines' },
        { name: 'Office Supplies', searchTerm: 'office supplies stationery paper' },
        { name: 'Pet Supplies', searchTerm: 'pet supplies dog cat animal' },
        { name: 'Automotive', searchTerm: 'automotive car parts accessories' },
        { name: 'Tools & Hardware', searchTerm: 'tools hardware construction' },
        { name: 'Arts & Crafts', searchTerm: 'arts crafts hobbies supplies' },
        { name: 'Party Supplies', searchTerm: 'party supplies decorations celebrations' },
        { name: 'Seasonal', searchTerm: 'seasonal holiday decorations' },
        { name: 'Gifts', searchTerm: 'gifts presents novelties' },
        { name: 'Electronics', searchTerm: 'electronics gadgets devices' },
        { name: 'Clothing', searchTerm: 'clothing apparel fashion' },
        { name: 'Food & Beverage', searchTerm: 'food beverage grocery' },
        { name: 'Home Improvement', searchTerm: 'home improvement renovation building' },
        { name: 'Baby & Kids', searchTerm: 'baby kids children products' },
        { name: 'Jewelry & Accessories', searchTerm: 'jewelry accessories fashion' },
        { name: 'Furniture', searchTerm: 'furniture home living room' }
      ],
    };

    const allCategories = categoryTemplates[businessType] || categoryTemplates.general;
    
    // Limit to requested count
    const categories = allCategories.slice(0, categoryCount);

    // Fetch existing categories to avoid duplicates
    const existingCategories = await prisma.directory_category.findMany({
      where: { tenantId: tenantId },
      select: { name: true, slug: true },
    });

    const existingNames = new Set(existingCategories.map(c => c.name.toLowerCase()));
    const existingSlugs = new Set(existingCategories.map(c => c.slug));

    // Filter out categories that already exist (by name)
    const categoriesToCreate = categories.filter(cat => {
      const nameExists = existingNames.has(cat.name.toLowerCase());
      if (nameExists) {
        console.log(`[Category Quick Start] Skipping duplicate category: "${cat.name}"`);
      }
      return !nameExists;
    });

    if (categoriesToCreate.length === 0) {
      return res.json({
        success: true,
        categoriesCreated: 0,
        categories: [],
        message: 'All categories already exist. No new categories were created.',
      });
    }

    console.log(`[Category Quick Start] Creating ${categoriesToCreate.length} new categories (${categories.length - categoriesToCreate.length} duplicates skipped)`);

    // Import Google taxonomy functions
    const { suggestCategories, getCategoryById, selectRandomFromBranch } = await import('../lib/google/taxonomy');

    // NEW: Use hierarchical branch-based generation if branches are defined
    const branches = taxonomyBranches[businessType];
    let hierarchicalCategories: Array<{ node: any; name: string }> = [];
    
    if (branches && branches.length > 0) {
      console.log(`[Category Quick Start] Using hierarchical branch generation for ${businessType}`);
      
      // Distribute category count across branches
      const perBranch = Math.ceil(categoriesToCreate.length / branches.length);
      
      for (const branch of branches) {
        const branchCategories = selectRandomFromBranch(branch, perBranch, {
          minDepth: 1,
          maxDepth: 3,
          diversify: true,
        });
        
        // Use the last part of the path as the friendly name
        hierarchicalCategories.push(...branchCategories.map(node => ({
          node,
          name: node.path[node.path.length - 1], // Use leaf name
        })));
      }
      
      // Trim to requested count
      hierarchicalCategories = hierarchicalCategories.slice(0, categoriesToCreate.length);
      
      console.log(`[Category Quick Start] Generated ${hierarchicalCategories.length} hierarchical categories from ${branches.length} branches`);
    }

    // Create categories with Google taxonomy alignment
    const createdCategories = await Promise.all(
      categoriesToCreate.map(async (cat, index) => {
        let googleCategoryId: string | null = null;
        let categoryName = cat.name;
        
        // Use hierarchical category if available
        if (hierarchicalCategories[index]) {
          const hierarchical = hierarchicalCategories[index];
          googleCategoryId = hierarchical.node.id;
          categoryName = hierarchical.name;
          
          console.log(`[Category Quick Start] Using hierarchical category: "${categoryName}" (${hierarchical.node.path.join(' > ')})`);
        } else {
          // Fallback to keyword matching
          const suggestions = suggestCategories(cat.searchTerm, 1);
          googleCategoryId = suggestions.length > 0 ? suggestions[0].id : null;
        }
        
        // Log the mapping for transparency
        if (googleCategoryId) {
          const googleCat = getCategoryById(googleCategoryId);
          console.log(`[Category Quick Start] Mapped "${cat.name}" to Google category: ${googleCat?.path.join(' > ')} (ID: ${googleCategoryId})`);
        } else {
          console.warn(`[Category Quick Start] No Google category found for "${cat.name}" (search: ${cat.searchTerm})`);
        }

        // Generate slug from final category name
        const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        // Check if a category with this slug already exists (handles Clover demo duplicates)
        const existingBySlug = await prisma.directory_category.findFirst({
          where: { tenantId, slug }
        });
        
        if (existingBySlug) {
          console.log(`[Category Quick Start] Found existing category by slug "${slug}": ${existingBySlug.id} - updating with Google taxonomy if missing`);
          
          // Update existing category with Google taxonomy ID if it doesn't have one
          if (!existingBySlug.googleCategoryId && googleCategoryId) {
            await prisma.directory_category.update({
              where: { id: existingBySlug.id },
              data: { 
                googleCategoryId,
                updatedAt: new Date()
              }
            });
            console.log(`[Category Quick Start] Updated existing category "${existingBySlug.name}" with Google taxonomy ID: ${googleCategoryId}`);
          }
          
          return existingBySlug; // Return existing instead of creating duplicate
        }

        return prisma.directory_category.create({
          data: {
            id: generateProductCatId(tenantId),
            tenantId,
            name: categoryName, // Use the hierarchical or template name
            slug,
            googleCategoryId,
            sortOrder: index,
            isActive: true,
          updatedAt: new Date(),
          } as any,
        });
      })
    );

    console.log(`[Category Quick Start] Created ${createdCategories.length} categories for tenant ${tenantId}`);

    const duplicatesSkipped = categories.length - categoriesToCreate.length;
    const responseMessage = duplicatesSkipped > 0
      ? `Created ${createdCategories.length} new categories. Skipped ${duplicatesSkipped} duplicate${duplicatesSkipped === 1 ? '' : 's'}.`
      : undefined;

    res.json({
      success: true,
      categoriesCreated: createdCategories.length,
      duplicatesSkipped,
      categories: createdCategories.map(c => ({ id: c.id, name: c.name })),
      ...(responseMessage && { message: responseMessage }),
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
