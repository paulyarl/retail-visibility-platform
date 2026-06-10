/**
 * CrmTaskService — CRUD + status + assignment for crm_tasks
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmTaskId, generateCrmActivityId } from '../lib/id-generator';

export class CrmTaskService extends BaseService {
  private static instance: CrmTaskService;

  private constructor() { super(); }

  static getInstance(): CrmTaskService {
    if (!CrmTaskService.instance) {
      CrmTaskService.instance = new CrmTaskService();
    }
    return CrmTaskService.instance;
  }

  /**
   * List tasks for a specific tenant
   */
  async listByTenant(tenantId: string, filters: { status?: string } = {}) {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;
    return prisma.crm_tasks.findMany({ where, orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }] });
  }

  /**
   * Global task list (all tenants)
   */
  async listGlobal(filters: { assignedTo?: string; status?: string; tenantId?: string } = {}) {
    const where: any = {};
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    if (filters.status) where.status = filters.status;
    if (filters.tenantId) where.tenant_id = filters.tenantId;
    return prisma.crm_tasks.findMany({ where, orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }] });
  }

  async getById(taskId: string) {
    return prisma.crm_tasks.findUnique({ where: { id: taskId } });
  }

  async create(data: {
    tenant_id: string;
    contact_id?: string;
    title: string;
    description?: string;
    priority?: string;
    due_date?: Date;
    assigned_to?: string;
    created_by: string;
  }) {
    return prisma.crm_tasks.create({ data: { id: generateCrmTaskId(data.tenant_id), ...data } });
  }

  async update(taskId: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_date?: Date;
    assigned_to?: string;
    contact_id?: string;
  }, actorId: string, actorName: string, actorType: string = 'platform') {
    const task = await prisma.crm_tasks.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    const updateData: any = { ...data };

    // Track completion time
    if (data.status === 'completed' && task.status !== 'completed') {
      updateData.completed_at = new Date();
    }

    const updated = await prisma.crm_tasks.update({
      where: { id: taskId },
      data: updateData,
    });

    // Auto-log status change as activity
    if (data.status && data.status !== task.status) {
      await prisma.crm_activities.create({
        data: {
          id: generateCrmActivityId(task.tenant_id),
          tenant_id: task.tenant_id,
          task_id: taskId,
          actor_id: actorId,
          actor_type: actorType,
          actor_name: actorName,
          activity_type: 'task_created',
          content: `Task "${task.title}" status changed from ${task.status} to ${data.status}`,
          metadata: { from: task.status, to: data.status },
          is_internal: false,
        },
      });
    }

    return updated;
  }

  async delete(taskId: string) {
    return prisma.crm_tasks.delete({ where: { id: taskId } });
  }

  /**
   * Reorder tasks within a status column (Kanban drag-and-drop)
   * Accepts an array of { id, sort_order } pairs and batch-updates them
   */
  async reorder(items: { id: string; sort_order: number }[]) {
    const ops = items.map(item =>
      prisma.crm_tasks.update({
        where: { id: item.id },
        data: { sort_order: item.sort_order },
      })
    );
    return prisma.$transaction(ops);
  }
}

export default CrmTaskService;
