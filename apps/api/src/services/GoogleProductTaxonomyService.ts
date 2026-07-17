import { logger } from '../logger';

/**
 * Google Product Taxonomy Service
 *
 * Fetches and caches Google's product category taxonomy (~5,500 categories).
 * Google publishes this as a static text file at:
 * https://www.google.com/basepages/producttype/taxonomy.en-US.txt
 *
 * Format: one category per line, "ID - Full > Category > Path"
 */

const TAXONOMY_URL = 'https://www.google.com/basepages/producttype/taxonomy.en-US.txt';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface GoogleTaxonomyCategory {
  id: string;
  path: string;
  parts: string[];
}

let cachedTaxonomy: GoogleTaxonomyCategory[] | null = null;
let cachedAt = 0;

/**
 * Fetch and parse Google's product category taxonomy.
 * Results are cached for 24 hours in memory.
 */
export async function getGoogleProductTaxonomy(): Promise<GoogleTaxonomyCategory[]> {
  if (cachedTaxonomy && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedTaxonomy;
  }

  try {
    const response = await fetch(TAXONOMY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch taxonomy: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    const categories: GoogleTaxonomyCategory[] = lines.map(line => {
      const match = line.match(/^(\d+)\s+-\s+(.+)$/);
      if (!match) return null;
      const id = match[1];
      const path = match[2].trim();
      const parts = path.split(' > ').map(p => p.trim());
      return { id, path, parts };
    }).filter((c): c is GoogleTaxonomyCategory => c !== null);

    cachedTaxonomy = categories;
    cachedAt = Date.now();

    console.log(`[GoogleProductTaxonomy] Loaded ${categories.length} categories`);
    return categories;
  } catch (error) {
    logger.error('[GoogleProductTaxonomy] Error fetching taxonomy:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    if (cachedTaxonomy) return cachedTaxonomy;
    return [];
  }
}

/**
 * Search Google product taxonomy by keyword.
 * Returns categories whose path contains the search term (case-insensitive).
 */
export async function searchGoogleProductTaxonomy(query: string, limit = 50): Promise<GoogleTaxonomyCategory[]> {
  const taxonomy = await getGoogleProductTaxonomy();
  if (!query.trim()) return taxonomy.slice(0, limit);

  const q = query.toLowerCase();
  return taxonomy
    .filter(c => c.path.toLowerCase().includes(q))
    .slice(0, limit);
}

/**
 * Get a single Google product category by ID.
 */
export async function getGoogleProductCategoryById(id: string): Promise<GoogleTaxonomyCategory | null> {
  const taxonomy = await getGoogleProductTaxonomy();
  return taxonomy.find(c => c.id === id) || null;
}
