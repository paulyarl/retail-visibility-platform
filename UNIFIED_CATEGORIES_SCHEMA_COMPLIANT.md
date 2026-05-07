# Unified Categories - Database Schema (Platform Standards Compliant)

## Overview

This document defines the database schema for the unified category management system, **fully compliant** with the platform's database naming standards as defined in `DATABASE_NAMING_STANDARD_MIGRATION_PLAN.md`.

---

## ✅ Compliance Checklist

- ✅ **Table name:** `snake_case_plural` format
- ✅ **Primary key:** Named `id`
- ✅ **Foreign keys:** `{referenced_table_singular}_id` format
- ✅ **Timestamps:** `created_at`, `updated_at`
- ✅ **Columns:** All `snake_case`
- ✅ **Booleans:** Prefixed with `is_`
- ✅ **Enums:** `snake_case` names and values
- ✅ **Indexes:** `idx_{table}_{column(s)}` format
- ✅ **Constraints:** `fk_`, `uq_`, `ck_` prefixes

---

## Table: `tenant_category_assignments`

### Schema Definition

```sql
-- Unified category assignments table
-- Compliant with platform naming standards

CREATE TABLE tenant_category_assignments (
  -- Primary key
  id SERIAL PRIMARY KEY,
  
  -- Foreign key to tenants table
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Category identification
  category_id VARCHAR(255) NOT NULL,
  category_name VARCHAR(500) NOT NULL,
  category_source VARCHAR(50) NOT NULL, -- 'gbp' or 'directory'
  
  -- Platform assignments (boolean flags)
  is_assigned_to_gbp BOOLEAN NOT NULL DEFAULT false,
  is_assigned_to_directory BOOLEAN NOT NULL DEFAULT false,
  
  -- Hierarchy
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Sync tracking
  gbp_sync_status VARCHAR(50),
  directory_sync_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  
  -- Standard timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT fk_tenant_category_assignments_tenant_id 
    FOREIGN KEY (tenant_id) 
    REFERENCES tenants(id) 
    ON DELETE CASCADE,
  
  -- Unique constraint: one category per tenant
  CONSTRAINT uq_tenant_category_assignments_tenant_id_category_id 
    UNIQUE(tenant_id, category_id),
  
  -- Check constraint: must be assigned to at least one platform
  CONSTRAINT ck_tenant_category_assignments_platform_assignment 
    CHECK (is_assigned_to_gbp = true OR is_assigned_to_directory = true),
  
  -- Check constraint: only one primary category per tenant
  CONSTRAINT ck_tenant_category_assignments_one_primary 
    CHECK (
      NOT is_primary OR 
      (SELECT COUNT(*) 
       FROM tenant_category_assignments tca 
       WHERE tca.tenant_id = tenant_category_assignments.tenant_id 
       AND tca.is_primary = true
       AND tca.id != tenant_category_assignments.id) = 0
    )
);

-- Indexes for performance
CREATE INDEX idx_tenant_category_assignments_tenant_id 
  ON tenant_category_assignments(tenant_id);

CREATE INDEX idx_tenant_category_assignments_tenant_id_is_primary 
  ON tenant_category_assignments(tenant_id, is_primary) 
  WHERE is_primary = true;

CREATE INDEX idx_tenant_category_assignments_tenant_id_gbp 
  ON tenant_category_assignments(tenant_id) 
  WHERE is_assigned_to_gbp = true;

CREATE INDEX idx_tenant_category_assignments_tenant_id_directory 
  ON tenant_category_assignments(tenant_id) 
  WHERE is_assigned_to_directory = true;

CREATE INDEX idx_tenant_category_assignments_category_id 
  ON tenant_category_assignments(category_id);

-- Trigger for updated_at
CREATE TRIGGER trg_tenant_category_assignments_updated_at
  BEFORE UPDATE ON tenant_category_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger (if audit system exists)
CREATE TRIGGER trg_tenant_category_assignments_audit
  AFTER INSERT OR UPDATE OR DELETE ON tenant_category_assignments
  FOR EACH ROW 
  EXECUTE FUNCTION audit_log_changes();
```

---

## Enum Types (if needed)

### Category Source Enum
```sql
-- Enum for category source
CREATE TYPE category_source_type AS ENUM (
  'gbp',
  'directory',
  'both'
);

-- Update table to use enum
ALTER TABLE tenant_category_assignments
  ALTER COLUMN category_source TYPE category_source_type
  USING category_source::category_source_type;
```

### Sync Status Enum
```sql
-- Enum for sync status
CREATE TYPE category_sync_status_type AS ENUM (
  'pending',
  'in_progress',
  'synced',
  'failed',
  'skipped'
);

-- Update table to use enum
ALTER TABLE tenant_category_assignments
  ALTER COLUMN gbp_sync_status TYPE category_sync_status_type
  USING gbp_sync_status::category_sync_status_type;

ALTER TABLE tenant_category_assignments
  ALTER COLUMN directory_sync_status TYPE category_sync_status_type
  USING directory_sync_status::category_sync_status_type;
```

---

## Prisma Schema (Compliant)

```prisma
model TenantCategoryAssignment {
  // Primary key
  id        Int      @id @default(autoincrement())
  
  // Foreign key
  tenantId  String   @map("tenant_id")
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Category identification
  categoryId     String  @map("category_id")
  categoryName   String  @map("category_name")
  categorySource String  @map("category_source")
  
  // Platform assignments (boolean flags)
  isAssignedToGbp       Boolean @default(false) @map("is_assigned_to_gbp")
  isAssignedToDirectory Boolean @default(false) @map("is_assigned_to_directory")
  
  // Hierarchy
  isPrimary     Boolean @default(false) @map("is_primary")
  displayOrder  Int     @default(0)    @map("display_order")
  
  // Sync tracking
  gbpSyncStatus       String?   @map("gbp_sync_status")
  directorySyncStatus String?   @map("directory_sync_status")
  lastSyncedAt        DateTime? @map("last_synced_at")
  
  // Standard timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  
  // Unique constraint
  @@unique([tenantId, categoryId], name: "uq_tenant_category_assignments_tenant_id_category_id")
  
  // Indexes
  @@index([tenantId], name: "idx_tenant_category_assignments_tenant_id")
  @@index([tenantId, isPrimary], name: "idx_tenant_category_assignments_tenant_id_is_primary")
  @@index([categoryId], name: "idx_tenant_category_assignments_category_id")
  
  // Table mapping
  @@map("tenant_category_assignments")
}
```

---

## Migration Script (Compliant)

```sql
-- File: migrations/001_create_tenant_category_assignments.sql
-- Unified category assignments table
-- Compliant with platform database naming standards

BEGIN;

-- Create the table
CREATE TABLE tenant_category_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  category_id VARCHAR(255) NOT NULL,
  category_name VARCHAR(500) NOT NULL,
  category_source VARCHAR(50) NOT NULL,
  is_assigned_to_gbp BOOLEAN NOT NULL DEFAULT false,
  is_assigned_to_directory BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  gbp_sync_status VARCHAR(50),
  directory_sync_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE tenant_category_assignments
  ADD CONSTRAINT fk_tenant_category_assignments_tenant_id
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add unique constraint
ALTER TABLE tenant_category_assignments
  ADD CONSTRAINT uq_tenant_category_assignments_tenant_id_category_id
  UNIQUE(tenant_id, category_id);

-- Add check constraint: platform assignment
ALTER TABLE tenant_category_assignments
  ADD CONSTRAINT ck_tenant_category_assignments_platform_assignment
  CHECK (is_assigned_to_gbp = true OR is_assigned_to_directory = true);

-- Create indexes
CREATE INDEX idx_tenant_category_assignments_tenant_id 
  ON tenant_category_assignments(tenant_id);

CREATE INDEX idx_tenant_category_assignments_tenant_id_is_primary 
  ON tenant_category_assignments(tenant_id, is_primary) 
  WHERE is_primary = true;

CREATE INDEX idx_tenant_category_assignments_tenant_id_gbp 
  ON tenant_category_assignments(tenant_id) 
  WHERE is_assigned_to_gbp = true;

CREATE INDEX idx_tenant_category_assignments_tenant_id_directory 
  ON tenant_category_assignments(tenant_id) 
  WHERE is_assigned_to_directory = true;

CREATE INDEX idx_tenant_category_assignments_category_id 
  ON tenant_category_assignments(category_id);

-- Create updated_at trigger
CREATE TRIGGER trg_tenant_category_assignments_updated_at
  BEFORE UPDATE ON tenant_category_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE tenant_category_assignments IS 
  'Unified category assignments for tenants across GBP and Directory platforms';

-- Comment on columns
COMMENT ON COLUMN tenant_category_assignments.category_source IS 
  'Source of the category: gbp, directory, or both';
COMMENT ON COLUMN tenant_category_assignments.is_assigned_to_gbp IS 
  'Whether this category is assigned to Google Business Profile';
COMMENT ON COLUMN tenant_category_assignments.is_assigned_to_directory IS 
  'Whether this category is assigned to Platform Directory';
COMMENT ON COLUMN tenant_category_assignments.is_primary IS 
  'Whether this is the primary category for the tenant';
COMMENT ON COLUMN tenant_category_assignments.display_order IS 
  'Display order for secondary categories (0 for primary)';

COMMIT;
```

---

## Comparison: Non-Compliant vs Compliant

### ❌ Non-Compliant (Original)
```sql
CREATE TABLE tenant_category_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- ❌ Wrong: camelCase columns
  categoryId VARCHAR(255) NOT NULL,
  categoryName VARCHAR(500) NOT NULL,
  categorySource VARCHAR(50) NOT NULL,
  
  -- ❌ Wrong: no is_ prefix for booleans
  assignedToGbp BOOLEAN DEFAULT false,
  assignedToDirectory BOOLEAN DEFAULT false,
  
  -- ❌ Wrong: camelCase
  isPrimary BOOLEAN DEFAULT false,
  displayOrder INTEGER DEFAULT 0,
  
  -- ❌ Wrong: camelCase
  gbpSyncStatus VARCHAR(50),
  directorySyncStatus VARCHAR(50),
  lastSyncedAt TIMESTAMP,
  
  -- ❌ Wrong: camelCase timestamps
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- ❌ Wrong: constraint naming
CONSTRAINT unique_tenant_category UNIQUE(tenant_id, category_id);

-- ❌ Wrong: index naming
CREATE INDEX tenant_categories_idx ON tenant_category_assignments(tenant_id);
```

### ✅ Compliant (Corrected)
```sql
CREATE TABLE tenant_category_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- ✅ Correct: snake_case columns
  category_id VARCHAR(255) NOT NULL,
  category_name VARCHAR(500) NOT NULL,
  category_source VARCHAR(50) NOT NULL,
  
  -- ✅ Correct: is_ prefix for booleans
  is_assigned_to_gbp BOOLEAN NOT NULL DEFAULT false,
  is_assigned_to_directory BOOLEAN NOT NULL DEFAULT false,
  
  -- ✅ Correct: snake_case
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- ✅ Correct: snake_case
  gbp_sync_status VARCHAR(50),
  directory_sync_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  
  -- ✅ Correct: snake_case timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ✅ Correct: constraint naming
CONSTRAINT uq_tenant_category_assignments_tenant_id_category_id 
  UNIQUE(tenant_id, category_id);

-- ✅ Correct: index naming
CREATE INDEX idx_tenant_category_assignments_tenant_id 
  ON tenant_category_assignments(tenant_id);
```

---

## TypeScript Types (Compliant)

```typescript
// Database model (matches Prisma schema)
export interface TenantCategoryAssignment {
  id: number;
  tenantId: string;
  categoryId: string;
  categoryName: string;
  categorySource: 'gbp' | 'directory' | 'both';
  isAssignedToGbp: boolean;
  isAssignedToDirectory: boolean;
  isPrimary: boolean;
  displayOrder: number;
  gbpSyncStatus: CategorySyncStatus | null;
  directorySyncStatus: CategorySyncStatus | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Sync status enum
export type CategorySyncStatus = 
  | 'pending'
  | 'in_progress'
  | 'synced'
  | 'failed'
  | 'skipped';

// API request/response types
export interface UnifiedCategoryRequest {
  primary: {
    categoryId: string;
    categoryName: string;
    categorySource: 'gbp' | 'directory';
    platforms: {
      gbp: boolean;
      directory: boolean;
    };
  } | null;
  secondary: Array<{
    categoryId: string;
    categoryName: string;
    categorySource: 'gbp' | 'directory';
    platforms: {
      gbp: boolean;
      directory: boolean;
    };
  }>;
}

export interface UnifiedCategoryResponse {
  success: boolean;
  data: {
    primary: TenantCategoryAssignment | null;
    secondary: TenantCategoryAssignment[];
  };
}
```

---

## Validation Queries

### Check Compliance
```sql
-- 1. Verify table name is snake_case_plural
SELECT 
  tablename,
  CASE 
    WHEN tablename ~ '^[a-z][a-z0-9_]*s$' THEN '✅ Compliant'
    ELSE '❌ Non-compliant'
  END as compliance
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'tenant_category_assignments';

-- 2. Verify all columns are snake_case
SELECT 
  column_name,
  CASE 
    WHEN column_name ~ '^[a-z][a-z0-9_]*$' THEN '✅ Compliant'
    ELSE '❌ Non-compliant'
  END as compliance
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_category_assignments';

-- 3. Verify boolean columns have is_ prefix
SELECT 
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'boolean' AND column_name LIKE 'is_%' THEN '✅ Compliant'
    WHEN data_type = 'boolean' AND column_name NOT LIKE 'is_%' THEN '❌ Non-compliant'
    ELSE 'N/A'
  END as compliance
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_category_assignments'
  AND data_type = 'boolean';

-- 4. Verify timestamp columns
SELECT 
  column_name,
  CASE 
    WHEN column_name IN ('created_at', 'updated_at') THEN '✅ Compliant'
    WHEN column_name IN ('createdAt', 'updatedAt') THEN '❌ Non-compliant'
    ELSE 'N/A'
  END as compliance
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_category_assignments'
  AND data_type LIKE 'timestamp%';

-- 5. Verify constraint naming
SELECT 
  constraint_name,
  CASE 
    WHEN constraint_name LIKE 'fk_%' THEN '✅ FK Compliant'
    WHEN constraint_name LIKE 'uq_%' THEN '✅ UQ Compliant'
    WHEN constraint_name LIKE 'ck_%' THEN '✅ CK Compliant'
    ELSE '❌ Non-compliant'
  END as compliance
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'tenant_category_assignments';

-- 6. Verify index naming
SELECT 
  indexname,
  CASE 
    WHEN indexname LIKE 'idx_%' THEN '✅ Compliant'
    WHEN indexname = 'tenant_category_assignments_pkey' THEN '✅ PK (auto)'
    ELSE '❌ Non-compliant'
  END as compliance
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'tenant_category_assignments';
```

---

## Summary of Changes for Compliance

| Item | Original | Compliant | Standard |
|------|----------|-----------|----------|
| **Table name** | `tenant_category_assignments` | ✅ No change | `snake_case_plural` |
| **Primary key** | `id` | ✅ No change | `id` |
| **Foreign key** | `tenant_id` | ✅ No change | `{table_singular}_id` |
| **Boolean columns** | `assignedToGbp` | `is_assigned_to_gbp` | `is_` prefix |
| **Boolean columns** | `assignedToDirectory` | `is_assigned_to_directory` | `is_` prefix |
| **Boolean columns** | `isPrimary` | `is_primary` | `is_` prefix |
| **Regular columns** | `categoryId` | `category_id` | `snake_case` |
| **Regular columns** | `categoryName` | `category_name` | `snake_case` |
| **Regular columns** | `categorySource` | `category_source` | `snake_case` |
| **Regular columns** | `displayOrder` | `display_order` | `snake_case` |
| **Sync columns** | `gbpSyncStatus` | `gbp_sync_status` | `snake_case` |
| **Sync columns** | `directorySyncStatus` | `directory_sync_status` | `snake_case` |
| **Sync columns** | `lastSyncedAt` | `last_synced_at` | `snake_case` |
| **Timestamps** | `createdAt` | `created_at` | Standard |
| **Timestamps** | `updatedAt` | `updated_at` | Standard |
| **Constraints** | `unique_tenant_category` | `uq_tenant_category_assignments_tenant_id_category_id` | `uq_` prefix |
| **Constraints** | N/A | `fk_tenant_category_assignments_tenant_id` | `fk_` prefix |
| **Constraints** | N/A | `ck_tenant_category_assignments_platform_assignment` | `ck_` prefix |
| **Indexes** | `tenant_categories_idx` | `idx_tenant_category_assignments_tenant_id` | `idx_` prefix |

---

## Conclusion

The unified categories schema is now **100% compliant** with the platform's database naming standards. All table names, column names, constraints, and indexes follow the established conventions, ensuring consistency across the entire database.

**Key Compliance Points:**
- ✅ Table name: `tenant_category_assignments` (snake_case_plural)
- ✅ All columns: snake_case
- ✅ Boolean columns: `is_` prefix
- ✅ Timestamps: `created_at`, `updated_at`
- ✅ Constraints: `fk_`, `uq_`, `ck_` prefixes
- ✅ Indexes: `idx_` prefix
- ✅ Foreign keys: `{table_singular}_id` format

This ensures the unified categories system integrates seamlessly with the rest of the platform's database architecture.
