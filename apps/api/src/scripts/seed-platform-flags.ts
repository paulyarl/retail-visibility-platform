/**
 * Seed script to migrate localStorage flags to database
 * Run with: npx ts-node src/scripts/seed-platform-flags.ts
 */

import { prisma } from '../prisma';

const DEFAULT_FLAGS = [
  {
    flag: 'FF_MAP_CARD',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Google Maps integration for tenant locations with privacy controls',
    allow_tenant_override: true,
  },
  {
    flag: 'FF_SWIS_PREVIEW',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Product preview widget showing live inventory feed',
    allow_tenant_override: true,
  },
  {
    flag: 'FF_BUSINESS_PROFILE',
    enabled: true, // strategy: 'on' in localStorage - ALREADY DEPLOYED
    rollout: 'Complete business profile management and onboarding',
    allow_tenant_override: false, // Critical feature, no override
  },
  {
    flag: 'FF_DARK_MODE',
    enabled: false, // strategy: 'off' in localStorage - Future feature
    rollout: 'Dark theme support across the platform (coming soon)',
    allow_tenant_override: true,
  },
  {
    flag: 'FF_GOOGLE_CONNECT_SUITE',
    enabled: false, // strategy: 'pilot' in localStorage - Pilot phase
    rollout: 'Pilot: Google Merchant Center + Business Profile integration (v1: read-only)',
    allow_tenant_override: false, // Controlled rollout, no tenant override
  },
  {
    flag: 'FF_APP_SHELL_NAV',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable the new header and Tenant Switcher (URL-driven tenant context)',
    allow_tenant_override: false, // Core navigation, no override
  },
  {
    flag: 'FF_TENANT_URLS',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable tenant-scoped routes like /t/{tenantId}/items and /t/{tenantId}/settings',
    allow_tenant_override: false, // Core routing, no override
  },
  {
    flag: 'FF_ITEMS_V2_GRID',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable the new high-performance items grid (virtualized, faster filters)',
    allow_tenant_override: true, // Performance feature, safe to override
  },
  {
    flag: 'FF_CATEGORY_MANAGEMENT_PAGE',
    enabled: true, // strategy: 'on' in localStorage - ALREADY DEPLOYED
    rollout: 'Enable category management page and features',
    allow_tenant_override: false, // Core feature, no override
  },
  {
    flag: 'FF_CATEGORY_QUICK_ACTIONS',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable quick actions for category management',
    allow_tenant_override: true, // UX enhancement, safe to override
  },
  {
    flag: 'FF_SUPPLIER_CATALOG_IMPORT',
    enabled: false, // pilot phase
    rollout: 'Browse open-source product catalogs (Open Food Facts, UPC Database, Open Beauty Facts) and bulk import items into tenant inventory',
    allow_tenant_override: true, // Safe for tenants to opt in
  },
  {
    flag: 'FF_TENANT_GBP_CATEGORY_SYNC',
    enabled: false,
    rollout: 'Google Business Profile category sync for tenant directory listings',
    allow_tenant_override: true,
  },
  {
    flag: 'FF_CATEGORY_MIRRORING',
    enabled: false,
    rollout: 'Mirror categories between platform and Google Business Profile',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_GLOBAL_TENANT_META',
    enabled: false,
    rollout: 'Region resolution from DB (per-request tenant metadata)',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_AUDIT_LOG',
    enabled: false,
    rollout: 'Audit log writes + table creation (boot fallback: env var)',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_I18N_SCAFFOLD',
    enabled: false,
    rollout: 'i18next translation scaffold (en-US, es-ES, fr-FR)',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_CURRENCY_RATE_STUB',
    enabled: false,
    rollout: 'Currency rate stub job endpoint',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_FEED_ALIGNMENT_ENFORCE',
    enabled: false,
    rollout: 'Block feed submission when categories unmapped',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_FEED_COVERAGE',
    enabled: true,
    rollout: 'Feed coverage endpoint gate',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_TENANT_PLATFORM_CATEGORY',
    enabled: false,
    rollout: 'Platform category mapping for tenants',
    allow_tenant_override: false,
  },
  {
    flag: 'FF_SCAN_ENRICHMENT',
    enabled: true,
    rollout: 'Image enrichment during barcode scan',
    allow_tenant_override: false,
  },
];

async function seedPlatformFlags() {
  console.log('🌱 Seeding platform feature flags...\n');

  for (const flagData of DEFAULT_FLAGS) {
    try {
      const flag = await prisma.platform_feature_flags_list.upsert({
        where: { flag: flagData.flag },
        update: {
          enabled: flagData.enabled,
          rollout: flagData.rollout,
          allow_tenant_override: flagData.allow_tenant_override,
        },
        create: flagData as any,
      });

      const status = flag.enabled ? '✅' : '⏸️';
      const override = flag.allow_tenant_override ? '🔓' : '🔒';
      console.log(`${status} ${override} ${flag.flag}`);
      console.log(`   ${flag.rollout || 'No description'}\n`);
    } catch (error) {
      console.error(`❌ Failed to seed ${flagData.flag}:`, error);
    }
  }

  console.log('✅ Platform flags seeded successfully!');
}

seedPlatformFlags()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
