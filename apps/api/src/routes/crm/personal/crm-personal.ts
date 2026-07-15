/**
 * Personal CRM Routes
 *
 * User-scoped CRM endpoints for personal CRM hub at /settings/crm.
 * Aggregates tickets, tasks, alerts, and activities across all user's tenant memberships.
 * Also supports platform support tickets (user → platform, tenant_id = 'platform').
 *
 * Auth: authenticateToken (mounted externally)
 * No checkTenantAccess — routes are cross-tenant by design.
 */

import { Router, Request, Response } from 'express';
import CrmTicketService from '../../../services/CrmTicketService';
import CrmTicketMessageService from '../../../services/CrmTicketMessageService';
import CrmTaskService from '../../../services/CrmTaskService';
import CrmActivityService from '../../../services/CrmActivityService';
import CrmAlertService from '../../../services/CrmAlertService';
import { prisma } from '../../../prisma';
import { audit } from '../../../audit';

const router = Router({ mergeParams: true });

const ticketService = CrmTicketService.getInstance();
const messageService = CrmTicketMessageService.getInstance();
const taskService = CrmTaskService.getInstance();
const activityService = CrmActivityService.getInstance();
const alertService = CrmAlertService.getInstance();

const PLATFORM_TENANT_ID = 'platform';

function getUserId(req: Request): string | null {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function getUserDisplayName(req: Request): string {
  return [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ') || req.user?.email || 'Platform User';
}

function getTenantIds(req: Request): string[] {
  return req.user?.tenantIds || [];
}

// ====================
// Dashboard
// ====================

// GET /api/personal/crm/dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const tenantIds = getTenantIds(req);

    const [assignedTickets, pendingTasks, recentActivities, unreadAlerts, platformTickets] = await Promise.all([
      prisma.crm_support_tickets.count({
        where: {
          assigned_to: userId,
          status: { in: ['open', 'in_progress', 'waiting'] },
        },
      }),
      prisma.crm_tasks.count({
        where: {
          assigned_to: userId,
          status: { in: ['pending', 'in_progress'] },
        },
      }),
      tenantIds.length > 0
        ? prisma.crm_activities.findMany({
            where: {
              tenant_id: { in: tenantIds },
              is_internal: false,
            },
            orderBy: { created_at: 'desc' },
            take: 10,
            select: {
              id: true, actor_id: true, actor_name: true, actor_type: true,
              activity_type: true, content: true, ticket_id: true, task_id: true,
              tenant_id: true, created_at: true,
            },
          })
        : Promise.resolve([]),
      tenantIds.length > 0
        ? prisma.crm_alerts.count({
            where: {
              tenant_id: { in: tenantIds },
              is_read: false,
              is_dismissed: false,
            },
          })
        : Promise.resolve(0),
      prisma.crm_support_tickets.count({
        where: {
          tenant_id: PLATFORM_TENANT_ID,
          assigned_to: userId,
          status: { in: ['open', 'in_progress', 'waiting'] },
        },
      }),
    ]);

    const tenantNames = tenantIds.length > 0
      ? await prisma.tenants.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];

    res.json({
      success: true,
      data: {
        assigned_ticket_count: assignedTickets,
        pending_task_count: pendingTasks,
        unread_alert_count: unreadAlerts,
        platform_ticket_count: platformTickets,
        recent_activities: recentActivities,
        tenants: tenantNames,
      },
    });
  } catch (error) {
    console.error('[CRM Personal] Error fetching dashboard:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch personal CRM dashboard' });
  }
});

// ====================
// Tickets (cross-tenant, assigned to user)
// ====================

// GET /api/personal/crm/tickets
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });

    const tickets = await ticketService.listGlobal({
      assignedTo: userId,
      status: req.query.status as string,
      priority: req.query.priority as string,
    });

    // Enrich with tenant names
    const tenantIds = [...new Set(tickets.map((t: any) => t.tenant_id))];
    const tenants = tenantIds.length > 0
      ? await prisma.tenants.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const tenantMap = new Map(tenants.map((t: any) => [t.id, t.name]));

    const enriched = tickets.map((t: any) => ({
      ...t,
      tenant_name: tenantMap.get(t.tenant_id) || t.tenant_id,
      is_platform_ticket: t.tenant_id === PLATFORM_TENANT_ID,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CRM Personal] Error listing tickets:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tickets' });
  }
});

// POST /api/personal/crm/tickets — create platform support ticket
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const actorName = getUserDisplayName(req);

    const ticket = await ticketService.create({
      tenant_id: PLATFORM_TENANT_ID,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || 'general',
      priority: req.body.priority || 'medium',
      assigned_to: userId,
    });

    await audit({ tenantId: PLATFORM_TENANT_ID, actor: userId, action: 'create', payload: { entity_type: 'crm_ticket', id: ticket.id, ...req.body } });

    // Auto-log ticket creation as activity
    await activityService.create({
      tenant_id: PLATFORM_TENANT_ID,
      ticket_id: ticket.id,
      actor_id: userId,
      actor_type: 'platform',
      actor_name: actorName,
      activity_type: 'status_change',
      content: `Platform ticket created: ${req.body.title}`,
      is_internal: false,
    });

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('[CRM Personal] Error creating platform ticket:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create platform ticket' });
  }
});

// GET /api/personal/crm/tickets/:ticketId/messages
router.get('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });

    const ticket = await ticketService.getById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'not_found', message: 'Ticket not found' });

    // User can only see their own tickets (assigned or platform tickets they created)
    if (ticket.assigned_to !== userId && ticket.tenant_id !== PLATFORM_TENANT_ID) {
      // Also allow if ticket is from one of their tenants
      const tenantIds = getTenantIds(req);
      if (!tenantIds.includes(ticket.tenant_id)) {
        return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this ticket' });
      }
    }

    // Show internal notes only for platform/tenant tickets, not customer tickets
    const messages = await messageService.listByTicket(req.params.ticketId, true);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CRM Personal] Error listing ticket messages:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list messages' });
  }
});

// POST /api/personal/crm/tickets/:ticketId/messages
router.post('/tickets/:ticketId/messages', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const actorName = getUserDisplayName(req);

    const ticket = await ticketService.getById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'not_found', message: 'Ticket not found' });

    if (ticket.assigned_to !== userId && ticket.tenant_id !== PLATFORM_TENANT_ID) {
      const tenantIds = getTenantIds(req);
      if (!tenantIds.includes(ticket.tenant_id)) {
        return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this ticket' });
      }
    }

    if (ticket.status === 'closed') {
      return res.status(403).json({ error: 'ticket_closed', message: 'Ticket is closed' });
    }

    const message = await messageService.create({
      ticket_id: req.params.ticketId,
      author_id: userId,
      author_type: 'platform',
      author_name: actorName,
      content: req.body.content,
      is_internal: req.body.is_internal || false,
    });

    res.json({ success: true, data: message });
  } catch (error) {
    console.error('[CRM Personal] Error creating ticket message:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create message' });
  }
});

// ====================
// Tasks (cross-tenant, assigned to user)
// ====================

// GET /api/personal/crm/tasks
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });

    const tasks = await taskService.listGlobal({
      assignedTo: userId,
      status: req.query.status as string,
    });

    // Enrich with tenant names
    const tenantIds = [...new Set(tasks.map((t: any) => t.tenant_id))];
    const tenants = tenantIds.length > 0
      ? await prisma.tenants.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const tenantMap = new Map(tenants.map((t: any) => [t.id, t.name]));

    const enriched = tasks.map((t: any) => ({
      ...t,
      tenant_name: tenantMap.get(t.tenant_id) || t.tenant_id,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CRM Personal] Error listing tasks:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list tasks' });
  }
});

// ====================
// Alerts (cross-tenant, from user's tenants)
// ====================

// GET /api/personal/crm/alerts
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const tenantIds = getTenantIds(req);
    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    const where: any = {
      tenant_id: { in: tenantIds },
      is_dismissed: false,
    };
    if (req.query.type) where.type = req.query.type;
    if (req.query.unreadOnly === 'true') where.is_read = false;

    const alerts = await prisma.crm_alerts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // Enrich with tenant names
    const alertTenantIds = [...new Set(alerts.map((a: any) => a.tenant_id))];
    const tenants = alertTenantIds.length > 0
      ? await prisma.tenants.findMany({
          where: { id: { in: alertTenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const tenantMap = new Map(tenants.map((t: any) => [t.id, t.name]));

    const enriched = alerts.map((a: any) => ({
      ...a,
      tenant_name: tenantMap.get(a.tenant_id) || a.tenant_id,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CRM Personal] Error listing alerts:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list alerts' });
  }
});

// PUT /api/personal/crm/alerts/:alertId/read
router.put('/alerts/:alertId/read', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const tenantIds = getTenantIds(req);

    const alert = await alertService.getById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'not_found', message: 'Alert not found' });
    if (!tenantIds.includes(alert.tenant_id)) {
      return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
    }

    await alertService.markRead(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Personal] Error marking alert read:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark alert as read' });
  }
});

// PUT /api/personal/crm/alerts/read-all
router.put('/alerts/read-all', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const tenantIds = getTenantIds(req);
    if (tenantIds.length === 0) return res.json({ success: true });

    await prisma.crm_alerts.updateMany({
      where: {
        tenant_id: { in: tenantIds },
        is_read: false,
        is_dismissed: false,
      },
      data: { is_read: true, read_at: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Personal] Error marking all alerts read:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to mark all alerts as read' });
  }
});

// PUT /api/personal/crm/alerts/:alertId/dismiss
router.put('/alerts/:alertId/dismiss', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const tenantIds = getTenantIds(req);

    const alert = await alertService.getById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: 'not_found', message: 'Alert not found' });
    if (!tenantIds.includes(alert.tenant_id)) {
      return res.status(403).json({ error: 'access_denied', message: 'You do not have access to this alert' });
    }

    await alertService.dismiss(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM Personal] Error dismissing alert:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to dismiss alert' });
  }
});

// ====================
// Activities (cross-tenant, from user's tenants)
// ====================

// GET /api/personal/crm/activities
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'authentication_required' });
    const tenantIds = getTenantIds(req);
    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    const activities = await prisma.crm_activities.findMany({
      where: {
        tenant_id: { in: tenantIds },
        is_internal: false,
      },
      orderBy: { created_at: 'desc' },
      take: req.query.limit ? parseInt(req.query.limit as string) : 30,
    });

    // Enrich with tenant names
    const actTenantIds = [...new Set(activities.map((a: any) => a.tenant_id))];
    const tenants = actTenantIds.length > 0
      ? await prisma.tenants.findMany({
          where: { id: { in: actTenantIds } },
          select: { id: true, name: true },
        })
      : [];
    const tenantMap = new Map(tenants.map((t: any) => [t.id, t.name]));

    const enriched = activities.map((a: any) => ({
      ...a,
      tenant_name: tenantMap.get(a.tenant_id) || a.tenant_id,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CRM Personal] Error listing activities:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list activities' });
  }
});

export default router;
