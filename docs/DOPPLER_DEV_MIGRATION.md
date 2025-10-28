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

## 🔄 **Migration Checklist**

- [x] Update root `package.json` scripts
- [x] Update `apps/api/package.json` scripts
- [x] Create migration documentation
- [x] Test dev config with database operations
- [x] Verify all npm scripts work
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
