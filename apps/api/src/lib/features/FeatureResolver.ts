/**
 * API Feature Resolver - Backend counterpart to web FeatureResolver
 * 
 * This mirrors the web resolver but is optimized for:
 * - Database operations
 * - API responses
 * - Server-side validation
 */

// ==================== SHARED TYPES ====================

export interface FeatureCapability {
  key: string;
  name: string;
  description: string;
  category: string;
  metadata?: Record<string, any>;
}

export interface TierFeatureRecord {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  isInherited: boolean;
  isHighlighted?: boolean;
  highlightOrder?: number;
  highlightDescription?: string | null;
  marketingName?: string | null;
}

// ==================== CANONICAL DEFINITIONS (API VERSION) ====================

// These should match the web version exactly - consider moving to shared package
const CANONICAL_FEATURES: Record<string, FeatureCapability> = {
  'qr_codes': {
    key: 'qr_codes',
    name: 'QR Codes',
    description: 'Generate QR codes for products and storefront',
    category: 'marketing',
    metadata: {
      supportedResolutions: ['512', '1024', '2048'],
      defaultResolution: '512'
    }
  },
  'barcode_scanning': {
    key: 'barcode_scanning',
    name: 'Barcode Scanning',
    description: 'Scan barcodes to automatically add products',
    category: 'inventory',
    metadata: {
      autoFill: true,
      imageRecognition: true
    }
  },
  'quick_setup': {
    key: 'quick_setup',
    name: 'Quick Setup',
    description: 'Guided setup for products and categories',
    category: 'onboarding',
    metadata: {
      fullAccess: true,
      categorySetup: true
    }
  },
  'branding_suite': {
    key: 'branding_suite',
    name: 'Branding Suite',
    description: 'Complete branding customization',
    category: 'branding',
    metadata: {
      logo: true,
      customColors: true,
      customFonts: false,
      marketingCopy: true
    }
  },
  // ... other canonical features (same as web version)
};

// ==================== LEGACY MAPPING ====================

const LEGACY_FEATURE_MAP: Record<string, string> = {
  // QR Codes consolidation
  'qr_codes_512': 'qr_codes',
  'qr_codes_1024': 'qr_codes',
  'qr_codes_2048': 'qr_codes',
  
  // Barcode scanning consolidation
  'barcode_scan': 'barcode_scanning',
  'product_scanning': 'barcode_scanning',
  'barcode_scanning': 'barcode_scanning',
  
  // Quick start consolidation
  'quick_start_wizard': 'quick_setup',
  'quick_start_wizard_full': 'quick_setup',
  'category_quick_start': 'quick_setup',
  
  // Branding consolidation
  'business_logo': 'branding_suite',
  'custom_branding': 'branding_suite',
  'custom_marketing_copy': 'branding_suite',
  
  // ... other mappings (same as web version)
};

// ==================== API FEATURE RESOLVER ====================

export class ApiFeatureResolver {
  private static instance: ApiFeatureResolver;
  private cache = new Map<string, any>();

  static getInstance(): ApiFeatureResolver {
    if (!ApiFeatureResolver.instance) {
      ApiFeatureResolver.instance = new ApiFeatureResolver();
    }
    return ApiFeatureResolver.instance;
  }

  /**
   * Resolve database feature records to canonical form
   */
  resolveTierFeatures(tierFeatures: TierFeatureRecord[]): TierFeatureRecord[] {
    const resolved = new Map<string, TierFeatureRecord>();
    
    tierFeatures.forEach(feature => {
      const canonicalKey = this.resolveFeature(feature.featureKey);
      
      if (!resolved.has(canonicalKey)) {
        // Create resolved feature record
        const resolvedFeature: TierFeatureRecord = {
          ...feature,
          featureKey: canonicalKey,
          featureName: CANONICAL_FEATURES[canonicalKey]?.name || feature.featureName
        };
        
        // Merge metadata from canonical definition
        const canonical = CANONICAL_FEATURES[canonicalKey];
        if (canonical?.metadata) {
          // Store metadata in a way that survives database round trips
          resolvedFeature.marketingName = resolvedFeature.marketingName || 
            `${canonical.name} - ${this.formatMetadata(canonical.metadata)}`;
        }
        
        resolved.set(canonicalKey, resolvedFeature);
      } else {
        // Merge highlight information from duplicates
        const existing = resolved.get(canonicalKey)!;
        if (feature.isHighlighted && !existing.isHighlighted) {
          existing.isHighlighted = true;
          existing.highlightOrder = feature.highlightOrder;
          existing.highlightDescription = feature.highlightDescription;
        }
      }
    });
    
    return Array.from(resolved.values());
  }

  /**
   * Resolve a single feature key
   */
  resolveFeature(featureKey: string): string {
    if (this.cache.has(featureKey)) {
      return this.cache.get(featureKey);
    }

    let resolved = featureKey;
    
    // Check legacy mapping
    if (LEGACY_FEATURE_MAP[featureKey]) {
      resolved = LEGACY_FEATURE_MAP[featureKey];
    }
    
    this.cache.set(featureKey, resolved);
    return resolved;
  }

  /**
   * Prepare tier features for API response
   */
  prepareForApiResponse(tierFeatures: TierFeatureRecord[], tierKey?: string): TierFeatureRecord[] {
    const resolved = this.resolveTierFeatures(tierFeatures);
    
    // Apply tier-specific metadata
    if (tierKey) {
      return resolved.map(feature => {
        const canonical = CANONICAL_FEATURES[feature.featureKey];
        if (canonical?.metadata) {
          const tierMetadata = this.getTierMetadata(feature.featureKey, tierKey);
          
          // Update marketing name with tier-specific info
          if (tierMetadata.maxResolution && feature.featureKey === 'qr_codes') {
            feature.marketingName = `${canonical.name} (${tierMetadata.maxResolution}px)`;
          } else if (tierMetadata.maxImages && feature.featureKey === 'image_gallery') {
            feature.marketingName = `${canonical.name} (${tierMetadata.maxImages} images)`;
          }
        }
        return feature;
      });
    }
    
    return resolved;
  }

  /**
   * Get tier-specific metadata
   */
  private getTierMetadata(featureKey: string, tierKey: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    switch (featureKey) {
      case 'qr_codes':
        if (tierKey.includes('enterprise')) {
          metadata.maxResolution = '2048';
        } else if (tierKey.includes('professional') || tierKey.includes('omnichannel')) {
          metadata.maxResolution = '1024';
        } else if (tierKey.includes('commitment') || tierKey.includes('ecommerce')) {
          metadata.maxResolution = '1024';
        } else {
          metadata.maxResolution = '512';
        }
        break;
        
      case 'image_gallery':
        if (tierKey.includes('enterprise') || tierKey.includes('professional')) {
          metadata.maxImages = 10;
        } else {
          metadata.maxImages = 5;
        }
        break;
    }
    
    return metadata;
  }

  /**
   * Format metadata for display
   */
  private formatMetadata(metadata: Record<string, any>): string {
    const parts: string[] = [];
    
    if (metadata.supportedResolutions) {
      parts.push(`${metadata.supportedResolutions.length} sizes`);
    }
    if (metadata.autoFill) {
      parts.push('auto-fill');
    }
    if (metadata.maxImages) {
      parts.push(`up to ${metadata.maxImages} images`);
    }
    
    return parts.join(', ');
  }

  /**
   * Validate feature list for database operations
   */
  validateFeatureList(features: string[]): {
    valid: string[];
    invalid: string[];
    resolved: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];
    const resolved: string[] = [];
    
    features.forEach(feature => {
      const canonical = this.resolveFeature(feature);
      resolved.push(canonical);
      
      if (CANONICAL_FEATURES[canonical]) {
        valid.push(feature);
      } else {
        invalid.push(feature);
      }
    });
    
    return { valid, invalid, resolved };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ==================== MIDDLEWARE INTEGRATION ====================

export const apiFeatureResolver = ApiFeatureResolver.getInstance();

// Express middleware for feature resolution
export function featureResolutionMiddleware(req: any, res: any, next: any) {
  // Add resolver to request for use in routes
  req.featureResolver = apiFeatureResolver;
  next();
}

// Database helper functions
export class DatabaseFeatureHelper {
  /**
   * Migrate tier features in database
   */
  static async migrateTierFeatures(
    tierId: string,
    connection: any
  ): Promise<{
    before: number;
    after: number;
    migrated: string[];
    removed: string[];
  }> {
    // Get current features
    const currentFeatures = await connection.query(
      'SELECT featureKey FROM tier_features WHERE tierId = ?',
      [tierId]
    );
    
    const resolver = apiFeatureResolver;
    const resolved = resolver.resolveTierFeatures(currentFeatures);
    
    // Create migration plan
    const toKeep = resolved.map(f => f.featureKey);
    
    // Define interface for current feature objects
    interface CurrentFeature {
      featureKey: string;
    }
    
    const toRemove = currentFeatures
      .filter((f: CurrentFeature) => !toKeep.includes(resolver.resolveFeature(f.featureKey)))
      .map((f: CurrentFeature) => f.featureKey);
    
    // Execute migration (in transaction)
    await connection.beginTransaction();
    
    try {
      // Remove duplicates/legacy features
      if (toRemove.length > 0) {
        await connection.query(
          'DELETE FROM tier_features WHERE tierId = ? AND featureKey IN (?)',
          [tierId, toRemove]
        );
      }
      
      // Update remaining features to canonical keys
      for (const feature of currentFeatures) {
        const canonical = resolver.resolveFeature(feature.featureKey);
        if (canonical !== feature.featureKey) {
          await connection.query(
            'UPDATE tier_features SET featureKey = ? WHERE tierId = ? AND featureKey = ?',
            [canonical, tierId, feature.featureKey]
          );
        }
      }
      
      await connection.commit();
      
      return {
        before: currentFeatures.length,
        after: toKeep.length,
        migrated: toRemove,
        removed: toRemove
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
}
