/**
 * FAQ Public Routes
 *
 * Public-facing FAQ display for storefront and product pages.
 * No authentication required — read-only.
 */

import { Router, Request, Response } from 'express';
import FaqService from '../services/FaqService';
import FaqOptionsService from '../services/FaqOptionsService';

const router = Router({ mergeParams: true });
const faqService = FaqService.getInstance();
const faqOptionsService = FaqOptionsService.getInstance();

// ====================
// Public Storefront FAQs
// ====================

// GET /api/public/tenants/:tenantId/faqs?scope=storefront
router.get('/faqs', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const { scope, productId } = req.query;

    // Resolve tier gate before serving data
    const tierState = await faqOptionsService.resolveFaqOptionsState(tenantId);
    if (!tierState.enabled) {
      res.json({ success: true, data: scope === 'product' && productId ? { productFAQs: [], storefrontFAQs: [] } : [] });
      return;
    }

    if (scope === 'product' && productId) {
      if (!tierState.productEnabled) {
        res.json({ success: true, data: { productFAQs: [], storefrontFAQs: [] } });
        return;
      }
      const { productFAQs, storefrontFAQs } = await faqService.getPublicProductFAQs(
        tenantId,
        productId as string
      );
      res.json({
        success: true,
        data: {
          productFAQs,
          storefrontFAQs,
        },
      });
      return;
    }

    if (!tierState.storefrontEnabled) {
      res.json({ success: true, data: [] });
      return;
    }

    const faqs = await faqService.getPublicStorefrontFAQs(tenantId);
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error('[FAQ Public] Error fetching FAQs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch FAQs' });
  }
});

// GET /api/public/tenants/:tenantId/faq-categories
router.get('/faq-categories', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;

    // Resolve tier gate before serving data
    const tierState = await faqOptionsService.resolveFaqOptionsState(tenantId);
    if (!tierState.enabled) {
      res.json({ success: true, data: [] });
      return;
    }

    const categories = await faqService.listCategories(tenantId);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('[FAQ Public] Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// POST /api/public/tenants/:tenantId/faqs/:faqId/feedback
router.post('/faqs/:faqId/feedback', async (req: Request, res: Response) => {
  try {
    const { tenantId, faqId } = req.params;
    const { type } = req.body;

    if (!type || !['up', 'down'].includes(type)) {
      res.status(400).json({ success: false, error: 'Invalid feedback type. Must be "up" or "down".' });
      return;
    }

    const feedback = await faqService.submitFeedback(tenantId, faqId, type, {
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
    });
    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('[FAQ Public] Error submitting feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

// POST /api/public/tenants/:tenantId/faqs/:faqId/suggest-edit
router.post('/faqs/:faqId/suggest-edit', async (req: Request, res: Response) => {
  try {
    const { tenantId, faqId } = req.params;
    const { comment, email } = req.body;

    if (!comment || !comment.trim()) {
      res.status(400).json({ success: false, error: 'Suggested edit comment is required.' });
      return;
    }

    const feedback = await faqService.submitFeedback(tenantId, faqId, 'suggest_edit', {
      comment: comment.trim(),
      email: email?.trim() || undefined,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
    });
    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('[FAQ Public] Error submitting suggested edit:', error);
    res.status(500).json({ success: false, error: 'Failed to submit suggested edit' });
  }
});

export default router;
