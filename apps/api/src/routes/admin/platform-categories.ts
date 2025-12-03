import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

// Database connection pool
const getPoolConfig = () => {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    if (connectionString.includes('sslmode=')) {
      connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=disable');
    } else {
      connectionString += '&sslmode=disable';
    }
  }

  const config: any = {
    connectionString,
    min: 1,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (!isProduction) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
};

let directPool: Pool | null = null;
const getDirectPool = () => {
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return new Pool(getPoolConfig());
  }

  if (!directPool) {
    directPool = new Pool(getPoolConfig());
  }
  return directPool;
};

/**
 * GET /api/admin/platform-categories
 * Get all platform categories with usage stats
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Read from platform_categories table
    const result = await getDirectPool().query(`
      SELECT 
        pc.id,
        pc.name,
        pc.slug,
        pc.description,
        pc.google_category_id,
        pc.icon_emoji,
        pc.sort_order,
        pc.level,
        pc.parent_id,
        pc.is_active,
        pc.created_at,
        pc.updated_at,
        0 as store_count,
        0 as product_count,
        0 as avg_rating,
        0 as listing_count
      FROM platform_categories pc
      WHERE pc.is_active = true
      ORDER BY pc.sort_order ASC, pc.name ASC
    `);

    return res.json({
      success: true,
      data: {
        categories: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('[Admin Platform Categories] List error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch platform categories',
    });
  }
});

/**
 * POST /api/admin/platform-categories
 * Create a new platform category
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      googleCategoryId,
      iconEmoji,
      sortOrder,
      level,
      parentId,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Name and slug are required',
      });
    }

    // Check if slug already exists
    const existing = await getDirectPool().query(
      'SELECT id FROM platform_categories WHERE slug = $1',
      [slug]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A category with this slug already exists',
      });
    }

    // Ensure google_category_id is not null (required by database)
    const finalGoogleCategoryId = googleCategoryId || `gcid:${slug}`;

    const result = await getDirectPool().query(
      `INSERT INTO platform_categories (
        name, slug, description, google_category_id, icon_emoji, 
        sort_order, level, parent_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *`,
      [
        name,
        slug,
        description || null,
        finalGoogleCategoryId,
        iconEmoji || '📦',
        sortOrder || 999,
        level || 0,
        parentId || null,
      ]
    );

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin Platform Categories] Create error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create category',
    });
  }
});

/**
 * PATCH /api/admin/platform-categories/:id
 * Update a platform category
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      googleCategoryId,
      iconEmoji,
      sortOrder,
      level,
      parentId,
      isActive,
    } = req.body;

    // Check if category exists
    const existing = await getDirectPool().query(
      'SELECT id FROM platform_categories WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // If slug is being changed, check for conflicts
    if (slug) {
      const slugCheck = await getDirectPool().query(
        'SELECT id FROM platform_categories WHERE slug = $1 AND id != $2',
        [slug, id]
      );

      if (slugCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'A category with this slug already exists',
        });
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (slug !== undefined) {
      updates.push(`slug = $${paramCount++}`);
      values.push(slug);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (googleCategoryId !== undefined) {
      updates.push(`google_category_id = $${paramCount++}`);
      values.push(googleCategoryId);
    }
    if (iconEmoji !== undefined) {
      updates.push(`icon_emoji = $${paramCount++}`);
      values.push(iconEmoji);
    }
    if (sortOrder !== undefined) {
      updates.push(`sort_order = $${paramCount++}`);
      values.push(sortOrder);
    }
    if (level !== undefined) {
      updates.push(`level = $${paramCount++}`);
      values.push(level);
    }
    if (parentId !== undefined) {
      updates.push(`parent_id = $${paramCount++}`);
      values.push(parentId);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await getDirectPool().query(
      `UPDATE platform_categories 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin Platform Categories] Update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update category',
    });
  }
});

/**
 * DELETE /api/admin/platform-categories/:id
 * Delete a platform category (soft delete by setting is_active = false)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await getDirectPool().query(
      'SELECT id FROM platform_categories WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check if category is in use
    const usage = await getDirectPool().query(
      'SELECT COUNT(*) as count FROM directory_listing_categories WHERE category_id = $1',
      [id]
    );

    const usageCount = parseInt(usage.rows[0].count);

    if (usageCount > 0) {
      // Soft delete - set is_active = false
      await getDirectPool().query(
        'UPDATE platform_categories SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      return res.json({
        success: true,
        message: `Category archived (${usageCount} listings still reference it)`,
      });
    } else {
      // Hard delete if not in use
      await getDirectPool().query(
        'DELETE FROM platform_categories WHERE id = $1',
        [id]
      );

      return res.json({
        success: true,
        message: 'Category deleted',
      });
    }
  } catch (error) {
    console.error('[Admin Platform Categories] Delete error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    });
  }
});

/**
 * POST /api/admin/platform-categories/reorder
 * Reorder categories by updating sort_order
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'categoryIds array is required',
      });
    }

    const client = await getDirectPool().connect();
    try {
      await client.query('BEGIN');

      // Update sort_order for each category
      for (let i = 0; i < categoryIds.length; i++) {
        await client.query(
          'UPDATE platform_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2',
          [(i + 1) * 10, categoryIds[i]]
        );
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Categories reordered successfully',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Admin Platform Categories] Reorder error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reorder categories',
    });
  }
});

export default router;
