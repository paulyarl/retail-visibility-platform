/**
 * Tenant CRM Routes
 * 
 * Tenant-scoped CRM endpoints for merchant dashboard widget and support page.
 * Auth: authenticateToken + checkTenantAccess (mounted externally)
 * Tenant ID derived from X-Tenant-ID header or req.user context.
 */

import { Router, Request, Response } from 'express';
import CrmTenantService from '../../../services/CrmTenantService';
import CrmContactService from '../../../services/CrmContactService';
import CrmTicketService from '../../../services/CrmTicketService';
import CrmTicketMessageService from '../../../services/CrmTicketMessageService';
import CrmTaskService from '../../../services/CrmTaskService';
import CrmActivityService from '../../../services/CrmActivityService';
import CrmInquiryService from '../../../services/CrmInquiryService';
import CrmAlertService from '../../../services/CrmAlertService';
import CrmOptionsService from '../../../services/CrmOptionsService';
import { prisma } from '../../../prisma';
import { audit } from '../../../audit';

const router = Router({ mergeParams: true });

const tenantService = CrmTenantService.getInstance();
const contactService = CrmContactService.getInstance();
const ticketService = CrmTicketService.getInstance();
const messageService = CrmTicketMessageService.getInstance();
const taskService = CrmTaskService.getInstance();
const activityService = CrmActivityService.getInstance();
const inquiryService = CrmInquiryService.getInstance();
const alertService = CrmAlertService.getInstance();
const crmOptionsService = CrmOptionsService.getInstance();

// Helper to get tenant ID from request context
function getTenantId(req: Request): string | null {
  return (req.headers['x-tenant-id'] as string) || req.user?.tenantIds?.[0] || null;
}

// Merchant gate check: returns false and sends 403 response if CRM is disabled
async function checkCrmEnabled(tenantId: string, res: Response): Promise<boolean> {
  const state = await crmOptionsService.resolveCrmOptionsState(tenantId);
  if (!state.enabled) {
    res.status(403).json({
      error: 'merchant_gate_disabled',
      message: 'CRM is disabled. Enable it in CRM Options settings.',
    });
    return false;
  }
  return true;
}

// ====================
// Stats (widget)
// ====================

// GET /api/tenant/crm/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const stats = await tenantService.getTenantCrmStats(tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[CRM Tenant] Error fetching stats:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch CRM stats' });
  }
});

// ====================
// Contacts
// ====================

// GET /api/tenant/crm/contacts
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    // Auto-sync contacts from orders before listing
    await contactService.syncFromOrders(tenantId);

    const contacts = await contactService.listByTenant(tenantId);
    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('[CRM Tenant] Error listing contacts:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list contacts' });
  }
});

// POST /api/tenant/crm/contacts
router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const contact = await contactService.create({ tenant_id: tenantId, ...req.body });
    await audit({ tenantId, actor: req.user?.userId, action: 'create', payload: { entity_type: 'crm_contact', id: contact.id, ...req.body } });
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('[CRM Tenant] Error creating contact:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create contact' });
  }
});

// GET /api/tenant/crm/contacts/:contactId
router.get('/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const contact = await contactService.getDetail(req.params.contactId);
    if (!contact || contact.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'not_found', message: 'Contact not found' });
    }
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('[CRM Tenant] Error fetching contact detail:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch contact detail' });
  }
});

// PUT /api/tenant/crm/contacts/:contactId
router.put('/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const contact = await contactService.update(req.params.contactId, req.body);
    await audit({ tenantId, actor: req.user?.userId, action: 'update', payload: { entity_type: 'crm_contact', id: contact.id } });
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('[CRM Tenant] Error updating contact:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update contact' });
  }
});

// ====================
// Tickets
// ====================

// GET /api/tenant/crm/tickets
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const tickets = await ticketService.listByTenant(tenantId, {
      status: req.query.status as string,
      priority: req.query.priority as string,
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('[CRM Tenant] Error listing tickets:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tickets' });
  }
});

// POST /api/tenant/crm/tickets
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Tenant User';

    // Resolve customer_id from contact_id if not explicitly provided
    let customer_id = req.body.customer_id;
    if (req.body.contact_id && !customer_id) {
      const contact = await contactService.getById(req.body.contact_id);
      if (contact && contact.tenant_id === tenantId && contact.customer_id) {
        customer_id = contact.customer_id;
      }
    }

    const ticket = await ticketService.create({ tenant_id: tenantId, ...req.body, customer_id });
    await audit({ tenantId, actor: actorId, action: 'create', payload: { entity_type: 'crm_ticket', id: ticket.id, ...req.body } });

    // Auto-log ticket creation as activity
    await activityService.create({
      tenant_id: tenantId,
      ticket_id: ticket.id,
      actor_id: actorId,
      actor_type: 'tenant',
      actor_name: actorName,
      activity_type: 'status_change',
      content: `Ticket created: ${req.body.title}`,
      is_internal: false,
    });

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[CRM Tenant] Error creating ticket:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create ticket' });
  }
});

// PUT /api/tenant/crm/tickets/:ticketId
router.put('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Tenant User';

    const ticket = await ticketService.update(req.params.ticketId, req.body, actorId, actorName, 'tenant');
    await audit({ tenantId, actor: actorId, action: 'update', payload: { entity_type: 'crm_ticket', id: ticket.id, ...req.body } });
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[CRM Tenant] Error updating ticket:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update ticket' });
  }
});

// GET /api/tenant/crm/tickets/:ticketId/messages
router.get('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;
    // Tenant users can see internal notes
    const messages = await messageService.listByTicket(req.params.ticketId, true);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CRM Tenant] Error listing ticket messages:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list messages' });
  }
});

// POST /api/tenant/crm/tickets/:ticketId/messages
router.post('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Tenant User';

    const message = await messageService.create({
      ticket_id: req.params.ticketId,
      author_id: actorId,
      author_type: 'tenant',
      author_name: actorName,
      content: req.body.content,
      is_internal: req.body.is_internal || false,
    });
    res.json({ success: true, data: message });
  } catch (error) {
    console.error('[CRM Tenant] Error creating ticket message:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create message' });
  }
});

// ====================
// Tasks (read-only for tenant)
// ====================

// GET /api/tenant/crm/tasks
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const tasks = await taskService.listByTenant(tenantId, { status: req.query.status as string });
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('[CRM Tenant] Error listing tasks:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tasks' });
  }
});

// ====================
// Activities
// ====================

// GET /api/tenant/crm/activities
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const activities = await activityService.listByTenant(tenantId, {
      type: req.query.type as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      isInternal: false, // Tenant users don't see internal notes by default
    });
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('[CRM Tenant] Error listing activities:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list activities' });
  }
});

// ====================
// Inquiries
// ====================

// GET /api/tenant/crm/inquiries
router.get('/inquiries', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const inquiries = await inquiryService.listByTenant(tenantId, {
      status: req.query.status as string,
      priority: req.query.priority as string,
    });
    res.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('[CRM Tenant] Error listing inquiries:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list inquiries' });
  }
});

// POST /api/tenant/crm/inquiries
router.post('/inquiries', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';

    const inquiry = await inquiryService.create({ tenant_id: tenantId, ...req.body, source: 'tenant_portal' });
    await audit({ tenantId, actor: actorId, action: 'create', payload: { entity_type: 'crm_inquiry', id: inquiry.id, ...req.body } });
    res.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[CRM Tenant] Error creating inquiry:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create inquiry' });
  }
});

// PUT /api/tenant/crm/inquiries/:inquiryId
router.put('/inquiries/:inquiryId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Tenant User';

    const inquiry = await inquiryService.update(req.params.inquiryId, req.body);

    // Log activity for status changes
    if (req.body.status) {
      await activityService.create({
        tenant_id: tenantId,
        actor_id: actorId,
        actor_type: 'tenant',
        actor_name: actorName,
        activity_type: 'status_change',
        content: `Inquiry status changed to ${req.body.status}`,
        metadata: { inquiry_id: inquiry.id },
      });
    }

    await audit({ tenantId, actor: actorId, action: 'update', payload: { entity_type: 'crm_inquiry', id: inquiry.id, ...req.body } });
    res.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[CRM Tenant] Error updating inquiry:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update inquiry' });
  }
});

// POST /api/tenant/crm/inquiries/:inquiryId/create-faq
// Tier-gated: requires faq_kb_auto_sync capability (higher tier feature)
router.post('/inquiries/:inquiryId/create-faq', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';

    // Check capability: faq_kb_auto_sync via tier_features_list
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId }, select: { subscription_tier: true } });
    const tierKey = tenant?.subscription_tier || 'free';
    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    const hasKbSync = tier ? await prisma.tier_features_list.findFirst({
      where: { tier_id: tier.id, feature_key: 'faq_kb_auto_sync', is_enabled: true },
    }) : null;

    if (!hasKbSync) {
      return res.status(403).json({
        error: 'capability_required',
        message: 'Inquiry-to-FAQ curation requires a higher tier. Upgrade to unlock FAQ knowledge base features.',
        capability: 'faq_kb_auto_sync',
      });
    }

    // Check merchant gate: faq_kb_auto_sync must be enabled in tenant settings
    const faqSettings = await prisma.tenant_faq_options_settings.findUnique({
      where: { tenant_id: tenantId },
      select: { faq_kb_auto_sync: true },
    });
    if (!faqSettings?.faq_kb_auto_sync) {
      return res.status(403).json({
        error: 'merchant_gate_disabled',
        message: 'Inquiry-to-FAQ curation is disabled. Enable it in FAQ Options settings.',
      });
    }

    // Fetch the inquiry
    const inquiry = await inquiryService.getById(req.params.inquiryId);
    if (!inquiry || inquiry.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'inquiry_not_found', message: 'Inquiry not found' });
    }

    // Create FAQ from inquiry subject/body
    const FaqService = (await import('../../../services/FaqService')).default;
    const faqService = FaqService.getInstance();
    const faq = await faqService.createFAQ({
      tenant_id: tenantId,
      question: req.body.question || inquiry.subject,
      answer: req.body.answer || inquiry.body || '',
      scope: req.body.scope || 'storefront',
      status: req.body.status || 'draft',
      category_id: req.body.category_id || null,
      tags: req.body.tags || ['from-inquiry'],
    });

    // Log activity
    await activityService.create({
      tenant_id: tenantId,
      actor_id: actorId,
      actor_type: 'tenant',
      actor_name: req.user?.email || 'Tenant User',
      activity_type: 'note',
      content: `FAQ created from inquiry: ${inquiry.subject}`,
      metadata: { inquiry_id: inquiry.id },
    });

    await audit({ tenantId, actor: actorId, action: 'create', payload: { entity_type: 'faq', source: 'inquiry', inquiry_id: inquiry.id, faq_id: faq?.id } });
    res.json({ success: true, data: faq });
  } catch (error) {
    console.error('[CRM Tenant] Error creating FAQ from inquiry:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create FAQ from inquiry' });
  }
});

// ====================
// Alerts
// ====================

// GET /api/tenant/crm/alerts
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const alerts = await alertService.listByTenant(tenantId, {
      type: req.query.type as string,
      unreadOnly: req.query.unread === 'true',
    });
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('[CRM Tenant] Error listing alerts:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list alerts' });
  }
});

// PUT /api/tenant/crm/alerts/:alertId/read
router.put('/alerts/:alertId/read', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const alert = await alertService.getById(req.params.alertId);
    if (!alert || alert.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'not_found', message: 'Alert not found' });
    }

    await alertService.markRead(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Tenant] Error marking alert read:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark alert read' });
  }
});

// PUT /api/tenant/crm/alerts/read-all
router.put('/alerts/read-all', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    await alertService.markAllRead(tenantId);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Tenant] Error marking all alerts read:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark all alerts read' });
  }
});

// PUT /api/tenant/crm/alerts/:alertId/dismiss
router.put('/alerts/:alertId/dismiss', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;

    const alert = await alertService.getById(req.params.alertId);
    if (!alert || alert.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'not_found', message: 'Alert not found' });
    }

    await alertService.dismiss(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Tenant] Error dismissing alert:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to dismiss alert' });
  }
});

// PATCH /api/tenant/:tenantId/crm/tickets/reorder
router.patch('/tickets/reorder', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;
    const { items } = req.body as { items: { id: string; sort_order: number }[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'invalid_input', message: 'items array required' });
    await ticketService.reorder(items);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Tenant] Error reordering tickets:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to reorder tickets' });
  }
});

// PATCH /api/tenant/:tenantId/crm/tasks/reorder
router.patch('/tasks/reorder', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' });
    if (!(await checkCrmEnabled(tenantId, res))) return;
    const { items } = req.body as { items: { id: string; sort_order: number }[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'invalid_input', message: 'items array required' });
    await taskService.reorder(items);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Tenant] Error reordering tasks:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to reorder tasks' });
  }
});

export default router;
