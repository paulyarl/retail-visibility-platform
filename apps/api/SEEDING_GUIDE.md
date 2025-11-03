# Seeding Scripts Guide

Quick reference for all seeding scripts in the project.

**Important:** All scripts require database connection via Doppler environment variables.

---

## 🚀 Quick Start (TL;DR)

**Need test data fast?** Run this:

```bash
# Get a tenant ID from your database or create a chain first
doppler run -- node seed-tenant-products.js \
  --tenant=YOUR_TENANT_ID \
  --scenario=grocery \
  --products=50 \
  --assign-all \
  --clear
```

**Result:** 50 products + 8 categories, 100% categorized in 1-2 seconds! ⚡

---

## Running with Doppler

All commands should be prefixed with `doppler run --`:

```bash
# Example
doppler run -- node create-test-chain-enhanced.js
doppler run -- node seed-tenant-products.js --tenant=tenant_123
```

---

## 1. Create Test Chain (Organization + Tenants + Products)

**Script:** `create-test-chain-enhanced.js`

### Basic Usage
```bash
# Default chain (3 locations, 600 SKUs each)
doppler run -- node create-test-chain-enhanced.js

# Custom name
doppler run -- node create-test-chain-enhanced.js --name="My Retail Chain"

# Specific number of locations and SKUs
doppler run -- node create-test-chain-enhanced.js --locations=5 --skus=1000
```

### Size Presets
```bash
# Small chain (2 locations, 500 SKUs each)
doppler run -- node create-test-chain-enhanced.js --size=small

# Medium chain (3 locations, 1500 SKUs each)
doppler run -- node create-test-chain-enhanced.js --size=medium

# Large chain (5 locations, 3000 SKUs each)
doppler run -- node create-test-chain-enhanced.js --size=large
```

### Scenarios
```bash
# Restaurant chain
doppler run -- node create-test-chain-enhanced.js --scenario=restaurant

# Retail chain
doppler run -- node create-test-chain-enhanced.js --scenario=retail

# Franchise chain
doppler run -- node create-test-chain-enhanced.js --scenario=franchise
```

### Multiple Chains
```bash
# Create 5 chains
doppler run -- node create-test-chain-enhanced.js --count=5

# Create 3 random chains
doppler run -- node create-test-chain-enhanced.js --count=3 --random
```

---

## 2. Seed Tenant Products & Categories

**Script:** `seed-tenant-products.js`

### Basic Usage
```bash
# Default (100 products, general store)
doppler run -- node seed-tenant-products.js --tenant=tenant_123

# Specific number of products
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --products=500

# With categories
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --with-categories

# Assign all products to categories (recommended!)
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --assign-all

# Quick test with 50 products, fully categorized
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=grocery --products=50 --assign-all --clear
```

### Scenarios

#### Grocery Store
```bash
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=grocery --products=300 --assign-all
```
**Categories:** Dairy & Eggs, Produce, Meat & Seafood, Bakery, Frozen Foods, Beverages, Snacks, Pantry Staples

#### Fashion Store
```bash
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=fashion --products=200 --assign-all
```
**Categories:** Men's Clothing, Women's Clothing, Shoes, Accessories, Activewear, Outerwear

#### Electronics Store
```bash
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=electronics --products=150 --assign-all
```
**Categories:** Computers, Smartphones, Audio, Gaming, Cameras, Accessories

#### General Store
```bash
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=general --products=250 --assign-all
```
**Categories:** Electronics, Home & Garden, Toys & Games, Sports, Books

### Clear and Reseed
```bash
# Clear existing data first
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --clear --scenario=grocery --products=500 --assign-all
```

---

## 3. Common Workflows

### Workflow 1: New Chain with Categorized Products
```bash
# Step 1: Create chain (note the tenant IDs in output)
doppler run -- node create-test-chain-enhanced.js --name="Fresh Grocers" --size=medium

# Step 2: Seed products for each tenant
doppler run -- node seed-tenant-products.js --tenant=tenant_XXX_0 --scenario=grocery --products=400 --assign-all
doppler run -- node seed-tenant-products.js --tenant=tenant_XXX_1 --scenario=grocery --products=350 --assign-all
doppler run -- node seed-tenant-products.js --tenant=tenant_XXX_2 --scenario=grocery --products=300 --assign-all
```

### Workflow 2: Test M3 Category Features
```bash
# Create tenant with products and categories
doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=grocery --products=200 --with-categories

# Products are created but NOT assigned to categories
# Perfect for testing category assignment UI
```

### Workflow 3: Full E2E Testing
```bash
# Create large chain with varied data
doppler run -- node create-test-chain-enhanced.js --name="Test Retail Co" --locations=5 --skus=800 --random

# Seed each location with different scenarios
doppler run -- node seed-tenant-products.js --tenant=tenant_XXX_0 --scenario=grocery --products=500 --assign-all
doppler run -- node seed-tenant-products.js --tenant=tenant_XXX_1 --scenario=fashion --products=300 --assign-all
doppler run -- node seed-tenant-products.js --tenant=tenant_XXX_2 --scenario=electronics --products=200 --assign-all
```

---

## 4. Finding Tenant IDs

### Method 1: Check Script Output
When you run `create-test-chain-enhanced.js`, it outputs tenant IDs:
```
✅ Demo Retail Chain - Main Store: 600 SKUs
   Tenant ID: tenant_1699123456789_0
```

### Method 2: Query Database
```bash
# List all tenants
npx prisma studio

# Or use psql/SQL
SELECT id, name FROM tenants ORDER BY created_at DESC LIMIT 10;
```

### Method 3: Admin Dashboard
Navigate to: `http://localhost:3000/admin/organizations`

---

## 5. Tips & Best Practices

### Performance
- Use `--products=100` for quick testing
- Use `--products=1000+` for performance testing
- Batch operations happen in groups of 100

### Data Quality
- `--assign-all` ensures 100% category mapping (good for testing feed validation)
- `--with-categories` creates categories but leaves products unassigned (good for testing assignment UI)
- Without flags, only products are created (good for testing category creation)

### Cleanup
- Use `--clear` to remove existing data before seeding
- Or manually delete via Prisma Studio or SQL

### Realistic Data
- Products have varied prices, stock levels, and availability
- ~75% products are active
- ~75% products are in stock
- Product names include variations (colors, sizes, adjectives)

---

## 6. Troubleshooting

### "Tenant not found"
- Verify tenant ID is correct
- Check tenant exists: `SELECT * FROM tenants WHERE id = 'tenant_123';`

### "Out of memory"
- Reduce `--products` count
- Script batches in groups of 100, but very large numbers may still cause issues

### Categories not appearing
- Make sure you used `--with-categories` or `--assign-all`
- Check: `SELECT * FROM categories WHERE tenant_id = 'tenant_123';`

### Products not assigned to categories
- Use `--assign-all` flag
- Check: `SELECT COUNT(*) FROM inventory_items WHERE category_id IS NOT NULL;`

---

## 7. Example: Complete M3 Testing Setup

```bash
# 1. Create a test chain
doppler run -- node create-test-chain-enhanced.js --name="M3 Test Chain" --size=small

# Output shows tenant IDs, e.g., tenant_1699123456789_0

# 2. Seed first location with grocery products (FULLY CATEGORIZED)
doppler run -- node seed-tenant-products.js \
  --tenant=tenant_1699123456789_0 \
  --scenario=grocery \
  --products=300 \
  --assign-all \
  --clear

# Result: 300 products, 8 categories, 100% categorized in ~2 seconds!

# 3. Seed second location with partial categorization (for testing assignment UI)
doppler run -- node seed-tenant-products.js \
  --tenant=tenant_1699123456789_1 \
  --scenario=grocery \
  --products=250 \
  --with-categories

# Result: 250 products, 8 categories, 0% categorized (test manual assignment)

# Now you can test:
# - Category management UI (/t/{tenantId}/categories)
# - Product assignment to categories (/t/{tenantId}/items)
# - GBP category selection (/t/{tenantId}/settings/gbp-category)
# - Feed validation with category mapping
# - Category alignment status (should show 100% for first tenant)
```

---

## 8. Script Locations

- **Chain Creator:** `apps/api/create-test-chain-enhanced.js`
- **Product Seeder:** `apps/api/seed-tenant-products.js`
- **This Guide:** `apps/api/SEEDING_GUIDE.md`

---

**Happy Seeding! 🌱**
