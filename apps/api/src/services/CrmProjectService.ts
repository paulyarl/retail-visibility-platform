/**
 * CrmProjectService — CRUD + stats for crm_projects
 * Internal cross-functional projects that group CRM tasks/tickets
 * without requiring a fake tenant.
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmProjectId } from '../lib/id-generator';

export class CrmProjectService extends BaseService {
  private static instance: CrmProjectService;

  private constructor() { super(); }

  static getInstance(): CrmProjectService {
    if (!CrmProjectService.instance) {
      CrmProjectService.instance = new CrmProjectService();
    }
    return CrmProjectService.instance;
  }

  async list(filters: { status?: string } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    return prisma.crm_projects.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async getById(projectId: string) {
    return prisma.crm_projects.findUnique({ where: { id: projectId } });
  }

  async create(data: {
    name: string;
    description?: string;
    created_by: string;
  }) {
    return prisma.crm_projects.create({
      data: { id: generateCrmProjectId(), ...data },
    });
  }

  async update(projectId: string, data: {
    name?: string;
    description?: string;
    status?: string;
  }) {
    const updateData: any = { ...data, updated_at: new Date() };
    if (data.status === 'completed' || data.status === 'archived') {
      const existing = await prisma.crm_projects.findUnique({ where: { id: projectId } });
      if (existing && !existing.closed_at) {
        updateData.closed_at = new Date();
      }
    }
    return prisma.crm_projects.update({
      where: { id: projectId },
      data: updateData,
    });
  }

  async delete(projectId: string) {
    return prisma.crm_projects.delete({ where: { id: projectId } });
  }

  async getStats(projectId: string) {
    const [totalTasks, pendingTasks, inProgressTasks, completedTasks, totalTickets, openTickets] = await Promise.all([
      prisma.crm_tasks.count({ where: { project_id: projectId } }),
      prisma.crm_tasks.count({ where: { project_id: projectId, status: 'pending' } }),
      prisma.crm_tasks.count({ where: { project_id: projectId, status: 'in_progress' } }),
      prisma.crm_tasks.count({ where: { project_id: projectId, status: 'completed' } }),
      prisma.crm_support_tickets.count({ where: { project_id: projectId } }),
      prisma.crm_support_tickets.count({ where: { project_id: projectId, status: { in: ['open', 'in_progress', 'waiting'] } } }),
    ]);

    return {
      total_tasks: totalTasks,
      pending_tasks: pendingTasks,
      in_progress_tasks: inProgressTasks,
      completed_tasks: completedTasks,
      total_tickets: totalTickets,
      open_tickets: openTickets,
    };
  }
}

export default CrmProjectService;
