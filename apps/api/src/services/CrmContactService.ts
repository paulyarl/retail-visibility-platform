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

  async getDetail(contactId: string) {
    return prisma.crm_contacts.findUnique({
      where: { id: contactId },
      include: {
        crm_support_tickets: { orderBy: { created_at: 'desc' } },
        crm_tasks: { orderBy: { created_at: 'desc' } },
        crm_inquiries: { orderBy: { created_at: 'desc' } },
        customers: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });
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

  /**
   * Sync contacts from orders — auto-creates crm_contacts for each
   * unique customer from orders. Customer-linked orders dedup by customer_id,
   * guest orders dedup by customer_email. Returns newly created count.
   */
  async syncFromOrders(tenantId: string): Promise<number> {
    // --- Phase 0: Reconcile guest orders to existing customers ---
    // Find guest orders (customer_id = null) whose email matches an existing customer
    const guestOrdersWithEmail = await prisma.orders.findMany({
      where: { tenant_id: tenantId, customer_id: null, customer_email: { not: '' } },
      select: { customer_email: true },
      distinct: ['customer_email'],
    });

    if (guestOrdersWithEmail.length > 0) {
      const emails = guestOrdersWithEmail.map(o => o.customer_email.toLowerCase());
      const matchingCustomers = await prisma.customers.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      });
      for (const customer of matchingCustomers) {
        const result = await prisma.orders.updateMany({
          where: {
            tenant_id: tenantId,
            customer_id: null,
            customer_email: customer.email,
          },
          data: { customer_id: customer.id, updated_at: new Date() },
        });
        if (result.count > 0) {
          console.log(`[CrmContactService] Reconciled ${result.count} guest orders to customer ${customer.id}`);
        }
      }
    }

    // Existing contacts: track both customer_id and email for dedup
    const existingContacts = await prisma.crm_contacts.findMany({
      where: { tenant_id: tenantId },
      select: { customer_id: true, email: true },
    });
    const existingCustomerIds = new Set(existingContacts.map(c => c.customer_id).filter(Boolean) as string[]);
    const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase()));

    // --- Phase 1: Customer-linked orders (dedup by customer_id) ---
    const customerIds = await prisma.orders.findMany({
      where: { tenant_id: tenantId, customer_id: { not: null } },
      select: { customer_id: true },
      distinct: ['customer_id'],
    });
    const newCustomerIds = customerIds.map(o => o.customer_id!).filter(id => !existingCustomerIds.has(id));

    let created = 0;

    if (newCustomerIds.length > 0) {
      // Batch-fetch customer records
      const customers = await prisma.customers.findMany({
        where: { id: { in: newCustomerIds } },
        select: { id: true, first_name: true, last_name: true, email: true, phone: true },
      });
      const customerMap = new Map(customers.map(c => [c.id, c]));

      for (const customerId of newCustomerIds) {
        const customer = customerMap.get(customerId);
        if (!customer) continue;

        // Skip if email already has a contact (avoid duplicate across customer_id/email)
        const email = customer.email?.trim().toLowerCase();
        if (email && existingEmails.has(email)) continue;

        try {
          await prisma.crm_contacts.create({
            data: {
              id: generateCrmContactId(tenantId),
              tenant_id: tenantId,
              first_name: customer.first_name || 'Unknown',
              last_name: customer.last_name || undefined,
              email: customer.email,
              phone: customer.phone || undefined,
              role: 'customer',
              customer_id: customerId,
              notes: 'Auto-synced from orders',
            },
          });
          existingCustomerIds.add(customerId);
          if (email) existingEmails.add(email);
          created++;
        } catch (err) {
          console.warn('[CrmContactService] syncFromOrders skip duplicate customer:', customerId, err);
        }
      }
    }

    // --- Phase 2: Guest orders without customer_id (dedup by email) ---
    const guestOrders = await prisma.orders.findMany({
      where: { tenant_id: tenantId, customer_id: null, customer_email: { not: '' } },
      select: { customer_email: true, customer_name: true, customer_phone: true },
      distinct: ['customer_email'],
      orderBy: { created_at: 'desc' },
    });

    for (const order of guestOrders) {
      const email = order.customer_email.trim().toLowerCase();
      if (!email || existingEmails.has(email)) continue;

      let firstName = 'Unknown';
      let lastName: string | undefined;
      if (order.customer_name) {
        const parts = order.customer_name.trim().split(/\s+/);
        firstName = parts[0] || 'Unknown';
        lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
      }

      try {
        await prisma.crm_contacts.create({
          data: {
            id: generateCrmContactId(tenantId),
            tenant_id: tenantId,
            first_name: firstName,
            last_name: lastName,
            email: order.customer_email.trim(),
            phone: order.customer_phone || undefined,
            role: 'customer',
            notes: 'Auto-synced from guest orders',
          },
        });
        existingEmails.add(email);
        created++;
      } catch (err) {
        console.warn('[CrmContactService] syncFromOrders skip duplicate email:', email, err);
      }
    }

    return created;
  }
}

export default CrmContactService;
