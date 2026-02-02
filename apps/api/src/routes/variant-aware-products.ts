/**
 * Variant-Aware Products API Routes
 * 
 * Provides endpoints for querying products with proper variant relationships
 * and parent-child grouping for enhanced frontend display.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/products/variant-aware
 * Get products with variant relationships and grouping
 */
router.get('/variant-aware', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { 
      page = '1', 
      limit = '50', 
      tenant_id,
      featured_type,
      category_id,
      min_price,
      max_price,
      on_sale,
      has_variants,
      product_type
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const whereConditions: any = [
      'tenant_id = $1',
      'item_status = $2',
      'stock > 0'
    ];

    const params: any[] = [user.tenantId, 'active'];

    if (featured_type) {
      whereConditions.push('featured_type = $' + (params.length + 1));
      params.push(featured_type);
    }

    if (category_id) {
      whereConditions.push('tenant_category_id = $' + (params.length + 1));
      params.push(category_id);
    }

    if (min_price) {
      whereConditions.push('price_cents >= $' + (params.length + 1));
      params.push(parseInt(min_price as string) * 100);
    }

    if (max_price) {
      whereConditions.push('price_cents <= $' + (params.length + 1));
      params.push(parseInt(max_price as string) * 100);
    }

    if (on_sale === 'true') {
      whereConditions.push('is_on_sale = $' + (params.length + 1));
      params.push(true);
    }

    if (has_variants === 'true') {
      whereConditions.push('has_variants = $' + (params.length + 1));
      params.push(true);
    }

    if (product_type === 'parent') {
      whereConditions.push('product_type = $' + (params.length + 1));
      params.push('parent');
    } else if (product_type === 'variant') {
      whereConditions.push('product_type = $' + (params.length + 1));
      params.push('variant');
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM storefront_products_mv 
      WHERE ${whereClause}
    `;
    
    const countResult = await prisma.$queryRawUnsafe(countQuery, params);
    const totalCount = parseInt((countResult as any)[0].total);

    // Get products with variant information
    const productsQuery = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        title,
        description,
        price_cents,
        sale_price_cents,
        stock,
        image_url,
        brand,
        item_status,
        availability,
        has_variants,
        tenant_category_id,
        created_at,
        updated_at,
        metadata,
        product_type,
        parent_item_id,
        variant_attributes,
        variant_name,
        variant_sort_order,
        variant_is_active,
        variant_group,
        parent_product,
        featured_type,
        featured_priority,
        is_featured_active,
        is_on_sale,
        auto_tagged_as_sale,
        discount_percentage,
        days_until_expiration,
        is_expired,
        is_expiring_soon
      FROM storefront_products_mv 
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN is_featured_active = true THEN featured_priority 
          ELSE 999 
        END ASC,
        is_on_sale DESC,
        discount_percentage DESC,
        name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, offset);

    const products = (await prisma.$queryRawUnsafe(productsQuery, params)) as any[];

    // Transform the data for frontend consumption
    const transformedProducts = products.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      price: row.price_cents / 100,
      originalPrice: row.price_cents / 100,
      salePrice: row.sale_price_cents ? row.sale_price_cents / 100 : undefined,
      discountPercentage: row.discount_percentage,
      onSale: row.is_on_sale,
      stock: row.stock,
      imageUrl: row.image_url,
      brand: row.brand,
      itemStatus: row.item_status,
      availability: row.availability,
      hasVariants: row.has_variants,
      tenantCategoryId: row.tenant_category_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata,
      productType: row.product_type,
      parentItemId: row.parent_item_id,
      variantAttributes: row.variant_attributes,
      variantName: row.variant_name,
      variantSortOrder: row.variant_sort_order,
      variantIsActive: row.variant_is_active,
      variantGroup: row.variant_group ? JSON.parse(row.variant_group) : null,
      parentProduct: row.parent_product ? JSON.parse(row.parent_product) : null,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      isFeaturedActive: row.is_featured_active,
      autoTaggedAsSale: row.auto_tagged_as_sale,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      currency: 'USD'
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      products: transformedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });

  } catch (error: any) {
    logger.error('[VARIANT-AWARE PRODUCTS] Query error:', error);
    res.status(500).json({
      success: false,
      error: 'query_failed',
      message: 'Failed to fetch variant-aware products',
      details: error.message
    });
  }
});

/**
 * GET /api/products/variant-aware/:id
 * Get a single product with full variant information
 */
router.get('/variant-aware/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const productQuery = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        title,
        description,
        price_cents,
        sale_price_cents,
        stock,
        image_url,
        brand,
        item_status,
        availability,
        has_variants,
        tenant_category_id,
        created_at,
        updated_at,
        metadata,
        product_type,
        parent_item_id,
        variant_attributes,
        variant_name,
        variant_sort_order,
        variant_is_active,
        variant_group,
        parent_product,
        featured_type,
        featured_priority,
        is_featured_active,
        is_on_sale,
        auto_tagged_as_sale,
        discount_percentage,
        days_until_expiration,
        is_expired,
        is_expiring_soon
      FROM storefront_products_mv 
      WHERE id = $1 AND tenant_id = $2
    `;

    const product = (await prisma.$queryRawUnsafe(productQuery, [id, user.tenantId])) as any[];

    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'product_not_found',
        message: 'Product not found'
      });
    }

    const row = product[0];

    // Transform the data
    const transformedProduct = {
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      price: row.price_cents / 100,
      originalPrice: row.price_cents / 100,
      salePrice: row.sale_price_cents ? row.sale_price_cents / 100 : undefined,
      discountPercentage: row.discount_percentage,
      onSale: row.is_on_sale,
      stock: row.stock,
      imageUrl: row.image_url,
      brand: row.brand,
      itemStatus: row.item_status,
      availability: row.availability,
      hasVariants: row.has_variants,
      tenantCategoryId: row.tenant_category_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata,
      productType: row.product_type,
      parentItemId: row.parent_item_id,
      variantAttributes: row.variant_attributes,
      variantName: row.variant_name,
      variantSortOrder: row.variant_sort_order,
      variantIsActive: row.variant_is_active,
      variantGroup: row.variant_group ? JSON.parse(row.variant_group) : null,
      parentProduct: row.parent_product ? JSON.parse(row.parent_product) : null,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      isFeaturedActive: row.is_featured_active,
      autoTaggedAsSale: row.auto_tagged_as_sale,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      currency: 'USD'
    };

    res.json({
      success: true,
      product: transformedProduct
    });

  } catch (error: any) {
    logger.error('[VARIANT-AWARE PRODUCTS] Single product error:', error);
    res.status(500).json({
      success: false,
      error: 'single_product_failed',
      message: 'Failed to fetch product details',
      details: error.message
    });
  }
});

/**
 * GET /api/products/parent/:parentId/variants
 * Get all variants for a specific parent product
 */
router.get('/parent/:parentId/variants', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const user = (req as any).user;

    // Verify parent product exists and user has access
    const parentQuery = `
      SELECT id, tenant_id, name, has_variants
      FROM storefront_products_mv 
      WHERE id = $1 AND tenant_id = $2 AND product_type = 'parent'
    `;

    const parentResult = (await prisma.$queryRawUnsafe(parentQuery, [parentId, user.tenantId])) as any[];

    if (parentResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'parent_not_found',
        message: 'Parent product not found'
      });
    }

    const parent = parentResult[0];

    if (!parent.has_variants) {
      return res.json({
        success: true,
        parent: {
          id: parent.id,
          name: parent.name,
          hasVariants: parent.has_variants
        },
        variants: [],
        message: 'This product does not have variants'
      });
    }

    // Get all variants for this parent
    const variantsQuery = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        title,
        description,
        price_cents,
        sale_price_cents,
        stock,
        image_url,
        brand,
        item_status,
        availability,
        variant_attributes,
        variant_name,
        variant_sort_order,
        variant_is_active,
        featured_type,
        featured_priority,
        is_featured_active,
        is_on_sale,
        auto_tagged_as_sale,
        discount_percentage,
        days_until_expiration,
        is_expired,
        is_expiring_soon
      FROM storefront_products_mv 
      WHERE parent_item_id = $1 AND tenant_id = $2 AND product_type = 'variant'
      ORDER BY variant_sort_order, variant_name
    `;

    const variants = (await prisma.$queryRawUnsafe(variantsQuery, [parentId, user.tenantId])) as any[];

    // Transform the data
    const transformedVariants = variants.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      price: row.price_cents / 100,
      originalPrice: row.price_cents / 100,
      salePrice: row.sale_price_cents ? row.sale_price_cents / 100 : undefined,
      discountPercentage: row.discount_percentage,
      onSale: row.is_on_sale,
      stock: row.stock,
      imageUrl: row.image_url,
      brand: row.brand,
      itemStatus: row.item_status,
      availability: row.availability,
      variantAttributes: row.variant_attributes,
      variantName: row.variant_name,
      variantSortOrder: row.variant_sort_order,
      variantIsActive: row.variant_is_active,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      isFeaturedActive: row.is_featured_active,
      autoTaggedAsSale: row.auto_tagged_as_sale,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      currency: 'USD'
    }));

    res.json({
      success: true,
      parent: {
        id: parent.id,
        name: parent.name,
        hasVariants: parent.has_variants
      },
      variants: transformedVariants,
      count: transformedVariants.length
    });

  } catch (error: any) {
    logger.error('[VARIANT-AWARE PRODUCTS] Variants query error:', error);
    res.status(500).json({
      success: false,
      error: 'variants_query_failed',
      message: 'Failed to fetch product variants',
      details: error.message
    });
  }
});

/**
 * GET /api/products/variant-groups
 * Get products grouped by variant relationships
 * Useful for displaying parent products with their variants
 */
router.get('/variant-groups', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { 
      page = '1', 
      limit = '20',
      featured_type,
      category_id,
      on_sale
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions for parent products only
    const whereConditions: any[] = [
      'tenant_id = $1',
      'product_type = $2',
      'has_variants = $3',
      'item_status = $4',
      'stock > 0'
    ];

    const params: any[] = [user.tenantId, 'parent', true, 'active'];

    if (featured_type) {
      whereConditions.push('featured_type = $' + (params.length + 1));
      params.push(featured_type);
    }

    if (category_id) {
      whereConditions.push('tenant_category_id = $' + (params.length + 1));
      params.push(category_id);
    }

    if (on_sale === 'true') {
      whereConditions.push('is_on_sale = $' + (params.length + 1));
      params.push(true);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM storefront_products_mv 
      WHERE ${whereClause}
    `;
    
    const countResult = await prisma.$queryRawUnsafe(countQuery, params);
    const totalCount = parseInt((countResult as any)[0].total);

    // Get parent products with variant groups
    const productsQuery = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        title,
        description,
        price_cents,
        sale_price_cents,
        stock,
        image_url,
        brand,
        item_status,
        availability,
        has_variants,
        tenant_category_id,
        created_at,
        updated_at,
        metadata,
        variant_group,
        featured_type,
        featured_priority,
        is_featured_active,
        is_on_sale,
        auto_tagged_as_sale,
        discount_percentage,
        days_until_expiration,
        is_expired,
        is_expiring_soon
      FROM storefront_products_mv 
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN is_featured_active = true THEN featured_priority 
          ELSE 999 
        END ASC,
        is_on_sale DESC,
        discount_percentage DESC,
        name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, offset);

    const products = (await prisma.$queryRawUnsafe(productsQuery, params)) as any[];

    // Transform the data
    const transformedProducts = products.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      price: row.price_cents / 100,
      originalPrice: row.price_cents / 100,
      salePrice: row.sale_price_cents ? row.sale_price_cents / 100 : undefined,
      discountPercentage: row.discount_percentage,
      onSale: row.is_on_sale,
      stock: row.stock,
      imageUrl: row.image_url,
      brand: row.brand,
      itemStatus: row.item_status,
      availability: row.availability,
      hasVariants: row.has_variants,
      tenantCategoryId: row.tenant_category_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata,
      variantGroup: row.variant_group ? JSON.parse(row.variant_group) : null,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      isFeaturedActive: row.is_featured_active,
      autoTaggedAsSale: row.auto_tagged_as_sale,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      currency: 'USD'
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      products: transformedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });

  } catch (error: any) {
    logger.error('[VARIANT-AWARE PRODUCTS] Variant groups error:', error);
    res.status(500).json({
      success: false,
      error: 'variant_groups_failed',
      message: 'Failed to fetch variant groups',
      details: error.message
    });
  }
});

export default router;
