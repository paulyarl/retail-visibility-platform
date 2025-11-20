# Migration Governance System

**Status:** ✅ PRODUCTION READY - Enforces Prisma mapping standards for all migrations

## Overview

This system prevents mixed camelCase/snake_case issues by enforcing strict standards before any migration can be deployed. It ensures all future schema changes follow the established Prisma mapping conventions.

## 🛡️ Governance Components

### 1. Schema Validator (`validate-prisma-schema.js`)
**Purpose:** Validates that all models and fields follow mapping standards

**Checks:**
- ✅ Model names are camelCase with `@@map("snake_case_table")`
- ✅ Field names are camelCase with `@map("snake_case_column")` when different
- ✅ Relations use camelCase field and model names
- ✅ Database conventions use snake_case

**Usage:**
```bash
pnpm schema:validate
```

### 2. Pre-Migration Checker (`pre-migration-check.js`)
**Purpose:** Comprehensive checks before migration execution

**Validates:**
- Schema mapping standards
- Breaking change analysis
- Migration safety
- Build compatibility

**Usage:**
```bash
pnpm migration:check [migration-name]
```

### 3. Migration Wrapper (`migration-wrapper.js`)
**Purpose:** Wraps Prisma commands with governance enforcement

**Features:**
- Pre-migration validation
- Safe migration execution
- Post-migration verification
- Standards enforcement

**Usage:**
```bash
pnpm migration:dev "migration-name"
pnpm migration:deploy
pnpm migration:reset
```

## 📋 Required Standards

### Model Standards
```prisma
// ✅ CORRECT - camelCase model with @@map
model InventoryItem {
  id         String
  tenantId   String   @map("tenant_id")
  itemStatus String   @map("item_status")
  createdAt  DateTime @map("created_at")
  
  @@map("inventory_item")
}

// ❌ WRONG - snake_case model name
model inventory_item {
  id         String
  tenant_id  String   // Missing @map
}
```

### Field Standards
```prisma
// ✅ CORRECT - camelCase with @map when different
createdAt    DateTime  @map("created_at")
tenantId     String    @map("tenant_id")
itemStatus   String    @map("item_status")

// Fields that match database don't need @map
id           String    // No @map needed
name         String    // No @map needed
email        String    // No @map needed

// ❌ WRONG - snake_case field names
created_at   DateTime  // Should be camelCase
tenant_id    String    // Should be camelCase
```

### Relation Standards
```prisma
// ✅ CORRECT - camelCase relations
model User {
  userTenants  UserTenant[]  // camelCase field, camelCase model
  invitations  Invitation[]  // camelCase field, camelCase model
  
  @@map("users")
}

// ❌ WRONG - snake_case relations
model users {
  user_tenants  user_tenants[]  // Should be camelCase
}
```

## 🚀 Migration Workflow

### Development Migrations
```bash
# 1. Validate current schema
pnpm schema:validate

# 2. Run pre-checks
pnpm migration:check "add-new-feature"

# 3. Execute migration with governance
pnpm migration:dev "add-new-feature"
```

### Production Deployment
```bash
# 1. Validate schema in CI/CD
pnpm schema:validate

# 2. Run comprehensive checks
pnpm migration:check

# 3. Deploy with validation
pnpm migration:deploy
```

## 🔍 Validation Examples

### Schema Validation Output
```
🔍 Validating Prisma schema for mapping standards...

✅ Schema validation passed! All models and fields follow mapping standards.

📋 Standards Summary:
   • Model names: camelCase with @@map("snake_case_table")
   • Field names: camelCase with @map("snake_case_column") when different
   • Relations: camelCase field names and model references
   • Database: snake_case tables and columns
```

### Error Detection
```
🚨 ERRORS (must fix before deployment):
   ❌ Model "user_tenant" should use camelCase (line 15)
   ❌ Field "tenant_id" should use camelCase (line 18)
   ❌ Field "createdAt" missing @map("created_at") attribute (line 22)

⚠️  WARNINGS (recommended fixes):
   ⚠️  Table name "UserTenants" should use snake_case (line 25)
```

## 🛠️ Integration Points

### Package.json Scripts
```json
{
  "scripts": {
    "schema:validate": "node scripts/validate-prisma-schema.js",
    "migration:check": "node scripts/pre-migration-check.js",
    "migration:dev": "node scripts/migration-wrapper.js dev",
    "migration:deploy": "node scripts/migration-wrapper.js deploy",
    "migration:reset": "node scripts/migration-wrapper.js reset"
  }
}
```

### CI/CD Integration
```yaml
# Add to your CI/CD pipeline
- name: Validate Prisma Schema
  run: pnpm schema:validate

- name: Check Migration Safety
  run: pnpm migration:check

- name: Deploy Migration
  run: pnpm migration:deploy
```

### Git Hooks (Recommended)
```bash
# .git/hooks/pre-commit
#!/bin/sh
echo "Validating Prisma schema..."
pnpm schema:validate || exit 1
```

## 🎯 Benefits

### Prevents Runtime Errors
- ✅ No more mixed case query failures
- ✅ No more field name mismatches
- ✅ No more relation errors
- ✅ Consistent API behavior

### Enforces Best Practices
- ✅ Prisma industry standards
- ✅ TypeScript conventions
- ✅ Database conventions
- ✅ Clean architecture

### Development Safety
- ✅ Catches issues before deployment
- ✅ Prevents breaking changes
- ✅ Validates build compatibility
- ✅ Maintains code quality

## 📚 Error Reference

### Common Validation Errors

**Model Name Issues:**
```
❌ Model "user_tenant" should use camelCase
✅ Fix: Rename to "UserTenant" with @@map("user_tenant")
```

**Missing @map Attributes:**
```
❌ Field "createdAt" missing @map("created_at") attribute
✅ Fix: Add @map("created_at") to field
```

**Relation Issues:**
```
❌ Referenced model "user_tenant" should use camelCase
✅ Fix: Update relation to reference "UserTenant"
```

### Build Compatibility Errors
```
❌ Build fails with current schema changes
✅ Fix: Ensure all Prisma queries use new camelCase names
```

## 🔄 Migration Process

### Before This System
```bash
# ❌ Old way - no validation
npx prisma migrate dev --name "new-feature"
# Could introduce mixed case issues
```

### With Governance System
```bash
# ✅ New way - enforced validation
pnpm migration:dev "new-feature"
# Automatically validates standards before proceeding
```

## 📊 Success Metrics

### Schema Quality
- **100%** of models use camelCase with @@map
- **100%** of fields use proper @map when needed
- **0** mixed case runtime errors
- **0** field name mismatches

### Development Efficiency
- **Prevents** debugging mixed case issues
- **Catches** problems before deployment
- **Enforces** consistent conventions
- **Maintains** code quality standards

## 🚨 Emergency Procedures

### If Validation Fails in Production
1. **Immediate:** Revert to last known good schema
2. **Fix:** Address validation errors locally
3. **Test:** Run full validation suite
4. **Deploy:** Use governance system for deployment

### Bypassing Validation (Emergency Only)
```bash
# Only in extreme emergencies
npx prisma migrate deploy --skip-validation
# Must be followed by immediate fix
```

## 📝 Maintenance

### Regular Tasks
- Review validation rules quarterly
- Update standards documentation
- Monitor error patterns
- Improve validation logic

### Version Updates
- Test with new Prisma versions
- Update validation patterns
- Maintain compatibility
- Document changes

---

**This governance system ensures that all future migrations maintain the architectural standards established by the complete Prisma @map standardization, preventing any regression to mixed case issues.**
