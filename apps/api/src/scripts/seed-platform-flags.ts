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
    allowTenantOverride: true,
  },
  {
    flag: 'FF_SWIS_PREVIEW',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Product preview widget showing live inventory feed',
    allowTenantOverride: true,
  },
  {
    flag: 'FF_BUSINESS_PROFILE',
    enabled: true, // strategy: 'on' in localStorage - ALREADY DEPLOYED
    rollout: 'Complete business profile management and onboarding',
    allowTenantOverride: false, // Critical feature, no override
  },
  {
    flag: 'FF_DARK_MODE',
    enabled: false, // strategy: 'off' in localStorage - Future feature
    rollout: 'Dark theme support across the platform (coming soon)',
    allowTenantOverride: true,
  },
  {
    flag: 'FF_GOOGLE_CONNECT_SUITE',
    enabled: false, // strategy: 'pilot' in localStorage - Pilot phase
    rollout: 'Pilot: Google Merchant Center + Business Profile integration (v1: read-only)',
    allowTenantOverride: false, // Controlled rollout, no tenant override
  },
  {
    flag: 'FF_APP_SHELL_NAV',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable the new header and Tenant Switcher (URL-driven tenant context)',
    allowTenantOverride: false, // Core navigation, no override
  },
  {
    flag: 'FF_TENANT_URLS',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable tenant-scoped routes like /t/{tenantId}/items and /t/{tenantId}/settings',
    allowTenantOverride: false, // Core routing, no override
  },
  {
    flag: 'FF_ITEMS_V2_GRID',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable the new high-performance items grid (virtualized, faster filters)',
    allowTenantOverride: true, // Performance feature, safe to override
  },
  {
    flag: 'FF_CATEGORY_MANAGEMENT_PAGE',
    enabled: true, // strategy: 'on' in localStorage - ALREADY DEPLOYED
    rollout: 'Enable category management page and features',
    allowTenantOverride: false, // Core feature, no override
  },
  {
    flag: 'FF_CATEGORY_QUICK_ACTIONS',
    enabled: false, // strategy: 'off' in localStorage
    rollout: 'Enable quick actions for category management',
    allowTenantOverride: true, // UX enhancement, safe to override
  },
];

async function seedPlatformFlags() {
  console.log('🌱 Seeding platform feature flags...\n');

  for (const flagData of DEFAULT_FLAGS) {
    try {
      const flag = await prisma.platformFeatureFlag.upsert({
        where: { flag: flagData.flag },
        update: {
          enabled: flagData.enabled,
          rollout: flagData.rollout,
          allowTenantOverride: flagData.allowTenantOverride,
        },
        create: flagData,
      });

      const status = flag.enabled ? '✅' : '⏸️';
      const override = flag.allowTenantOverride ? '🔓' : '🔒';
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
