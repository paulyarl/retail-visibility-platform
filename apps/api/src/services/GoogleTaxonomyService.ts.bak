/**
 * Google Taxonomy Service
 * Handles fetching and processing Google Product Taxonomy data
 */
export class GoogleTaxonomyService {
  private readonly TAXONOMY_URL = 'https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt';

  /**
   * Fetch the latest taxonomy from Google
   */
  async fetchLatestTaxonomy(): Promise<{
    version: string;
    categories: GoogleTaxonomyCategory[];
    lastModified: Date;
  }> {
    try {
      const response = await fetch(this.TAXONOMY_URL, {
        headers: {
          'User-Agent': 'RetailVisibilityPlatform/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch taxonomy: ${response.status}`);
      }

      const text = await response.text();
      const lastModified = new Date(response.headers.get('last-modified') || Date.now());

      const categories = this.parseTaxonomyText(text);

      return {
        version: this.generateVersion(lastModified),
        categories,
        lastModified
      };
    } catch (error) {
      console.error('Error fetching Google taxonomy:', error);
      throw error;
    }
  }

  /**
   * Parse Google's taxonomy text format into structured data
   */
  private parseTaxonomyText(text: string): GoogleTaxonomyCategory[] {
    const lines = text.split('\n').filter(line => line.trim());
    const categories: GoogleTaxonomyCategory[] = [];

    for (const line of lines) {
      const [id, path] = line.split(' - ', 2);
      if (id && path) {
        const pathParts = path.split(' > ');
        categories.push({
          id: id.trim(),
          name: pathParts[pathParts.length - 1],
          path: pathParts,
          fullPath: path.trim(),
          level: pathParts.length - 1,
          parentId: pathParts.length > 1 ? this.findParentId(categories, pathParts) : null
        });
      }
    }

    return categories;
  }

  /**
   * Find parent category ID for a given path
   */
  private findParentId(categories: GoogleTaxonomyCategory[], pathParts: string[]): string | null {
    if (pathParts.length <= 1) return null;

    const parentPath = pathParts.slice(0, -1);
    const parent = categories.find(cat =>
      cat.path.length === parentPath.length &&
      cat.path.every((part, index) => part === parentPath[index])
    );

    return parent?.id || null;
  }

  /**
   * Generate version string from last modified date
   */
  private generateVersion(lastModified: Date): string {
    return `google-${lastModified.getFullYear()}${(lastModified.getMonth() + 1).toString().padStart(2, '0')}${lastModified.getDate().toString().padStart(2, '0')}`;
  }

  /**
   * Validate taxonomy data structure
   */
  validateTaxonomy(categories: GoogleTaxonomyCategory[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const category of categories) {
      if (ids.has(category.id)) {
        errors.push(`Duplicate category ID: ${category.id}`);
      }
      ids.add(category.id);
    }

    // Check for missing parents
    const idSet = new Set(categories.map(c => c.id));
    for (const category of categories) {
      if (category.parentId && !idSet.has(category.parentId)) {
        errors.push(`Category ${category.id} references non-existent parent ${category.parentId}`);
      }
    }

    // Check path consistency
    for (const category of categories) {
      if (category.path.length - 1 !== category.level) {
        errors.push(`Category ${category.id} has inconsistent level (${category.level}) vs path length (${category.path.length})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export interface GoogleTaxonomyCategory {
  id: string;
  name: string;
  path: string[];
  fullPath: string;
  level: number;
  parentId: string | null;
}
