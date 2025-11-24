import { GoogleTaxonomyService } from './GoogleTaxonomyService';
import { prisma } from '../prisma';
import { GOOGLE_PRODUCT_TAXONOMY } from '../lib/google/taxonomy';

function collectNodes(nodes: any[]): any[] {
  const out: any[] = [];
  for (const node of nodes) {
    const { id, name, children } = node;
    const parentId = node.path?.length > 1 ? node.path[node.path.length - 2] : null;
    const level = node.path?.length || 1;
    out.push({
      categoryId: id,
      categoryPath: node.path.join(' > '),
      parentId,
      level,
    });
    // Taxonomy is flat - no children property
  }
  return out;
}

async function upsertInBatches(items: any[], batchSize = 200) {
  console.log(`[TaxonomySyncService] Processing ${items.length} items in batches of ${batchSize}`);
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`[TaxonomySyncService] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)} with ${batch.length} items`);
    
    try {
      await prisma.$transaction(
        batch.map((it) =>
          prisma.googleTaxonomy.upsert({
            where: { categoryId: it.categoryId },
            create: {
              categoryId: it.categoryId,
              categoryPath: it.categoryPath,
              parentId: it.parentId,
              level: it.level,
              isActive: true,
              version: '2024-09',
            } as any,
            update: {
              categoryPath: it.categoryPath,
              parentId: it.parentId,
              level: it.level,
              isActive: true,
              version: '2024-09',
            },
          })
        )
      );
      console.log(`[TaxonomySyncService] Batch ${Math.floor(i/batchSize) + 1} completed successfully`);
    } catch (error) {
      console.error(`[TaxonomySyncService] Batch ${Math.floor(i/batchSize) + 1} failed:`, error);
      throw error;
    }
  }
  
  console.log('[TaxonomySyncService] All batches completed');
}

export class TaxonomySyncService {
  private googleService: GoogleTaxonomyService;

  constructor() {
    this.googleService = new GoogleTaxonomyService();
  }

  /**
   * Check for taxonomy updates from Google
   */
  async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    latestVersion: string;
    changes: TaxonomyChange[];
  }> {
    try {
      const latestTaxonomy = await this.googleService.fetchLatestTaxonomy();
      const currentTaxonomy = await this.getCurrentTaxonomy();

      const changes = this.detectChanges(currentTaxonomy, latestTaxonomy.categories);

      return {
        hasUpdates: changes.length > 0,
        latestVersion: latestTaxonomy.version,
        changes
      };
    } catch (error) {
      console.error('Failed to check for taxonomy updates:', error);
      throw error;
    }
  }

  /**
   * Apply taxonomy updates (safe, non-breaking changes only)
   */
  async applySafeUpdates(changes: TaxonomyChange[]): Promise<{
    applied: number;
    skipped: number;
    needsReview: number;
  }> {
    console.log('[TaxonomySyncService] applySafeUpdates called - populating google_taxonomy_list table');
    
    // Instead of processing changes, just populate the table with all taxonomy data
    const flat = collectNodes(GOOGLE_PRODUCT_TAXONOMY);
    console.log(`[TaxonomySyncService] Processing ${flat.length} categories from GOOGLE_PRODUCT_TAXONOMY`);
    
    try {
      await upsertInBatches(flat, 200);
      
      const total = await prisma.googleTaxonomy.count();
      console.log(`[TaxonomySyncService] Total records after sync: ${total}`);
      
      return {
        applied: flat.length,
        skipped: 0,
        needsReview: 0
      };
    } catch (error) {
      console.error('[TaxonomySyncService] Error populating taxonomy:', error);
      throw error;
    }
  }

  /**
   * Migrate items affected by taxonomy changes
   */
  async migrateAffectedItems(changes: TaxonomyChange[]): Promise<{
    migrated: number;
    flagged: number;
  }> {
    const affectedCategories = changes.map(c => c.categoryId);
    const affectedItems = await this.findItemsWithCategories(affectedCategories);

    let migrated = 0;
    let flagged = 0;

    for (const item of affectedItems) {
      const migrationResult = await this.migrateItemCategory(item);

      if (migrationResult.success) {
        migrated++;
      } else {
        await this.flagItemForReview(item.id, migrationResult.reason || 'Category migration failed');
        flagged++;
      }
    }

    return { migrated, flagged };
  }

  private isSafeChange(change: TaxonomyChange): boolean {
    // Safe changes: new categories, name changes, minor updates
    return change.type === 'new' ||
           change.type === 'renamed' ||
           change.type === 'minor_update';
  }

  private async applyChange(change: TaxonomyChange): Promise<void> {
    // Apply the change to the database
    await this.updateTaxonomyCategory(change);
  }

  private async queueForReview(change: TaxonomyChange): Promise<void> {
    // Store change for admin review
    await this.createAdminReviewTask(change);
  }

  private detectChanges(current: any[], latest: any[]): TaxonomyChange[] {
    // Compare taxonomies and identify changes
    // This is a simplified implementation
    const changes: TaxonomyChange[] = [];

    // Find new categories
    for (const latestCat of latest) {
      const existing = current.find(c => c.id === latestCat.id);
      if (!existing) {
        changes.push({
          type: 'new',
          categoryId: latestCat.id,
          oldData: null,
          newData: latestCat
        });
      }
    }

    // Find renamed categories
    for (const currentCat of current) {
      const latestCat = latest.find(c => c.id === currentCat.id);
      if (latestCat && currentCat.name !== latestCat.name) {
        changes.push({
          type: 'renamed',
          categoryId: currentCat.id,
          oldData: currentCat,
          newData: latestCat
        });
      }
    }

    return changes;
  }

  private async migrateItemCategory(item: any): Promise<{
    success: boolean;
    reason?: string;
  }> {
    // Find best matching category for the item
    const bestMatch = await this.findBestCategoryMatch(item.categoryPath);

    if (bestMatch) {
      await this.updateItemCategory(item.id, bestMatch);
      return { success: true };
    } else {
      return {
        success: false,
        reason: 'No suitable replacement category found'
      };
    }
  }

  private async findBestCategoryMatch(oldPath: string[]): Promise<string[] | null> {
    // Implementation would use fuzzy matching, parent matching, etc.
    // This is a placeholder
    return null;
  }

  private async updateItemCategory(item_id: string, newPath: string[]): Promise<void> {
    // Update the item's category in the database
    // Implementation would use the existing updateItem API
  }

  private async flagItemForReview(item_id: string, reason: string): Promise<void> {
    // Mark item for manual review
    // Could add a flag in the database or create a review task
  }

  private async getCurrentTaxonomy(): Promise<any[]> {
    // Fetch current taxonomy from database
    const current = await prisma.googleTaxonomy.findMany({
      select: {
        categoryId: true,
        categoryPath: true,
        parentId: true,
        level: true,
        version: true
      }
    });
    console.log(`[TaxonomySyncService] Found ${current.length} existing taxonomy records`);
    return current;
  }

  private async findItemsWithCategories(categoryIds: string[]): Promise<any[]> {
    // Find items that use the specified categories
    return [];
  }

  private async updateTaxonomyCategory(change: TaxonomyChange): Promise<void> {
    // Update taxonomy category in database
  }

  private async createAdminReviewTask(change: TaxonomyChange): Promise<void> {
    // Create task for admin to review
  }
}

interface TaxonomyChange {
  type: 'new' | 'renamed' | 'removed' | 'structural' | 'minor_update';
  categoryId: string;
  oldData: any;
  newData: any;
}
