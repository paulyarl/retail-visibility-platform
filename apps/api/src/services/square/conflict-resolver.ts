/**
 * Square Conflict Resolver
 * Handles data conflicts during synchronization
 * Phase 3: Sync Service Implementation
 */

export interface ConflictData {
  field: string;
  squareValue: any;
  platformValue: any;
  squareUpdatedAt?: Date;
  platformUpdatedAt?: Date;
}

export interface ConflictResolution {
  field: string;
  resolvedValue: any;
  source: 'square' | 'platform' | 'manual';
  reason: string;
}

export interface ConflictRule {
  field: string;
  strategy: 'square_wins' | 'platform_wins' | 'most_recent' | 'manual' | 'custom';
  threshold?: number; // For price differences, etc.
  customResolver?: (conflict: ConflictData) => ConflictResolution;
}

export class ConflictResolver {
  private rules: Map<string, ConflictRule>;
  private manualReviewQueue: ConflictData[];

  constructor() {
    this.rules = new Map();
    this.manualReviewQueue = [];
    this.initializeDefaultRules();
  }

  /**
   * Initialize default conflict resolution rules
   */
  private initializeDefaultRules() {
    // Price: Manual review if difference > $10
    this.addRule({
      field: 'price',
      strategy: 'custom',
      threshold: 10,
      customResolver: (conflict) => {
        const diff = Math.abs(
          (conflict.squareValue || 0) - (conflict.platformValue || 0)
        );

        if (diff > 10) {
          return {
            field: 'price',
            resolvedValue: conflict.squareValue,
            source: 'manual',
            reason: `Price difference $${diff.toFixed(2)} exceeds threshold, requires manual review`,
          };
        }

        // Square wins for small differences (POS is source of truth)
        return {
          field: 'price',
          resolvedValue: conflict.squareValue,
          source: 'square',
          reason: 'Square POS is source of truth for pricing',
        };
      },
    });

    // Name: Most recent wins
    this.addRule({
      field: 'name',
      strategy: 'most_recent',
    });

    // Description: Always sync (Platform can be more detailed)
    this.addRule({
      field: 'description',
      strategy: 'platform_wins',
    });

    // SKU: Square wins (POS is source of truth)
    this.addRule({
      field: 'sku',
      strategy: 'square_wins',
    });

    // Quantity: Most recent wins
    this.addRule({
      field: 'quantity',
      strategy: 'most_recent',
    });

    // Images: Platform wins (can have more images)
    this.addRule({
      field: 'images',
      strategy: 'platform_wins',
    });

    // Category: Platform wins (more detailed categorization)
    this.addRule({
      field: 'category',
      strategy: 'platform_wins',
    });

    // Active status: Platform wins (business decides visibility)
    this.addRule({
      field: 'isActive',
      strategy: 'platform_wins',
    });

    // Public status: Platform wins (business decides visibility)
    this.addRule({
      field: 'isPublic',
      strategy: 'platform_wins',
    });
  }

  /**
   * Add a conflict resolution rule
   */
  addRule(rule: ConflictRule) {
    this.rules.set(rule.field, rule);
  }

  /**
   * Get a conflict resolution rule
   */
  getRule(field: string): ConflictRule | undefined {
    return this.rules.get(field);
  }

  /**
   * Resolve a single conflict
   */
  resolve(conflict: ConflictData): ConflictResolution {
    const rule = this.rules.get(conflict.field);

    if (!rule) {
      // Default: Most recent wins
      return this.resolveMostRecent(conflict);
    }

    switch (rule.strategy) {
      case 'square_wins':
        return {
          field: conflict.field,
          resolvedValue: conflict.squareValue,
          source: 'square',
          reason: 'Square POS is configured as source of truth',
        };

      case 'platform_wins':
        return {
          field: conflict.field,
          resolvedValue: conflict.platformValue,
          source: 'platform',
          reason: 'Platform is configured as source of truth',
        };

      case 'most_recent':
        return this.resolveMostRecent(conflict);

      case 'manual':
        this.manualReviewQueue.push(conflict);
        return {
          field: conflict.field,
          resolvedValue: conflict.squareValue, // Default to Square while awaiting review
          source: 'manual',
          reason: 'Conflict requires manual review',
        };

      case 'custom':
        if (rule.customResolver) {
          return rule.customResolver(conflict);
        }
        return this.resolveMostRecent(conflict);

      default:
        return this.resolveMostRecent(conflict);
    }
  }

  /**
   * Resolve conflict based on most recent timestamp
   */
  private resolveMostRecent(conflict: ConflictData): ConflictResolution {
    if (!conflict.squareUpdatedAt && !conflict.platformUpdatedAt) {
      // No timestamps, default to Square
      return {
        field: conflict.field,
        resolvedValue: conflict.squareValue,
        source: 'square',
        reason: 'No timestamps available, defaulting to Square',
      };
    }

    if (!conflict.squareUpdatedAt) {
      return {
        field: conflict.field,
        resolvedValue: conflict.platformValue,
        source: 'platform',
        reason: 'Platform has more recent data',
      };
    }

    if (!conflict.platformUpdatedAt) {
      return {
        field: conflict.field,
        resolvedValue: conflict.squareValue,
        source: 'square',
        reason: 'Square has more recent data',
      };
    }

    const squareTime = conflict.squareUpdatedAt.getTime();
    const platformTime = conflict.platformUpdatedAt.getTime();

    if (squareTime > platformTime) {
      return {
        field: conflict.field,
        resolvedValue: conflict.squareValue,
        source: 'square',
        reason: `Square data is more recent (${this.formatTimeDiff(squareTime - platformTime)} newer)`,
      };
    } else if (platformTime > squareTime) {
      return {
        field: conflict.field,
        resolvedValue: conflict.platformValue,
        source: 'platform',
        reason: `Platform data is more recent (${this.formatTimeDiff(platformTime - squareTime)} newer)`,
      };
    } else {
      // Same timestamp, default to Square
      return {
        field: conflict.field,
        resolvedValue: conflict.squareValue,
        source: 'square',
        reason: 'Timestamps are equal, defaulting to Square',
      };
    }
  }

  /**
   * Resolve multiple conflicts
   */
  resolveMultiple(conflicts: ConflictData[]): ConflictResolution[] {
    return conflicts.map((conflict) => this.resolve(conflict));
  }

  /**
   * Detect conflicts between Square and Platform data
   */
  detectConflicts(
    squareData: Record<string, any>,
    platformData: Record<string, any>,
    squareUpdatedAt?: Date,
    platformUpdatedAt?: Date
  ): ConflictData[] {
    const conflicts: ConflictData[] = [];

    // Compare all fields
    const allFields = new Set([
      ...Object.keys(squareData),
      ...Object.keys(platformData),
    ]);

    for (const field of allFields) {
      const squareValue = squareData[field];
      const platformValue = platformData[field];

      // Skip if values are equal
      if (this.areValuesEqual(squareValue, platformValue)) {
        continue;
      }

      // Skip if both are null/undefined
      if (
        (squareValue === null || squareValue === undefined) &&
        (platformValue === null || platformValue === undefined)
      ) {
        continue;
      }

      conflicts.push({
        field,
        squareValue,
        platformValue,
        squareUpdatedAt,
        platformUpdatedAt,
      });
    }

    return conflicts;
  }

  /**
   * Check if two values are equal (handles arrays and objects)
   */
  private areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, index) => this.areValuesEqual(val, b[index]));
    }

    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => this.areValuesEqual(a[key], b[key]));
    }

    return false;
  }

  /**
   * Format time difference in human-readable format
   */
  private formatTimeDiff(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  /**
   * Get conflicts requiring manual review
   */
  getManualReviewQueue(): ConflictData[] {
    return [...this.manualReviewQueue];
  }

  /**
   * Clear manual review queue
   */
  clearManualReviewQueue() {
    this.manualReviewQueue = [];
  }

  /**
   * Get conflict statistics
   */
  getStats(resolutions: ConflictResolution[]): {
    total: number;
    squareWins: number;
    platformWins: number;
    manualReview: number;
  } {
    return {
      total: resolutions.length,
      squareWins: resolutions.filter((r) => r.source === 'square').length,
      platformWins: resolutions.filter((r) => r.source === 'platform').length,
      manualReview: resolutions.filter((r) => r.source === 'manual').length,
    };
  }

  /**
   * Apply resolutions to merge data
   */
  applyResolutions(
    baseData: Record<string, any>,
    resolutions: ConflictResolution[]
  ): Record<string, any> {
    const mergedData = { ...baseData };

    for (const resolution of resolutions) {
      mergedData[resolution.field] = resolution.resolvedValue;
    }

    return mergedData;
  }

  /**
   * Log conflict resolution
   */
  logResolution(resolution: ConflictResolution, productName?: string) {
    const prefix = productName ? `[${productName}]` : '';
    console.log(
      `${prefix} Conflict resolved for '${resolution.field}': ` +
        `${resolution.source} wins - ${resolution.reason}`
    );
  }

  /**
   * Log multiple resolutions
   */
  logResolutions(resolutions: ConflictResolution[], productName?: string) {
    if (resolutions.length === 0) {
      console.log(`${productName ? `[${productName}]` : ''} No conflicts detected`);
      return;
    }

    console.log(
      `${productName ? `[${productName}]` : ''} Resolved ${resolutions.length} conflict(s):`
    );
    resolutions.forEach((resolution) => this.logResolution(resolution, ''));
  }
}

/**
 * Create a default conflict resolver instance
 */
export function createConflictResolver(): ConflictResolver {
  return new ConflictResolver();
}

/**
 * Singleton instance
 */
export const conflictResolver = createConflictResolver();
