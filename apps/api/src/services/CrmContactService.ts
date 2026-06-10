/**
 * CrmContactService — CRUD for crm_contacts
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmContactId } from '../lib/id-generator';

export class CrmContactService extends BaseService {
  private static instance: CrmContactService;

  private constructor() { super(); }

  static getInstance(): CrmContactService {
    if (!CrmContactService.instance) {
      CrmContactService.instance = new CrmContactService();
    }
    return CrmContactService.instance;
  }

  async listByTenant(tenantId: string) {
    return prisma.crm_contacts.findMany({
      where: { tenant_id: tenantId },
      orderBy: { is_primary: 'desc' },
    });
  }

  async getById(contactId: string) {
    return prisma.crm_contacts.findUnique({ where: { id: contactId } });
  }

  async create(data: {
    tenant_id: string;
    first_name: string;
    last_name?: string;
    email: string;
    phone?: string;
    role?: string;
    is_primary?: boolean;
    notes?: string;
    customer_id?: string;
  }) {
    // If setting as primary, unset other primaries for this tenant
    if (data.is_primary) {
      await prisma.crm_contacts.updateMany({
        where: { tenant_id: data.tenant_id, is_primary: true },
        data: { is_primary: false },
      });
    }
    return prisma.crm_contacts.create({ data: { id: generateCrmContactId(data.tenant_id), ...data } });
  }

  async update(contactId: string, data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    role?: string;
    is_primary?: boolean;
    notes?: string;
    customer_id?: string;
  }) {
    // If setting as primary, unset other primaries for this tenant
    if (data.is_primary) {
      const contact = await prisma.crm_contacts.findUnique({ where: { id: contactId }, select: { tenant_id: true } });
      if (contact) {
        await prisma.crm_contacts.updateMany({
          where: { tenant_id: contact.tenant_id, is_primary: true },
          data: { is_primary: false },
        });
      }
    }
    return prisma.crm_contacts.update({ where: { id: contactId }, data });
  }

  async delete(contactId: string) {
    return prisma.crm_contacts.delete({ where: { id: contactId } });
  }
}

export default CrmContactService;
