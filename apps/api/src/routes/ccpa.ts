/**
 * CCPA Compliance Routes
 *
 * Public endpoints for California Consumer Privacy Act requests:
 * - POST /api/ccpa/opt-out-sale — record "Do Not Sell My Personal Information" request
 * - GET  /api/ccpa/data-categories — list data categories collected (required disclosure)
 * - GET  /api/ccpa/requests/:tenantId — merchant view of CCPA requests for their tenant
 * - PUT  /api/ccpa/requests/:id — admin/merchant update request status
 * - GET  /api/ccpa/requests — admin view of all CCPA requests
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import CcpaComplianceService from '../services/CcpaComplianceService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import type { Request, Response } from 'express';

const router = Router();
const ccpaService = CcpaComplianceService.getInstance();

const optOutSchema = z.object({
  email: z.string().email(),
  tenantId: z.string().optional(),
  customerId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/ccpa/opt-out-sale
 * Public endpoint — no auth required (customers may not be logged in)
 */
router.post('/opt-out-sale', async (req: Request, res: Response) => {
  try {
    const validation = optOutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'A valid email address is required',
        details: validation.error.issues,
      });
    }

    const { email, tenantId, customerId, notes } = validation.data;

    const request = await ccpaService.createRequest({
      email,
      requestType: 'opt_out_sale',
      tenantId,
      customerId,
      notes,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info('[CCPA] Opt-out-sale request submitted', undefined, {
      id: request.id,
      email,
      tenantId,
    });

    // File a Requests-Hub ticket for the platform admin (fire-and-forget,
    // non-blocking). Platform-scope intake is project-scoped — no tenant
    // row is consumed or created ('platform' is not a tenants row and the
    // tickets table's tenant FK rejects it).
    (async () => {
      try {
        const { PLATFORM_CRM_PROJECT_ID } = await import('../lib/platform-scope');
        const { default: CrmTicketService } = await import('../services/CrmTicketService');
        const { default: CrmTicketMessageService } = await import('../services/CrmTicketMessageService');

        const adminGuideUrl = `${req.protocol}://${req.get('host')}/settings/admin/crm/requests`;
        const ticketBody = [
          `CCPA "Do Not Sell My Personal Information" request submitted by ${email}.`,
          tenantId ? `Associated tenant: ${tenantId}` : 'No specific tenant provided.',
          notes ? `Additional details: ${notes}` : '',
          '',
          '--- Admin Processing Guide ---',
          `1. Review the CCPA request: ${req.protocol}://${req.get('host')}/settings/admin/ccpa`,
          `2. Verify the requester identity via email reply to ${email}`,
          '3. Process the opt-out within 15 business days (CCPA requirement)',
          '4. Update the CCPA request status to "completed" or "denied"',
          `5. Reply to the submitter at ${email} with confirmation`,
          `6. Update this ticket status to "resolved" when done: ${adminGuideUrl}`,
        ].filter(Boolean).join('\n');

        const ticket = await CrmTicketService.getInstance().create({
          project_id: PLATFORM_CRM_PROJECT_ID,
          title: `CCPA Opt-Out Request — ${email}`,
          description: ticketBody,
          category: 'ccpa_request',
          priority: 'normal',
          inquiry_id: request.id,
        });

        await CrmTicketMessageService.getInstance().create({
          ticket_id: ticket.id,
          author_id: 'system',
          author_type: 'platform',
          author_name: 'CCPA Intake',
          content_blocks: {
            version: '1',
            blocks: [
              { type: 'paragraph', text: `CCPA opt-out request filed by ${email}.` },
              { type: 'button', label: 'Open Requests Hub', url: adminGuideUrl, variant: 'primary' },
            ],
          },
        });

        logger.info('[CCPA] CRM ticket created for platform admin', undefined, {
          ticketId: ticket.id,
          ccpaRequestId: request.id,
          email,
        });
      } catch (crmErr) {
        logger.error('[CCPA] CRM ticket creation failed (non-critical)', undefined, {
          error: crmErr instanceof Error ? crmErr.message : String(crmErr),
          ccpaRequestId: request.id,
        });
      }
    })();

    return res.json({
      success: true,
      message: 'Your "Do Not Sell My Personal Information" request has been recorded. We will process it within 15 business days.',
      requestId: request.id,
    });
  } catch (error) {
    logger.error('[CCPA] Opt-out-sale failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to submit request. Please try again or contact support.',
    });
  }
});

/**
 * GET /api/ccpa/data-categories
 * Public endpoint — required CCPA disclosure of data categories collected
 */
router.get('/data-categories', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    categories: ccpaService.getDataCategories(),
  });
});

/**
 * GET /api/ccpa/requests
 * Admin only — view all CCPA requests
 */
router.get('/requests', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await ccpaService.getAllRequests(
      status as 'pending' | 'completed' | 'denied' | undefined,
      100
    );

    return res.json({ success: true, data: requests });
  } catch (error) {
    logger.error('[CCPA] Admin list failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * GET /api/ccpa/requests/:tenantId
 * Merchant view — CCPA requests for a specific tenant
 */
router.get('/requests/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req.user as any)?.userId || (req.user as any)?.user_id;
    const userTenants = (req.user as any)?.tenantIds || [];

    if (!userTenants.includes(tenantId) && (req.user as any)?.role !== 'ADMIN' && (req.user as any)?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'You do not have access to this tenant' });
    }

    const status = req.query.status as string | undefined;
    const requests = await ccpaService.getRequestsForTenant(
      tenantId,
      status as 'pending' | 'completed' | 'denied' | undefined
    );

    return res.json({ success: true, data: requests });
  } catch (error) {
    logger.error('[CCPA] Tenant list failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * PUT /api/ccpa/requests/:id
 * Admin/merchant — update request status
 */
router.put('/requests/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'completed', 'denied'].includes(status)) {
      return res.status(400).json({ success: false, error: 'invalid_status', message: 'Status must be pending, completed, or denied' });
    }

    const updated = await ccpaService.updateStatus(id, status, notes);
    return res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[CCPA] Update status failed', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
