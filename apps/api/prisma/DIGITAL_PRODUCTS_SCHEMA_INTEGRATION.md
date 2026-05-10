# Digital Products Schema Integration Guide

## Overview

This guide explains how to integrate the digital products schema changes into the existing Prisma schema after running the SQL migration.

## Prerequisites

1. ✅ SQL migration file created: `20260510_digital_products_system.sql`
2. ✅ Schema additions file created: `DIGITAL_PRODUCTS_SCHEMA_ADDITIONS.prisma`
3. ⏳ Run SQL migration on database
4. ⏳ Introspect database with Prisma
5. ⏳ Generate Prisma client

## Step-by-Step Integration

### Step 1: Run SQL Migration

Execute the SQL migration file on your database:

```bash
# Using psql
psql -d your_database_name -f apps/api/prisma/migrations/20260510_digital_products_system.sql

# Or using Supabase CLI
supabase db push

# Or through Supabase Dashboard
# Copy the contents of 20260510_digital_products_system.sql
# Paste into SQL Editor and run
```

### Step 2: Verify Tables Created

Connect to your database and verify:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('digital_download_pages', 'digital_downloads', 'download_access_logs');

-- Check columns in digital_download_pages
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'digital_download_pages'
ORDER BY ordinal_position;

-- Check foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('digital_download_pages', 'digital_downloads', 'download_access_logs');
```

### Step 3: Introspect Database with Prisma

Run Prisma introspection to pull the schema changes:

```bash
cd apps/api
npx prisma db pull
```

This will:
- Read the database schema
- Add new models to `schema.prisma`
- Update existing models with new columns and relations
- Preserve existing comments and attributes

### Step 4: Review Generated Schema

After introspection, verify the following models were added:

#### digital_download_pages
```prisma
model digital_download_pages {
  id                          String                    @id @default(uuid()) @db.Uuid
  tenant_id                   String                    @db.Uuid
  item_id                     String                    @db.Uuid
  slug                        String                    @db.VarChar(255)
  title                       String                    @db.VarChar(255)
  // ... other fields
  
  tenants                     tenants                   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  inventory_items             inventory_items           @relation(fields: [item_id], references: [id], onDelete: Cascade)
  digital_downloads           digital_downloads[]
  digital_access_grants       digital_access_grants[]
  
  @@unique([tenant_id, item_id])
  @@unique([tenant_id, slug])
  @@index([tenant_id])
  @@index([item_id])
  @@index([slug])
  @@index([status])
}
```

#### digital_downloads
```prisma
model digital_downloads {
  id                          String                    @id @default(uuid()) @db.Uuid
  tenant_id                   String                    @db.Uuid
  download_page_id            String                    @db.Uuid
  item_id                     String                    @db.Uuid
  asset_name                  String                    @db.VarChar(255)
  asset_type                  String                    @db.VarChar(50)
  // ... other fields
  
  tenants                     tenants                   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  digital_download_pages      digital_download_pages    @relation(fields: [download_page_id], references: [id], onDelete: Cascade)
  inventory_items             inventory_items           @relation(fields: [item_id], references: [id], onDelete: Cascade)
  download_access_logs        download_access_logs[]
  
  @@index([download_page_id])
  @@index([item_id])
  @@index([tenant_id])
  @@index([asset_type])
  @@index([display_order])
}
```

#### download_access_logs
```prisma
model download_access_logs {
  id                          String                    @id @default(uuid()) @db.Uuid
  tenant_id                   String                    @db.Uuid
  access_grant_id             String                    @db.VarChar(255)
  download_id                 String?                   @db.Uuid
  accessed_at                 DateTime                  @default(now()) @db.Timestamptz(6)
  // ... other fields
  
  tenants                     tenants                   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  digital_access_grants       digital_access_grants     @relation(fields: [access_grant_id], references: [id], onDelete: Cascade)
  digital_downloads           digital_downloads?        @relation(fields: [download_id], references: [id], onDelete: SetNull)
  
  @@index([access_grant_id])
  @@index([tenant_id])
  @@index([accessed_at])
  @@index([download_successful])
}
```

### Step 5: Verify Existing Models Updated

Check that the following existing models have been updated:

#### inventory_items
Should now have:
```prisma
model inventory_items {
  // ... existing fields
  download_page_id            String?                   @db.Uuid
  digital_download_pages      digital_download_pages?
  digital_downloads           digital_downloads[]
  download_access_logs        download_access_logs[]
  // ... existing relations
}
```

#### digital_access_grants
Should now have:
```prisma
model digital_access_grants {
  // ... existing fields
  tenant_id                   String?                   @db.Uuid
  download_page_id            String?                   @db.Uuid
  customer_id                 String?                   @db.Uuid
  access_granted_at           DateTime                  @default(now()) @db.Timestamptz(6)
  access_expires_at           DateTime?                 @db.Timestamptz(6)
  max_downloads               Int?
  license_key                 String?                   @unique @db.VarChar(255)
  license_key_activated_at    DateTime?                 @db.Timestamptz(6)
  license_key_activated_by    String?                   @db.VarChar(255)
  status                      String                    @default("active") @db.VarChar(50)
  access_ip_addresses         String[]
  
  tenants                     tenants?                  @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  digital_download_pages      digital_download_pages?   @relation(fields: [download_page_id], references: [id], onDelete: SetNull)
  customers                   customers?                @relation(fields: [customer_id], references: [id], onDelete: SetNull)
  download_access_logs        download_access_logs[]
  // ... existing relations
}
```

#### tenants
Should now have:
```prisma
model tenants {
  // ... existing fields
  digital_download_pages      digital_download_pages[]
  digital_downloads           digital_downloads[]
  download_access_logs        download_access_logs[]
  // ... existing relations
}
```

#### customers
Should now have:
```prisma
model customers {
  // ... existing fields
  digital_access_grants       digital_access_grants[]
  // ... existing relations
}
```

#### users
Should now have:
```prisma
model users {
  // ... existing fields
  digital_download_pages      digital_download_pages[]
  // ... existing relations
}
```

### Step 6: Generate Prisma Client

After verifying the schema, generate the Prisma client:

```bash
cd apps/api
npx prisma generate
```

This will:
- Generate TypeScript types for all models
- Update the Prisma client with new models and relations
- Make the new types available throughout the application

### Step 7: Test the Integration

Create a test script to verify everything works:

```typescript
// apps/api/test-digital-products.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDigitalProducts() {
  console.log('Testing digital products integration...\n');
  
  // Test 1: Check models exist
  console.log('1. Checking models exist...');
  try {
    const downloadPages = await prisma.digital_download_pages.findMany();
    console.log('   ✅ digital_download_pages model exists');
    
    const downloads = await prisma.digital_downloads.findMany();
    console.log('   ✅ digital_downloads model exists');
    
    const accessLogs = await prisma.download_access_logs.findMany();
    console.log('   ✅ download_access_logs model exists');
  } catch (error) {
    console.error('   ❌ Models not found:', error);
    return;
  }
  
  // Test 2: Check relations
  console.log('\n2. Checking relations...');
  try {
    // Check inventory_items has download_page_id
    const items = await prisma.inventory_items.findFirst({
      include: { digital_download_pages: true }
    });
    console.log('   ✅ inventory_items -> digital_download_pages relation exists');
    
    // Check digital_access_grants has new fields
    const grants = await prisma.digital_access_grants.findFirst({
      include: { 
        digital_download_pages: true,
        download_access_logs: true 
      }
    });
    console.log('   ✅ digital_access_grants relations exist');
  } catch (error) {
    console.error('   ❌ Relations not found:', error);
  }
  
  // Test 3: Create test data
  console.log('\n3. Creating test data...');
  try {
    // This would require a valid tenant, item, and user
    // Skip for now, just verify schema structure
    console.log('   ⏭️  Skipping test data creation (requires valid references)');
  } catch (error) {
    console.error('   ❌ Test data creation failed:', error);
  }
  
  console.log('\n✅ Integration test complete!');
}

testDigitalProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run the test:

```bash
cd apps/api
npx ts-node test-digital-products.ts
```

## Common Issues and Solutions

### Issue 1: Prisma db pull doesn't add relations

**Solution:** Manually add the relation fields to the schema:

```prisma
// In tenants model
digital_download_pages      digital_download_pages[]
digital_downloads           digital_downloads[]
download_access_logs        download_access_logs[]

// In inventory_items model
download_page_id            String?                   @db.Uuid
digital_download_pages      digital_download_pages?
digital_downloads           digital_downloads[]
download_access_logs        download_access_logs[]
```

### Issue 2: Enum types not generated

**Solution:** Add enum definitions manually if Prisma doesn't introspect them:

```prisma
enum asset_type {
  file
  link
  license_key
  access_grant
}

enum download_method {
  direct
  email
  license_key
  external
}

enum access_type {
  standard
  time_limited
  limited_downloads
}
```

### Issue 3: Column names don't match

**Solution:** Use `@map` to match database column names:

```prisma
model digital_download_pages {
  accessDurationDays  Int?    @map("access_duration_days")
  // ...
}
```

## Next Steps

After completing the schema integration:

1. ✅ Phase 1.2 Complete - Prisma schema updated
2. ⏭️ Phase 1.3 - Cart Service Enhancement
3. ⏭️ Phase 1.4 - Digital Product Badge Component
4. ⏭️ Phase 2 - API Endpoints & Singleton Services

## Verification Checklist

- [ ] SQL migration executed successfully
- [ ] Tables created in database
- [ ] Foreign keys established
- [ ] Indexes created
- [ ] Prisma db pull completed
- [ ] Models added to schema.prisma
- [ ] Relations defined correctly
- [ ] Indexes defined
- [ ] Prisma generate completed
- [ ] TypeScript types available
- [ ] Test script passes
