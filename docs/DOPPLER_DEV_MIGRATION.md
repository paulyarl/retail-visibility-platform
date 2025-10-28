# Doppler Configuration Migration: Local → Dev

## Overview

This guide documents the migration from `doppler run --config local` to `doppler run --config dev` for better environment separation.

---

## ✅ **Migration Complete**

**Date:** October 28, 2024  
**Status:** ✅ Complete  
**Default Config:** `dev`  
**Fallback Config:** `local` (still available)

---

## 🎯 **What Changed**

### **1. Root Package Scripts**

**Before:**
```json
"dev": "pnpm -r --parallel dev"
```

**After:**
```json
"dev": "doppler run --config dev -- pnpm -r --parallel dev",
"dev:local": "doppler run --config local -- pnpm -r --parallel dev"
```

### **2. API Package Scripts**

**New Scripts Added:**
```json
{
  "db:seed": "doppler run --config dev -- prisma db seed",
  "db:seed:local": "doppler run --config local -- prisma db seed",
  "db:push": "doppler run --config dev -- prisma db push",
  "db:push:local": "doppler run --config local -- prisma db push",
  "db:migrate": "doppler run --config dev -- prisma migrate dev",
  "db:migrate:local": "doppler run --config local -- prisma migrate dev",
  "db:studio": "doppler run --config dev -- prisma studio",
  "db:studio:local": "doppler run --config local -- prisma studio",
  "db:generate": "doppler run --config dev -- prisma generate"
}
```

---

## 🚀 **New Usage**

### **Development Server**

**New (Recommended):**
```bash
pnpm dev
# Uses dev config automatically
```

**Old (Still Works):**
```bash
pnpm dev:local
# Uses local config
```

### **Database Commands**

**Seed Database:**
```bash
cd apps/api
pnpm db:seed              # Uses dev
pnpm db:seed:local        # Uses local
```

**Run Migrations:**
```bash
cd apps/api
pnpm db:migrate           # Uses dev
pnpm db:migrate:local     # Uses local
```

**Prisma Studio:**
```bash
cd apps/api
pnpm db:studio            # Uses dev
pnpm db:studio:local      # Uses local
```

**Generate Prisma Client:**
```bash
cd apps/api
pnpm db:generate          # Uses dev
```

**Database Push:**
```bash
cd apps/api
pnpm db:push              # Uses dev
pnpm db:push:local        # Uses local
```

---

## 📋 **Available Doppler Configs**

| Config | Environment | Purpose | Status |
|--------|-------------|---------|--------|
| `dev` | Development | **Default dev environment** | ✅ Active |
| `local` | Development | Local override/testing | ✅ Available |
| `dev_personal` | Development | Personal dev environment | ⚪ Available |
| `stg` | Staging | Pre-production testing | ⚪ Available |
| `prd` | Production | Production environment | ⚪ Available |

---

## 🔧 **Direct Doppler Commands**

If you need to run Doppler commands directly:

### **Development (Default):**
```bash
doppler run --config dev -- <command>
```

### **Local (Fallback):**
```bash
doppler run --config local -- <command>
```

### **Examples:**

```bash
# Run migrations
doppler run --config dev -- npx prisma migrate dev --name add_feature

# Seed database
doppler run --config dev -- npx prisma db seed

# Open Prisma Studio
doppler run --config dev -- npx prisma studio

# Generate Prisma Client
doppler run --config dev -- npx prisma generate

# Create test data
doppler run --config dev -- node create-test-tenants.js --count=5

# Create test chain
doppler run --config dev -- node create-test-chain-enhanced.js --scenario=retail
```

---

## 🎨 **Test Data Scripts**

Test data creation scripts work with both configs:

```bash
# Using dev (default)
cd apps/api
doppler run --config dev -- node create-test-tenants.js --type=retail --count=3
doppler run --config dev -- node create-test-chain-enhanced.js --scenario=restaurant

# Using local (fallback)
doppler run --config local -- node create-test-tenants.js --type=retail --count=3
doppler run --config local -- node create-test-chain-enhanced.js --scenario=restaurant
```

---

## 🔄 **Database Migration: Local → Dev**

### ⚠️ **IMPORTANT: Pre-Migration Checklist**

Before starting the migration, ensure:

1. **Stop all dev servers:**
   ```bash
   # Stop pnpm dev if running
   # Press Ctrl+C in the terminal running the dev server
   ```

2. **Close Prisma Studio:**
   ```bash
   # Close any open Prisma Studio instances (both local and dev)
   # They lock the database and prevent migrations
   ```

3. **Commit your code:**
   ```bash
   git add .
   git commit -m "checkpoint before database migration"
   ```

4. **Backup important data:**
   ```bash
   # If you have production data, back it up first!
   ```

---

### **Step-by-Step Sequence**

Follow these steps to migrate your database changes from `local` to `dev`:

#### **Step 1: Verify Local Database State**
```bash
cd apps/api

# Check current migrations
doppler run --config local -- npx prisma migrate status

# View database in Prisma Studio
pnpm db:studio:local
```

#### **Step 2: Generate Migration from Local Changes**
```bash
# If you have schema changes that aren't migrated yet
doppler run --config local -- npx prisma migrate dev --name your_migration_name

# This creates a new migration file in prisma/migrations/
```

#### **Step 3: Export Local Database (Optional - for data preservation)**
```bash
# Export data if you need to preserve it
doppler run --config local -- npx prisma db pull

# Or manually export specific tables if needed
```

#### **Step 4: Apply Migrations to Dev Database**
```bash
# Apply all pending migrations to dev
pnpm db:migrate

# Or explicitly:
doppler run --config dev -- npx prisma migrate dev
```

#### **Step 5: Verify Dev Database**
```bash
# Check migration status
doppler run --config dev -- npx prisma migrate status

# View in Prisma Studio
pnpm db:studio

# Verify schema is correct
doppler run --config dev -- npx prisma validate
```

#### **Step 6: Seed Dev Database**
```bash
# Seed with test data
pnpm db:seed

# Or create specific test data
doppler run --config dev -- node create-admin-user.js
doppler run --config dev -- node create-test-tenants.js --count=5
doppler run --config dev -- node create-test-chain-enhanced.js --scenario=retail
```

#### **Step 7: Generate Prisma Client**
```bash
# Regenerate Prisma Client for dev
pnpm db:generate

# Restart dev server to use new client
pnpm dev
```

---

### **Quick Migration Command Sequence**

⚠️ **Prerequisites:** Stop dev servers and close Prisma Studio first!

For a clean migration, run these commands in order:

```bash
# 1. Navigate to API directory
cd apps/api

# 2. Check local migrations are up to date
doppler run --config local -- npx prisma migrate status

# 3. Apply migrations to dev
doppler run --config dev -- npx prisma migrate deploy

# 4. Generate Prisma Client
doppler run --config dev -- npx prisma generate

# 5. Seed dev database
doppler run --config dev -- npx prisma db seed

# 6. Verify
doppler run --config dev -- npx prisma studio
```

---

### **Handling Schema Drift**

If dev database has drift (manual changes):

```bash
# Option 1: Reset dev database (DESTRUCTIVE)
doppler run --config dev -- npx prisma migrate reset --force

# Option 2: Create baseline migration
doppler run --config dev -- npx prisma migrate resolve --applied <migration_name>

# Option 3: Push schema without migrations (for prototyping)
doppler run --config dev -- npx prisma db push
```

---

### **Migration Scenarios**

#### **Scenario 1: New Feature with Schema Changes**
```bash
# 1. Develop locally
doppler run --config local -- npx prisma migrate dev --name add_new_feature

# 2. Test locally
doppler run --config local -- npx prisma studio

# 3. Apply to dev
doppler run --config dev -- npx prisma migrate dev

# 4. Commit migration files
git add apps/api/prisma/migrations/
git commit -m "feat: add new feature schema"
```

#### **Scenario 2: Syncing Existing Local Database to Dev**
```bash
# 1. Ensure all local changes are migrated
doppler run --config local -- npx prisma migrate dev

# 2. Copy migration files (they're already in git)
# No action needed - migrations are version controlled

# 3. Apply to dev
doppler run --config dev -- npx prisma migrate deploy

# 4. Seed dev with fresh data
doppler run --config dev -- npx prisma db seed
```

#### **Scenario 3: Fresh Dev Database Setup**
```bash
# 1. Reset dev database
doppler run --config dev -- npx prisma migrate reset --force

# 2. Apply all migrations
doppler run --config dev -- npx prisma migrate deploy

# 3. Seed database
doppler run --config dev -- npx prisma db seed

# 4. Create test data
doppler run --config dev -- node create-admin-user.js
doppler run --config dev -- node create-test-tenants.js --count=10
```

---

### **Data Migration Tools**

#### **Export Data from Local**
```bash
# Using Prisma
doppler run --config local -- npx prisma db pull > local-schema.prisma

# Using pg_dump (PostgreSQL)
doppler run --config local -- pg_dump $DATABASE_URL > local-backup.sql
```

#### **Import Data to Dev**
```bash
# Using psql (PostgreSQL)
doppler run --config dev -- psql $DATABASE_URL < local-backup.sql

# Or use Prisma seed scripts
doppler run --config dev -- npx prisma db seed
```

---

## 🔄 **Migration Checklist**

- [x] Update root `package.json` scripts
- [x] Update `apps/api/package.json` scripts
- [x] Create migration documentation
- [x] Test dev config with database operations
- [x] Verify all npm scripts work
- [ ] Migrate database from local to dev
- [ ] Update team documentation
- [ ] Notify team members of change

---

## 🧪 **Testing the Migration**

Run these commands to verify everything works:

```bash
# 1. Start dev server
pnpm dev

# 2. In another terminal, test database commands
cd apps/api
pnpm db:studio

# 3. Test migrations
pnpm db:migrate

# 4. Test seeding
pnpm db:seed

# 5. Test data generation
doppler run --config dev -- node create-admin-user.js
```

---

## 🆘 **Troubleshooting**

### **Issue: "Config not found"**
**Solution:** Verify Doppler configs:
```bash
doppler configs
```

### **Issue: "Environment variables not loading"**
**Solution:** Check Doppler setup:
```bash
doppler setup
```

### **Issue: "Need to use local config"**
**Solution:** Use the `:local` suffix:
```bash
pnpm dev:local
pnpm db:seed:local
```

---

## 📚 **Related Documentation**

- [Organization Request Workflow](./ORGANIZATION_REQUEST_WORKFLOW.md)
- [Doppler CLI Documentation](https://docs.doppler.com/docs/cli)
- [Environment Configuration Best Practices](https://12factor.net/config)

---

## 🎯 **Benefits of Dev Config**

1. **Environment Separation** - Clear distinction between local experiments and shared dev
2. **Team Consistency** - Everyone uses the same dev environment
3. **Easier Onboarding** - New team members just run `pnpm dev`
4. **Fallback Available** - Local config still works for special cases
5. **Production Safety** - Clear separation from production config

---

## 📝 **Quick Reference**

| Task | Command |
|------|---------|
| Start dev server | `pnpm dev` |
| Seed database | `cd apps/api && pnpm db:seed` |
| Run migrations | `cd apps/api && pnpm db:migrate` |
| Open Prisma Studio | `cd apps/api && pnpm db:studio` |
| Generate Prisma Client | `cd apps/api && pnpm db:generate` |
| Create test tenants | `cd apps/api && doppler run --config dev -- node create-test-tenants.js` |
| Create test chain | `cd apps/api && doppler run --config dev -- node create-test-chain-enhanced.js` |
| Use local config | Add `:local` suffix to any command |

---

**Migration completed successfully! 🎉**

All commands now use `dev` config by default with `local` as a fallback option.
