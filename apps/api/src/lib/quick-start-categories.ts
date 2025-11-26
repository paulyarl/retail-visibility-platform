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
      await prisma.tenantCategory.create({
        data: {
          /**id: `cat_${tenantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, */
          id: generateQsCatId(),
          tenantId,
          name: category.name,
          slug: category.slug,
          updatedAt: new Date(),
        },
      });
    } catch (error: any) {
      // Log error but continue with other categories
      console.error(`Failed to create category ${category.name} for tenant ${tenantId}:`, error);
    }
  }
}

export default {
  generateQuickStartCategories,
  createQuickStartCategoriesForTenant,
};
