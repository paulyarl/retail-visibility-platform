/**
 * CRM Admin Routes
 * 
 * Platform admin CRM endpoints for tenant management, global ticket/task queues,
 * and Requests Hub.
 * Auth: authenticateToken (mounted externally)
 */

import { Router, Request, Response } from 'express';
import CrmTenantService from '../../../services/CrmTenantService';
import CrmContactService from '../../../services/CrmContactService';
import CrmTicketService from '../../../services/CrmTicketService';
import CrmTicketMessageService from '../../../services/CrmTicketMessageService';
import CrmTaskService from '../../../services/CrmTaskService';
import CrmTaskMessageService from '../../../services/CrmTaskMessageService';
import CrmActivityService from '../../../services/CrmActivityService';
import CrmInquiryService from '../../../services/CrmInquiryService';
import CrmRequestReadService from '../../../services/CrmRequestReadService';
import CrmRequestHubService from '../../../services/CrmRequestHubService';
import CrmAlertService from '../../../services/CrmAlertService';
import { prisma } from '../../../prisma';
import { audit } from '../../../audit';

interface RequestItem {
  id: string;
  type: 'ticket' | 'task' | 'inquiry';
  tenant_id: string;
  tenant_name: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  created_at: Date | null;
  is_read: boolean;
}

const router = Router({ mergeParams: true });

const tenantService = CrmTenantService.getInstance();
const contactService = CrmContactService.getInstance();
const ticketService = CrmTicketService.getInstance();
const messageService = CrmTicketMessageService.getInstance();
const taskService = CrmTaskService.getInstance();
const taskMessageService = CrmTaskMessageService.getInstance();
const activityService = CrmActivityService.getInstance();
const inquiryService = CrmInquiryService.getInstance();
const requestReadService = CrmRequestReadService.getInstance();
const requestHubService = CrmRequestHubService.getInstance();
const alertService = CrmAlertService.getInstance();

// ====================
// Dashboard Stats
// ====================

// GET /api/admin/crm/dashboard-stats
router.get('/dashboard-stats', async (_req: Request, res: Response) => {
  try {
    const stats = await requestHubService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[CRM Admin] Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch dashboard stats' });
  }
});

// ====================
// Tenants (CRM context)
// ====================

// GET /api/admin/crm/tenants
router.get('/tenants', async (req: Request, res: Response) => {
  try {
    const result = await tenantService.listTenants({
      q: req.query.q as string,
      tier: req.query.tier as string,
      status: req.query.status as string,
      assignedTo: req.query.assignedTo as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 25,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CRM Admin] Error listing tenants:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tenants' });
  }
});

// GET /api/admin/crm/tenants/:tenantId
router.get('/tenants/:tenantId', async (req: Request, res: Response) => {
  try {
    const detail = await tenantService.getTenantDetail(req.params.tenantId);
    if (!detail) return res.status(404).json({ error: 'tenant_not_found' });
    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('[CRM Admin] Error fetching tenant detail:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch tenant detail' });
  }
});

// GET /api/admin/crm/tenants/:tenantId/transactions
router.get('/tenants/:tenantId/transactions', async (req: Request, res: Response) => {
  try {
    const result = await tenantService.getTenantTransactions(
      req.params.tenantId,
      req.query.page ? parseInt(req.query.page as string) : 1,
      req.query.limit ? parseInt(req.query.limit as string) : 25,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CRM Admin] Error fetching transactions:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch transactions' });
  }
});

// ====================
// Contacts (admin can manage any tenant's contacts)
// ====================

// GET /api/admin/crm/tenants/:tenantId/contacts
router.get('/tenants/:tenantId/contacts', async (req: Request, res: Response) => {
  try {
    // Auto-sync contacts from orders before listing
    await contactService.syncFromOrders(req.params.tenantId);

    const contacts = await contactService.listByTenant(req.params.tenantId);
    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('[CRM Admin] Error listing contacts:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list contacts' });
  }
});

// POST /api/admin/crm/tenants/:tenantId/contacts
router.post('/tenants/:tenantId/contacts', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';

    const contact = await contactService.create({ tenant_id: tenantId, ...req.body });
    await audit({ tenantId, actor: actorId, action: 'create', payload: { entity_type: 'crm_contact', id: contact.id, ...req.body } });
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('[CRM Admin] Error creating contact:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create contact' });
  }
});

// PUT /api/admin/crm/contacts/:contactId
router.put('/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const contact = await contactService.update(req.params.contactId, req.body);
    await audit({ tenantId: contact.tenant_id, actor: actorId, action: 'update', payload: { entity_type: 'crm_contact', id: contact.id } });
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error('[CRM Admin] Error updating contact:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update contact' });
  }
});

// DELETE /api/admin/crm/contacts/:contactId
router.delete('/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const contact = await contactService.getById(req.params.contactId);
    if (!contact) return res.status(404).json({ error: 'contact_not_found' });

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    await contactService.delete(req.params.contactId);
    await audit({ tenantId: contact.tenant_id, actor: actorId, action: 'delete', payload: { entity_type: 'crm_contact', id: contact.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Admin] Error deleting contact:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete contact' });
  }
});

// ====================
// Tickets (global + tenant-scoped)
// ====================

// GET /api/admin/crm/tickets/:ticketId
router.get('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const ticket = await ticketService.getById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[CRM Admin] Error fetching ticket:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch ticket' });
  }
});

// GET /api/admin/crm/tickets (global queue)
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const tickets = await ticketService.listGlobal({
      assignedTo: req.query.assignedTo as string,
      status: req.query.status as string,
      priority: req.query.priority as string,
      category: req.query.category as string,
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('[CRM Admin] Error listing global tickets:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tickets' });
  }
});

// GET /api/admin/crm/tenants/:tenantId/tickets
router.get('/tenants/:tenantId/tickets', async (req: Request, res: Response) => {
  try {
    const tickets = await ticketService.listByTenant(req.params.tenantId, {
      status: req.query.status as string,
      priority: req.query.priority as string,
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('[CRM Admin] Error listing tenant tickets:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tickets' });
  }
});

// POST /api/admin/crm/tenants/:tenantId/tickets
router.post('/tenants/:tenantId/tickets', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const ticket = await ticketService.create({ tenant_id: tenantId, ...req.body });
    await audit({ tenantId, actor: actorId, action: 'create', payload: { entity_type: 'crm_ticket', id: ticket.id, ...req.body } });

    // Auto-log ticket creation as activity
    await activityService.create({
      tenant_id: tenantId,
      ticket_id: ticket.id,
      actor_id: actorId,
      actor_type: 'platform',
      actor_name: actorName,
      activity_type: 'status_change',
      content: `Ticket created: ${req.body.title}`,
      is_internal: false,
    });

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[CRM Admin] Error creating ticket:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create ticket' });
  }
});

// PUT /api/admin/crm/tickets/:ticketId
router.put('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const ticket = await ticketService.update(req.params.ticketId, req.body, actorId, actorName, 'platform');
    await audit({ tenantId: ticket.tenant_id, actor: actorId, action: 'update', payload: { entity_type: 'crm_ticket', id: ticket.id, ...req.body } });
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[CRM Admin] Error updating ticket:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update ticket' });
  }
});

// GET /api/admin/crm/tickets/:ticketId/messages
router.get('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    // Admin can see internal notes
    const messages = await messageService.listByTicket(req.params.ticketId, true);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CRM Admin] Error listing ticket messages:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list messages' });
  }
});

// POST /api/admin/crm/tickets/:ticketId/messages
router.post('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const message = await messageService.create({
      ticket_id: req.params.ticketId,
      author_id: actorId,
      author_type: 'platform',
      author_name: actorName,
      content: req.body.content,
      is_internal: req.body.is_internal ?? true, // Admin notes default to internal
    });
    res.json({ success: true, data: message });
  } catch (error) {
    console.error('[CRM Admin] Error creating ticket message:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create message' });
  }
});

// ====================
// Tasks (global + tenant-scoped)
// ====================

// GET /api/admin/crm/tasks (global task board)
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await taskService.listGlobal({
      assignedTo: req.query.assignedTo as string,
      status: req.query.status as string,
      tenantId: req.query.tenantId as string,
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('[CRM Admin] Error listing tasks:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tasks' });
  }
});

// POST /api/admin/crm/tasks
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const task = await taskService.create({ ...req.body, created_by: actorId });
    await audit({ tenantId: req.body.tenant_id, actor: actorId, action: 'create', payload: { entity_type: 'crm_task', id: task.id } });

    // Auto-log task creation as activity
    await activityService.create({
      tenant_id: req.body.tenant_id,
      task_id: task.id,
      actor_id: actorId,
      actor_type: 'platform',
      actor_name: actorName,
      activity_type: 'task_created',
      content: `Task created: ${req.body.title}`,
      is_internal: false,
    });

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('[CRM Admin] Error creating task:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create task' });
  }
});

// PUT /api/admin/crm/tasks/:taskId
router.put('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const task = await taskService.update(req.params.taskId, req.body, actorId, actorName, 'platform');
    await audit({ tenantId: task.tenant_id, actor: actorId, action: 'update', payload: { entity_type: 'crm_task', id: task.id } });
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('[CRM Admin] Error updating task:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update task' });
  }
});

// GET /api/admin/crm/tasks/:taskId/messages
router.get('/tasks/:taskId/messages', async (req: Request, res: Response) => {
  try {
    const messages = await taskMessageService.listByTask(req.params.taskId, true);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CRM Admin] Error listing task messages:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list task messages' });
  }
});

// POST /api/admin/crm/tasks/:taskId/messages
router.post('/tasks/:taskId/messages', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const message = await taskMessageService.create({
      task_id: req.params.taskId,
      author_id: actorId,
      author_type: 'platform',
      author_name: actorName,
      content: req.body.content,
      is_internal: req.body.is_internal ?? true,
    });
    res.json({ success: true, data: message });
  } catch (error) {
    console.error('[CRM Admin] Error creating task message:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create task message' });
  }
});

// DELETE /api/admin/crm/tasks/:taskId
router.delete('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const task = await taskService.getById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    await taskService.delete(req.params.taskId);
    await audit({ tenantId: task.tenant_id, actor: actorId, action: 'delete', payload: { entity_type: 'crm_task', id: task.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Admin] Error deleting task:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete task' });
  }
});

// ====================
// Activities
// ====================

// GET /api/admin/crm/activities (global)
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const isInternal = req.query.isInternal === 'true' ? true : req.query.isInternal === 'false' ? false : undefined;
    const activities = await activityService.listGlobal({ limit, isInternal });
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('[CRM Admin] Error listing global activities:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list activities' });
  }
});

// GET /api/admin/crm/tenants/:tenantId/activities
router.get('/tenants/:tenantId/activities', async (req: Request, res: Response) => {
  try {
    const activities = await activityService.listByTenant(req.params.tenantId, {
      type: req.query.type as string,
      ticketId: req.query.ticketId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      isInternal: req.query.isInternal === 'true' ? true : req.query.isInternal === 'false' ? false : undefined,
    });
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('[CRM Admin] Error listing activities:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list activities' });
  }
});

// POST /api/admin/crm/tenants/:tenantId/activities
router.post('/tenants/:tenantId/activities', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    const activity = await activityService.create({
      tenant_id: tenantId,
      actor_id: actorId,
      actor_type: 'platform',
      actor_name: actorName,
      ...req.body,
    });
    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('[CRM Admin] Error creating activity:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create activity' });
  }
});

// ====================
// Inquiries
// ====================

// GET /api/admin/crm/inquiries (global)
router.get('/inquiries', async (req: Request, res: Response) => {
  try {
    const inquiries = await inquiryService.listGlobal({
      assignedTo: req.query.assignedTo as string,
      status: req.query.status as string,
    });
    res.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('[CRM Admin] Error listing inquiries:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list inquiries' });
  }
});

// GET /api/admin/crm/tenants/:tenantId/inquiries
router.get('/tenants/:tenantId/inquiries', async (req: Request, res: Response) => {
  try {
    const inquiries = await inquiryService.listByTenant(req.params.tenantId, {
      status: req.query.status as string,
      priority: req.query.priority as string,
    });
    res.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('[CRM Admin] Error listing tenant inquiries:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list inquiries' });
  }
});

// POST /api/admin/crm/tenants/:tenantId/inquiries
router.post('/tenants/:tenantId/inquiries', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';

    const inquiry = await inquiryService.create({ tenant_id: tenantId, ...req.body });
    await audit({ tenantId, actor: actorId, action: 'create', payload: { entity_type: 'crm_inquiry', id: inquiry.id } });
    res.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[CRM Admin] Error creating inquiry:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create inquiry' });
  }
});

// PUT /api/admin/crm/inquiries/:inquiryId
router.put('/inquiries/:inquiryId', async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const inquiry = await inquiryService.update(req.params.inquiryId, req.body);
    await audit({ tenantId: inquiry.tenant_id, actor: actorId, action: 'update', payload: { entity_type: 'crm_inquiry', id: inquiry.id } });
    res.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[CRM Admin] Error updating inquiry:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update inquiry' });
  }
});

// ====================
// Requests Hub (unified tickets + tasks + inquiries)
// ====================

// GET /api/admin/crm/requests
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || req.user?.user_id || 'unknown';
    const requestItems = await requestHubService.listRequests(userId, {
      type: req.query.type as any,
      status: req.query.status as string,
      priority: req.query.priority as string,
      assignedTo: req.query.assignedTo as string,
      tenantId: req.query.tenantId as string,
      unread: req.query.unread === 'true',
    });

    res.json({ success: true, data: requestItems });
  } catch (error) {
    console.error('[CRM Admin] Error listing requests:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list requests' });
  }
});

// PATCH /api/admin/crm/requests/:requestId
router.patch('/requests/:requestId', async (req: Request, res: Response) => {
  try {
    const { type, ...data } = req.body;
    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const actorName = req.user?.email || 'Platform Admin';

    let result: any;
    if (type === 'ticket') {
      result = await ticketService.update(req.params.requestId, data, actorId, actorName, 'platform');
    } else if (type === 'task') {
      result = await taskService.update(req.params.requestId, data, actorId, actorName, 'platform');
    } else if (type === 'inquiry') {
      result = await inquiryService.update(req.params.requestId, data);
    } else {
      return res.status(400).json({ error: 'invalid_type', message: 'Type must be ticket, task, or inquiry' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CRM Admin] Error updating request:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update request' });
  }
});

// POST /api/admin/crm/requests/:requestId/read
router.post('/requests/:requestId/read', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || req.user?.user_id || 'unknown';
    const requestType = req.body.type || req.query.type as string;
    if (!requestType) return res.status(400).json({ error: 'type_required', message: 'Request type (ticket/task/inquiry) required' });

    await requestReadService.markRead(userId, req.params.requestId, requestType);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Admin] Error marking request read:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark request as read' });
  }
});

// POST /api/admin/crm/requests/read-all
router.post('/requests/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || req.user?.user_id || 'unknown';

    // Fetch all open items
    const [tickets, tasks, inquiries] = await Promise.all([
      ticketService.listGlobal({ status: 'open' }),
      taskService.listGlobal({ status: 'pending' }),
      inquiryService.listGlobal({ status: 'open' }),
    ]);

    const allRequests = [
      ...tickets.map((t: any) => ({ id: t.id, type: 'ticket' as const })),
      ...tasks.map((t: any) => ({ id: t.id, type: 'task' as const })),
      ...inquiries.map((i: any) => ({ id: i.id, type: 'inquiry' as const })),
    ];

    await requestReadService.markAllRead(userId, allRequests);
    res.json({ success: true, marked: allRequests.length });
  } catch (error) {
    console.error('[CRM Admin] Error marking all requests read:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark all requests as read' });
  }
});

// ====================
// Alerts (admin creates alerts for tenants)
// ====================

// POST /api/admin/crm/alerts
router.post('/alerts', async (req: Request, res: Response) => {
  try {
    const { tenant_id, type, title, body, icon, metadata } = req.body;
    if (!tenant_id || !type || !title) {
      return res.status(400).json({ error: 'invalid_input', message: 'tenant_id, type, and title are required' });
    }

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const alert = await alertService.create({ tenant_id, type, title, body, icon, metadata });
    await audit({ tenantId: tenant_id, actor: actorId, action: 'create', payload: { entity_type: 'crm_alert', id: alert.id, type, title } });
    res.json({ success: true, data: alert });
  } catch (error) {
    console.error('[CRM Admin] Error creating alert:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create alert' });
  }
});

// POST /api/admin/crm/alerts/broadcast
// Send the same alert to multiple tenants (or all tenants when send_to_all is true)
router.post('/alerts/broadcast', async (req: Request, res: Response) => {
  try {
    const { tenant_ids, send_to_all, type, title, body, icon, metadata } = req.body;
    if (!type || !title) {
      return res.status(400).json({ error: 'invalid_input', message: 'type and title are required' });
    }

    let targetIds: string[] = [];

    if (send_to_all) {
      const allTenants = await prisma.tenants.findMany({
        where: { subscription_status: { notIn: ['cancelled'] } },
        select: { id: true },
      });
      targetIds = allTenants.map((t: { id: string }) => t.id);
    } else {
      if (!Array.isArray(tenant_ids) || tenant_ids.length === 0) {
        return res.status(400).json({ error: 'invalid_input', message: 'tenant_ids array or send_to_all is required' });
      }
      targetIds = tenant_ids;
    }

    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'no_tenants', message: 'No tenants found to broadcast to' });
    }

    const actorId = req.user?.userId || req.user?.user_id || 'unknown';
    const results = await Promise.all(
      targetIds.map(tid => alertService.create({ tenant_id: tid, type, title, body, icon, metadata }))
    );
    await audit({ tenantId: 'broadcast', actor: actorId, action: 'create', payload: { entity_type: 'crm_alert_broadcast', count: results.length, send_to_all: !!send_to_all, type, title } });
    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('[CRM Admin] Error broadcasting alerts:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to broadcast alerts' });
  }
});

// PATCH /api/admin/crm/tickets/reorder
router.patch('/tickets/reorder', async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: { id: string; sort_order: number }[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'invalid_input', message: 'items array required' });
    await ticketService.reorder(items);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Admin] Error reordering tickets:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to reorder tickets' });
  }
});

// PATCH /api/admin/crm/tasks/reorder
router.patch('/tasks/reorder', async (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: { id: string; sort_order: number }[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'invalid_input', message: 'items array required' });
    await taskService.reorder(items);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Admin] Error reordering tasks:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to reorder tasks' });
  }
});

export default router;
