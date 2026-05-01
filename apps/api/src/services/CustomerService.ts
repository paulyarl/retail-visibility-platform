/**
 * Customer Service
 * 
 * Handles platform-wide customer management:
 * - Customer creation and profile management
 * - Customer-tenant relationship management
 * - Customer analytics and segmentation
 * - Customer data migration from orders
 */

import { prisma } from '../prisma';

export interface Customer {
  id: string;
  customerNumber: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  preferredLanguage: string;
  timezone: string;
  marketingConsent: boolean;
  smsConsent: boolean;
  emailConsent: boolean;
  platformOrders: number;
  platformValueCents: number;
  firstPlatformOrderAt?: Date;
  lastPlatformOrderAt?: Date;
  tags: string[];
  preferences: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerTenantRelationship {
  id: string;
  customerId: string;
  tenantId: string;
  customerSegment: 'regular' | 'vip' | 'new' | 'at_risk' | 'inactive';
  loyaltyPoints: number;
  tenantOrders: number;
  tenantValueCents: number;
  firstTenantOrderAt?: Date;
  lastTenantOrderAt?: Date;
  tenantTags: string[];
  tenantPreferences: any;
  internalNotes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerWithRelationships extends Customer {
  tenantRelationships: CustomerTenantRelationship[];
}

export class CustomerService {
  private static instance: CustomerService;

  static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Create or find a customer by email
   */
  async createOrFindCustomer(email: string, customerData?: Partial<Customer>): Promise<Customer> {
    // Try to find existing customer
    let customer = await prisma.customers.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!customer) {
      // Generate customer number
      const customerNumber = await this.generateCustomerNumber();

      // Create new customer
      customer = await prisma.customers.create({
        data: {
          id: `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          customer_number: customerNumber,
          email: email.toLowerCase(),
          first_name: customerData?.firstName,
          last_name: customerData?.lastName,
          phone: customerData?.phone || undefined,
          date_of_birth: customerData?.dateOfBirth,
          gender: customerData?.gender,
          preferred_language: customerData?.preferredLanguage || 'en',
          timezone: customerData?.timezone || 'UTC',
          marketing_consent: customerData?.marketingConsent || false,
          sms_consent: customerData?.smsConsent || false,
          email_consent: customerData?.emailConsent || true,
          tags: customerData?.tags || [],
          preferences: customerData?.preferences || {},
          metadata: customerData?.metadata || {},
        },
      });
    }

    return this.formatCustomer(customer);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<Customer | null> {
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });

    return customer ? this.formatCustomer(customer) : null;
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string): Promise<Customer | null> {
    const customer = await prisma.customers.findUnique({
      where: { email: email.toLowerCase() },
    });

    return customer ? this.formatCustomer(customer) : null;
  }

  /**
   * Get customer with tenant relationships
   */
  async getCustomerWithRelationships(customerId: string): Promise<CustomerWithRelationships | null> {
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      include: {
        customer_tenant_relationships: true,
      },
    });

    if (!customer) {
      return null;
    }

    return {
      ...this.formatCustomer(customer),
      tenantRelationships: customer.customer_tenant_relationships.map(rel => this.formatCustomerTenantRelationship(rel)),
    };
  }

  /**
   * Update customer profile
   */
  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const customer = await prisma.customers.update({
      where: { id: customerId },
      data: {
        first_name: updates.firstName,
        last_name: updates.lastName,
        phone: updates.phone,
        date_of_birth: updates.dateOfBirth,
        gender: updates.gender,
        preferred_language: updates.preferredLanguage,
        timezone: updates.timezone,
        marketing_consent: updates.marketingConsent,
        sms_consent: updates.smsConsent,
        email_consent: updates.emailConsent,
        tags: updates.tags,
        preferences: updates.preferences,
        metadata: updates.metadata,
      },
    });

    return this.formatCustomer(customer);
  }

  /**
   * Get or create customer-tenant relationship
   */
  async getOrCreateCustomerTenantRelationship(
    customerId: string,
    tenantId: string
  ): Promise<CustomerTenantRelationship> {
    let relationship = await prisma.customer_tenant_relationships.findUnique({
      where: {
        customer_id_tenant_id: {
          customer_id: customerId,
          tenant_id: tenantId,
        },
      },
    });

    if (!relationship) {
      relationship = await prisma.customer_tenant_relationships.create({
        data: {
          id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          customer_id: customerId,
          tenant_id: tenantId,
        },
      });
    }

    return this.formatCustomerTenantRelationship(relationship);
  }

  /**
   * Update customer-tenant relationship
   */
  async updateCustomerTenantRelationship(
    customerId: string,
    tenantId: string,
    updates: Partial<CustomerTenantRelationship>
  ): Promise<CustomerTenantRelationship> {
    const relationship = await prisma.customer_tenant_relationships.update({
      where: {
        customer_id_tenant_id: {
          customer_id: customerId,
          tenant_id: tenantId,
        },
      },
      data: {
        customer_segment: updates.customerSegment,
        loyalty_points: updates.loyaltyPoints,
        tenant_tags: updates.tenantTags,
        tenant_preferences: updates.tenantPreferences,
        internal_notes: updates.internalNotes,
        is_active: updates.isActive,
      },
    });

    return this.formatCustomerTenantRelationship(relationship);
  }

  /**
   * Update customer analytics from order
   */
  async updateCustomerFromOrder(orderId: string): Promise<void> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        customer_id: true,
        customer_email: true,
        customer_name: true,
        customer_phone: true,
        tenant_id: true,
        total_cents: true,
        created_at: true,
      },
    });

    if (!order || !order.customer_email) {
      return;
    }

    // Create or find customer
    const customer = await this.createOrFindCustomer(order.customer_email, {
      firstName: order.customer_name?.split(' ')[0],
      lastName: order.customer_name?.split(' ').slice(1).join(' '),
      phone: order.customer_phone || undefined,
    });

    // Update platform analytics
    await prisma.customers.update({
      where: { id: customer.id },
      data: {
        platform_orders: { increment: 1 },
        platform_value_cents: { increment: order.total_cents },
        first_platform_order_at: customer.platformOrders === 0 ? order.created_at : customer.firstPlatformOrderAt,
        last_platform_order_at: order.created_at,
      },
    });

    // Update tenant relationship
    const relationship = await this.getOrCreateCustomerTenantRelationship(customer.id, order.tenant_id);
    await prisma.customer_tenant_relationships.update({
      where: { id: relationship.id },
      data: {
        tenant_orders: { increment: 1 },
        tenant_value_cents: { increment: order.total_cents },
        first_tenant_order_at: relationship.tenantOrders === 0 ? order.created_at : relationship.firstTenantOrderAt,
        last_tenant_order_at: order.created_at,
      },
    });
  }

  /**
   * Get tenant customers
   */
  async getTenantCustomers(
    tenantId: string,
    options: {
      segment?: string;
      limit?: number;
      offset?: number;
      search?: string;
    } = {}
  ): Promise<{
    customers: (Customer & { relationship: CustomerTenantRelationship })[];
    total: number;
  }> {
    const { segment, limit = 50, offset = 0, search } = options;

    const whereClause: any = {
      tenant_id: tenantId,
      is_active: true,
    };

    if (segment) {
      whereClause.customer_segment = segment;
    }

    if (search) {
      whereClause.customer = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [relationships, total] = await Promise.all([
      prisma.customer_tenant_relationships.findMany({
        where: whereClause,
        include: {
          customers: true,
        },
        orderBy: { last_tenant_order_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.customer_tenant_relationships.count({ where: whereClause }),
    ]);

    const customers = relationships.map(rel => ({
      ...this.formatCustomer(rel.customers),
      relationship: this.formatCustomerTenantRelationship(rel),
    }));

    return { customers, total };
  }

  /**
   * Generate unique customer number
   */
  private async generateCustomerNumber(): Promise<string> {
    const prefix = 'CUST';
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Format customer from database record
   */
  private formatCustomer(customer: any): Customer {
    return {
      id: customer.id,
      customerNumber: customer.customer_number,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      dateOfBirth: customer.date_of_birth,
      gender: customer.gender,
      preferredLanguage: customer.preferred_language,
      timezone: customer.timezone,
      marketingConsent: customer.marketing_consent,
      smsConsent: customer.sms_consent,
      emailConsent: customer.email_consent,
      platformOrders: customer.platform_orders,
      platformValueCents: customer.platform_value_cents,
      firstPlatformOrderAt: customer.first_platform_order_at,
      lastPlatformOrderAt: customer.last_platform_order_at,
      tags: customer.tags || [],
      preferences: customer.preferences || {},
      metadata: customer.metadata || {},
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }

  /**
   * Format customer-tenant relationship from database record
   */
  private formatCustomerTenantRelationship(relationship: any): CustomerTenantRelationship {
    return {
      id: relationship.id,
      customerId: relationship.customer_id,
      tenantId: relationship.tenant_id,
      customerSegment: relationship.customer_segment,
      loyaltyPoints: relationship.loyalty_points,
      tenantOrders: relationship.tenant_orders,
      tenantValueCents: relationship.tenant_value_cents,
      firstTenantOrderAt: relationship.first_tenant_order_at,
      lastTenantOrderAt: relationship.last_tenant_order_at,
      tenantTags: relationship.tenant_tags || [],
      tenantPreferences: relationship.tenant_preferences || {},
      internalNotes: relationship.internal_notes,
      isActive: relationship.is_active,
      createdAt: relationship.created_at,
      updatedAt: relationship.updated_at,
    };
  }
}

export default CustomerService;
