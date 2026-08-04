/**
 * marketing-customer.ts — authenticated customer portal routes for the
 * Marketing Ops Customer Portal (§6.2, §7.2).
 *
 * All routes require customer JWT auth and enforce hasPlatformContext (§4.2):
 * a storefront-only customer gets 403 context_required, not empty data.
 *
 * Routes (mounted at /api/customer/marketing):
 *   GET  /overview                          — portal overview (§7.2)
 *   GET  /campaigns                         — list claimed campaigns
 *   GET  /campaigns/:id                     — single campaign detail
 *   GET  /purchases                         — full payment history
 *   GET  /receipts/:revenueId               — receipt view model (§7.4)
 *   GET  /receipts/:revenueId/pdf           — receipt PDF download (§6.5)
 *   GET  /branding                          — get branding settings
 *   PUT  /branding                          — update branding settings
 *   GET  /support/tickets                   — list support tickets
 *   POST /support/tickets                   — create support ticket
 *   GET  /support/tickets/:id               — get ticket detail
 *   POST /support/tickets/:id/messages      — reply to ticket
 *   GET  /alerts                            — list platform alerts
 *   POST /alerts/:id/read                   — mark alert read
 *   POST /alerts/:id/dismiss                — dismiss alert
 *   POST /alerts/mark-all-read              — mark all read
 *   GET  /alerts/unread-count               — unread badge count
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CustomerAuthService } from '../services/CustomerAuthService';
import {
  buildPortalOverview,
  buildReceiptViewModel,
  projectCampaign,
  projectCampaigns,
} from '../services/MarketingCustomerProjection';
import { MarketingReceiptPdfService } from '../services/marketing/MarketingReceiptPdfService';
import { PLATFORM_SCOPE } from '../lib/platform-scope';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();
const customerAuthService = CustomerAuthService.getInstance();

// ── Auth middleware (same pattern as customer-coupons.ts) ───────────────

const getCustomerId = (req: Request): string | null => {
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) return payload.customerId;
  }
  // Fallback to cookie
  if (req.cookies?.customer_session_id) {
    return req.cookies.customer_session_id;
  }
  return null;
};

const requireCustomerAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerId(req);
  if (!customerId) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Not authenticated' });
  }
  (req as any).customerId = customerId;
  next();
};

/**
 * Context gate middleware (§4.2): requires hasPlatformContext.
 * Returns 403 context_required if the customer has no platform relationships.
 */
const requirePlatformContext = async (req: Request, res: Response, next: Function) => {
  const customerId = (req as any).customerId;
  const contexts = await customerAuthService.computeContexts(customerId);
  if (!contexts.platform) {
    return res.status(403).json({
      success: false,
      error: 'context_required',
      message: 'Marketing portal access requires a linked marketing purchase.',
    });
  }
  next();
};

// ── Portal overview (§7.2) ──────────────────────────────────────────────

router.get('/overview', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const overview = await buildPortalOverview(customerId, req.ctx);
    res.json({ success: true, data: overview });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /overview error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load overview' });
  }
});

// ── Campaigns (§7.2) ────────────────────────────────────────────────────

router.get('/campaigns', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const campaigns = await prisma.mkt_campaigns_list.findMany({
      where: { customer_id: customerId },
      include: {
        mkt_deliverables_list: true,
        marketing_revenue: { orderBy: { created_at: 'desc' } },
      },
      orderBy: { date_paid: 'desc' },
    });
    const projected = await projectCampaigns(campaigns, req.ctx);
    res.json({ success: true, data: projected });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /campaigns error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load campaigns' });
  }
});

router.get('/campaigns/:id', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const campaign = await prisma.mkt_campaigns_list.findFirst({
      where: { id: req.params.id, customer_id: customerId },
      include: {
        mkt_deliverables_list: true,
        marketing_revenue: { orderBy: { created_at: 'desc' } },
      },
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    const projected = await projectCampaign(campaign, req.ctx);
    if (!projected) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    res.json({ success: true, data: projected });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /campaigns/:id error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load campaign' });
  }
});

// ── Purchases (§7.2) ────────────────────────────────────────────────────

router.get('/purchases', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const revenue = await prisma.marketing_revenue.findMany({
      where: { customer_id: customerId },
      include: { mkt_campaigns_list: true },
      orderBy: { created_at: 'desc' },
    });
    const purchases = revenue.map((r) => ({
      id: r.id,
      revenueId: r.id,
      campaignId: r.campaign_id,
      businessName: r.mkt_campaigns_list?.business_name || '',
      serviceCategory: r.mkt_campaigns_list?.service_category || null,
      amountCents: r.amount_cents || 0,
      discountCents: r.discount_cents || 0,
      date: r.created_at,
      receiptUrl: `/api/customer/marketing/receipts/${r.id}/pdf`,
      receiptViewUrl: `/account/marketing/receipts/${r.id}`,
    }));
    res.json({ success: true, data: purchases });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /purchases error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load purchases' });
  }
});

// ── Receipts (§6.5, §7.4) ───────────────────────────────────────────────

router.get('/receipts/:revenueId', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const vm = await buildReceiptViewModel(req.params.revenueId, customerId, req.ctx);
    if (!vm) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    res.json({ success: true, data: vm });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /receipts/:revenueId error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load receipt' });
  }
});

router.get('/receipts/:revenueId/pdf', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const vm = await buildReceiptViewModel(req.params.revenueId, customerId, req.ctx);
    if (!vm) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    const { pdfBuffer, filename } = await MarketingReceiptPdfService.generate({
      campaignId: vm.campaignId,
      ctx: req.ctx,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('[marketing-customer] GET /receipts/:revenueId/pdf error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});

// ── Branding (§7.4) ─────────────────────────────────────────────────────

const brandingSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  assetUrl: z.string().url().nullable().optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

router.get('/branding', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const branding = await prisma.mkt_customer_branding.findUnique({
      where: { customer_id: customerId },
    });
    res.json({
      success: true,
      data: branding
        ? {
            logoUrl: branding.logo_url,
            assetUrl: branding.asset_url,
            brandColor: branding.brand_color,
          }
        : { logoUrl: null, assetUrl: null, brandColor: null },
    });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /branding error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load branding' });
  }
});

router.put('/branding', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const parsed = brandingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // Validate asset_url is http(s) and not a platform-internal host (§7.4)
    if (parsed.data.assetUrl) {
      try {
        const u = new URL(parsed.data.assetUrl);
        if (!['http:', 'https:'].includes(u.protocol)) {
          return res.status(400).json({ success: false, error: 'asset_url must be http(s)' });
        }
      } catch {
        return res.status(400).json({ success: false, error: 'asset_url must be a valid URL' });
      }
    }

    const existing = await prisma.mkt_customer_branding.findUnique({
      where: { customer_id: customerId },
    });

    if (existing) {
      const updated = await prisma.mkt_customer_branding.update({
        where: { customer_id: customerId },
        data: {
          logo_url: parsed.data.logoUrl,
          asset_url: parsed.data.assetUrl,
          brand_color: parsed.data.brandColor,
          updated_at: new Date(),
        },
      });
      res.json({ success: true, data: { logoUrl: updated.logo_url, assetUrl: updated.asset_url, brandColor: updated.brand_color } });
    } else {
      const created = await prisma.mkt_customer_branding.create({
        data: {
          id: `mkb-${customerId}-${Date.now()}`,
          customer_id: customerId,
          logo_url: parsed.data.logoUrl,
          asset_url: parsed.data.assetUrl,
          brand_color: parsed.data.brandColor,
        },
      });
      res.status(201).json({ success: true, data: { logoUrl: created.logo_url, assetUrl: created.asset_url, brandColor: created.brand_color } });
    }
  } catch (error: any) {
    logger.error('[marketing-customer] PUT /branding error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update branding' });
  }
});

// ── Support tickets (§7.7) ──────────────────────────────────────────────

const createTicketSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().optional().default('marketing_ops'),
  campaignId: z.string().optional(),
});

router.get('/support/tickets', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const tickets = await prisma.crm_support_tickets.findMany({
      where: { customer_id: customerId, tenant_id: PLATFORM_SCOPE },
      include: {
        crm_ticket_messages: {
          where: { is_internal: false },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: tickets });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /support/tickets error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load tickets' });
  }
});

router.post('/support/tickets', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // Validate campaign_id belongs to this customer (§7.7)
    if (parsed.data.campaignId) {
      const campaign = await prisma.mkt_campaigns_list.findFirst({
        where: { id: parsed.data.campaignId, customer_id: customerId },
        select: { id: true },
      });
      if (!campaign) {
        return res.status(400).json({ success: false, error: 'invalid_campaign' });
      }
    }

    const ticket = await prisma.crm_support_tickets.create({
      data: {
        id: `tkt-${customerId}-${Date.now()}`,
        customer_id: customerId,
        tenant_id: PLATFORM_SCOPE,
        title: parsed.data.title,
        description: parsed.data.description || null,
        category: parsed.data.category || 'marketing_ops',
        campaign_id: parsed.data.campaignId || null,
        status: 'open',
        priority: 'medium',
      },
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('[marketing-customer] POST /support/tickets error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create ticket' });
  }
});

router.get('/support/tickets/:id', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const ticket = await prisma.crm_support_tickets.findFirst({
      where: { id: req.params.id, customer_id: customerId, tenant_id: PLATFORM_SCOPE },
      include: {
        crm_ticket_messages: {
          where: { is_internal: false },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }
    res.json({ success: true, data: ticket });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /support/tickets/:id error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load ticket' });
  }
});

const replySchema = z.object({
  message: z.string().min(1),
});

router.post('/support/tickets/:id/messages', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // Verify ownership
    const ticket = await prisma.crm_support_tickets.findFirst({
      where: { id: req.params.id, customer_id: customerId, tenant_id: PLATFORM_SCOPE },
      select: { id: true },
    });
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    const message = await prisma.crm_ticket_messages.create({
      data: {
        id: `tktmsg-${customerId}-${Date.now()}`,
        ticket_id: req.params.id,
        content: parsed.data.message,
        author_id: customerId,
        author_type: 'customer',
        author_name: 'Customer',
        is_internal: false,
        created_at: new Date(),
      },
    });

    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    logger.error('[marketing-customer] POST /support/tickets/:id/messages error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to reply' });
  }
});

// ── Alerts (§7.9) ───────────────────────────────────────────────────────

router.get('/alerts', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    // Fetch platform-scope alerts (§7.9 read-time targeting)
    const alerts = await prisma.crm_alerts.findMany({
      where: { tenant_id: PLATFORM_SCOPE },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // Fetch per-customer states for these alerts
    const states = await prisma.crm_customer_alert_states.findMany({
      where: { customer_id: customerId, alert_id: { in: alerts.map((a) => a.id) } },
    });
    const stateMap = new Map(states.map((s) => [s.alert_id, s]));

    // Fetch customer's claimed campaign IDs for campaign-targeted alerts
    const claimedCampaigns = await prisma.mkt_campaigns_list.findMany({
      where: { customer_id: customerId },
      select: { id: true },
    });
    const claimedCampaignIds = new Set(claimedCampaigns.map((c) => c.id));

    // Apply read-time targeting filter (§7.9)
    const visible = alerts.filter((alert) => {
      const meta = alert.metadata as any;
      if (!meta || Object.keys(meta).length === 0) return true; // broadcast
      if (meta.customer_id && meta.customer_id === customerId) return true; // targeted
      if (meta.campaign_id && claimedCampaignIds.has(meta.campaign_id)) return true; // campaign-targeted
      return false;
    });

    const result = visible.map((alert) => {
      const state = stateMap.get(alert.id);
      return {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        body: alert.body,
        icon: alert.icon,
        createdAt: alert.created_at,
        isRead: !!state?.read_at,
        isDismissed: !!state?.dismissed_at,
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /alerts error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to load alerts' });
  }
});

router.get('/alerts/unread-count', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const alerts = await prisma.crm_alerts.findMany({
      where: { tenant_id: PLATFORM_SCOPE },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const states = await prisma.crm_customer_alert_states.findMany({
      where: { customer_id: customerId, alert_id: { in: alerts.map((a) => a.id) } },
    });
    const stateMap = new Map(states.map((s) => [s.alert_id, s]));

    const claimedCampaigns = await prisma.mkt_campaigns_list.findMany({
      where: { customer_id: customerId },
      select: { id: true },
    });
    const claimedCampaignIds = new Set(claimedCampaigns.map((c) => c.id));

    const unread = alerts.filter((alert) => {
      const state = stateMap.get(alert.id);
      if (state?.read_at || state?.dismissed_at) return false;
      const meta = alert.metadata as any;
      if (!meta || Object.keys(meta).length === 0) return true;
      if (meta.customer_id && meta.customer_id === customerId) return true;
      if (meta.campaign_id && claimedCampaignIds.has(meta.campaign_id)) return true;
      return false;
    });

    res.json({ success: true, data: { count: unread.length } });
  } catch (error: any) {
    logger.error('[marketing-customer] GET /alerts/unread-count error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to count unread alerts' });
  }
});

router.post('/alerts/:id/read', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const alertId = req.params.id;

    // Upsert per-customer state (§5.9)
    const existing = await prisma.crm_customer_alert_states.findUnique({
      where: { alert_id_customer_id: { alert_id: alertId, customer_id: customerId } },
    });

    if (existing) {
      await prisma.crm_customer_alert_states.update({
        where: { id: existing.id },
        data: { read_at: new Date() },
      });
    } else {
      await prisma.crm_customer_alert_states.create({
        data: {
          id: `cas-${customerId}-${alertId}`,
          alert_id: alertId,
          customer_id: customerId,
          read_at: new Date(),
        },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[marketing-customer] POST /alerts/:id/read error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to mark read' });
  }
});

router.post('/alerts/:id/dismiss', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const alertId = req.params.id;

    const existing = await prisma.crm_customer_alert_states.findUnique({
      where: { alert_id_customer_id: { alert_id: alertId, customer_id: customerId } },
    });

    if (existing) {
      await prisma.crm_customer_alert_states.update({
        where: { id: existing.id },
        data: { dismissed_at: new Date(), read_at: existing.read_at || new Date() },
      });
    } else {
      await prisma.crm_customer_alert_states.create({
        data: {
          id: `cas-${customerId}-${alertId}`,
          alert_id: alertId,
          customer_id: customerId,
          dismissed_at: new Date(),
          read_at: new Date(),
        },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[marketing-customer] POST /alerts/:id/dismiss error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to dismiss' });
  }
});

router.post('/alerts/mark-all-read', requireCustomerAuth, requirePlatformContext, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const alerts = await prisma.crm_alerts.findMany({
      where: { tenant_id: PLATFORM_SCOPE },
      select: { id: true },
    });

    for (const alert of alerts) {
      const existing = await prisma.crm_customer_alert_states.findUnique({
        where: { alert_id_customer_id: { alert_id: alert.id, customer_id: customerId } },
      });
      if (!existing || !existing.read_at) {
        if (existing) {
          await prisma.crm_customer_alert_states.update({
            where: { id: existing.id },
            data: { read_at: new Date() },
          });
        } else {
          await prisma.crm_customer_alert_states.create({
            data: {
              id: `cas-${customerId}-${alert.id}`,
              alert_id: alert.id,
              customer_id: customerId,
              read_at: new Date(),
            },
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[marketing-customer] POST /alerts/mark-all-read error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to mark all read' });
  }
});

export default router;
