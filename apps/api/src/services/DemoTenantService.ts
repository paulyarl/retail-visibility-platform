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

/**
 * Sales-demo templates with a DEMO_TEMPLATES config. 'seed_preview' is a
 * demo_template value written on preview storefronts but is NOT a sales
 * template — it has no DEMO_TEMPLATES entry, so it never appears in the
 * sales-demo template picker and createDemoTenant('seed_preview') throws
 * "Unknown demo template" (spec §5f).
 */
export type SalesDemoTemplate = 'grocery' | 'convenience' | 'specialty_retail';
export type DemoTemplate = SalesDemoTemplate | 'seed_preview';

interface DemoTemplateConfig {
  scenario: QuickStartScenario;
  productCount: number;
  businessName: string;
  storefrontType: 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';
  subscriptionTier: string;
  gbpPrimaryCategory: string;
  defaultHours: Array<{ day: string; open: string; close: string }>;
  defaultCity: string;
  defaultState: string;
  defaultCountry: string;
  defaultPhone: string;
  defaultEmail: string;
  defaultWebsite: string;
  defaultDescription: string;
}

const DEMO_TEMPLATES: Record<SalesDemoTemplate, DemoTemplateConfig> = {
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
    defaultCity: 'New York',
    defaultState: 'New York',
    defaultCountry: 'US',
    defaultPhone: '+1-555-0100',
    defaultEmail: 'demo@demo-grocery.example.com',
    defaultWebsite: 'https://demo-grocery.example.com',
    defaultDescription: 'A demo grocery store showcasing the VisibleShelf platform with realistic product catalog.',
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
    defaultCity: 'New York',
    defaultState: 'New York',
    defaultCountry: 'US',
    defaultPhone: '+1-555-0200',
    defaultEmail: 'demo@demo-convenience.example.com',
    defaultWebsite: 'https://demo-convenience.example.com',
    defaultDescription: 'A demo convenience store showcasing the VisibleShelf platform with quick-commerce products.',
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
    defaultCity: 'New York',
    defaultState: 'New York',
    defaultCountry: 'US',
    defaultPhone: '+1-555-0300',
    defaultEmail: 'demo@demo-specialty.example.com',
    defaultWebsite: 'https://demo-specialty.example.com',
    defaultDescription: 'A demo specialty retail store showcasing the VisibleShelf platform with curated products.',
  },
};

const DEFAULT_EXPIRY_DAYS = 30;

// Seed-preview storefront lifecycle (docs/LocalBiz/SEED_PREVIEW_STOREFRONT_SPEC.md)
const SEED_PREVIEW_EXPIRY_DAYS = 14;
const SEED_PREVIEW_EXTENSION_DAYS = 7;
const SEED_PREVIEW_MAX_EXTENSIONS = 2;
const SEED_PREVIEW_HARD_CAP_DAYS = 28;
const SEED_PREVIEW_DEFAULT_PRODUCT_COUNT = 20;

export interface CreateFromSeedOptions {
  productCount?: number;
  expiresAt?: Date;
  scenario?: QuickStartScenario;
  createdBy?: string;
}

export type CreateFromSeedResult =
  | {
      ok: true;
      tenantId: string;
      name: string;
      slug: string;
      storefrontUrl: string;
      productsCreated: number;
      categoriesCreated: number;
      expiresAt: Date;
      existing: boolean;
    }
  | { ok: false; code: 'seed_not_found' | 'not_pb08_eligible'; reason: string };

export type ExtendSeedPreviewResult =
  | { ok: true; expiresAt: Date; extensionsUsed: number }
  | { ok: false; code: 'seed_not_found' | 'no_live_preview' | 'extension_cap_reached' | 'hard_cap_reached'; extensionsUsed: number; expiresAt: Date | null; reason: string };

/**
 * Map a seed's category label to a quick-start catalog scenario. Deliberately
 * fuzzy — the catalog is labeled sample data, so a near match beats a generic
 * one but nothing here claims real inventory (spec §5).
 */
export function mapSeedCategoryToScenario(category: string | null | undefined): QuickStartScenario {
  const c = (category || '').toLowerCase();
  const rules: Array<[RegExp, QuickStartScenario]> = [
    [/pharm|drug\s*store/, 'pharmacy'],
    [/grocer|supermarket|food\s*mart|\bmart\b|market|convenience|deli|bodega|produce|butcher|bakery/, 'grocery'],
    [/fashion|boutique|apparel|cloth|shoe|thrift|vintage/, 'fashion'],
    [/electron|phone|computer|appliance/, 'electronics'],
    [/hardware|tool|lumber|home\s*improvement/, 'hardware_tools'],
    [/furniture|mattress/, 'furniture'],
    [/pet|aquari/, 'pet_supplies'],
    [/book|media|record|music\s*store/, 'books_media'],
    [/sport|outdoor|fitness|bike|bicycle/, 'sports_outdoors'],
    [/toy|game/, 'toys_games'],
    [/auto|car\s*part|tire/, 'automotive'],
    [/jewel|watch/, 'jewelry'],
    [/baby|kid|children/, 'baby_kids'],
    [/art|craft|hobby/, 'arts_crafts'],
    [/office|stationer|suppl/, 'office_supplies'],
    [/beauty|salon|barber|cosmet|spa|nail/, 'health_beauty'],
    [/health|wellness|vitamin|supplement/, 'health_beauty'],
    [/garden|nurser|plant|florist|home\s*goods|home\s*decor/, 'home_garden'],
    [/restaurant|cafe|coffee|eater|diner|grill|pizza|taqueria/, 'restaurant'],
    [/service|repair|clean|laundr/, 'service_business'],
  ];
  for (const [re, scenario] of rules) {
    if (re.test(c)) return scenario;
  }
  return 'general';
}

export interface CreateDemoTenantOptions {
  template: SalesDemoTemplate;
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

  getAvailableTemplates(): Array<{ key: SalesDemoTemplate; name: string; productCount: number }> {
    return (Object.keys(DEMO_TEMPLATES) as SalesDemoTemplate[]).map(key => ({
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

    const location = {
      city: config.defaultCity,
      state: config.defaultState,
      country: config.defaultCountry,
    };

    const slug = await slugSingletonService.generateSlug(name, location, tenantId);

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

    await this.seedBusinessProfile(tenantId, name, config);

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

  async seedDemoProducts(tenantId: string, template: SalesDemoTemplate): Promise<{ productsCreated: number; categoriesCreated: number }> {
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

  private async seedBusinessProfile(
    tenantId: string,
    businessName: string,
    config: DemoTemplateConfig
  ): Promise<void> {
    try {
      await prisma.tenant_business_profiles_list.create({
        data: {
          tenant_id: tenantId,
          business_name: businessName,
          address_line1: '123 Demo Street',
          city: config.defaultCity,
          state: config.defaultState,
          postal_code: '10001',
          country_code: config.defaultCountry,
          phone_number: config.defaultPhone,
          email: config.defaultEmail,
          website: config.defaultWebsite,
          business_description: config.defaultDescription,
          updated_at: new Date(),
        },
      });
      logger.info(`[DemoTenantService] Seeded business profile for tenant ${tenantId}`);
    } catch (err) {
      logger.warn(`[DemoTenantService] Failed to seed business profile for tenant ${tenantId}`, undefined, { error: err });
    }
  }

  /**
   * Create a seed-preview storefront for an eligible Directory Presence seed
   * (docs/LocalBiz/SEED_PREVIEW_STOREFRONT_SPEC.md §3).
   *
   * Eligibility: at least one linked campaign carries a CONFIRMED PB-08
   * website_build_scope playbook_decision — assignment alone is not enough.
   * Idempotent: one live preview per seed; concurrent calls are serialized by
   * a per-seed advisory lock inside the creation transaction.
   */
  /**
   * §3 step 0 — the seed is preview-eligible when at least one linked campaign
   * (any link role) carries a CONFIRMED PB-08 website_build_scope decision.
   */
  private async isSeedPb08Eligible(seedId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 1
      FROM directory_seed_campaign_links l
      JOIN mkt_campaigns_list c ON c.id = l.campaign_id
      WHERE l.seed_id = ${seedId}
        AND c.playbook_code = 'PB-08'
        AND c.playbook_decision ->> 'kind' = 'website_build_scope'
      LIMIT 1
    `;
    return rows.length > 0;
  }

  /** Live preview state for the seed-page/campaign UI. */
  async getSeedPreviewStatus(seedId: string): Promise<{
    found: boolean;
    eligible: boolean;
    preview: {
      tenantId: string;
      slug: string;
      storefrontUrl: string;
      expiresAt: Date | null;
      createdAt: Date;
      extensionsUsed: number;
      pageViews: number;
    } | null;
  }> {
    const seed = await prisma.directory_presence_seeds.findUnique({
      where: { id: seedId },
      select: { tenant_id: true },
    });
    if (!seed) {
      return { found: false, eligible: false, preview: null };
    }

    const [eligible, preview] = await Promise.all([
      this.isSeedPb08Eligible(seedId),
      prisma.tenants.findFirst({
        where: {
          demo_source_tenant_id: seed.tenant_id,
          is_demo: true,
          demo_template: 'seed_preview',
          location_status: 'active',
        },
        select: { id: true, slug: true, demo_expires_at: true, created_at: true, metadata: true },
      }),
    ]);

    // B-3 — preview opens: page-view events are keyed by the preview tenant.
    let pageViews = 0;
    if (preview) {
      const rows = await prisma.$queryRaw<{ views: bigint }[]>`
        SELECT COUNT(*)::bigint AS views
        FROM directory_presence_events
        WHERE tenant_id = ${preview.id}
          AND event_type = 'listing_viewed'
      `;
      pageViews = Number(rows[0]?.views ?? 0);
    }

    return {
      found: true,
      eligible,
      preview: preview
        ? {
            tenantId: preview.id,
            slug: preview.slug || '',
            storefrontUrl: `/tenant/${preview.slug}`,
            expiresAt: preview.demo_expires_at,
            createdAt: preview.created_at,
            extensionsUsed: ((preview.metadata as any)?.seed_preview?.extensions_used ?? 0) as number,
            pageViews,
          }
        : null,
    };
  }

  async createFromSeed(seedId: string, options: CreateFromSeedOptions = {}): Promise<CreateFromSeedResult> {
    // Load the seed and its listing NAP in one join
    const seedRows = await prisma.$queryRaw<any[]>`
      SELECT s.id, s.tenant_id, s.category,
             dl.business_name, dl.address, dl.city, dl.state, dl.zip_code,
             dl.phone, dl.email, dl.website, dl.business_hours,
             dl.latitude, dl.longitude, dl.logo_url, dl.description
      FROM directory_presence_seeds s
      JOIN directory_listings_list dl ON dl.id = s.listing_id
      WHERE s.id = ${seedId}
      LIMIT 1
    `;
    const seed = seedRows[0];
    if (!seed) {
      return { ok: false, code: 'seed_not_found', reason: `Seed ${seedId} not found` };
    }

    if (!(await this.isSeedPb08Eligible(seedId))) {
      return {
        ok: false,
        code: 'not_pb08_eligible',
        reason: 'Seed has no linked campaign with a confirmed PB-08 website_build_scope decision',
      };
    }

    const name = seed.business_name || 'Sample Storefront';
    const scenario = options.scenario || mapSeedCategoryToScenario(seed.category);
    const productCount = options.productCount ?? SEED_PREVIEW_DEFAULT_PRODUCT_COUNT;
    const expiresAt = options.expiresAt || new Date(Date.now() + SEED_PREVIEW_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    logger.info(`[DemoTenantService] Creating seed-preview storefront for seed ${seedId} (${name})`, undefined, { seedId, scenario });

    const outcome = await prisma.$transaction(async (tx) => {
      // B-5: serialize concurrent generate calls for this seed
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seed_preview:' || ${seedId}))`;

      const existing = await tx.tenants.findFirst({
        where: {
          demo_source_tenant_id: seed.tenant_id,
          is_demo: true,
          demo_template: 'seed_preview',
          location_status: 'active',
        },
        select: { id: true, name: true, slug: true, demo_expires_at: true },
      });
      if (existing) {
        return { existing } as const;
      }

      const tenantId = generateTenantId();
      const location = { city: seed.city || '', state: seed.state || '', country: 'US' };
      const slug = await slugSingletonService.generateSlug(name, location, tenantId);

      await tx.tenants.create({
        data: {
          id: tenantId,
          name,
          slug,
          created_by: options.createdBy || null,
          subscription_tier: 'seed_preview',
          subscription_status: 'active',
          location_status: 'active',
          directory_visible: false,
          is_demo: true,
          demo_expires_at: expiresAt,
          demo_source_tenant_id: seed.tenant_id,
          demo_template: 'seed_preview',
          gbp_primary_category_name: seed.category || null,
          metadata: { seed_preview: { seed_id: seedId, extensions_used: 0 } } as any,
        },
      });

      // Business profile from the seed listing — only sourced fields (§3 step 2/5).
      // Hours land in profile.hours the same way the claim path copies them;
      // when unsourced they stay null and the page shows unconfirmed hours.
      await tx.tenant_business_profiles_list.create({
        data: {
          tenant_id: tenantId,
          business_name: name,
          address_line1: seed.address || '',
          city: seed.city || '',
          state: seed.state || null,
          postal_code: seed.zip_code || '',
          country_code: 'US',
          phone_number: seed.phone || null,
          email: seed.email || null,
          website: seed.website || null,
          logo_url: seed.logo_url || null,
          business_description: seed.description || null,
          hours: seed.business_hours ?? undefined,
          latitude: seed.latitude ?? null,
          longitude: seed.longitude ?? null,
          updated_at: new Date(),
        } as any,
      });

      const seedResult = await generateQuickStartProducts({
        tenant_id: tenantId,
        scenario,
        productCount,
        assignCategories: true,
        createAsDrafts: false,
        allActive: true,
        generateImages: false,
        storefrontType: 'retail',
      } as any, tx);

      // Label every generated product as a sample (§5) — the public page shows
      // a Sample badge and nothing ever claims real inventory.
      await tx.$executeRaw`
        UPDATE inventory_items
        SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"sample": true}'::jsonb
        WHERE tenant_id = ${tenantId}
      `;

      return { tenantId, slug, seedResult } as const;
    }, { timeout: 60000, maxWait: 15000 });

    if ('existing' in outcome) {
      const e = outcome.existing as NonNullable<typeof outcome.existing>;
      return {
        ok: true,
        tenantId: e.id,
        name: e.name,
        slug: e.slug || '',
        storefrontUrl: `/tenant/${e.slug}`,
        productsCreated: 0,
        categoriesCreated: 0,
        expiresAt: e.demo_expires_at || expiresAt,
        existing: true,
      };
    }

    // §3 step 7 — the storefront MV only refreshes on demand; without this the
    // preview URL renders an empty storefront. Post-commit (CONCURRENTLY can't
    // run inside the transaction above).
    try {
      const { refreshStorefrontDiscoveryMv } = await import('../lib/seed-preview');
      await refreshStorefrontDiscoveryMv();
    } catch (err: any) {
      logger.error('[DemoTenantService] mv_storefront_discovery refresh failed after preview create', undefined, {
        tenantId: outcome.tenantId,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
    }

    logger.info(`[DemoTenantService] Seed-preview storefront created: ${outcome.tenantId}`, undefined, {
      seedId,
      tenantId: outcome.tenantId,
      productsCreated: outcome.seedResult.productsCreated,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      ok: true,
      tenantId: outcome.tenantId,
      name,
      slug: outcome.slug,
      storefrontUrl: `/tenant/${outcome.slug}`,
      productsCreated: outcome.seedResult.productsCreated,
      categoriesCreated: outcome.seedResult.categoriesCreated,
      expiresAt,
      existing: false,
    };
  }

  /**
   * Extend a seed's live preview by +7 days, max 2 extensions, hard cap of
   * 28 days from preview creation (D-4).
   */
  async extendSeedPreview(seedId: string): Promise<ExtendSeedPreviewResult> {
    const seed = await prisma.directory_presence_seeds.findUnique({
      where: { id: seedId },
      select: { tenant_id: true },
    });
    if (!seed) {
      return { ok: false, code: 'seed_not_found', extensionsUsed: 0, expiresAt: null, reason: `Seed ${seedId} not found` };
    }

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seed_preview_extend:' || ${seedId}))`;

      const preview = await tx.tenants.findFirst({
        where: {
          demo_source_tenant_id: seed.tenant_id,
          is_demo: true,
          demo_template: 'seed_preview',
          location_status: 'active',
        },
        select: { id: true, demo_expires_at: true, created_at: true, metadata: true },
      });
      if (!preview) {
        return { ok: false, code: 'no_live_preview', extensionsUsed: 0, expiresAt: null, reason: 'No live preview for this seed' } as const;
      }

      const meta = ((preview.metadata as any)?.seed_preview ?? {}) as Record<string, any>;
      const used = meta.extensions_used || 0;
      if (used >= SEED_PREVIEW_MAX_EXTENSIONS) {
        return { ok: false, code: 'extension_cap_reached', extensionsUsed: used, expiresAt: preview.demo_expires_at, reason: `Extension cap reached (${SEED_PREVIEW_MAX_EXTENSIONS})` } as const;
      }

      const hardCap = new Date(preview.created_at.getTime() + SEED_PREVIEW_HARD_CAP_DAYS * 24 * 60 * 60 * 1000);
      const candidate = new Date((preview.demo_expires_at?.getTime() ?? Date.now()) + SEED_PREVIEW_EXTENSION_DAYS * 24 * 60 * 60 * 1000);
      const newExpiry = candidate > hardCap ? hardCap : candidate;
      if (newExpiry <= (preview.demo_expires_at ?? new Date(0))) {
        return { ok: false, code: 'hard_cap_reached', extensionsUsed: used, expiresAt: preview.demo_expires_at, reason: 'Preview already at the 28-day hard cap' } as const;
      }

      await tx.tenants.update({
        where: { id: preview.id },
        data: {
          demo_expires_at: newExpiry,
          metadata: {
            ...(preview.metadata as any ?? {}),
            seed_preview: { ...meta, extensions_used: used + 1 },
          } as any,
        },
      });

      logger.info(`[DemoTenantService] Extended seed preview for ${seed.tenant_id} to ${newExpiry.toISOString()} (${used + 1}/${SEED_PREVIEW_MAX_EXTENSIONS})`);

      return { ok: true, expiresAt: newExpiry, extensionsUsed: used + 1 } as const;
    });
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

    // Close the tenant and archive its catalog in one transaction — sample
    // products are kept for audit (never deleted per spec §5e) but must stop
    // surfacing once the demo ends.
    const [, archived] = await prisma.$transaction([
      prisma.tenants.update({
        where: { id: tenantId },
        data: {
          location_status: 'closed' as any,
          status_changed_at: new Date(),
          status_changed_by: 'demo_expiry_job',
          closure_reason: 'Demo tenant expired',
          directory_visible: false,
          subscription_status: 'cancelled',
        },
      }),
      prisma.inventory_items.updateMany({
        where: {
          tenant_id: tenantId,
          item_status: { in: ['active', 'inactive'] },
        },
        data: { item_status: 'archived' },
      }),
    ]);

    // The storefront MV only refreshes on demand, and CONCURRENTLY cannot run
    // inside a transaction — refresh now that the writes have committed, or
    // archived products/closed tenant linger on the public storefront (B-1).
    try {
      const { refreshStorefrontDiscoveryMv } = await import('../lib/seed-preview');
      await refreshStorefrontDiscoveryMv();
    } catch (err: any) {
      logger.error('[DemoTenantService] mv_storefront_discovery refresh failed after demo expiry', undefined, {
        tenantId,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
    }

    logger.info(`[DemoTenantService] Demo tenant ${tenantId} expired; ${archived.count} product(s) archived`);

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

    try {
      const { refreshStorefrontDiscoveryMv } = await import('../lib/seed-preview');
      await refreshStorefrontDiscoveryMv();
    } catch (err: any) {
      logger.error('[DemoTenantService] mv_storefront_discovery refresh failed after demo delete', undefined, {
        tenantId,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
    }

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

  async changeDemoTenantTier(
    tenantId: string,
    newTier: string
  ): Promise<{ changed: boolean; tenantId: string; oldTier: string; newTier: string; reason: string }> {
    const VALID_TIERS = [
      'discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel',
      'professional', 'chain_starter', 'chain_professional', 'enterprise', 'organization',
    ];

    if (!VALID_TIERS.includes(newTier)) {
      return {
        changed: false,
        tenantId,
        oldTier: '',
        newTier,
        reason: `Invalid tier "${newTier}". Valid tiers: ${VALID_TIERS.join(', ')}`,
      };
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, is_demo: true, subscription_tier: true },
    });

    if (!tenant) {
      return { changed: false, tenantId, oldTier: '', newTier, reason: 'Tenant not found' };
    }

    if (!tenant.is_demo) {
      return { changed: false, tenantId, oldTier: tenant.subscription_tier || '', newTier, reason: 'Tenant is not a demo tenant' };
    }

    const oldTier = tenant.subscription_tier || 'unknown';

    if (oldTier === newTier) {
      return { changed: false, tenantId, oldTier, newTier, reason: `Tier is already "${newTier}"` };
    }

    await prisma.tenants.update({
      where: { id: tenantId },
      data: { subscription_tier: newTier },
    });

    logger.info(`[DemoTenantService] Changed demo tenant ${tenantId} (${tenant.name}) tier: ${oldTier} → ${newTier}`);

    return {
      changed: true,
      tenantId,
      oldTier,
      newTier,
      reason: `Tier changed from "${oldTier}" to "${newTier}"`,
    };
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
