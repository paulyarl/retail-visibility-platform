/**
 * Quick Start Categories Generator
 * 
 * Provides a set of starter categories for new tenants
 * to help them get started with product categorization.
 */

import { prisma } from '../prisma';
import { generateQsCatId } from './id-generator';

export interface QuickStartCategory {
  name: string;
  slug: string;
  parentId?: string;
}

/**
 * Generate a set of quick start categories for a new tenant
 */
export async function generateQuickStartCategories(): Promise<QuickStartCategory[]> {
  const categories: QuickStartCategory[] = [
    // Main categories
    {
      name: 'Electronics',
      slug: 'electronics'
    },
    {
      name: 'Clothing & Apparel',
      slug: 'clothing-apparel'
    },
    {
      name: 'Home & Garden',
      slug: 'home-garden'
    },
    {
      name: 'Food & Beverages',
      slug: 'food-beverages'
    },
    {
      name: 'Health & Beauty',
      slug: 'health-beauty'
    },
    {
      name: 'Sports & Outdoors',
      slug: 'sports-outdoors'
    },
    {
      name: 'Toys & Games',
      slug: 'toys-games'
    },
    {
      name: 'Books & Media',
      slug: 'books-media'
    },
    {
      name: 'Office Supplies',
      slug: 'office-supplies'
    },
    {
      name: 'Pet Supplies',
      slug: 'pet-supplies'
    },
    {
      name: 'Automotive',
      slug: 'automotive'
    },
    {
      name: 'Tools & Hardware',
      slug: 'tools-hardware'
    }
  ];

  return categories;
}

/**
 * Create quick start categories for a specific tenant
 */
export async function createQuickStartCategoriesForTenant(tenantId: string): Promise<void> {
  const categories = await generateQuickStartCategories();
  
  for (const category of categories) {
    try {
      // Check if category already exists for this tenant
      const existing = await prisma.directory_category.findFirst({
        where: {
          tenantId: tenantId,
          slug: category.slug,
        },
      });
      
      if (existing) {
        console.log(`[Quick Start Categories] Skipping duplicate category: ${category.name} for tenant ${tenantId}`);
        continue;
      }
      
      // Create new category
      await prisma.directory_category.create({
        data: {
          id: generateQsCatId(),
          tenantId: tenantId,
          name: category.name,
          slug: category.slug,
          isActive: true, 
          updatedAt: new Date(),
        },
      });
      console.log(`[Quick Start Categories] Created category: ${category.name} for tenant ${tenantId}`);
    } catch (error: any) {
      // Log error but continue with other categories
      console.error(`[Quick Start Categories] Failed to create category ${category.name} for tenant ${tenantId}:`, error);
    }
  }
}

export default {
  generateQuickStartCategories,
  createQuickStartCategoriesForTenant,
};
