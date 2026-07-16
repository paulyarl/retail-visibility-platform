/**
 * Customer CRM Routes
 * 
 * Customer-scoped CRM endpoints for support portal.
 * Auth: authenticateCustomer middleware (mounted externally)
 * Customer ID derived from req.customer set by authenticateCustomer.
 */

import { Router, Request, Response } from 'express';
import CrmTicketService from '../../../services/CrmTicketService';
import CrmTicketMessageService from '../../../services/CrmTicketMessageService';
import CrmActivityService from '../../../services/CrmActivityService';
import CrmInquiryService from '../../../services/CrmInquiryService';
import CrmOptionsService from '../../../services/CrmOptionsService';
import { CrmAlertService } from '../../../services/CrmAlertService';
import CrmCustomerReadStateService from '../../../services/CrmCustomerReadStateService';
import { audit } from '../../../audit';
import { prisma } from '../../../prisma';
import { logger } from '../../../logger';

async function checkCrmCustomerEnabled(tenantId: string, res: Response): Promise<boolean> {
  const crmOptions = await CrmOptionsService.getInstance().resolveCrmOptionsState(tenantId);
  if (!crmOptions.enabled) {
    res.status(403).json({ error: 'crm_disabled', message: 'CRM is not enabled for this tenant' });
    return false;
  }
  if (!crmOptions.customerTicketsEnabled) {
    res.status(403).json({ error: 'crm_customer_tickets_disabled', message: 'Customer tickets are not enabled for this tenant' });
    return false;
  }
  return true;
}

const router = Router({ mergeParams: true });

const ticketService = CrmTicketService.getInstance();
const messageService = CrmTicketMessageService.getInstance();
const activityService = CrmActivityService.getInstance();
const inquiryService = CrmInquiryService.getInstance();
const alertService = CrmAlertService.getInstance();
const customerReadStateService = CrmCustomerReadStateService.getInstance();

/**
 * Get the set of tenant IDs and order IDs belonging to a customer (by email).
 * Used to scope CRM alerts to only those the customer owns or has a relationship with.
 */
async function getCustomerAlertScope(customerEmail: string): Promise<{ tenantIds: string[]; orderIds: string[] }> {
  const orders = await prisma.orders.findMany({
    where: { customer_email: customerEmail },
    select: { id: true, tenant_id: true },
  });
  const orderTenantIds = orders.map(o => o.tenant_id);

  // Also include tenants from customer-tenant relationships (e.g., customers who
  // abandoned a cart but haven't placed an order yet, but have a relationship)
  const relationships = await prisma.customer_tenant_relationships.findMany({
    where: { customers: { email: customerEmail } },
    select: { tenant_id: true },
  });
  const relationshipTenantIds = relationships.map(r => r.tenant_id);

  const tenantIds = [...new Set([...orderTenantIds, ...relationshipTenantIds])];
  const orderIds = orders.map(o => o.id);
  return { tenantIds, orderIds };
}

// ====================
// Tickets
// ====================

// GET /api/customer/crm/tickets
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const tickets = await ticketService.listByCustomer(customerId, {
      status: req.query.status as string,
    });

    // Filter out tickets from tenants where CRM customer tickets are disabled
    const tenantIds = [...new Set(tickets.map((t: any) => t.tenant_id))];
    const crmStates = await Promise.all(tenantIds.map(id => CrmOptionsService.getInstance().resolveCrmOptionsState(id).then(s => ({ id, enabled: s.enabled && s.customerTicketsEnabled })).catch(() => ({ id, enabled: false }))));
    const enabledTenantIds = new Set(crmStates.filter(s => s.enabled).map(s => s.id));
    const filteredTickets = tickets.filter((t: any) => enabledTenantIds.has(t.tenant_id));

    // Enrich with tenant name/logo from business profile
    const enrichedTenantIds = [...new Set(filteredTickets.map((t: any) => t.tenant_id))];
    const profiles = await prisma.tenant_business_profiles_list.findMany({
      where: { tenant_id: { in: enrichedTenantIds } },
      select: { tenant_id: true, business_name: true, logo_url: true },
    });
    const profileMap = new Map(profiles.map((p: any) => [p.tenant_id, p]));
    const enriched = filteredTickets.map((t: any) => ({
      ...t,
      tenant_name: profileMap.get(t.tenant_id)?.business_name || null,
      tenant_logo: profileMap.get(t.tenant_id)?.logo_url || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error('[CRM Customer] Error listing tickets:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tickets' });
  }
});

// POST /api/customer/crm/tickets
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    if (!req.body.tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required', message: 'Tenant ID is required to create a ticket' });
    }
    if (!(await checkCrmCustomerEnabled(req.body.tenant_id, res))) return;

    const ticket = await ticketService.createFromCustomer(customerId, {
      tenant_id: req.body.tenant_id,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      category: req.body.category,
      faq_id: req.body.faq_id || undefined,
    });

    await audit({
      tenantId: req.body.tenant_id,
      actor: customerId,
      action: 'create',
      payload: { entity_type: 'crm_ticket', id: ticket.id, title: req.body.title },
    });

    // Auto-log ticket creation as activity
    const customerName = [req.customer?.first_name, req.customer?.last_name].filter(Boolean).join(' ') || req.customer?.email || 'Customer';
    await activityService.create({
      tenant_id: req.body.tenant_id,
      ticket_id: ticket.id,
      actor_id: customerId,
      actor_type: 'customer',
      actor_name: customerName,
      activity_type: 'status_change',
      content: `Ticket created by customer: ${req.body.title}`,
      is_internal: false,
    });

    res.json({ success: true, data: ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create ticket';
    logger.error('[CRM Customer] Error creating ticket:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    if (message.includes('relationship')) {
      return res.status(403).json({ error: 'customer_tenant_relationship_required', message });
    }
    res.status(500).json({ error: 'internal_error', message });
  }
});

// GET /api/customer/crm/tickets/:ticketId
router.get('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const ticket = await ticketService.getById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });

    // Verify ownership
    if (ticket.customer_id !== customerId) {
      return res.status(403).json({ error: 'access_denied', message: 'You can only view your own tickets' });
    }
    if (!(await checkCrmCustomerEnabled(ticket.tenant_id, res))) return;

    // Enrich with tenant name/logo from business profile
    const profile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: ticket.tenant_id },
      select: { business_name: true, logo_url: true },
    });

    res.json({ success: true, data: { ...ticket, tenant_name: profile?.business_name || null, tenant_logo: profile?.logo_url || null } });
  } catch (error) {
    logger.error('[CRM Customer] Error fetching ticket:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch ticket' });
  }
});

// GET /api/customer/crm/tickets/:ticketId/messages
router.get('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    // Verify ticket ownership first
    const ticket = await ticketService.getById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });
    if (ticket.customer_id !== customerId) {
      return res.status(403).json({ error: 'access_denied', message: 'You can only view your own tickets' });
    }
    if (!(await checkCrmCustomerEnabled(ticket.tenant_id, res))) return;

    // Customer cannot see internal notes
    const messages = await messageService.listByTicket(req.params.ticketId, false);
    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error('[CRM Customer] Error listing ticket messages:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list messages' });
  }
});

// POST /api/customer/crm/tickets/:ticketId/messages
router.post('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    // Verify ticket ownership
    const ticket = await ticketService.getById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });
    if (ticket.customer_id !== customerId) {
      return res.status(403).json({ error: 'access_denied', message: 'You can only reply to your own tickets' });
    }
    if (!(await checkCrmCustomerEnabled(ticket.tenant_id, res))) return;

    const customerName = [req.customer?.first_name, req.customer?.last_name].filter(Boolean).join(' ') || req.customer?.email || 'Customer';

    const message = await messageService.create({
      ticket_id: req.params.ticketId,
      author_id: customerId,
      author_type: 'customer',
      author_name: customerName,
      content: req.body.content,
      is_internal: false, // Customer messages are never internal
    });

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error('[CRM Customer] Error creating ticket message:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to create message' });
  }
});

// ====================
// Activities
// ====================

// GET /api/customer/crm/activities
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const activities = await activityService.listByCustomer(customerId, {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    // Filter out activities from tenants where CRM customer tickets are disabled
    const tenantIds = [...new Set(activities.map((a: any) => a.tenant_id).filter(Boolean))];
    const crmStates = await Promise.all(tenantIds.map(id => CrmOptionsService.getInstance().resolveCrmOptionsState(id).then(s => ({ id, enabled: s.enabled && s.customerTicketsEnabled })).catch(() => ({ id, enabled: false }))));
    const enabledTenantIds = new Set(crmStates.filter(s => s.enabled).map(s => s.id));
    const filteredActivities = activities.filter((a: any) => !a.tenant_id || enabledTenantIds.has(a.tenant_id));
    res.json({ success: true, data: filteredActivities });
  } catch (error) {
    logger.error('[CRM Customer] Error listing activities:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list activities' });
  }
});

// ====================
// Orders
// ====================

// GET /api/customer/crm/orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const customerEmail = req.customer?.email;
    if (!customerEmail) return res.status(400).json({ error: 'customer_email_required' });

    const orders = await prisma.orders.findMany({
      where: { customer_email: customerEmail },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        order_number: true,
        total_cents: true,
        order_status: true,
        payment_status: true,
        tenant_id: true,
        created_at: true,
      },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('[CRM Customer] Error listing orders:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list orders' });
  }
});

// ====================
// Inquiries
// ====================

// GET /api/customer/crm/inquiries
router.get('/inquiries', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const inquiries = await inquiryService.listByCustomer(customerId, {
      status: req.query.status as string,
    });
    res.json({ success: true, data: inquiries });
  } catch (error) {
    logger.error('[CRM Customer] Error listing inquiries:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list inquiries' });
  }
});

// POST /api/customer/crm/inquiries
router.post('/inquiries', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    if (!req.body.tenant_id) {
      return res.status(400).json({ error: 'tenant_id_required', message: 'Tenant ID is required to submit an inquiry' });
    }
    if (!(await checkCrmCustomerEnabled(req.body.tenant_id, res))) return;

    const inquiry = await inquiryService.createFromCustomer(customerId, {
      tenant_id: req.body.tenant_id,
      subject: req.body.subject,
      body: req.body.body,
      priority: req.body.priority,
    });

    await audit({
      tenantId: req.body.tenant_id,
      actor: customerId,
      action: 'create',
      payload: { entity_type: 'crm_inquiry', id: inquiry.id, subject: req.body.subject },
    });

    res.json({ success: true, data: inquiry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create inquiry';
    logger.error('[CRM Customer] Error creating inquiry:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    if (message.includes('relationship')) {
      return res.status(403).json({ error: 'customer_tenant_relationship_required', message });
    }
    res.status(500).json({ error: 'internal_error', message });
  }
});

// ====================
// Alerts
// ====================

// GET /api/customer/crm/alerts
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    const customerEmail = req.customer?.email;
    if (!customerId || !customerEmail) {
      return res.status(401).json({ error: 'customer_auth_required' });
    }

    const { tenantIds, orderIds } = await getCustomerAlertScope(customerEmail);
    if (tenantIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Query all undismissed alerts from customer-related tenants
    const where: any = {
      tenant_id: { in: tenantIds },
      is_dismissed: false,
    };

    if (req.query.type) {
      where.type = req.query.type as string;
    }
    if (req.query.unread === 'true') {
      where.is_read = false;
    }

    const alerts = await prisma.crm_alerts.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    // Scope order alerts to only those matching customer's own order IDs
    // Scope abandoned_cart alerts to only those matching customer's email
    const filtered = alerts.filter((a: any) => {
      if (a.type === 'order') {
        const metaOrderId = a.metadata?.order_id;
        return metaOrderId && orderIds.includes(metaOrderId);
      }
      if (a.type === 'abandoned_cart') {
        const metaEmail = a.metadata?.customer_email;
        return metaEmail && metaEmail === customerEmail;
      }
      return true; // info, warning, subscription, etc. are tenant-scoped
    });

    res.json({ success: true, data: filtered });
  } catch (error) {
    logger.error('[CRM Customer] Error listing alerts:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list alerts' });
  }
});

// PUT /api/customer/crm/alerts/:alertId/read
router.put('/alerts/:alertId/read', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    const customerEmail = req.customer?.email;
    if (!customerId || !customerEmail) {
      return res.status(401).json({ error: 'customer_auth_required' });
    }

    const alert = await alertService.getById(req.params.alertId);
    if (!alert) {
      return res.status(404).json({ error: 'not_found', message: 'Alert not found' });
    }

    // Verify ownership: tenant must be in customer's tenant list
    const { tenantIds, orderIds } = await getCustomerAlertScope(customerEmail);
    if (!tenantIds.includes(alert.tenant_id)) {
      return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
    }
    // For order alerts, also verify the order belongs to the customer
    if (alert.type === 'order') {
      const metaOrderId = (alert.metadata as any)?.order_id;
      if (!metaOrderId || !orderIds.includes(metaOrderId)) {
        return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
      }
    }
    // For abandoned_cart alerts, verify the customer email matches
    if (alert.type === 'abandoned_cart') {
      const metaEmail = (alert.metadata as any)?.customer_email;
      if (!metaEmail || metaEmail !== customerEmail) {
        return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
      }
    }

    await alertService.markRead(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    logger.error('[CRM Customer] Error marking alert read:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark alert read' });
  }
});

// PUT /api/customer/crm/alerts/read-all
router.put('/alerts/read-all', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    const customerEmail = req.customer?.email;
    if (!customerId || !customerEmail) {
      return res.status(401).json({ error: 'customer_auth_required' });
    }

    const { tenantIds } = await getCustomerAlertScope(customerEmail);
    if (tenantIds.length === 0) {
      return res.json({ success: true });
    }

    // Mark all non-dismissed alerts in customer-related tenants as read
    // Note: this marks ALL tenant alerts read, not just order-scoped ones,
    // because non-order alerts (info/warning) are tenant-level and legitimate to mark read
    await prisma.crm_alerts.updateMany({
      where: {
        tenant_id: { in: tenantIds },
        is_dismissed: false,
        is_read: false,
      },
      data: { is_read: true, read_at: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[CRM Customer] Error marking all alerts read:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark all alerts read' });
  }
});

// PUT /api/customer/crm/alerts/:alertId/dismiss
router.put('/alerts/:alertId/dismiss', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    const customerEmail = req.customer?.email;
    if (!customerId || !customerEmail) {
      return res.status(401).json({ error: 'customer_auth_required' });
    }

    const alert = await alertService.getById(req.params.alertId);
    if (!alert) {
      return res.status(404).json({ error: 'not_found', message: 'Alert not found' });
    }

    // Verify ownership: tenant must be in customer's tenant list
    const { tenantIds, orderIds } = await getCustomerAlertScope(customerEmail);
    if (!tenantIds.includes(alert.tenant_id)) {
      return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
    }
    // For order alerts, also verify the order belongs to the customer
    if (alert.type === 'order') {
      const metaOrderId = (alert.metadata as any)?.order_id;
      if (!metaOrderId || !orderIds.includes(metaOrderId)) {
        return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
      }
    }
    // For abandoned_cart alerts, verify the customer email matches
    if (alert.type === 'abandoned_cart') {
      const metaEmail = (alert.metadata as any)?.customer_email;
      if (!metaEmail || metaEmail !== customerEmail) {
        return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
      }
    }

    await alertService.dismiss(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    logger.error('[CRM Customer] Error dismissing alert:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to dismiss alert' });
  }
});

// ====================
// User Read State (persistent widget read tracking)
// ====================

// GET /api/customer/crm/read-state
router.get('/read-state', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const states = await customerReadStateService.getReadStates(customerId);
    res.json({ success: true, data: states });
  } catch (error) {
    logger.error('[CRM Customer] Error fetching read state:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch read state' });
  }
});

// PUT /api/customer/crm/read-state
// Body: { scope: string, last_read_at?: ISO string }
router.put('/read-state', async (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ error: 'customer_auth_required' });

    const { scope, last_read_at } = req.body;
    if (!scope || typeof scope !== 'string') {
      return res.status(400).json({ error: 'scope_required', message: 'scope is required' });
    }

    const lastReadAt = last_read_at ? new Date(last_read_at) : new Date();

    await customerReadStateService.setLastReadAt(customerId, scope, lastReadAt);
    res.json({ success: true });
  } catch (error) {
    logger.error('[CRM Customer] Error updating read state:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update read state' });
  }
});

export default router;
