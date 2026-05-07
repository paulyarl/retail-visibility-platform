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

/**
 * Get all categories under a specific branch (by root path)
 * Example: getCategoriesByBranch(['Food, Beverages & Tobacco']) returns all food categories
 */
export function getCategoriesByBranch(rootPath: string[]): CategoryNode[] {
  return GOOGLE_PRODUCT_TAXONOMY.filter((node: CategoryNode) => {
    // Check if this category starts with the root path
    if (node.path.length < rootPath.length) return false;
    
    for (let i = 0; i < rootPath.length; i++) {
      if (node.path[i] !== rootPath[i]) return false;
    }
    
    return true;
  });
}

/**
 * Get categories at a specific depth level within a branch
 * depth = 1: immediate children of root
 * depth = 2: grandchildren, etc.
 */
export function getCategoriesByDepth(rootPath: string[], depth: number): CategoryNode[] {
  const targetDepth = rootPath.length + depth;
  
  return GOOGLE_PRODUCT_TAXONOMY.filter((node: CategoryNode) => {
    // Must be exactly at target depth
    if (node.path.length !== targetDepth) return false;
    
    // Must start with root path
    for (let i = 0; i < rootPath.length; i++) {
      if (node.path[i] !== rootPath[i]) return false;
    }
    
    return true;
  });
}

/**
 * Randomly select categories from a branch with optional depth constraints
 * This creates realistic, hierarchically-related category sets
 */
export function selectRandomFromBranch(
  rootPath: string[],
  count: number,
  options: {
    minDepth?: number;  // Minimum depth below root (1 = immediate children)
    maxDepth?: number;  // Maximum depth below root
    diversify?: boolean; // Try to pick from different sub-branches
  } = {}
): CategoryNode[] {
  const { minDepth = 1, maxDepth = 3, diversify = true } = options;
  
  // Get all categories in the branch within depth constraints
  const candidates = GOOGLE_PRODUCT_TAXONOMY.filter((node: CategoryNode) => {
    const nodeDepth = node.path.length;
    const relativeDepth = nodeDepth - rootPath.length;
    
    // Check depth constraints
    if (relativeDepth < minDepth || relativeDepth > maxDepth) return false;
    
    // Check if starts with root path
    for (let i = 0; i < rootPath.length; i++) {
      if (node.path[i] !== rootPath[i]) return false;
    }
    
    return true;
  });
  
  if (candidates.length === 0) return [];
  
  // If diversify is enabled, try to pick from different sub-branches
  if (diversify && candidates.length > count) {
    const selected: CategoryNode[] = [];
    const usedSubBranches = new Set<string>();
    
    // Shuffle candidates
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    
    for (const candidate of shuffled) {
      if (selected.length >= count) break;
      
      // Get the sub-branch identifier (first level after root)
      const subBranch = candidate.path[rootPath.length];
      
      // Try to avoid duplicate sub-branches if possible
      if (!usedSubBranches.has(subBranch) || selected.length >= count / 2) {
        selected.push(candidate);
        usedSubBranches.add(subBranch);
      }
    }
    
    // Fill remaining slots if needed
    while (selected.length < count && selected.length < candidates.length) {
      const remaining = shuffled.filter(c => !selected.includes(c));
      if (remaining.length === 0) break;
      selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
    
    return selected;
  }
  
  // Simple random selection
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, candidates.length));
}
