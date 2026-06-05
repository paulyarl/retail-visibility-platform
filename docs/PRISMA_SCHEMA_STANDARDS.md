# Prisma Schema Standards & Naming Conventions

**Status:** ✅ ENFORCED - All new schema changes must follow these standards

## 🎯 Overview

This document establishes the official naming conventions and standards for all Prisma schema changes in the Retail Visibility Platform. These standards ensure consistency, type safety, and maintainability across the entire codebase.

## 📋 Golden Rules

### 1. **Database Layer (snake_case)**
- All database tables: `snake_case`
- All database columns: `snake_case`
- All foreign keys: `tenant_id`, `user_id`, `organization_id`

### 2. **Prisma Schema Layer (camelCase)**
- All Prisma models: `PascalCase`
- All Prisma fields: `camelCase`
- **ALWAYS** use `@map("snake_case_name")` for every field

### 3. **TypeScript Layer (camelCase)**
- Generated types use `camelCase`
- Code accesses properties in `camelCase`
- Type-safe database operations

## 🏗️ Standard Model Template

```prisma
model YourNewModel {
  // Primary key
  id          String   @id @default(dbgenerated("gen_random_uuid()"))
  
  // Foreign keys (always follow this pattern)
  tenantId    String   @map("tenant_id")
  userId      String?  @map("user_id")
  
  // Business fields (camelCase → snake_case)
  businessName String  @map("business_name")
  isActive     Boolean @default(true) @map("is_active")
  displayOrder Int     @default(0) @map("display_order")
  
  // JSON fields
  metadata    Json?    @map("metadata")
  settings    Json?    @map("settings")
  
  // Timestamps (standard pattern - REQUIRED)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  // Relations (camelCase names, reference camelCase fields)
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user        users?   @relation(fields: [userId], references: [id])
  
  // Indexes (use camelCase field names)
  @@index([tenantId])
  @@index([createdAt])
  @@unique([tenantId, businessName])
  
  // Table mapping (if different from model name)
  @@map("your_new_model")
}
```

## 🔧 Field Type Standards

### **String Fields**
```prisma
name        String   @map("name")
description String?  @map("description")  // Optional
email       String   @unique @map("email")
```

### **Numeric Fields**
```prisma
count       Int      @default(0) @map("count")
price       Decimal  @db.Decimal(12, 2) @map("price")
percentage  Float    @map("percentage")
```

### **Boolean Fields**
```prisma
isActive    Boolean  @default(true) @map("is_active")
isEnabled   Boolean  @default(false) @map("is_enabled")
```

### **DateTime Fields**
```prisma
createdAt   DateTime @default(now()) @map("created_at")
updatedAt   DateTime @updatedAt @map("updated_at")
deletedAt   DateTime? @map("deleted_at")
expiresAt   DateTime? @map("expires_at")
```

### **JSON Fields**
```prisma
metadata    Json?    @map("metadata")
settings    Json     @default("{}") @map("settings")
```

### **Enum Fields**
```prisma
status      ItemStatus @default(active) @map("status")
visibility  ItemVisibility @default(public) @map("visibility")
```

## 🔗 Relation Standards

### **One-to-Many Relations**
```prisma
// Parent model
model Tenant {
  id    String @id
  items InventoryItem[]  // Plural, camelCase
}

// Child model
model InventoryItem {
  id       String @id
  tenantId String @map("tenant_id")
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

### **Many-to-Many Relations**
```prisma
model User {
  id      String @id
  tenants UserTenant[]
}

model Tenant {
  id    String @id
  users UserTenant[]
}

model UserTenant {
  id       String @id
  userId   String @map("user_id")
  tenantId String @map("tenant_id")
  role     UserRole @default(MEMBER) @map("role")
  
  user     User   @relation(fields: [userId], references: [id])
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  
  @@unique([userId, tenantId])
}
```

## 📊 Index Standards

### **Single Field Indexes**
```prisma
@@index([tenantId])
@@index([createdAt])
@@index([status])
```

### **Composite Indexes**
```prisma
@@index([tenantId, status])
@@index([tenantId, createdAt])
@@unique([tenantId, email])
```

### **Named Indexes**
```prisma
@@index([tenantId, status], map: "idx_model_tenant_status")
@@unique([email], map: "unique_model_email")
```

## 🚫 What NOT to Do

### **❌ Inconsistent Naming**
```prisma
// DON'T DO THIS
model BadExample {
  id          String @id
  tenant_id   String              // Missing @map, wrong case
  businessName String             // Missing @map
  created_at  DateTime @default(now())  // Wrong case in schema
}
```

### **❌ Missing @map Attributes**
```prisma
// DON'T DO THIS
model BadExample {
  id          String @id
  tenantId    String              // Will create "tenantId" in DB
  businessName String             // Will create "businessName" in DB
}
```

### **❌ Inconsistent Relations**
```prisma
// DON'T DO THIS
model BadExample {
  tenant_id String                // Wrong case
  tenant    Tenant @relation(fields: [tenant_id], references: [id])  // Inconsistent
}
```

## ✅ Migration Patterns

### **Adding New Columns**
```prisma
// In schema.prisma
model ExistingModel {
  // ... existing fields
  
  // New field following standards
  newFeature  Boolean @default(false) @map("new_feature")
  addedAt     DateTime @default(now()) @map("added_at")
}
```

### **Creating New Tables**
```sql
-- Generated migration will be:
CREATE TABLE "new_model" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "business_name" TEXT NOT NULL,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

## 🔍 Code Review Checklist

Before approving any schema changes, verify:

- [ ] All fields use `camelCase` in Prisma schema
- [ ] All fields have `@map("snake_case")` attributes
- [ ] Foreign keys follow pattern: `fieldId @map("field_id")`
- [ ] Timestamps included: `createdAt`, `updatedAt`
- [ ] Relations use camelCase field references
- [ ] Indexes reference camelCase field names
- [ ] Model names are `PascalCase`
- [ ] No snake_case in Prisma field names
- [ ] Proper `onDelete` cascades where appropriate

## 🎯 TypeScript Benefits

Following these standards ensures:

```typescript
// ✅ Type-safe operations
const item = await prisma.inventoryItem.create({
  data: {
    tenantId: "123",           // camelCase in code
    businessName: "My Store",  // camelCase in code
    isActive: true,            // camelCase in code
  }
});

// ✅ Type-safe access
console.log(item.businessName);  // Works
console.log(item.business_name); // TypeScript error - prevents bugs
```

## 📚 Examples from Codebase

### **Tenant Model (Reference)**
```prisma
model Tenant {
  id                          String                        @id
  name                        String
  createdAt                   DateTime                      @default(now()) @map("created_at")
  subscriptionTier            String?                       @default("starter") @map("subscription_tier")
  subscriptionStatus          String?                       @default("trial") @map("subscription_status")
  organizationId              String?                       @map("organization_id")
  
  organization                organization?                 @relation(fields: [organizationId], references: [id])
  inventoryItems              inventory_item[]
  
  @@index([organizationId])
}
```

### **Inventory Item Model (Reference)**
```prisma
model inventory_item {
  id                    String                   @id
  tenantId              String                   @map("tenant_id")
  sku                   String
  businessName          String                   @map("business_name")
  isActive              Boolean                  @default(true) @map("is_active")
  createdAt             DateTime                 @default(now()) @map("created_at")
  updatedAt             DateTime                 @map("updated_at")
  
  tenant                Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, sku])
  @@index([tenantId, updatedAt])
}
```

## 🚀 Enforcement

This standard is **MANDATORY** for all new schema changes. Any pull request that doesn't follow these conventions will be rejected.

### **Automated Checks**
Consider adding pre-commit hooks or CI checks to validate:
- All fields have `@map()` attributes
- No snake_case field names in schema
- Consistent relation patterns

### **Documentation Updates**
When adding new models, update:
- This standards document (if patterns change)
- API documentation
- Type definitions
- Migration notes

---

**Last Updated:** November 2024  
**Next Review:** When major Prisma version changes occur

**Questions?** Refer to the established patterns in `Tenant` and `inventory_item` models as canonical examples.
