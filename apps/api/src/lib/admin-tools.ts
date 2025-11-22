/**
 * Admin Tools Library
 * 
 * Reusable functions for admin control panel operations.
 * Extracted from CLI scripts for use in API endpoints.
 */

import { PrismaClient } from '@prisma/client';
import { generateQuickStartProducts } from './quick-start';

const prisma = new PrismaClient();

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
  const org = await prisma.organization.create({
    data: {
      id: orgId,
      name,
      // Store owner in both legacy snake_case and new camelCase columns
      ownerId: 'admin_test', // Test organizations owned by admin
      maxLocations: config.locations * 2, // Allow room for growth
      maxTotalSKUs: config.skuRange[1] * 2,
      // Required timestamps
      updatedAt: new Date(),
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
    const currentTenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: `${name} - ${locationName}`,
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        organizationId: org.id,
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
      });
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
  const tenants = await prisma.tenant.findMany({
    where: { organizationId },
    select: { id: true },
  });

  // Count products before deletion
  const productCount = await prisma.inventoryItem.count({
    where: {
      tenantId: { in: tenants.map(t => t.id) },
    },
  });

  // Delete all products
  await prisma.inventoryItem.deleteMany({
    where: {
      tenantId: { in: tenants.map(t => t.id) },
    },
  });

  // Delete all tenants
  await prisma.tenant.deleteMany({
    where: { organizationId },
  });

  // Delete organization
  await prisma.organization.delete({
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
  const tenant = await prisma.tenant.create({
    data: {
      id: tenantId,
      name,
      subscriptionTier,
      subscriptionStatus,
      organizationId: organizationId || null,
    },
  });

  // Link to owner if provided
  if (ownerId) {
    await prisma.userTenant.create({
      data: {
        id: `ut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: ownerId,
        tenantId: tenant.id,
        role: 'OWNER',
        updatedAt: new Date(),
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
    });
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
        await prisma.inventoryItem.deleteMany({
          where: { tenantId: tenantId },
        });
      }

      // Seed products
      const result = await generateQuickStartProducts({
        tenant_id: tenantId,
        scenario,
        productCount,
        assignCategories: true,
        createAsDrafts,
      });

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
      const result = await prisma.inventoryItem.deleteMany({
        where: { tenantId: tenantId },
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
