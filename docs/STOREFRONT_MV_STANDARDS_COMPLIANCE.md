# Storefront MV - Standards Compliance Verification

**Date:** 2024-11-28  
**Status:** ✅ FULLY COMPLIANT  
**Scope:** SQL naming standards + Category system alignment

---

## Executive Summary

The `storefront_products` materialized view is **100% compliant** with platform standards:

✅ **SQL Naming Standards** - All snake_case, proper prefixes  
✅ **Category System** - Uses correct `tenant_categories` (not platform_categories)  
✅ **Index Naming** - Follows idx_/uq_ conventions  
✅ **Column Naming** - Consistent snake_case  

---

## Category System Clarification

### **Two Separate Category Systems:**

#### **1. Platform Categories** (Directory System)
```sql
-- Tables:
platform_categories              -- Master category table
directory_listing_categories     -- Junction table

-- Purpose: Directory browsing (public marketplace)
-- Scope: Cross-tenant, normalized
-- Google Taxonomy: 1:1 alignment
-- Used by: Directory pages, category browsing
```

#### **2. Tenant Categories** (Storefront System)
```sql
-- Tables:
tenant_categories                -- Tenant-specific categories

-- Purpose: Storefront product organization
-- Scope: Per-tenant, customizable
-- Google Taxonomy: Optional alignment via google_category_id
-- Used by: Storefront, product management
```

### **Why Two Systems?**

**Platform Categories (Directory):**
- ✅ Standardized across all tenants
- ✅ Google taxonomy aligned
- ✅ Used for public discovery
- ✅ Managed by platform

**Tenant Categories (Storefront):**
- ✅ Customizable per tenant
- ✅ Tenant-specific organization
- ✅ Used for storefront browsing
- ✅ Managed by tenant

**These are INTENTIONALLY separate!**

---

## Storefront MV Compliance Check

### **✅ Uses Correct Category System**

```sql
-- Storefront MV correctly uses tenant_categories
FROM inventory_items ii
LEFT JOIN tenant_categories tc ON tc.id = ii.tenant_category_id
```

**Why this is correct:**
- Storefront products belong to tenants
- Tenants organize products with their own categories
- `tenant_categories` is the right table for storefront
- `platform_categories` is for directory (different system)

---

## SQL Naming Standards Compliance

### **✅ Table/View Names**

| Item | Name | Standard | Status |
|------|------|----------|--------|
| Materialized View | `storefront_products` | snake_case_plural | ✅ |
| Refresh Log Table | `storefront_mv_refresh_log` | snake_case with _mv_ | ✅ |

---

### **✅ Column Names**

All columns use **snake_case**:

```sql
-- Product identity
id                    ✅
tenant_id             ✅
sku                   ✅

-- Product details
name                  ✅
title                 ✅
description           ✅
marketing_description ✅

-- Pricing
price                 ✅
price_cents           ✅
currency              ✅

-- Inventory
stock                 ✅
quantity              ✅
availability          ✅

-- Media
image_url             ✅
image_gallery         ✅

-- Category (denormalized)
category_id           ✅
category_name         ✅
category_slug         ✅
google_category_id    ✅

-- Computed flags
has_image             ✅
in_stock              ✅
has_gallery           ✅

-- Timestamps
created_at            ✅
updated_at            ✅
```

**All 100% compliant with snake_case standard!**

---

### **✅ Index Names**

All indexes follow **idx_** or **uq_** prefix convention:

```sql
-- Unique indexes (uq_ prefix)
uq_storefront_products_id                           ✅

-- Regular indexes (idx_ prefix)
idx_storefront_products_tenant_category             ✅
idx_storefront_products_tenant                      ✅
idx_storefront_products_search                      ✅
idx_storefront_products_fulltext                    ✅
idx_storefront_products_availability                ✅
idx_storefront_products_updated                     ✅
```

**All follow naming convention!**

---

### **✅ Function Names**

```sql
refresh_storefront_products_debounced()             ✅
-- snake_case with descriptive suffix
```

---

### **✅ Trigger Names**

```sql
trg_refresh_storefront_on_inventory                 ✅
trg_refresh_storefront_on_categories                ✅
-- trg_ prefix + snake_case
```

---

## Comparison with Directory MVs

### **Directory Category Listings MV:**
```sql
CREATE MATERIALIZED VIEW directory_category_listings AS
SELECT
  dl.id,
  dl.tenant_id,
  ...
  pc.id as category_id,              -- platform_categories
  pc.name as category_name,
  pc.slug as category_slug,
  pc.google_category_id
FROM directory_listings_list dl
INNER JOIN directory_listing_categories dlc ON dlc.listing_id = dl.id
INNER JOIN platform_categories pc ON pc.id = dlc.category_id
```

**Uses:** `platform_categories` ✅ (Correct for directory)

---

### **Storefront Products MV:**
```sql
CREATE MATERIALIZED VIEW storefront_products AS
SELECT
  ii.id,
  ii.tenant_id,
  ...
  tc.id as category_id,              -- tenant_categories
  tc.name as category_name,
  tc.slug as category_slug,
  tc.google_category_id
FROM inventory_items ii
LEFT JOIN tenant_categories tc ON tc.id = ii.tenant_category_id
```

**Uses:** `tenant_categories` ✅ (Correct for storefront)

---

## Standards Compliance Summary

### **✅ Database Naming Standards**

| Standard | Requirement | Storefront MV | Status |
|----------|-------------|---------------|--------|
| Table names | snake_case_plural | `storefront_products` | ✅ |
| Column names | snake_case | All columns | ✅ |
| Index names | idx_/uq_ prefix | All indexes | ✅ |
| Function names | snake_case | `refresh_storefront_products_debounced` | ✅ |
| Trigger names | trg_ prefix | `trg_refresh_storefront_on_*` | ✅ |
| Comments | Descriptive | All objects | ✅ |

**100% Compliant!**

---

### **✅ Category System Alignment**

| System | Table | MV Usage | Status |
|--------|-------|----------|--------|
| Directory | `platform_categories` | `directory_category_listings` | ✅ |
| Storefront | `tenant_categories` | `storefront_products` | ✅ |

**Correctly uses separate category systems!**

---

### **✅ Materialized View Pattern**

| Pattern | Directory MVs | Storefront MV | Status |
|---------|---------------|---------------|--------|
| Naming | snake_case_plural | `storefront_products` | ✅ |
| Indexes | Multiple optimized | 7 indexes | ✅ |
| Refresh | Debounced triggers | 30-second debounce | ✅ |
| Logging | Refresh log table | `storefront_mv_refresh_log` | ✅ |
| Comments | Descriptive | All objects | ✅ |

**Follows established pattern!**

---

## Architecture Consistency

### **Platform-Wide MV Architecture:**

```
1. Directory System (Public Marketplace)
   ├── platform_categories (master)
   ├── directory_listing_categories (junction)
   ├── directory_category_listings (MV)
   └── directory_category_stats (MV)

2. Storefront System (Tenant-Specific)
   ├── tenant_categories (tenant-specific)
   ├── inventory_items (products)
   └── storefront_products (MV) ⭐ NEW
```

**Each system uses its own category table - this is correct!**

---

## Potential Confusion (Clarified)

### **Question:** "Should storefront use platform_categories?"

**Answer:** ❌ **NO!**

**Reason:**
- `platform_categories` = Directory browsing (cross-tenant)
- `tenant_categories` = Storefront organization (per-tenant)
- These serve different purposes
- Tenants need custom categories for their products
- Platform categories are for public discovery

### **Example:**

**Tenant "Bob's Hardware":**
- **Storefront categories** (tenant_categories):
  - "Power Tools"
  - "Hand Tools"
  - "Fasteners"
  - *(Bob's custom organization)*

- **Directory categories** (platform_categories):
  - "Hardware & Tools" (standardized)
  - *(Platform-wide discovery)*

**Both are needed, they serve different purposes!**

---

## Future Alignment Opportunity

### **Optional Enhancement:**

Link tenant categories to platform categories for better discovery:

```sql
ALTER TABLE tenant_categories
ADD COLUMN platform_category_id TEXT 
REFERENCES platform_categories(id);
```

**Benefits:**
- Tenants can map their categories to platform categories
- Better directory discovery
- Google taxonomy alignment
- Cross-tenant category analytics

**Status:** Not required now, but could be added later

---

## Conclusion

### **✅ Full Standards Compliance:**

1. **SQL Naming:** 100% compliant with snake_case standards
2. **Category System:** Correctly uses `tenant_categories` for storefront
3. **Index Naming:** Follows idx_/uq_ prefix conventions
4. **MV Pattern:** Consistent with directory MVs
5. **Architecture:** Maintains separation of concerns

### **✅ Correct Category Usage:**

- **Directory MVs** → `platform_categories` ✅
- **Storefront MV** → `tenant_categories` ✅

**These are DIFFERENT systems serving DIFFERENT purposes!**

---

## Verification Checklist

- [x] All table/view names use snake_case
- [x] All column names use snake_case
- [x] All indexes follow idx_/uq_ prefix
- [x] Functions use snake_case
- [x] Triggers use trg_ prefix
- [x] Uses correct category table (tenant_categories)
- [x] Follows established MV pattern
- [x] Includes refresh logging
- [x] Has descriptive comments
- [x] Consistent with platform architecture

**All checks passed!** ✅

---

**Status:** ✅ FULLY COMPLIANT  
**Category System:** ✅ CORRECT (tenant_categories)  
**SQL Standards:** ✅ 100% COMPLIANT  
**Architecture:** ✅ CONSISTENT
