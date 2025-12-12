/**
 * Admin Tools Library
 * 
 * Reusable functions for admin control panel operations.
 * Extracted from CLI scripts for use in API endpoints.
 */

import { prisma } from '../prisma';
import { generateQuickStartProducts } from './quick-start';
import { generateQuickStart, generateUserTenantId } from './id-generator';

// Chain size configurations
const CHAIN_SIZES = {
  small: {
    locations: 1,
    skuRange: [200, 400],
  },
  medium: {
    locations: 3,
    skuRange: [600, 1200],
  },
  large: {
    locations: 5,
    skuRange: [1500, 2500],
  },
};

export interface CreateTestChainOptions {
  name: string;
  size: 'small' | 'medium' | 'large';
  scenario: 'grocery' | 'fashion' | 'electronics' | 'general';
  seedProducts?: boolean;
  createAsDrafts?: boolean;
}

export interface TestChainResult {
  organizationId: string;
  tenant: Array<{
    id: string;
    name: string;
    skuCount: number;
  }>;
  totalSkus: number;
}

/**
 * Create a test organization with multiple tenant locations
 */
export async function createTestChain(options: CreateTestChainOptions): Promise<TestChainResult> {
  const { name, size, scenario, seedProducts = true, createAsDrafts = true } = options;
  
  const config = CHAIN_SIZES[size];
  const orgId = `org_test_${Date.now()}`;
  
  // Create organization
  const org = await prisma.organizations_list.create({
    data: {
      id: orgId,
      name,
      // Store owner in both legacy snake_case and new camelCase columns
      owner_id: 'admin_test', // Test organizations owned by admin
      max_locations: config.locations * 2, // Allow room for growth
      max_total_skus: config.skuRange[1] * 2,
      // Required timestamps
      updated_at: new Date(),
    },
  });

  // Create tenant locations
  const tenants: TestChainResult['tenant'] = [];
  const locationNames = ['Main Store', 'Downtown Branch', 'Uptown Store', 'Westside Location', 'Eastside Branch'];
  
  for (let i = 0; i < config.locations; i++) {
    const locationName = locationNames[i] || `Location ${i + 1}`;
    const tenantId = `chain_location_${Date.now()}_${i}`;
    
    // Calculate SKU count for this location
    const [minSkus, maxSkus] = config.skuRange;
    const skuCount = Math.floor(minSkus + (maxSkus - minSkus) * (1 - i * 0.3));
    
    // Create tenant
    const currentTenant = await prisma.tenants.create({
      data: {
        id: tenantId,
        name: `${name} - ${locationName}`,
        subscription_tier: 'professional',
        subscription_status: 'active',
        organization_id: org.id,
      },
    });

    // Seed products if requested
    let actualSkuCount = 0;
    if (seedProducts) {
      const result = await generateQuickStartProducts({
        tenant_id: currentTenant.id,
        scenario,
        productCount: skuCount,
        assignCategories: true,
        createAsDrafts,
      }, prisma);
      actualSkuCount = result.productsCreated;
    }

    tenants.push({
      id: currentTenant.id,
      name: currentTenant.name,
      skuCount: actualSkuCount,
    });
  }

  const totalSkus = tenants.reduce((sum: number, t: { skuCount: number }) => sum + t.skuCount, 0);

  return {
    organizationId: org.id,
    tenant: tenants,
    totalSkus,
  };
}

/**
 * Delete a test organization and all associated data
 */
export async function deleteTestChain(organizationId: string): Promise<{
  tenantsDeleted: number;
  productsDeleted: number;
}> {
  // Get all tenants in the organization
  const tenants = await prisma.tenants.findMany({
    where: { organization_id: organizationId },
    select: { id: true },
  });

  // Count products before deletion
  const productCount = await prisma.inventory_items.count({
    where: {
      tenant_id: { in: tenants.map(t => t.id) },
    },
  });

  // Delete all products
  await prisma.inventory_items.deleteMany({
    where: {
      tenant_id: { in: tenants.map(t => t.id) },
    },
  });

  // Delete all tenants
  await prisma.tenants.deleteMany({
    where: { organization_id: organizationId },
  });

  // Delete organization
  await prisma.organizations_list.delete({
    where: { id: organizationId },
  });

  return {
    tenantsDeleted: tenants.length,
    productsDeleted: productCount,
  };
}

/**
 * Create a test tenant (standalone, not part of a chain)
 */
export async function createTestTenant(options: {
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  organizationId?: string;
  ownerId?: string;
  scenario?: 'grocery' | 'fashion' | 'electronics' | 'general';
  productCount?: number;
  createAsDrafts?: boolean;
}) {
  const {
    name,
    subscriptionTier = 'professional',
    subscriptionStatus = 'trial',
    organizationId,
    ownerId,
    scenario = 'general',
    productCount = 0,
    createAsDrafts = true,
  } = options;

  const tenantId = `tenant_test_${Date.now()}`;

  // Create tenant
  const tenant = await prisma.tenants.create({
    data: {
      id: tenantId,
      name,
      subscription_tier: subscriptionTier,
      subscription_status: subscriptionStatus,
      organization_id: organizationId || null,
    },
  });

  // Link to owner if provided
  if (ownerId) {
    await prisma.user_tenants.create({
      data: {
        id: generateUserTenantId(ownerId, tenant.id),
        user_id: ownerId,
        tenant_id: tenant.id,
        role: 'OWNER',
        updated_at: new Date(),
      },
    });
    console.log(`[Admin Tools] Linked tenant ${tenant.id} to owner ${ownerId}`);
  }

  // Seed products if requested
  let result = null;
  if (productCount > 0) {
    result = await generateQuickStartProducts({
      tenant_id: tenant.id,
      scenario,
      productCount,
      assignCategories: true,
      createAsDrafts,
    }, prisma);
  }

  return {
    tenantId: tenant.id,
    name: tenant.name,
    productsCreated: result?.productsCreated || 0,
    categoriesCreated: result?.categoriesCreated || 0,
  };
}

/**
 * Bulk seed products across multiple tenants
 */
export async function bulkSeedProducts(options: {
  tenantIds: string[];
  scenario: 'grocery' | 'fashion' | 'electronics' | 'general';
  productCount: number;
  createAsDrafts?: boolean;
  clearExisting?: boolean;
}) {
  const { tenantIds, scenario, productCount, createAsDrafts = true, clearExisting = false } = options;

  const results = [];

  for (const tenantId of tenantIds) {
    try {
      // Clear existing products if requested
      if (clearExisting) {
        await prisma.inventory_items.deleteMany({
          where: { tenant_id: tenantId },
        });
      }

      // Seed products
      const result = await generateQuickStartProducts({
        tenant_id: tenantId,
        scenario,
        productCount,
        assignCategories: true,
        createAsDrafts,
      }, prisma);

      results.push({
        tenantId,
        productsCreated: result.productsCreated,
        status: 'success',
      });
    } catch (error: any) {
      results.push({
        tenantId,
        productsCreated: 0,
        status: 'error',
        error: error.message,
      });
    }
  }

  const totalProductsCreated = results.reduce((sum, r) => sum + r.productsCreated, 0);

  return {
    results,
    totalProductsCreated,
  };
}

/**
 * Bulk clear products from multiple tenants
 */
export async function bulkClearProducts(tenantIds: string[]) {
  const results = [];

  for (const tenantId of tenantIds) {
    try {
      const result = await prisma.inventory_items.deleteMany({
        where: { tenant_id: tenantId },
      });

      results.push({
        tenantId,
        productsDeleted: result.count,
        status: 'success',
      });
    } catch (error: any) {
      results.push({
        tenantId,
        productsDeleted: 0,
        status: 'error',
        error: error.message,
      });
    }
  }

  const totalProductsDeleted = results.reduce((sum, r) => sum + r.productsDeleted, 0);

  return {
    results,
    totalProductsDeleted,
  };
}
