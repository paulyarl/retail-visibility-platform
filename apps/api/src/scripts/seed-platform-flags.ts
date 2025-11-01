/**
 * Seed script to migrate localStorage flags to database
 * Run with: npx ts-node src/scripts/seed-platform-flags.ts
 */

import { prisma } from '../prisma';

const DEFAULT_FLAGS = [
  {
    flag: 'FF_MAP_CARD',
    enabled: false,
    rollout: 'Google Maps integration for tenant locations',
    allowTenantOverride: true,
  },
  {
    flag: 'FF_SWIS_PREVIEW',
    enabled: false,
    rollout: 'Product preview widget showing live inventory feed',
    allowTenantOverride: true,
  },
  {
    flag: 'FF_BUSINESS_PROFILE',
    enabled: true,
    rollout: 'Complete business profile management - fully deployed',
    allowTenantOverride: false,
  },
  {
    flag: 'FF_DARK_MODE',
    enabled: false,
    rollout: 'Dark theme support (coming soon)',
    allowTenantOverride: true,
  },
  {
    flag: 'FF_GOOGLE_CONNECT_SUITE',
    enabled: false,
    rollout: 'Pilot: Google Merchant Center + Business Profile integration',
    allowTenantOverride: false,
  },
  {
    flag: 'FF_APP_SHELL_NAV',
    enabled: false,
    rollout: 'New header and Tenant Switcher',
    allowTenantOverride: false,
  },
  {
    flag: 'FF_TENANT_URLS',
    enabled: false,
    rollout: 'Tenant-scoped routes like /t/{tenantId}/items',
    allowTenantOverride: false,
  },
  {
    flag: 'FF_ITEMS_V2_GRID',
    enabled: false,
    rollout: 'High-performance items grid (virtualized)',
    allowTenantOverride: true,
  },
  {
    flag: 'FF_CATEGORY_MANAGEMENT_PAGE',
    enabled: true,
    rollout: 'Category management page - fully deployed',
    allowTenantOverride: false,
  },
  {
    flag: 'FF_CATEGORY_QUICK_ACTIONS',
    enabled: false,
    rollout: 'Quick actions for category management',
    allowTenantOverride: true,
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
