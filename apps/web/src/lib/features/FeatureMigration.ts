/**
 * Feature Migration Utility
 * 
 * Tools for safely migrating from legacy feature keys to consolidated canonical features
 */

import { featureResolver, type FeatureCapability } from './FeatureResolver';

// ==================== MIGRATION ANALYSIS ====================

export interface FeatureAnalysis {
  originalKey: string;
  canonicalKey: string;
  isConsolidated: boolean;
  featureExists: boolean;
  category?: string;
  duplicates?: string[];
}

export interface TierAnalysis {
  tierKey: string;
  originalFeatures: string[];
  consolidatedFeatures: string[];
  legacyFeatures: string[];
  duplicateFeatures: string[];
  featureGroups: string[];
  reductionCount: number;
  reductionPercentage: number;
}

export class FeatureMigration {
  /**
   * Analyze a single feature for migration
   */
  static analyzeFeature(featureKey: string): FeatureAnalysis {
    const canonical = featureResolver.resolveFeature(featureKey);
    const feature = featureResolver.getFeature(featureKey);
    
    return {
      originalKey: featureKey,
      canonicalKey: canonical,
      isConsolidated: canonical !== featureKey,
      featureExists: !!feature,
      category: feature?.category,
      duplicates: this.findDuplicates(featureKey)
    };
  }

  /**
   * Find duplicate or related features
   */
  static findDuplicates(featureKey: string): string[] {
    const canonical = featureResolver.resolveFeature(featureKey);
    const duplicates: string[] = [];

    // Known duplicate patterns
    const duplicatePatterns: Record<string, string[]> = {
      'qr_codes': ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048'],
      'barcode_scanning': ['barcode_scan', 'product_scanning', 'barcode_scanning'],
      'quick_setup': ['quick_start_wizard', 'quick_start_wizard_full', 'category_quick_start'],
      'branding_suite': ['business_logo', 'custom_branding', 'custom_marketing_copy'],
      'product_search': ['basic_search'],
      'image_gallery': ['image_gallery_5', 'image_gallery_10'],
      'analytics': ['performance_analytics', 'advanced_analytics'],
      'commerce': ['commerce_full_payment', 'commerce_enabled']
    };

    return duplicatePatterns[canonical] || [];
  }

  /**
   * Analyze a tier's feature list for migration
   */
  static analyzeTier(tierKey: string, features: string[]): TierAnalysis {
    const analysis = featureResolver.getTierFeatures(features);
    
    return {
      tierKey,
      originalFeatures: features,
      consolidatedFeatures: analysis.consolidated,
      legacyFeatures: analysis.legacy,
      duplicateFeatures: this.findDuplicateFeatures(features),
      featureGroups: analysis.groups,
      reductionCount: features.length - analysis.consolidated.length,
      reductionPercentage: Math.round(
        ((features.length - analysis.consolidated.length) / features.length) * 100
      )
    };
  }

  /**
   * Find duplicate features in a feature list
   */
  static findDuplicateFeatures(features: string[]): string[] {
    const resolved = features.map(f => featureResolver.resolveFeature(f));
    const duplicates: string[] = [];
    const seen = new Set<string>();

    resolved.forEach((canonical, index) => {
      if (seen.has(canonical)) {
        duplicates.push(features[index]);
      } else {
        seen.add(canonical);
      }
    });

    return duplicates;
  }

  /**
   * Generate migration report for multiple tiers
   */
  static generateMigrationReport(tiers: Record<string, string[]>): {
    summary: {
      totalTiers: number;
      totalOriginalFeatures: number;
      totalConsolidatedFeatures: number;
      overallReduction: number;
      overallReductionPercentage: number;
    };
    tierAnalyses: TierAnalysis[];
    consolidationGroups: Record<string, string[]>;
    recommendations: string[];
  } {
    const tierAnalyses = Object.entries(tiers).map(([tierKey, features]) => 
      this.analyzeTier(tierKey, features)
    );

    const totalOriginalFeatures = tierAnalyses.reduce(
      (sum, analysis) => sum + analysis.originalFeatures.length, 0
    );
    const totalConsolidatedFeatures = tierAnalyses.reduce(
      (sum, analysis) => sum + analysis.consolidatedFeatures.length, 0
    );

    // Identify consolidation opportunities
    const consolidationGroups: Record<string, string[]> = {};
    tierAnalyses.forEach(analysis => {
      analysis.legacyFeatures.forEach(feature => {
        const canonical = featureResolver.resolveFeature(feature);
        if (!consolidationGroups[canonical]) {
          consolidationGroups[canonical] = [];
        }
        if (!consolidationGroups[canonical].includes(feature)) {
          consolidationGroups[canonical].push(feature);
        }
      });
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(tierAnalyses, consolidationGroups);

    return {
      summary: {
        totalTiers: tierAnalyses.length,
        totalOriginalFeatures,
        totalConsolidatedFeatures,
        overallReduction: totalOriginalFeatures - totalConsolidatedFeatures,
        overallReductionPercentage: Math.round(
          ((totalOriginalFeatures - totalConsolidatedFeatures) / totalOriginalFeatures) * 100
        )
      },
      tierAnalyses,
      consolidationGroups,
      recommendations
    };
  }

  /**
   * Generate migration recommendations
   */
  static generateRecommendations(
    tierAnalyses: TierAnalysis[],
    consolidationGroups: Record<string, string[]>
  ): string[] {
    const recommendations: string[] = [];

    // High-impact consolidations
    const highImpactGroups = Object.entries(consolidationGroups)
      .filter(([_, variants]) => variants.length > 2)
      .map(([canonical, variants]) => ({ canonical, variants }))
      .sort((a, b) => b.variants.length - a.variants.length);

    if (highImpactGroups.length > 0) {
      recommendations.push(
        `🎯 High-Impact Consolidations: ${highImpactGroups.length} feature groups with ${highImpactGroups.reduce((sum, g) => sum + g.variants.length, 0)} total variants`
      );
      
      highImpactGroups.slice(0, 3).forEach(({ canonical, variants }) => {
        recommendations.push(
          `  • ${canonical}: ${variants.length} variants (${variants.join(', ')})`
        );
      });
    }

    // Tier-specific recommendations
    const highReductionTiers = tierAnalyses
      .filter(analysis => analysis.reductionPercentage > 30)
      .sort((a, b) => b.reductionPercentage - a.reductionPercentage);

    if (highReductionTiers.length > 0) {
      recommendations.push(
        `📊 High-Reduction Tiers: ${highReductionTiers.length} tiers could reduce features by >30%`
      );
      
      highReductionTiers.slice(0, 3).forEach(analysis => {
        recommendations.push(
          `  • ${analysis.tierKey}: ${analysis.reductionPercentage}% reduction (${analysis.reductionCount} fewer features)`
        );
      });
    }

    // Migration strategy recommendations
    recommendations.push('🔄 Migration Strategy:');
    recommendations.push('  1. Start with FeatureResolver integration (zero breaking changes)');
    recommendations.push('  2. Update tier definitions to use canonical features');
    recommendations.push('  3. Gradually migrate component references');
    recommendations.push('  4. Remove legacy mappings after full migration');

    return recommendations;
  }

  /**
   * Create migration script for a specific tier
   */
  static createTierMigrationScript(analysis: TierAnalysis): string {
    const { tierKey, originalFeatures, consolidatedFeatures, legacyFeatures } = analysis;
    
    let script = `// Migration Script for ${tierKey}\n`;
    script += `// Original: ${originalFeatures.length} features\n`;
    script += `// Consolidated: ${consolidatedFeatures.length} features\n`;
    script += `// Reduction: ${analysis.reductionCount} features (${analysis.reductionPercentage}%)\n\n`;
    
    script += `// Original features:\n`;
    script += `const originalFeatures = ${JSON.stringify(originalFeatures, null, 2)};\n\n`;
    
    script += `// Consolidated features:\n`;
    script += `const consolidatedFeatures = ${JSON.stringify(consolidatedFeatures, null, 2)};\n\n`;
    
    if (legacyFeatures.length > 0) {
      script += `// Legacy mappings (for backward compatibility):\n`;
      script += `const legacyMappings = {\n`;
      legacyFeatures.forEach(legacy => {
        const canonical = featureResolver.resolveFeature(legacy);
        script += `  '${legacy}': '${canonical}',\n`;
      });
      script += `};\n\n`;
    }
    
    if (analysis.featureGroups.length > 0) {
      script += `// Feature groups enabled:\n`;
      script += `const featureGroups = ${JSON.stringify(analysis.featureGroups, null, 2)};\n\n`;
    }
    
    script += `// Usage in code:\n`;
    script += `// import { featureResolver } from '@/lib/features/FeatureResolver';\n`;
    script += `// const resolved = featureResolver.resolveFeatures(originalFeatures);\n`;
    script += `// const unique = [...new Set(resolved)];\n`;
    
    return script;
  }

  /**
   * Validate migration completeness
   */
  static validateMigration(
    originalFeatures: string[],
    migratedFeatures: string[]
  ): {
    isValid: boolean;
    missingFeatures: string[];
    extraFeatures: string[];
    consolidatedCount: number;
  } {
    const resolvedOriginal = featureResolver.resolveFeatures(originalFeatures);
    const resolvedMigrated = featureResolver.resolveFeatures(migratedFeatures);
    
    const missingFeatures = resolvedOriginal.filter(f => !resolvedMigrated.includes(f));
    const extraFeatures = resolvedMigrated.filter(f => !resolvedOriginal.includes(f));
    const consolidatedCount = resolvedOriginal.length - [...new Set(resolvedOriginal)].length;
    
    return {
      isValid: missingFeatures.length === 0 && extraFeatures.length === 0,
      missingFeatures,
      extraFeatures,
      consolidatedCount
    };
  }
}

// ==================== CONSOLE EXPORTS ====================

// Export for use in console/debugging
if (typeof window !== 'undefined') {
  (window as any).featureMigration = FeatureMigration;
  (window as any).featureResolver = featureResolver;
}
