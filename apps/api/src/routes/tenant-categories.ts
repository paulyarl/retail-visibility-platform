import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { triggerRevalidate } from '../utils/revalidate';
import { categoryService } from '../services/CategoryService';

const router = Router();

// Validation schemas
const createCategorySchema = z.object({
  tenantId: z.string().cuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  parentId: z.string().cuid().optional(),
  googleCategoryId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  parentId: z.string().cuid().optional().nullable(),
  googleCategoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const alignCategorySchema = z.object({
  googleCategoryId: z.string().min(1),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/tenants/:tenantId/categories
 * List categories for a tenant with optional search, mapped filter, and cursor pagination
 * Query:
 *  - search: string (name/slug contains)
 *  - mapped: 'true' | 'false' | undefined
 *  - includeInactive: 'true' | 'false'
 *  - limit: number (max 50, default 50)
 *  - cursor: string (id of last item from previous page)
 */
router.get('/:tenantId/categories', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      includeInactive = 'false',
      parentId,
      search,
      mapped,
      limit,
      cursor,
    } = req.query;

    const where: any = { tenantId };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (parentId === 'null') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { slug: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (mapped === 'true') {
      where.googleCategoryId = { not: null };
    } else if (mapped === 'false') {
      where.googleCategoryId = null;
    }

    const take = Math.min(Math.max(parseInt(String(limit || '50'), 10) || 50, 1), 50);

    const findArgs: any = {
      where,
      orderBy: { id: 'asc' as const },
      take: take + 1, // fetch one extra to determine nextCursor
    };
    if (cursor && typeof cursor === 'string') {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1; // skip the cursor item itself
    }

    const result = await prisma.tenantCategory.findMany(findArgs);
    const hasMore = result.length > take;
    const categories = hasMore ? result.slice(0, take) : result;
    const nextCursor = hasMore ? categories[categories.length - 1]?.id : undefined;

    // Calculate mapping stats
    const totalCategories = categories.length;
    const mappedCategories = categories.filter(c => c.googleCategoryId).length;
    const mappingCoverage = totalCategories > 0 
      ? (mappedCategories / totalCategories) * 100 
      : 0;

    res.json({
      success: true,
      data: categories,
      nextCursor,
      stats: {
        total: totalCategories,
        mapped: mappedCategories,
        unmapped: totalCategories - mappedCategories,
        mappingCoverage: parseFloat(mappingCoverage.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/categories/:id
 * Get a specific category
 */
router.get('/:tenantId/categories/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const category = await prisma.tenantCategory.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Get Google taxonomy info if mapped
    let googleCategory = null;
    if (category.googleCategoryId) {
      googleCategory = await prisma.googleTaxonomy.findUnique({
        where: { categoryId: category.googleCategoryId },
      });
    }

    // Get child categories count
    const childCount = await prisma.tenantCategory.count({
      where: {
        tenantId,
        parentId: id,
        isActive: true,
      },
    });

    // Get products using this category count
    const productCount = await prisma.inventoryItem.count({
      where: {
        tenantId,
        categoryPath: {
          has: category.slug,
        },
      },
    });

    res.json({
      success: true,
      data: {
        ...category,
        googleCategory,
        childCount,
        productCount,
      },
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category',
    });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/categories
 * Create a new category
 */
router.post('/:tenantId/categories', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = createCategorySchema.parse({ ...req.body, tenantId });

    // Check for duplicate slug
    const existing = await prisma.tenantCategory.findFirst({
      where: {
        tenantId,
        slug: body.slug,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Category with this slug already exists',
      });
    }

    // Validate parent exists if provided
    if (body.parentId) {
      const parent = await prisma.tenantCategory.findFirst({
        where: {
          id: body.parentId,
          tenantId,
        },
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent category not found',
        });
      }
    }

    const category = await categoryService.createTenantCategory(tenantId, {
      name: body.name,
      slug: body.slug,
      parentId: body.parentId ?? null,
      googleCategoryId: body.googleCategoryId ?? null,
      sortOrder: body.sortOrder || 0,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    });
  }
});

/**
 * PUT /api/v1/tenants/:tenantId/categories/:id
 * Update a category
 */
router.put('/:tenantId/categories/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const body = updateCategorySchema.parse(req.body);

    // Check category exists
    const existing = await prisma.tenantCategory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check for duplicate slug if changing
    if (body.slug && body.slug !== existing.slug) {
      const duplicate = await prisma.tenantCategory.findFirst({
        where: {
          tenantId,
          slug: body.slug,
          id: { not: id },
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'Category with this slug already exists',
        });
      }
    }

    // Validate parent exists if provided
    if (body.parentId) {
      const parent = await prisma.tenantCategory.findFirst({
        where: {
          id: body.parentId,
          tenantId,
        },
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent category not found',
        });
      }

      // Prevent circular reference
      if (body.parentId === id) {
        return res.status(400).json({
          success: false,
          error: 'Category cannot be its own parent',
        });
      }
    }

    const category = await categoryService.updateTenantCategory(tenantId, id, body);

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
    });
  }
});

/**
 * DELETE /api/v1/tenants/:tenantId/categories/:id
 * Delete a category (soft delete)
 */
router.delete('/:tenantId/categories/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Check category exists
    const category = await prisma.tenantCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check for child categories
    const childCount = await prisma.tenantCategory.count({
      where: {
        tenantId,
        parentId: id,
        isActive: true,
      },
    });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with active child categories',
        childCount,
      });
    }

    // Check for products using this category
    const productCount = await prisma.inventoryItem.count({
      where: {
        tenantId,
        categoryPath: {
          has: category.slug,
        },
      },
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with products assigned',
        productCount,
      });
    }

    await categoryService.softDeleteTenantCategory(tenantId, id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/categories/:id/align
 * Align category to Google taxonomy
 */
router.post('/:tenantId/categories/:id/align', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const body = alignCategorySchema.parse(req.body);

    // Check category exists
    const category = await prisma.tenantCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Validate Google category exists
    const googleCategory = await prisma.googleTaxonomy.findUnique({
      where: { categoryId: body.googleCategoryId },
    });

    if (!googleCategory) {
      return res.status(404).json({
        success: false,
        error: 'Google category not found',
      });
    }

    const updated = await categoryService.alignCategory(tenantId, id, body.googleCategoryId);

    res.json({
      success: true,
      data: {
        ...updated,
        googleCategory,
      },
      message: 'Category aligned successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error aligning category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to align category',
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/categories/unmapped
 * Get all unmapped categories
 */
router.get('/:tenantId/categories-unmapped', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const unmapped = await prisma.tenantCategory.findMany({
      where: {
        tenantId,
        isActive: true,
        googleCategoryId: null,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: unmapped,
      count: unmapped.length,
    });
  } catch (error) {
    console.error('Error fetching unmapped categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unmapped categories',
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/categories/alignment-status
 * Get category alignment status and metrics
 */
router.get('/:tenantId/categories-alignment-status', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const [total, mapped, unmapped] = await Promise.all([
      prisma.tenantCategory.count({
        where: { tenantId, isActive: true },
      }),
      prisma.tenantCategory.count({
        where: {
          tenantId,
          isActive: true,
          googleCategoryId: { not: null },
        },
      }),
      prisma.tenantCategory.count({
        where: {
          tenantId,
          isActive: true,
          googleCategoryId: null,
        },
      }),
    ]);

    const mappingCoverage = total > 0 ? (mapped / total) * 100 : 0;
    const isCompliant = mappingCoverage === 100;

    res.json({
      success: true,
      data: {
        total,
        mapped,
        unmapped,
        mappingCoverage: parseFloat(mappingCoverage.toFixed(2)),
        isCompliant,
        status: isCompliant ? 'compliant' : unmapped > 0 ? 'needs_alignment' : 'unknown',
      },
    });
  } catch (error) {
    console.error('Error fetching alignment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alignment status',
    });
  }
});

export default router;
