/**
 * Google Product Taxonomy
 * Source: https://support.google.com/merchants/answer/6324436
 * Full taxonomy: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 * 
 * Updated: 2021-09-21
 * Total categories: 5,595
 * 
 * To update: Run `npx tsx scripts/download-google-taxonomy.ts`
 */

import taxonomyData from './taxonomy-data.json';

export interface CategoryNode {
  id: string;
  name: string;
  path: string[];
}

interface TaxonomyData {
  version: string;
  downloadedAt: string;
  totalCategories: number;
  categories: CategoryNode[];
}

/**
 * Full Google Product Taxonomy (5,595 categories)
 * Loaded from taxonomy-data.json
 */
export const GOOGLE_PRODUCT_TAXONOMY: CategoryNode[] = (taxonomyData as TaxonomyData).categories;

/**
 * Taxonomy metadata
 */
export const TAXONOMY_VERSION = (taxonomyData as TaxonomyData).version;
export const TAXONOMY_TOTAL = (taxonomyData as TaxonomyData).totalCategories;

/**
 * Search taxonomy by keyword
 * Data is already flat (no need to flatten)
 */
export function searchCategories(query: string, limit = 10): CategoryNode[] {
  const lowerQuery = query.toLowerCase();
  
  return GOOGLE_PRODUCT_TAXONOMY
    .filter((node: CategoryNode) => 
      node.name.toLowerCase().includes(lowerQuery) ||
      node.path.some((p: string) => p.toLowerCase().includes(lowerQuery))
    )
    .slice(0, limit);
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): CategoryNode | null {
  return GOOGLE_PRODUCT_TAXONOMY.find((node: CategoryNode) => node.id === id) || null;
}

/**
 * Validate category path against Google taxonomy
 */
export function validateCategoryPath(path: string[]): boolean {
  const pathString = path.join(' > ');
  
  return GOOGLE_PRODUCT_TAXONOMY.some((node: CategoryNode) => 
    node.path.join(' > ') === pathString
  );
}

/**
 * Suggest categories based on product title/description
 */
export function suggestCategories(text: string, limit = 5): CategoryNode[] {
  const lowerText = text.toLowerCase();
  
  // Simple keyword matching (can be enhanced with ML)
  const scored = GOOGLE_PRODUCT_TAXONOMY.map((node: CategoryNode) => {
    let score = 0;
    const keywords = node.path.join(' ').toLowerCase().split(' ');
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score += 1;
      }
    }
    
    return { node, score };
  });
  
  return scored
    .filter((item: { node: CategoryNode; score: number }) => item.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, limit)
    .map((item: { node: CategoryNode }) => item.node);
}
