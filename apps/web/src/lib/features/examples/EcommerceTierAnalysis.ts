/**
 * Example: Ecommerce Tier Feature Analysis
 * 
 * This shows how the FeatureResolver can analyze and consolidate the ecommerce tier features
 */

import { FeatureMigration } from '../FeatureMigration';
import { featureResolver } from '../FeatureResolver';

// Original ecommerce tier features (from your data)
const ECOMMERCE_TIER_FEATURES = [
  "business_logo",
  "google_shopping", 
  "google_merchant_center",
  "basic_product_pages",
  "qr_codes_512",
  "performance_analytics",
  "storefront",
  "product_search",
  "mobile_responsive",
  "enhanced_seo",
  "basic_categories",
  "quick_start_wizard_full",
  "product_scanning",
  "gbp_integration",
  "custom_branding",
  "qr_codes_1024",
  "image_gallery_5",
  "interactive_maps",
  "privacy_mode",
  "custom_marketing_copy",
  "square_sync",
  "clover_sync",
  "quick_start_wizard",
  "manual_entry",
  "manual_barcode",
  "google_sync",
  "category_quick_start",
  "categories",
  "bulk_import",
  "basic_search",
  "payment_client_credentials",
  "commerce_full_payment",
  "commerce_enabled",
  "barcode_scan"
];

// ==================== ANALYSIS ====================

export function analyzeEcommerceTier() {
  console.log('🔍 Ecommerce Tier Feature Analysis\n');
  
  // Basic analysis
  const analysis = FeatureMigration.analyzeTier('ecommerce', ECOMMERCE_TIER_FEATURES);
  
  console.log('📊 Tier Analysis Results:');
  console.log(`  Original features: ${analysis.originalFeatures.length}`);
  console.log(`  Consolidated features: ${analysis.consolidatedFeatures.length}`);
  console.log(`  Legacy features: ${analysis.legacyFeatures.length}`);
  console.log(`  Feature groups: ${analysis.featureGroups.length}`);
  console.log(`  Reduction: ${analysis.reductionCount} features (${analysis.reductionPercentage}%)\n`);
  
  // Show consolidation opportunities
  console.log('🔄 Feature Consolidations:');
  const consolidations = new Map<string, string[]>();
  
  analysis.legacyFeatures.forEach(legacy => {
    const canonical = featureResolver.resolveFeature(legacy);
    if (!consolidations.has(canonical)) {
      consolidations.set(canonical, []);
    }
    consolidations.get(canonical)!.push(legacy);
  });
  
  consolidations.forEach((variants, canonical) => {
    if (variants.length > 1) {
      console.log(`  ${canonical}: ${variants.length} variants`);
      variants.forEach(variant => {
        console.log(`    - ${variant}`);
      });
      console.log('');
    }
  });
  
  // Show consolidated feature list
  console.log('✅ Consolidated Feature List:');
  analysis.consolidatedFeatures.forEach((feature, index) => {
    const featureData = featureResolver.getFeature(feature);
    const isGroup = analysis.featureGroups.includes(feature);
    const marker = isGroup ? '📦' : '🔧';
    console.log(`  ${index + 1}. ${marker} ${feature}`);
    if (featureData) {
      console.log(`     Category: ${featureData.category}`);
      if (featureData.metadata) {
        console.log(`     Metadata: ${JSON.stringify(featureData.metadata, null, 6)}`);
      }
    }
  });
  
  return analysis;
}

export function generateEcommerceMigrationScript() {
  const analysis = FeatureMigration.analyzeTier('ecommerce', ECOMMERCE_TIER_FEATURES);
  return FeatureMigration.createTierMigrationScript(analysis);
}

export function validateEcommerceMigration() {
  // Simulate migration to consolidated features
  const analysis = FeatureMigration.analyzeTier('ecommerce', ECOMMERCE_TIER_FEATURES);
  
  const validation = FeatureMigration.validateMigration(
    ECOMMERCE_TIER_FEATURES,
    analysis.consolidatedFeatures
  );
  
  console.log('\n✅ Migration Validation:');
  console.log(`  Valid: ${validation.isValid}`);
  console.log(`  Missing features: ${validation.missingFeatures.length}`);
  console.log(`  Extra features: ${validation.extraFeatures.length}`);
  console.log(`  Consolidated duplicates: ${validation.consolidatedCount}`);
  
  return validation;
}

// ==================== USAGE EXAMPLES ====================

export function demonstrateFeatureResolver() {
  console.log('🛠️ FeatureResolver Usage Examples\n');
  
  // Example 1: Resolve individual features
  console.log('1️⃣ Individual Feature Resolution:');
  const examples = ['qr_codes_512', 'barcode_scan', 'product_scanning', 'quick_start_wizard_full'];
  examples.forEach(example => {
    const resolved = featureResolver.resolveFeature(example);
    const feature = featureResolver.getFeature(example);
    console.log(`  ${example} → ${resolved}`);
    if (feature) {
      console.log(`    Category: ${feature.category}`);
      console.log(`    Description: ${feature.description}`);
    }
  });
  
  // Example 2: Batch resolution
  console.log('\n2️⃣ Batch Feature Resolution:');
  const batch = ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048', 'barcode_scan', 'product_scanning'];
  const resolved = featureResolver.resolveFeatures(batch);
  const unique = [...new Set(resolved)];
  console.log(`  Original: ${batch.length} features`);
  console.log(`  Resolved: ${resolved.length} features`);
  console.log(`  Unique: ${unique.length} features`);
  console.log(`  Unique features: ${unique.join(', ')}`);
  
  // Example 3: Tier-based metadata
  console.log('\n3️⃣ Tier-Based Metadata:');
  const qrMetadata = featureResolver.getFeatureMetadata('qr_codes', 'ecommerce');
  console.log(`  QR Codes (Ecommerce tier):`);
  console.log(`    Max resolution: ${qrMetadata.maxResolution}`);
  console.log(`    Supported: ${qrMetadata.supportedResolutions?.join(', ')}`);
  
  const professionalMetadata = featureResolver.getFeatureMetadata('qr_codes', 'professional');
  console.log(`  QR Codes (Professional tier):`);
  console.log(`    Max resolution: ${professionalMetadata.maxResolution}`);
  
  // Example 4: Feature groups
  console.log('\n4️⃣ Feature Groups:');
  const marketingTools = featureResolver.getFeatureGroup('marketing_tools');
  if (marketingTools) {
    console.log(`  ${marketingTools.name}:`);
    console.log(`    Description: ${marketingTools.description}`);
    console.log(`    Features: ${marketingTools.features.join(', ')}`);
  }
}

// ==================== EXPORTS ====================

export { ECOMMERCE_TIER_FEATURES };

// Auto-run analysis when imported in development
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Ecommerce Tier Feature Analysis Loaded');
  console.log('Run analyzeEcommerceTier() to see the analysis');
}
