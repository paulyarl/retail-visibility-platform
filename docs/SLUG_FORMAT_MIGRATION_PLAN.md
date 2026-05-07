# Slug Format Migration Plan

## Overview
Migrate product slugs to the new underscore-based format for reliable product comparison across the platform.

## Rules Reference

### UPC Products
```
upc_{brand}_{category}_{upc-code}_{name-hash}
```
- `_` = part boundary (underscore)
- `brand` = may contain bonded words with hyphens (e.g., `general-mills`)
- `category` = may contain bonded words with hyphens (e.g., `ready-to-eat-cereal`)
- `upc-code` = UPC digits only (keep as string)
- `name-hash` = stable 8-char hash of product name

**Example**: `upc_general-mills_ready-to-eat-cereal_001234567890_a1b2c3d4`

### LPC Products
```
lpc_{sku}_{category}_{item-id}_{name-hash}
```
- `_` = part boundary (underscore)
- `sku` = universal SKU (may contain hyphens, keep them)
- `category` = may contain bonded words with hyphens
- `item-id` = the row's ID or original SKU
- `name-hash` = stable 8-char hash of product name

**Example**: `lpc_VS-FRO-BIR-225153_frozen-foods_qsid-1766436467819_3a42c2`

## Critical Implementation Notes

### 1. Bonded Word Preservation
**CORRECT**: Keep hyphens in brand and category names
```sql
-- Brand: "General Mills" → "general-mills" (NOT "general_mills")
-- Category: "Ready-to-Eat Cereal" → "ready-to-eat-cereal" (NOT "ready_to_eat_cereal")
```

**INCORRECT**: Replacing all hyphens with underscores
```sql
-- WRONG: REPLACE(brand, '-', '_')
-- This breaks bonded word tokens
```

### 2. Name Hash Consistency
Use the same hash algorithm for both UPC and LPC:
```sql
substring(md5(lower(coalesce(name, ''))) from 1 for 8)
```

### 3. Underscore as Part Boundary
Underscores ONLY separate the 5 major parts:
- Type (upc/lpc)
- Identifier (brand for UPC, SKU for LPC)
- Category
- Item ID (for LPC) or UPC code
- Name hash

## Phase 1: Schema Analysis & Preparation

### Task 1.1: Verify Current Schema
- [ ] Check if `slug_type` and `slug_prefix` columns exist in database
- [ ] Verify `category_path` data structure in source tables
- [ ] Identify all tables using product slugs
- [ ] Map current slug format patterns

### Task 1.2: Schema Migration
```sql
-- Add new columns for migration tracking
ALTER TABLE product_slug_registry 
ADD COLUMN IF NOT EXISTS format_version VARCHAR(10) DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS slug_components JSONB,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS migration_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS slug_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS slug_prefix VARCHAR(10);

-- Add index for migration queries
CREATE INDEX IF NOT EXISTS idx_slug_registry_migration 
ON product_slug_registry(migration_status, format_version);
```

### Task 1.3: Test Data Extraction
```sql
-- Test extraction from inventory_items
SELECT 
  id,
  name,
  brand,
  sku,
  gtin,
  category_path,
  -- Test UPC slug generation
  CASE 
    WHEN gtin IS NOT NULL AND length(trim(gtin)) >= 6 THEN
      'upc_' || 
      regexp_replace(lower(coalesce(brand, 'unknown')), '[^a-z0-9-]+', '-', 'g') || '_' ||
      regexp_replace(lower(coalesce(array_to_string(category_path, 'general'), 'general')), '[^a-z0-9-]+', '-', 'g') || '_' ||
      trim(gtin) || '_' ||
      substring(md5(lower(coalesce(name, ''))) from 1 for 8)
    ELSE
      'lpc_' || 
      coalesce(sku, 'unknown') || '_' ||
      regexp_replace(lower(coalesce(array_to_string(category_path, 'general'), 'general')), '[^a-z0-9-]+', '-', 'g') || '_' ||
      id || '_' ||
      substring(md5(lower(coalesce(name, ''))) from 1 for 8)
  END AS new_slug
FROM inventory_items
LIMIT 10;
```

## Phase 2: Function Development

### Task 2.1: Slug Generation Functions
```sql
-- Generate LPC slug with bonded word preservation
CREATE OR REPLACE FUNCTION generate_lpc_slug(
  p_sku TEXT,
  p_category TEXT,
  p_item_id TEXT,
  p_name TEXT
) RETURNS TEXT AS $$
DECLARE
  v_category_slug TEXT;
  v_name_hash TEXT;
BEGIN
  -- Convert category to slug token (preserve hyphens in bonded words)
  v_category_slug := trim(both '-' from 
    regexp_replace(lower(p_category), '[^a-z0-9-]+', '-', 'g')
  );
  
  -- Generate stable name hash
  v_name_hash := substring(md5(lower(coalesce(p_name, ''))) from 1 for 8);
  
  RETURN FORMAT('lpc_%s_%s_%s_%s',
    p_sku,
    v_category_slug,
    p_item_id,
    v_name_hash
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate UPC slug with bonded word preservation
CREATE OR REPLACE FUNCTION generate_upc_slug(
  p_brand TEXT,
  p_category TEXT,
  p_upc_code TEXT,
  p_name TEXT
) RETURNS TEXT AS $$
DECLARE
  v_brand_slug TEXT;
  v_category_slug TEXT;
  v_name_hash TEXT;
BEGIN
  -- Convert brand to slug token (preserve hyphens in bonded words)
  v_brand_slug := trim(both '-' from 
    regexp_replace(lower(coalesce(p_brand, 'unknown')), '[^a-z0-9-]+', '-', 'g')
  );
  
  -- Convert category to slug token
  v_category_slug := trim(both '-' from 
    regexp_replace(lower(p_category), '[^a-z0-9-]+', '-', 'g')
  );
  
  -- Generate stable name hash
  v_name_hash := substring(md5(lower(coalesce(p_name, ''))) from 1 for 8);
  
  RETURN FORMAT('upc_%s_%s_%s_%s',
    v_brand_slug,
    v_category_slug,
    p_upc_code,
    v_name_hash
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Task 2.2: Component Parsing Function
```sql
-- Parse slug into components respecting 5-part structure
CREATE OR REPLACE FUNCTION parse_slug_components(p_slug TEXT)
RETURNS JSONB AS $$
DECLARE
  v_type TEXT;
  v_parts TEXT[];
BEGIN
  -- Extract type (first part)
  v_type := split_part(p_slug, '_', 1);
  
  -- Split by underscore
  v_parts := string_to_array(p_slug, '_');
  
  -- Build components object based on type
  IF v_type = 'lpc' THEN
    RETURN jsonb_build_object(
      'type', v_parts[1],
      'sku', v_parts[2],
      'category', v_parts[3],
      'item_id', v_parts[4],
      'name_hash', v_parts[5]
    );
  ELSIF v_type = 'upc' THEN
    RETURN jsonb_build_object(
      'type', v_parts[1],
      'brand', v_parts[2],
      'category', v_parts[3],
      'upc_code', v_parts[4],
      'name_hash', v_parts[5]
    );
  ELSE
    RETURN jsonb_build_object('error', 'unknown_slug_type');
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Task 2.3: Comparison Functions
```sql
-- Compare two registry entries
CREATE OR REPLACE FUNCTION compare_registry_products(
  p_registry_id_1 VARCHAR(255),
  p_registry_id_2 VARCHAR(255)
) RETURNS JSONB AS $$
DECLARE
  v_comp1 JSONB;
  v_comp2 JSONB;
  v_similarity_score INTEGER := 0;
BEGIN
  -- Get components for both products
  SELECT parse_slug_components(product_slug) INTO v_comp1
  FROM product_slug_registry WHERE id = p_registry_id_1;
  
  SELECT parse_slug_components(product_slug) INTO v_comp2
  FROM product_slug_registry WHERE id = p_registry_id_2;
  
  IF v_comp1 IS NULL OR v_comp2 IS NULL THEN
    RETURN jsonb_build_object('error', 'product_not_found');
  END IF;
  
  -- Calculate similarity score (0-100)
  IF v_comp1->>'type' = v_comp2->>'type' THEN v_similarity_score := v_similarity_score + 20; END IF;
  IF v_comp1->>'category' = v_comp2->>'category' THEN v_similarity_score := v_similarity_score + 30; END IF;
  
  -- For LPC: compare SKU
  IF v_comp1->>'type' = 'lpc' AND v_comp1->>'sku' = v_comp2->>'sku' THEN
    v_similarity_score := v_similarity_score + 40;
  END IF;
  
  -- For UPC: compare brand and UPC
  IF v_comp1->>'type' = 'upc' THEN
    IF v_comp1->>'brand' = v_comp2->>'brand' THEN v_similarity_score := v_similarity_score + 20; END IF;
    IF v_comp1->>'upc_code' = v_comp2->>'upc_code' THEN v_similarity_score := v_similarity_score + 20; END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'exact_match', v_comp1 = v_comp2,
    'category_match', v_comp1->>'category' = v_comp2->>'category',
    'type_match', v_comp1->>'type' = v_comp2->>'type',
    'similarity_score', v_similarity_score,
    'match_type', CASE
      WHEN v_comp1 = v_comp2 THEN 'exact'
      WHEN v_similarity_score >= 70 THEN 'partial'
      WHEN v_comp1->>'category' = v_comp2->>'category' THEN 'category'
      ELSE 'none'
    END
  );
END;
$$ LANGUAGE plpgsql;
```

## Phase 3: Trigger Implementation

### Task 3.1: Create Migration-Safe Trigger
```sql
-- Trigger for new slug format (backward compatible)
CREATE OR REPLACE FUNCTION product_slug_registry_trigger_v2()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not provided
  IF NEW.product_slug IS NULL OR NEW.product_slug = '' THEN
    -- Determine slug type from data
    IF NEW.universal_sku IS NOT NULL THEN
      -- LPC product
      NEW.slug_type := 'lpc';
      NEW.slug_prefix := 'lpc';
      -- Note: Category and name need to be fetched from source tables
      -- This will be handled by the backfill process
    END IF;
    
    NEW.format_version := 'v2';
    NEW.migration_status := 'generated';
  END IF;
  
  -- Parse and store components
  IF NEW.product_slug IS NOT NULL THEN
    NEW.slug_components := parse_slug_components(NEW.product_slug);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Phase 4: Backfill Migration

### Task 4.1: Backfill from inventory_items
```sql
-- Backfill product_slug_registry from inventory_items
INSERT INTO product_slug_registry (
  id,
  product_slug,
  universal_sku,
  tenant_id,
  original_sku,
  slug_type,
  slug_prefix,
  format_version,
  slug_components,
  migration_status,
  is_active
)
SELECT 
  'psr-' || gen_random_uuid()::text,
  CASE 
    WHEN gtin IS NOT NULL AND length(trim(gtin)) >= 6 THEN
      generate_upc_slug(brand, array_to_string(category_path, '-'), trim(gtin), name)
    ELSE
      generate_lpc_slug(sku, array_to_string(category_path, '-'), id, name)
  END,
  sku,
  tenant_id,
  sku,
  CASE WHEN gtin IS NOT NULL THEN 'upc' ELSE 'lpc' END,
  CASE WHEN gtin IS NOT NULL THEN 'upc' ELSE 'lpc' END,
  'v2',
  parse_slug_components(
    CASE 
      WHEN gtin IS NOT NULL THEN generate_upc_slug(brand, array_to_string(category_path, '-'), trim(gtin), name)
      ELSE generate_lpc_slug(sku, array_to_string(category_path, '-'), id, name)
    END
  ),
  'backfilled',
  true
FROM inventory_items
WHERE NOT EXISTS (
  SELECT 1 FROM product_slug_registry psr 
  WHERE psr.original_sku = inventory_items.sku
    AND psr.tenant_id = inventory_items.tenant_id
)
ON CONFLICT (product_slug) DO NOTHING;
```

## Phase 5: Testing & Validation

### Task 5.1: Validation Queries
```sql
-- Check migration status
SELECT 
  format_version,
  migration_status,
  slug_type,
  COUNT(*) as count
FROM product_slug_registry
GROUP BY format_version, migration_status, slug_type;

-- Validate slug format compliance
SELECT 
  id,
  product_slug,
  CASE 
    WHEN product_slug ~ '^lpc_[^_]+_[^_]+_[^_]+_[a-f0-9]{8}$' THEN 'valid_lpc'
    WHEN product_slug ~ '^upc_[^_]+_[^_]+_[^_]+_[a-f0-9]{8}$' THEN 'valid_upc'
    ELSE 'invalid'
  END as validation_status
FROM product_slug_registry
WHERE format_version = 'v2'
LIMIT 20;

-- Test comparison function
SELECT compare_registry_products(
  'psr-sid-zpw3rbxj',
  'psr-1395549b-761e-412f-9aa3-9249f1663e6b'
);
```

### Task 5.2: Bonded Word Validation
```sql
-- Verify bonded words are preserved
SELECT 
  product_slug,
  slug_components->>'brand' as brand,
  slug_components->>'category' as category
FROM product_slug_registry
WHERE slug_type = 'upc'
  AND format_version = 'v2'
  AND (product_slug LIKE '%general-mills%' OR product_slug LIKE '%ready-to-eat%')
LIMIT 10;
```

## Phase 6: API Development (Future)

### Comparison API Endpoints
- `POST /api/products/compare` - Compare two products by registry ID
- `GET /api/products/matches` - Find similar products by component criteria
- `POST /api/products/batch-compare` - Bulk comparison operations

## Success Criteria

1. ✅ All slugs follow the 5-part underscore format
2. ✅ Bonded words preserved with hyphens
3. ✅ Name hash consistent across UPC and LPC
4. ✅ Component parsing works for both formats
5. ✅ Comparison function returns accurate similarity scores
6. ✅ No duplicate slugs in registry
7. ✅ Migration status tracked for all entries

## Rollback Plan

If issues arise:
```sql
-- Mark v2 slugs as inactive
UPDATE product_slug_registry 
SET is_active = false 
WHERE format_version = 'v2';

-- Reactivate v1 slugs
UPDATE product_slug_registry 
SET is_active = true 
WHERE format_version = 'v1';
```
