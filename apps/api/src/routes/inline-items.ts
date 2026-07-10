import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireWritableSubscription } from '../middleware/subscription';
import { checkTenantAccess } from '../middleware/auth';

const router = Router();

// GET /api/items/complete
router.get("/api/items/complete", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const tenant_id = req.query.tenant_id as string;
    if (!tenant_id) {
      return res.status(400).json({ error: "tenant_id_required" });
    }

    const {
      q: search = '',
      status: statusFilter = 'all',
      visibility: visibilityFilter = 'all',
      categoryId,
      categoryFilter = 'all',
      page = '1',
      limit = '25'
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 25, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { tenant_id };

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'syncing') {
        where.item_status = 'active';
        where.visibility = 'public';
      } else {
        where.item_status = statusFilter;
      }
    } else {
      where.item_status = { not: 'trashed' };
    }

    if (visibilityFilter && visibilityFilter !== 'all') {
      where.visibility = visibilityFilter;
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { sku: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { brand: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.directory_category_id = categoryId;
    } else if (categoryFilter === 'assigned') {
      where.directory_category_id = { not: null };
    } else if (categoryFilter === 'unassigned') {
      where.directory_category_id = null;
    }

    const storewideWhere = { tenant_id, item_status: { not: 'trashed' as const } };

    const [itemsResult, totalCountResult, activeCount, inactiveCount, syncingCount, publicCount, privateCount, lowStockCount] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limitNum,
        select: {
          id: true,
          tenant_id: true,
          sku: true,
          name: true,
          title: true,
          description: true,
          price_cents: true,
          stock: true,
          image_url: true,
          brand: true,
          category_path: true,
          directory_category_id: true,
          item_status: true,
          availability: true,
          has_variants: true,
          product_type: true,
          featured_type: true,
          featured_at: true,
          visibility: true,
          created_at: true,
          updated_at: true,
        }
      }),
      prisma.inventory_items.count({ where }),
      prisma.inventory_items.count({ where: { ...storewideWhere, item_status: 'active' } }),
      prisma.inventory_items.count({ where: { ...storewideWhere, item_status: 'inactive' } }),
      prisma.inventory_items.count({ where: { ...storewideWhere, sync_status: 'pending' } }),
      prisma.inventory_items.count({ where: { ...storewideWhere, visibility: 'public' } }),
      prisma.inventory_items.count({ where: { ...storewideWhere, visibility: 'private' } }),
      prisma.inventory_items.count({ where: { ...storewideWhere, stock: { lte: 5 } } }),
    ]);

    const totalPages = Math.ceil(totalCountResult / limitNum);

    res.json({
      items: itemsResult,
      stats: {
        total: totalCountResult,
        active: activeCount,
        inactive: inactiveCount,
        syncing: syncingCount,
        public: publicCount,
        private: privateCount,
        lowStock: lowStockCount,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCountResult,
        totalPages,
        hasMore: offset + limitNum < totalCountResult,
      },
    });
  } catch (error) {
    console.error('[GET /api/items/complete] Error:', error);
    res.status(500).json({ error: "failed_to_get_items" });
  }
});

// PATCH /api/v1/tenants/:tenant_id/items/:itemId/category
router.patch('/api/v1/tenants/:tenant_id/items/:itemId/category', async (req, res) => {
  try {
    const { tenant_id, itemId } = req.params as { tenant_id: string; itemId: string };
    const { directory_category_id, categorySlug } = (req.body || {}) as { directory_category_id?: string; categorySlug?: string };

    const { categoryService } = await import('../services/CategoryService');
    const updated = await categoryService.assignItemCategory(tenant_id, itemId, { directoryCategoryId: directory_category_id, categorySlug });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    const code = typeof e?.statusCode === 'number' ? e.statusCode : 500;
    const msg = e?.message || 'failed_to_assign_category';
    console.error('[PATCH /api/v1/tenants/:tenant_id/items/:itemId/category] Error:', msg);
    return res.status(code).json({ success: false, error: msg });
  }
});

// PUT /api/items/:itemId
router.put('/api/items/:itemId', authenticateToken, requireWritableSubscription, async (req, res) => {
  try {
    const { itemId } = req.params;
    const updateData = req.body;

    if (!updateData) {
      return res.status(400).json({ error: 'update_data_required' });
    }

    const prismaUpdateData: any = {};

    if (updateData.name !== undefined) prismaUpdateData.name = updateData.name;
    if (updateData.price !== undefined) prismaUpdateData.price = updateData.price;
    if (updateData.stock !== undefined) {
      const stockValue = typeof updateData.stock === 'string' ? parseInt(updateData.stock, 10) : updateData.stock;
      prismaUpdateData.stock = stockValue;
      prismaUpdateData.quantity = stockValue;
    }
    if (updateData.description !== undefined) prismaUpdateData.description = updateData.description;
    if (updateData.visibility !== undefined) prismaUpdateData.visibility = updateData.visibility;
    if (updateData.item_status !== undefined) prismaUpdateData.item_status = updateData.item_status;
    if (updateData.category_path !== undefined) prismaUpdateData.category_path = updateData.category_path;

    const updatedItem = await prisma.inventory_items.update({
      where: { id: itemId },
      data: prismaUpdateData,
    });

    const result = {
      id: updatedItem.id,
      tenant_id: updatedItem.tenant_id,
      sku: updatedItem.sku,
      name: updatedItem.name,
      price: updatedItem.price,
      stock: updatedItem.stock,
      description: updatedItem.description,
      visibility: updatedItem.visibility,
      status: updatedItem.item_status,
      category_path: updatedItem.category_path,
      created_at: updatedItem.created_at,
      updated_at: updatedItem.updated_at,
    };

    return res.json(result);
  } catch (error) {
    console.error('[PUT /api/items/:itemId] Error:', error);
    return res.status(500).json({ error: 'failed_to_update_item' });
  }
});

// GET /api/products/needs-enrichment
router.get('/api/products/needs-enrichment', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { isPlatformUser } = await import('../utils/platform-admin');

    const tenantId = req.query.tenant_id as string;

    if (!tenantId && !isPlatformUser(user)) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        item_status: 'active',
        OR: [
          { image_url: null },
          { image_url: '' },
          { description: null },
          { description: '' },
        ]
      },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: {
        id: true,
        sku: true,
        name: true,
        image_url: true,
        description: true,
        brand: true,
        tenant_id: true,
      }
    });

    res.json({ items, total: items.length });
  } catch (error) {
    console.error('[GET /api/products/needs-enrichment] Error:', error);
    res.status(500).json({ error: 'failed_to_get_products_needing_enrichment' });
  }
});

export default router;
