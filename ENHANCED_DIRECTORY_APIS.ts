// ============================================================================
// ENHANCED DIRECTORY API ENDPOINTS WITH 3-CATEGORY SUPPORT
// ============================================================================

import { Request, Response } from 'express';
import { getCategoryCounts } from '../utils/category-counts';

/**
 * Enhanced GET /api/directory/categories - Support category type filtering
 * Query parameters:
 * - tenantId: required
 * - categoryType: optional filter ('tenant', 'gbp_primary', 'gbp_secondary', 'platform')
 */
export async function getCategoriesEnhanced(req: Request, res: Response) {
  try {
    const { tenantId, categoryType } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ 
        error: 'Tenant ID is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    // Validate categoryType if provided
    const validTypes = ['tenant', 'gbp_primary', 'gbp_secondary', 'platform'];
    if (categoryType && !validTypes.includes(categoryType as string)) {
      return res.status(400).json({ 
        error: 'Invalid categoryType. Must be one of: ' + validTypes.join(', '),
        code: 'INVALID_CATEGORY_TYPE'
      });
    }

    const categories = await getCategoryCounts(
      tenantId, 
      false, 
      categoryType as any
    );

    // Group by category type for enhanced frontend response
    const groupedCategories = categories.reduce((acc, cat) => {
      const type = cat.categoryType || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(cat);
      return acc;
    }, {} as Record<string, typeof categories>);

    res.json({
      success: true,
      data: {
        categories: categoryType ? categories : groupedCategories,
        summary: {
          totalCategories: categories.length,
          categoryTypes: [...new Set(categories.map(c => c.categoryType))],
          totalProducts: categories.reduce((sum, cat) => sum + (cat.count || 0), 0),
          filterApplied: categoryType || null
        }
      }
    });

  } catch (error) {
    console.error('[Enhanced Categories API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/directory/categories/types - Get available category types for tenant
 */
export async function getCategoryTypes(req: Request, res: Response) {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ 
        error: 'Tenant ID is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    // Get all categories to determine available types
    const allCategories = await getCategoryCounts(tenantId);
    
    // Group by category type and count
    const typeSummary = allCategories.reduce((acc, cat) => {
      const type = cat.categoryType || 'unknown';
      if (!acc[type]) {
        acc[type] = {
          type,
          count: 0,
          products: 0,
          isPrimary: false,
          categories: []
        };
      }
      acc[type].count++;
      acc[type].products += cat.count || 0;
      acc[type].isPrimary = acc[type].isPrimary || (cat.isPrimary === true);
      acc[type].categories.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        count: cat.count
      });
      return acc;
    }, {} as Record<string, any>);

    // Order by priority: tenant > gbp_primary > gbp_secondary > platform
    const orderedTypes = ['tenant', 'gbp_primary', 'gbp_secondary', 'platform'];
    const availableTypes = orderedTypes
      .filter(type => typeSummary[type])
      .map(type => typeSummary[type]);

    res.json({
      success: true,
      data: {
        tenantId,
        availableTypes,
        summary: {
          totalTypes: availableTypes.length,
          totalCategories: allCategories.length,
          totalProducts: allCategories.reduce((sum, cat) => sum + (cat.count || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('[Category Types API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category types',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * GET /api/directory/categories/summary - Get category summary with all types
 */
export async function getCategoriesSummary(req: Request, res: Response) {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ 
        error: 'Tenant ID is required',
        code: 'MISSING_TENANT_ID'
      });
    }

    const categories = await getCategoryCounts(tenantId);

    // Comprehensive summary
    const summary = {
      tenantId,
      totalCategories: categories.length,
      totalProducts: categories.reduce((sum, cat) => sum + (cat.count || 0), 0),
      categoryTypes: {
        tenant: categories.filter(c => c.categoryType === 'tenant'),
        gbp_primary: categories.filter(c => c.categoryType === 'gbp_primary'),
        gbp_secondary: categories.filter(c => c.categoryType === 'gbp_secondary'),
        platform: categories.filter(c => c.categoryType === 'platform')
      },
      primaryCategories: categories.filter(c => c.isPrimary === true),
      secondaryCategories: categories.filter(c => c.isPrimary === false),
      topCategories: categories
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 10)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          type: cat.categoryType,
          count: cat.count,
          isPrimary: cat.isPrimary
        }))
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('[Categories Summary API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories summary',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Route registration helper
export function registerEnhancedDirectoryRoutes(app: any) {
  // Enhanced categories endpoint with filtering
  app.get('/api/directory/categories/enhanced', getCategoriesEnhanced);
  
  // Category types endpoint
  app.get('/api/directory/categories/types', getCategoryTypes);
  
  // Categories summary endpoint
  app.get('/api/directory/categories/summary', getCategoriesSummary);

  console.log('[Enhanced Directory APIs] Registered 3-category system endpoints');
}
