/**
 * FAQ Public Routes
 *
 * Public-facing FAQ display for storefront and product pages.
 * No authentication required — read-only.
 */

import { Router, Request, Response } from 'express';
import FaqService from '../services/FaqService';
import FaqOptionsService from '../services/FaqOptionsService';
import FaqCrmIntegrationService from '../services/FaqCrmIntegrationService';
import { logger } from '../logger';

const router = Router({ mergeParams: true });
const faqService = FaqService.getInstance();
const faqOptionsService = FaqOptionsService.getInstance();
const faqCrmIntegrationService = FaqCrmIntegrationService.getInstance();

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
    logger.error('[FAQ Public] Error fetching FAQs:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FAQ Public] Error fetching categories:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FAQ Public] Error submitting feedback:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FAQ Public] Error submitting suggested edit:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to submit suggested edit' });
  }
});

// ====================
// FAQ-CRM Integration
// ====================

// GET /api/public/tenants/:tenantId/faqs/search?query=...
// NOTE: Must be placed before /faqs/:faqId routes to avoid shadowing
router.get('/faqs/search', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const { query, limit } = req.query;

    const tierState = await faqOptionsService.resolveFaqOptionsState(tenantId);
    if (!tierState.enabled || !tierState.storefrontEnabled) {
      res.json({ success: true, data: [] });
      return;
    }

    const suggestions = await faqCrmIntegrationService.searchRelevantFAQs(
      tenantId,
      String(query || ''),
      Math.min(parseInt(String(limit || '5'), 10), 10)
    );
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('[FAQ Public] Error searching FAQs:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to search FAQs' });
  }
});

// POST /api/public/tenants/:tenantId/faqs/:faqId/create-ticket
router.post('/faqs/:faqId/create-ticket', async (req: Request, res: Response) => {
  try {
    const { tenantId, faqId } = req.params;
    const { customer_id, title, description, email, source } = req.body;

    const tierState = await faqOptionsService.resolveFaqOptionsState(tenantId);
    if (!tierState.enabled) {
      res.status(403).json({ success: false, error: 'FAQ feature not enabled for this tenant' });
      return;
    }

    const ticket = await faqCrmIntegrationService.createTicketFromFeedback({
      tenant_id: tenantId,
      faq_id: faqId,
      customer_id: customer_id || undefined,
      title: title || undefined,
      description: description || undefined,
      email: email || undefined,
      source: source || 'faq_feedback',
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('[FAQ Public] Error creating ticket from feedback:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: (error as any)?.message || 'Failed to create ticket' });
  }
});

export default router;
