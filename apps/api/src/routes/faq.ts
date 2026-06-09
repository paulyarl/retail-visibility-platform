/**
 * FAQ Merchant Routes
 *
 * Tenant-scoped CRUD for FAQs, categories, and templates.
 * Requires tenant authentication.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import FaqService from '../services/FaqService';
import FaqCoverageService from '../services/FaqCoverageService';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });
const faqService = FaqService.getInstance();
const faqCoverageService = FaqCoverageService.getInstance();

// ====================
// VALIDATION SCHEMAS
// ====================

const createFAQSchema = z.object({
  category_id: z.string().uuid().nullable().default(null),
  question: z.string().min(1).max(500),
  answer: z.string().min(1),
  scope: z.enum(['storefront', 'product']).default('storefront'),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  tags: z.array(z.string().max(50)).optional(),
  display_order: z.number().int().optional(),
  product_ids: z.array(z.string()).optional(),
});

const updateFAQSchema = z.object({
  category_id: z.string().uuid().optional(),
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).optional(),
  scope: z.enum(['storefront', 'product']).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  tags: z.array(z.string().max(50)).optional(),
  display_order: z.number().int().optional(),
  product_ids: z.array(z.string()).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  display_order: z.number().int().optional(),
});

// ====================
// MIDDLEWARE
// ====================

router.use(authenticateToken);

// ====================
// FAQ CRUD
// ====================

// GET /api/tenants/:tenantId/faqs
router.get('/', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const { scope, status, categoryId, search } = req.query;
    const faqs = await faqService.listFAQs(tenantId, {
      scope: scope as string | undefined,
      status: status as string | undefined,
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
    });
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error('[FAQ] Error listing FAQs:', error);
    res.status(500).json({ success: false, error: 'Failed to list FAQs' });
  }
});

// POST /api/tenants/:tenantId/faqs
router.post('/', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const parsed = createFAQSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const faq = await faqService.createFAQ({
      ...parsed.data,
      tenant_id: tenantId,
    });
    res.status(201).json({ success: true, data: faq });
  } catch (error) {
    console.error('[FAQ] Error creating FAQ:', error);
    res.status(500).json({ success: false, error: 'Failed to create FAQ' });
  }
});

// POST /api/tenants/:tenantId/faqs/reorder
router.post('/reorder', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      res.status(400).json({ success: false, error: 'orders must be an array' });
      return;
    }
    await faqService.reorderFAQs(tenantId, orders);
    res.json({ success: true, message: 'FAQs reordered' });
  } catch (error) {
    console.error('[FAQ] Error reordering FAQs:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder FAQs' });
  }
});

// POST /api/tenants/:tenantId/faqs/bulk-status
router.post('/bulk-status', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const { faqIds, status } = req.body;
    if (!Array.isArray(faqIds) || !status) {
      res.status(400).json({ success: false, error: 'faqIds array and status required' });
      return;
    }
    const count = await faqService.bulkUpdateStatus(tenantId, faqIds, status);
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    console.error('[FAQ] Error bulk updating FAQs:', error);
    res.status(500).json({ success: false, error: 'Failed to update FAQs' });
  }
});

// POST /api/tenants/:tenantId/faqs/bulk-delete
router.post('/bulk-delete', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const { faqIds } = req.body;
    if (!Array.isArray(faqIds)) {
      res.status(400).json({ success: false, error: 'faqIds array required' });
      return;
    }
    const count = await faqService.bulkDelete(tenantId, faqIds);
    res.json({ success: true, data: { deleted: count } });
  } catch (error) {
    console.error('[FAQ] Error bulk deleting FAQs:', error);
    res.status(500).json({ success: false, error: 'Failed to delete FAQs' });
  }
});

// ====================
// Categories
// ====================

// GET /api/tenants/:tenantId/faqs/categories
router.get('/categories', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const categories = await faqService.listCategories(tenantId);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('[FAQ] Error listing categories:', error);
    res.status(500).json({ success: false, error: 'Failed to list categories' });
  }
});

// POST /api/tenants/:tenantId/faqs/categories
router.post('/categories', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }
    const category = await faqService.createCategory({
      ...parsed.data,
      tenant_id: tenantId,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('[FAQ] Error creating category:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// PUT /api/tenants/:tenantId/faqs/categories/:categoryId
router.put('/categories/:categoryId', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, categoryId } = req.params;
    const { name, display_order } = req.body;
    await faqService.updateCategory(categoryId, tenantId, { name, display_order });
    res.json({ success: true, message: 'Category updated' });
  } catch (error) {
    console.error('[FAQ] Error updating category:', error);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// DELETE /api/tenants/:tenantId/faqs/categories/:categoryId
router.delete('/categories/:categoryId', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, categoryId } = req.params;
    const deleted = await faqService.deleteCategory(categoryId, tenantId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('[FAQ] Error deleting category:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// ====================
// Product FAQs
// ====================

// GET /api/tenants/:tenantId/faqs/products/:productId/faqs
router.get('/products/:productId/faqs', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;
    const faqs = await faqService.listProductFAQs(tenantId, productId);
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error('[FAQ] Error listing product FAQs:', error);
    res.status(500).json({ success: false, error: 'Failed to list product FAQs' });
  }
});

// ====================
// Templates
// ====================

// GET /api/tenants/:tenantId/faqs/templates
router.get('/templates', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const templates = await faqService.listGlobalTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('[FAQ] Error listing templates:', error);
    res.status(500).json({ success: false, error: 'Failed to list templates' });
  }
});

// POST /api/tenants/:tenantId/faqs/templates/:templateId/apply
router.post('/templates/:templateId/apply', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, templateId } = req.params;
    const { selectedPairs } = req.body;
    const result = await faqService.applyTemplate(tenantId, templateId, selectedPairs);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[FAQ] Error applying template:', error);
    res.status(500).json({ success: false, error: 'Failed to apply template' });
  }
});

// ====================
// Coverage metrics (before parameterized routes to avoid shadowing)
// ====================

// GET /api/tenants/:tenantId/faqs/coverage
router.get('/coverage', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const metrics = await faqCoverageService.getTenantCoverage(tenantId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('[FAQ] Error fetching coverage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch coverage metrics' });
  }
});

// Individual FAQ CRUD (must be last)
// ====================

// GET /api/tenants/:tenantId/faqs/:faqId
router.get('/:faqId', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, faqId } = req.params;
    const faq = await faqService.getFAQById(faqId, tenantId);
    if (!faq) {
      res.status(404).json({ success: false, error: 'FAQ not found' });
      return;
    }
    res.json({ success: true, data: faq });
  } catch (error) {
    console.error('[FAQ] Error getting FAQ:', error);
    res.status(500).json({ success: false, error: 'Failed to get FAQ' });
  }
});

// PUT /api/tenants/:tenantId/faqs/:faqId
router.put('/:faqId', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, faqId } = req.params;
    const parsed = updateFAQSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const faq = await faqService.updateFAQ(faqId, tenantId, parsed.data);
    if (!faq) {
      res.status(404).json({ success: false, error: 'FAQ not found' });
      return;
    }
    res.json({ success: true, data: faq });
  } catch (error) {
    console.error('[FAQ] Error updating FAQ:', error);
    res.status(500).json({ success: false, error: 'Failed to update FAQ' });
  }
});

// DELETE /api/tenants/:tenantId/faqs/:faqId
router.delete('/:faqId', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, faqId } = req.params;
    const deleted = await faqService.deleteFAQ(faqId, tenantId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'FAQ not found' });
      return;
    }
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (error) {
    console.error('[FAQ] Error deleting FAQ:', error);
    res.status(500).json({ success: false, error: 'Failed to delete FAQ' });
  }
});

export default router;
