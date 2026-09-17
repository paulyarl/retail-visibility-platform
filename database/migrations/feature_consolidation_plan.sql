-- ========================================
-- Feature Consolidation Migration Plan
-- ========================================
-- 
-- This SQL script provides a safe, phased approach to consolidate
-- redundant features while maintaining data integrity.
-- 
-- RISK MITIGATION:
-- 1. All operations are transactional
-- 2. Backup tables are created before changes
-- 3. Rollback scripts are included
-- 4. Validation queries confirm success
-- ========================================

-- ========================================
-- PHASE 0: PREPARATION & VALIDATION
-- ========================================

-- Create backup of current tier features
CREATE TABLE tier_features_backup_YYYY_MM_DD AS 
SELECT * FROM tier_features;

-- Create feature mapping table for tracking changes
CREATE TABLE feature_migration_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  migration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tier_id VARCHAR(255),
  old_feature_key VARCHAR(255),
  new_feature_key VARCHAR(255),
  operation ENUM('consolidated', 'renamed', 'removed'),
  status ENUM('pending', 'completed', 'failed', 'rolled_back'),
  notes TEXT
);

-- Current state analysis
SELECT 
  t.tierKey,
  COUNT(tf.id) as total_features,
  COUNT(DISTINCT 
    CASE 
      WHEN tf.featureKey LIKE 'qr_codes_%' THEN 'qr_codes'
      WHEN tf.featureKey IN ('barcode_scan', 'product_scanning', 'barcode_scanning') THEN 'barcode_scanning'
      WHEN tf.featureKey LIKE 'quick_start_%' THEN 'quick_setup'
      WHEN tf.featureKey IN ('business_logo', 'custom_branding', 'custom_marketing_copy') THEN 'branding_suite'
      WHEN tf.featureKey IN ('basic_search', 'product_search') THEN 'product_search'
      WHEN tf.featureKey LIKE 'image_gallery_%' THEN 'image_gallery'
      WHEN tf.featureKey IN ('performance_analytics', 'advanced_analytics') THEN 'analytics'
      WHEN tf.featureKey IN ('commerce_full_payment', 'commerce_enabled') THEN 'commerce'
      ELSE tf.featureKey
    END
  ) as unique_features,
  COUNT(*) - COUNT(DISTINCT 
    CASE 
      WHEN tf.featureKey LIKE 'qr_codes_%' THEN 'qr_codes'
      WHEN tf.featureKey IN ('barcode_scan', 'product_scanning', 'barcode_scanning') THEN 'barcode_scanning'
      WHEN tf.featureKey LIKE 'quick_start_%' THEN 'quick_setup'
      WHEN tf.featureKey IN ('business_logo', 'custom_branding', 'custom_marketing_copy') THEN 'branding_suite'
      WHEN tf.featureKey IN ('basic_search', 'product_search') THEN 'product_search'
      WHEN tf.featureKey LIKE 'image_gallery_%' THEN 'image_gallery'
      WHEN tf.featureKey IN ('performance_analytics', 'advanced_analytics') THEN 'analytics'
      WHEN tf.featureKey IN ('commerce_full_payment', 'commerce_enabled') THEN 'commerce'
      ELSE tf.featureKey
    END
  ) as duplicate_count
FROM tiers t
JOIN tier_features tf ON t.id = tf.tierId
GROUP BY t.tierKey
ORDER BY duplicate_count DESC;

-- ========================================
-- PHASE 1: FEATURE CONSOLIDATION (SAFE)
-- ========================================
-- This phase consolidates duplicate features within each tier
-- without removing any functionality

-- Start transaction for safety
START TRANSACTION;

-- Insert migration log entries
INSERT INTO feature_migration_log (tier_id, old_feature_key, new_feature_key, operation, status)
SELECT 
  tf.tierId,
  tf.featureKey,
  CASE 
    WHEN tf.featureKey LIKE 'qr_codes_%' THEN 'qr_codes'
    WHEN tf.featureKey IN ('barcode_scan', 'product_scanning', 'barcode_scanning') THEN 'barcode_scanning'
    WHEN tf.featureKey LIKE 'quick_start_%' THEN 'quick_setup'
    WHEN tf.featureKey IN ('business_logo', 'custom_branding', 'custom_marketing_copy') THEN 'branding_suite'
    WHEN tf.featureKey IN ('basic_search', 'product_search') THEN 'product_search'
    WHEN tf.featureKey LIKE 'image_gallery_%' THEN 'image_gallery'
    WHEN tf.featureKey IN ('performance_analytics', 'advanced_analytics') THEN 'analytics'
    WHEN tf.featureKey IN ('commerce_full_payment', 'commerce_enabled') THEN 'commerce'
    ELSE tf.featureKey
  END as new_key,
  'consolidated',
  'pending'
FROM tier_features tf
WHERE tf.featureKey IN (
  -- QR Codes variants
  'qr_codes_512', 'qr_codes_1024', 'qr_codes_2048',
  -- Barcode variants
  'barcode_scan', 'product_scanning', 'barcode_scanning',
  -- Quick start variants
  'quick_start_wizard', 'quick_start_wizard_full', 'category_quick_start',
  -- Branding variants
  'business_logo', 'custom_branding', 'custom_marketing_copy',
  -- Search variants
  'basic_search',
  -- Gallery variants
  'image_gallery_5', 'image_gallery_10',
  -- Analytics variants
  'performance_analytics', 'advanced_analytics',
  -- Commerce variants
  'commerce_full_payment', 'commerce_enabled'
);

-- Consolidate QR Codes (keep highest resolution per tier)
UPDATE tier_features tf1
SET featureKey = 'qr_codes',
    featureName = 'QR Codes',
    highlightDescription = CASE 
      WHEN tf1.featureKey = 'qr_codes_2048' THEN 'Ultra-high resolution QR codes for professional printing'
      WHEN tf1.featureKey = 'qr_codes_1024' THEN 'High-resolution QR codes for marketing materials'
      ELSE 'Standard QR codes for digital use'
    END
WHERE tf1.id = (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY tierId, 
             CASE 
               WHEN featureKey LIKE 'qr_codes_%' THEN 'qr_codes'
               ELSE featureKey
             END
             ORDER BY 
               CASE featureKey
                 WHEN 'qr_codes_2048' THEN 1
                 WHEN 'qr_codes_1024' THEN 2
                 WHEN 'qr_codes_512' THEN 3
                 ELSE 4
               END
           ) as rn
    FROM tier_features
    WHERE featureKey LIKE 'qr_codes_%'
  ) ranked
  WHERE rn = 1
);

-- Remove duplicate QR codes
DELETE FROM tier_features 
WHERE featureKey LIKE 'qr_codes_%' 
  AND featureKey != 'qr_codes'
  AND id NOT IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY tierId, 'qr_codes'
               ORDER BY 
                 CASE featureKey
                   WHEN 'qr_codes_2048' THEN 1
                   WHEN 'qr_codes_1024' THEN 2
                   WHEN 'qr_codes_512' THEN 3
                   ELSE 4
                 END
             ) as rn
      FROM tier_features
      WHERE featureKey LIKE 'qr_codes_%'
    ) ranked
    WHERE rn = 1
  );

-- Consolidate Barcode Scanning (keep any variant, rename to canonical)
UPDATE tier_features 
SET featureKey = 'barcode_scanning',
    featureName = 'Barcode Scanning'
WHERE featureKey IN ('barcode_scan', 'product_scanning', 'barcode_scanning')
  AND id = (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY tierId ORDER BY id) as rn
      FROM tier_features
      WHERE featureKey IN ('barcode_scan', 'product_scanning', 'barcode_scanning')
    ) ranked
    WHERE rn = 1
  );

-- Remove duplicate barcode features
DELETE FROM tier_features 
WHERE featureKey IN ('barcode_scan', 'product_scanning', 'barcode_scanning')
  AND featureKey != 'barcode_scanning';

-- Consolidate Quick Setup
UPDATE tier_features 
SET featureKey = 'quick_setup',
    featureName = 'Quick Setup'
WHERE featureKey LIKE 'quick_start_%'
  AND id = (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY tierId ORDER BY id) as rn
      FROM tier_features
      WHERE featureKey LIKE 'quick_start_%'
    ) ranked
    WHERE rn = 1
  );

-- Remove duplicate quick start features
DELETE FROM tier_features 
WHERE featureKey LIKE 'quick_start_%' 
  AND featureKey != 'quick_setup';

-- Consolidate Branding Suite
UPDATE tier_features 
SET featureKey = 'branding_suite',
    featureName = 'Branding Suite'
WHERE featureKey IN ('business_logo', 'custom_branding', 'custom_marketing_copy')
  AND id = (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY tierId ORDER BY id) as rn
      FROM tier_features
      WHERE featureKey IN ('business_logo', 'custom_branding', 'custom_marketing_copy')
    ) ranked
    WHERE rn = 1
  );

-- Remove duplicate branding features
DELETE FROM tier_features 
WHERE featureKey IN ('business_logo', 'custom_branding', 'custom_marketing_copy')
  AND featureKey != 'branding_suite';

-- Update migration log status
UPDATE feature_migration_log 
SET status = 'completed'
WHERE status = 'pending';

COMMIT;

-- ========================================
-- PHASE 1 VALIDATION
-- ========================================

-- Verify consolidation results
SELECT 
  'Before' as phase,
  COUNT(*) as total_records
FROM tier_features_backup_YYYY_MM_DD
UNION ALL
SELECT 
  'After' as phase,
  COUNT(*) as total_records
FROM tier_features;

-- Check for any lost functionality
SELECT 
  t.tierKey,
  COUNT(tf.id) as current_features,
  COUNT(bf.id) as backup_features,
  COUNT(bf.id) - COUNT(tf.id) as difference
FROM tiers t
LEFT JOIN tier_features tf ON t.id = tf.tierId
LEFT JOIN tier_features_backup_YYYY_MM_DD bf ON t.id = bf.tierId
GROUP BY t.tierKey
HAVING COUNT(bf.id) - COUNT(tf.id) != 0;

-- ========================================
-- PHASE 2: TIER-SPECIFIC OPTIMIZATION
-- ========================================
-- This phase optimizes feature metadata based on tier capabilities

START TRANSACTION;

-- Update QR codes metadata based on tier
UPDATE tier_features tf
JOIN tiers t ON tf.tierId = t.id
SET tf.highlightDescription = CASE
  WHEN t.tierKey IN ('enterprise', 'professional', 'omnichannel') THEN 
    'Ultra-high resolution QR codes (2048px) for professional printing and marketing'
  WHEN t.tierKey IN ('commitment', 'ecommerce') THEN 
    'High-resolution QR codes (1024px) for marketing materials'
  ELSE 
    'Standard QR codes (512px) for digital use'
END,
tf.highlightOrder = CASE
  WHEN t.tierKey IN ('enterprise', 'professional', 'omnichannel') THEN 2
  WHEN t.tierKey IN ('commitment', 'ecommerce') THEN 3
  ELSE 4
END
WHERE tf.featureKey = 'qr_codes';

-- Update branding suite metadata
UPDATE tier_features tf
JOIN tiers t ON tf.tierId = t.id
SET tf.highlightDescription = CASE
  WHEN t.tierKey IN ('enterprise', 'professional', 'omnichannel') THEN 
    'Complete branding suite with logo, custom colors, marketing copy, and advanced customization'
  WHEN t.tierKey IN ('commitment', 'ecommerce') THEN 
    'Professional branding with logo, custom colors, and marketing copy'
  ELSE 
    'Basic branding with logo and custom colors'
END
WHERE tf.featureKey = 'branding_suite';

COMMIT;

-- ========================================
-- PHASE 3: CLEANUP (OPTIONAL)
-- ========================================
-- Only run after full migration is complete and validated

-- This phase can be run later to clean up any remaining legacy references
-- Uncomment when ready for final cleanup

/*
START TRANSACTION;

-- Remove any remaining legacy features that weren't consolidated
DELETE FROM tier_features 
WHERE featureKey IN (
  'basic_search', 'image_gallery_5', 'image_gallery_10',
  'performance_analytics', 'advanced_analytics',
  'commerce_full_payment', 'commerce_enabled'
)
AND featureKey NOT IN (
  SELECT DISTINCT featureKey FROM tier_features_backup_YYYY_MM_DD
  WHERE featureKey IN (
    'qr_codes', 'barcode_scanning', 'quick_setup', 'branding_suite',
    'product_search', 'image_gallery', 'analytics', 'commerce'
  )
);

-- Update feature names to canonical naming
UPDATE tier_features 
SET featureName = CASE featureKey
  WHEN 'product_search' THEN 'Product Search'
  WHEN 'image_gallery' THEN 'Image Gallery'
  WHEN 'analytics' THEN 'Performance Analytics'
  WHEN 'commerce' THEN 'E-commerce'
  ELSE featureName
END
WHERE featureKey IN ('product_search', 'image_gallery', 'analytics', 'commerce');

COMMIT;
*/

-- ========================================
-- ROLLBACK SCRIPT
-- ========================================
-- In case of issues, use this to restore original state

/*
-- Rollback to backup
START TRANSACTION;

-- Drop current features
DELETE FROM tier_features;

-- Restore from backup
INSERT INTO tier_features 
SELECT * FROM tier_features_backup_YYYY_MM_DD;

-- Drop migration log
DROP TABLE feature_migration_log;

COMMIT;
*/

-- ========================================
-- FINAL VALIDATION QUERY
-- ========================================

-- Run this to verify migration success
SELECT 
  'Migration Summary' as metric,
  COUNT(DISTINCT tf.tierId) as tiers_affected,
  COUNT(tf.id) as final_feature_count,
  (SELECT COUNT(*) FROM tier_features_backup_YYYY_MM_DD) as original_count,
  (SELECT COUNT(*) FROM tier_features_backup_YYYY_MM_DD) - COUNT(tf.id) as features_removed,
  ROUND(
    ((SELECT COUNT(*) FROM tier_features_backup_YYYY_MM_DD) - COUNT(tf.id)) * 100.0 / 
    (SELECT COUNT(*) FROM tier_features_backup_YYYY_MM_DD), 
    2
  ) as reduction_percentage
FROM tier_features tf
UNION ALL
SELECT 
  'Consolidated Groups' as metric,
  COUNT(DISTINCT featureKey) as value,
  0, 0, 0, 0
FROM tier_features
WHERE featureKey IN ('qr_codes', 'barcode_scanning', 'quick_setup', 'branding_suite');
