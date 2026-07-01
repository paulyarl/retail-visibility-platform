/**
 * Demo Tenant Service
 *
 * Creates and manages demo tenants with pre-populated data, restricted
 * capabilities, and configurable expiration. Used for sales demos and
 * prospective customer evaluation.
 *
 * Templates:
 *   - grocery: Grocery store with 20 realistic products
 *   - convenience: Convenience store with 15 products
 *   - specialty_retail: Specialty retail with 18 products
 */

import { prisma } from '../prisma';
import { generateTenantId, generateUserTenantId } from '../lib/id-generator';
import { generateQuickStartProducts, QuickStartScenario } from '../lib/quick-start';
import slugSingletonService from './SlugSingletonService';
import { logger } from '../logger';

export type DemoTemplate = 'grocery' | 'convenience' | 'specialty_retail';

interface DemoTemplateConfig {
  scenario: QuickStartScenario;
  productCount: number;
  businessName: string;
  storefrontType: 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';
  subscriptionTier: string;
  gbpPrimaryCategory: string;
  defaultHours: Array<{ day: string; open: string; close: string }>;
}

const DEMO_TEMPLATES: Record<DemoTemplate, DemoTemplateConfig> = {
  grocery: {
    scenario: 'grocery',
    productCount: 20,
    businessName: 'Demo Grocery Store',
    storefrontType: 'retail',
    subscriptionTier: 'professional',
    gbpPrimaryCategory: 'grocery_store',
    defaultHours: [
      { day: 'MONDAY', open: '08:00', close: '21:00' },
      { day: 'TUESDAY', open: '08:00', close: '21:00' },
      { day: 'WEDNESDAY', open: '08:00', close: '21:00' },
      { day: 'THURSDAY', open: '08:00', close: '21:00' },
      { day: 'FRIDAY', open: '08:00', close: '22:00' },
      { day: 'SATURDAY', open: '08:00', close: '22:00' },
      { day: 'SUNDAY', open: '09:00', close: '20:00' },
    ],
  },
  convenience: {
    scenario: 'grocery',
    productCount: 15,
    businessName: 'Demo Convenience Store',
    storefrontType: 'retail',
    subscriptionTier: 'starter',
    gbpPrimaryCategory: 'convenience_store',
    defaultHours: [
      { day: 'MONDAY', open: '06:00', close: '23:00' },
      { day: 'TUESDAY', open: '06:00', close: '23:00' },
      { day: 'WEDNESDAY', open: '06:00', close: '23:00' },
      { day: 'THURSDAY', open: '06:00', close: '23:00' },
      { day: 'FRIDAY', open: '06:00', close: '00:00' },
      { day: 'SATURDAY', open: '06:00', close: '00:00' },
      { day: 'SUNDAY', open: '07:00', close: '23:00' },
    ],
  },
  specialty_retail: {
    scenario: 'general',
    productCount: 18,
    businessName: 'Demo Specialty Retail',
    storefrontType: 'retail',
    subscriptionTier: 'professional',
    gbpPrimaryCategory: 'store',
    defaultHours: [
      { day: 'MONDAY', open: '10:00', close: '18:00' },
      { day: 'TUESDAY', open: '10:00', close: '18:00' },
      { day: 'WEDNESDAY', open: '10:00', close: '18:00' },
      { day: 'THURSDAY', open: '10:00', close: '19:00' },
      { day: 'FRIDAY', open: '10:00', close: '19:00' },
      { day: 'SATURDAY', open: '10:00', close: '18:00' },
      { day: 'SUNDAY', open: '12:00', close: '17:00' },
    ],
  },
};

const DEFAULT_EXPIRY_DAYS = 30;

export interface CreateDemoTenantOptions {
  template: DemoTemplate;
  businessName?: string;
  createdBy?: string;
  expiresAt?: Date;
  sourceTenantId?: string;
  subdomain?: string;
}

export interface DemoTenantResult {
  tenantId: string;
  name: string;
  slug: string;
  subdomain: string | null;
  template: DemoTemplate;
  productsCreated: number;
  categoriesCreated: number;
  expiresAt: Date;
}

class DemoTenantService {
  private static instance: DemoTenantService;

  private constructor() {}

  static getInstance(): DemoTenantService {
    if (!DemoTenantService.instance) {
      DemoTenantService.instance = new DemoTenantService();
    }
    return DemoTenantService.instance;
  }

  getAvailableTemplates(): Array<{ key: DemoTemplate; name: string; productCount: number }> {
    return (Object.keys(DEMO_TEMPLATES) as DemoTemplate[]).map(key => ({
      key,
      name: DEMO_TEMPLATES[key].businessName.replace('Demo ', ''),
      productCount: DEMO_TEMPLATES[key].productCount,
    }));
  }

  async createDemoTenant(options: CreateDemoTenantOptions): Promise<DemoTenantResult> {
    const {
      template,
      businessName,
      createdBy,
      sourceTenantId,
      subdomain,
    } = options;

    const config = DEMO_TEMPLATES[template];
    if (!config) {
      throw new Error(`Unknown demo template: ${template}`);
    }

    const name = businessName || config.businessName;
    const tenantId = generateTenantId();
    const expiresAt = options.expiresAt || new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    logger.info(`[DemoTenantService] Creating demo tenant: ${name} (${template})`, undefined, { tenantId, template });

    const slug = await slugSingletonService.generateSlug(name, {}, tenantId);

    const tenant = await prisma.tenants.create({
      data: {
        id: tenantId,
        name,
        slug,
        subdomain: subdomain || null,
        created_by: createdBy || null,
        subscription_tier: config.subscriptionTier,
        subscription_status: 'active',
        location_status: 'active',
        is_demo: true,
        demo_expires_at: expiresAt,
        demo_source_tenant_id: sourceTenantId || null,
        demo_template: template,
        gbp_primary_category_id: config.gbpPrimaryCategory,
      },
    });

    if (createdBy) {
      await prisma.user_tenants.create({
        data: {
          id: generateUserTenantId(createdBy, tenantId),
          user_id: createdBy,
          tenant_id: tenantId,
          role: 'OWNER',
          updated_at: new Date(),
        },
      }).catch(err => {
        logger.warn(`[DemoTenantService] Failed to link owner ${createdBy} to demo tenant ${tenantId}`, undefined, { error: err });
      });
    }

    await this.seedBusinessHours(tenantId, config.defaultHours);

    const seedResult = await this.seedDemoProducts(tenantId, template);

    logger.info(`[DemoTenantService] Demo tenant created: ${tenantId}`, undefined, {
      tenantId,
      productsCreated: seedResult.productsCreated,
      categoriesCreated: seedResult.categoriesCreated,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      tenantId,
      name: tenant.name,
      slug,
      subdomain: tenant.subdomain,
      template,
      productsCreated: seedResult.productsCreated,
      categoriesCreated: seedResult.categoriesCreated,
      expiresAt,
    };
  }

  async seedDemoProducts(tenantId: string, template: DemoTemplate): Promise<{ productsCreated: number; categoriesCreated: number }> {
    const config = DEMO_TEMPLATES[template];
    if (!config) {
      throw new Error(`Unknown demo template: ${template}`);
    }

    logger.info(`[DemoTenantService] Seeding ${config.productCount} products for tenant ${tenantId} (${template})`);

    const result = await generateQuickStartProducts({
      tenant_id: tenantId,
      scenario: config.scenario,
      productCount: config.productCount,
      assignCategories: true,
      createAsDrafts: false,
      generateImages: false,
      storefrontType: config.storefrontType,
    } as any, prisma);

    return {
      productsCreated: result.productsCreated,
      categoriesCreated: result.categoriesCreated,
    };
  }

  private async seedBusinessHours(
    tenantId: string,
    hours: Array<{ day: string; open: string; close: string }>
  ): Promise<void> {
    try {
      await prisma.business_hours_list.create({
        data: {
          id: `${tenantId}_hours`,
          tenant_id: tenantId,
          periods: hours as any,
          timezone: 'America/New_York',
          updated_at: new Date(),
        },
      });
      logger.info(`[DemoTenantService] Seeded business hours for tenant ${tenantId}`);
    } catch (err) {
      logger.warn(`[DemoTenantService] Failed to seed business hours for tenant ${tenantId}`, undefined, { error: err });
    }
  }

  async expireDemoTenant(tenantId: string): Promise<{ expired: boolean; reason: string }> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, is_demo: true, demo_expires_at: true, name: true },
    });

    if (!tenant) {
      return { expired: false, reason: 'Tenant not found' };
    }

    if (!tenant.is_demo) {
      return { expired: false, reason: 'Tenant is not a demo tenant' };
    }

    logger.info(`[DemoTenantService] Expiring demo tenant: ${tenantId} (${tenant.name})`);

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        location_status: 'closed' as any,
        status_changed_at: new Date(),
        status_changed_by: 'demo_expiry_job',
        closure_reason: 'Demo tenant expired',
        directory_visible: false,
        subscription_status: 'cancelled',
      },
    });

    return { expired: true, reason: 'Demo tenant expired successfully' };
  }

  async listDemoTenants(options: { includeExpired?: boolean; limit?: number; offset?: number } = {}): Promise<{
    tenants: Array<{
      id: string;
      name: string;
      demo_template: string | null;
      demo_expires_at: Date | null;
      is_demo: boolean | null;
      subdomain: string | null;
      slug: string | null;
      subscription_status: string | null;
      location_status: string;
      created_at: Date;
    }>;
    total: number;
  }> {
    const { includeExpired = false, limit = 50, offset = 0 } = options;

    const where: any = { is_demo: true };
    if (!includeExpired) {
      where.location_status = 'active';
    }

    const [tenants, total] = await Promise.all([
      prisma.tenants.findMany({
        where,
        select: {
          id: true,
          name: true,
          demo_template: true,
          demo_expires_at: true,
          is_demo: true,
          subdomain: true,
          slug: true,
          subscription_status: true,
          location_status: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.tenants.count({ where }),
    ]);

    return { tenants, total };
  }

  async getDemoTenant(tenantId: string): Promise<any | null> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        is_demo: true,
        demo_expires_at: true,
        demo_source_tenant_id: true,
        demo_template: true,
        subdomain: true,
        slug: true,
        subscription_tier: true,
        subscription_status: true,
        location_status: true,
        created_at: true,
        gbp_primary_category_id: true,
        gbp_primary_category_name: true,
      },
    });

    if (!tenant || !tenant.is_demo) return null;

    const productCount = await prisma.inventory_items.count({
      where: { tenant_id: tenantId, item_status: 'active' as any },
    });

    return { ...tenant, productCount };
  }

  async deleteDemoTenant(tenantId: string): Promise<{ deleted: boolean; productsDeleted: number }> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, is_demo: true },
    });

    if (!tenant || !tenant.is_demo) {
      return { deleted: false, productsDeleted: 0 };
    }

    const productCount = await prisma.inventory_items.count({
      where: { tenant_id: tenantId },
    });

    await prisma.inventory_items.deleteMany({
      where: { tenant_id: tenantId },
    });

    await prisma.business_hours_list.deleteMany({
      where: { tenant_id: tenantId },
    }).catch(() => {});

    await prisma.business_hours_special_list.deleteMany({
      where: { tenant_id: tenantId },
    }).catch(() => {});

    await prisma.user_tenants.deleteMany({
      where: { tenant_id: tenantId },
    }).catch(() => {});

    await prisma.tenants.delete({
      where: { id: tenantId },
    });

    logger.info(`[DemoTenantService] Deleted demo tenant: ${tenantId} (${productCount} products removed)`);

    return { deleted: true, productsDeleted: productCount };
  }

  async convertToDemoTenant(tenantId: string, options: {
    template?: DemoTemplate;
    expiresAt?: Date;
    sourceTenantId?: string;
  }): Promise<{ converted: boolean; tenantId: string; reason: string }> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, is_demo: true, location_status: true },
    });

    if (!tenant) {
      return { converted: false, tenantId, reason: 'Tenant not found' };
    }

    if (tenant.is_demo) {
      return { converted: false, tenantId, reason: 'Tenant is already a demo tenant' };
    }

    const expiresAt = options.expiresAt || new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        is_demo: true,
        demo_expires_at: expiresAt,
        demo_template: options.template || null,
        demo_source_tenant_id: options.sourceTenantId || null,
      },
    });

    logger.info(`[DemoTenantService] Converted tenant ${tenantId} (${tenant.name}) to demo`, undefined, {
      tenantId,
      expiresAt: expiresAt.toISOString(),
      template: options.template || null,
    });

    return { converted: true, tenantId, reason: 'Tenant converted to demo successfully' };
  }

  async revokeDemoStatus(tenantId: string): Promise<{ revoked: boolean; tenantId: string; reason: string }> {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, is_demo: true },
    });

    if (!tenant) {
      return { revoked: false, tenantId, reason: 'Tenant not found' };
    }

    if (!tenant.is_demo) {
      return { revoked: false, tenantId, reason: 'Tenant is not a demo tenant' };
    }

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        is_demo: false,
        demo_expires_at: null,
        demo_source_tenant_id: null,
        demo_template: null,
      },
    });

    logger.info(`[DemoTenantService] Revoked demo status from tenant ${tenantId} (${tenant.name})`);

    return { revoked: true, tenantId, reason: 'Demo status revoked successfully' };
  }

  async findExpiredDemoTenants(): Promise<Array<{ id: string; name: string; demo_expires_at: Date | null }>> {
    return prisma.tenants.findMany({
      where: {
        is_demo: true,
        demo_expires_at: { lte: new Date() },
        location_status: 'active' as any,
      },
      select: {
        id: true,
        name: true,
        demo_expires_at: true,
      },
    });
  }
}

export default DemoTenantService.getInstance();
