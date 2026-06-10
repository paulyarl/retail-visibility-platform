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
import { audit } from '../../../audit';
import { prisma } from '../../../prisma';

const router = Router({ mergeParams: true });

const ticketService = CrmTicketService.getInstance();
const messageService = CrmTicketMessageService.getInstance();
const activityService = CrmActivityService.getInstance();
const inquiryService = CrmInquiryService.getInstance();

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

    // Enrich with tenant name/logo from business profile
    const tenantIds = [...new Set(tickets.map((t: any) => t.tenant_id))];
    const profiles = await prisma.tenant_business_profiles_list.findMany({
      where: { tenant_id: { in: tenantIds } },
      select: { tenant_id: true, business_name: true, logo_url: true },
    });
    const profileMap = new Map(profiles.map((p: any) => [p.tenant_id, p]));
    const enriched = tickets.map((t: any) => ({
      ...t,
      tenant_name: profileMap.get(t.tenant_id)?.business_name || null,
      tenant_logo: profileMap.get(t.tenant_id)?.logo_url || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CRM Customer] Error listing tickets:', error);
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

    const ticket = await ticketService.createFromCustomer(customerId, {
      tenant_id: req.body.tenant_id,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      category: req.body.category,
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
    console.error('[CRM Customer] Error creating ticket:', error);
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

    // Enrich with tenant name/logo from business profile
    const profile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: ticket.tenant_id },
      select: { business_name: true, logo_url: true },
    });

    res.json({ success: true, data: { ...ticket, tenant_name: profile?.business_name || null, tenant_logo: profile?.logo_url || null } });
  } catch (error) {
    console.error('[CRM Customer] Error fetching ticket:', error);
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

    // Customer cannot see internal notes
    const messages = await messageService.listByTicket(req.params.ticketId, false);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CRM Customer] Error listing ticket messages:', error);
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
    console.error('[CRM Customer] Error creating ticket message:', error);
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
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('[CRM Customer] Error listing activities:', error);
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
    console.error('[CRM Customer] Error listing orders:', error);
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
    console.error('[CRM Customer] Error listing inquiries:', error);
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
    console.error('[CRM Customer] Error creating inquiry:', error);
    if (message.includes('relationship')) {
      return res.status(403).json({ error: 'customer_tenant_relationship_required', message });
    }
    res.status(500).json({ error: 'internal_error', message });
  }
});

export default router;
