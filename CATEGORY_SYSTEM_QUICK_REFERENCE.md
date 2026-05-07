# Category System - Quick Reference Guide

**Status:** ✅ PRODUCTION READY - Two independent category systems

---

## Two Separate Category Systems

### **1. Product Categories** (What you SELL)
- **Purpose:** Organize inventory and products
- **Examples:** Dog Food, Prescription Medications, Fresh Produce
- **Source:** Google Product Taxonomy (6,000+ categories)
- **Table:** `directory_category` (with product-specific usage)

### **2. Directory Categories** (What you ARE)
- **Purpose:** Business classification for directory listings
- **Examples:** Grocery Store, Pharmacy, Pet Store
- **Source:** Google Business Profile (4,000+ categories)
- **Table:** `directory_category` (platform) + `directory_settings_list` (assignment)

---

## Quick Links

### **For Tenants:**

**Product Categories:**
- **Manage:** `http://localhost:3000/t/{tenantId}/categories/manage`
- **Purpose:** Create/edit product categories for inventory
- **Actions:** Import from Google Taxonomy, create custom, organize products

**Directory Categories:**
- **Manage:** `http://localhost:3000/t/{tenantId}/settings/directory`
- **Purpose:** Select business type categories for directory listing
- **Actions:** Select 1 primary + up to 9 secondary categories

---

### **For Admins:**

**Platform Product Categories:**
- **Seed:** `http://localhost:3000/admin/categories`
- **Purpose:** Seed platform-level product categories
- **Actions:** Bulk import from Google Product Taxonomy

**Platform Directory Categories:**
- **Seed:** `http://localhost:3000/admin/platform-categories`
- **Purpose:** Seed platform-level directory/business categories
- **Actions:** Bulk import 25 GBP business types

---

## System Comparison

| Aspect | Product Categories | Directory Categories |
|--------|-------------------|---------------------|
| **What** | What you SELL | What you ARE |
| **Examples** | Dog Food, Medications | Grocery Store, Pharmacy |
| **Source** | Google Product Taxonomy | Google Business Profile |
| **Count** | 6,000+ available | 4,000+ available (25 seeded) |
| **Tenant Limit** | Unlimited | 1 primary + 9 secondary |
| **Used For** | Product organization | Directory listing |
| **Tenant Page** | `/t/{tenantId}/categories/manage` | `/t/{tenantId}/settings/directory` |
| **Admin Page** | `/admin/categories` | `/admin/platform-categories` |
| **Table** | `directory_category` | `directory_category` + `directory_settings_list` |

---

## Data Flow

### **Product Categories:**

```
Admin Seeds Product Categories
    ↓
/admin/categories (Google Product Taxonomy)
    ↓
Tenant Manages Product Categories
    ↓
/t/{tenantId}/categories/manage
    ↓
Create/Import/Organize
    ↓
Assign to Products
    ↓
Product Organization & Inventory
```

### **Directory Categories:**

```
Admin Seeds Directory Categories
    ↓
/admin/platform-categories (GBP Business Types)
    ↓
Tenant Selects Directory Categories
    ↓
/t/{tenantId}/settings/directory
    ↓
Select Primary (1) + Secondary (up to 9)
    ↓
Save to directory_settings_list
    ↓
Directory Listing & Google Business Profile
```

---

## Database Schema

### **Product Categories:**

```prisma
// Stored in directory_category table
model directory_category {
  id                 String
  tenantId           String   // 'platform' or 't-abc123'
  name               String   // "Dog Food"
  slug               String   // "dog-food"
  googleCategoryId   String?  // Google Product Taxonomy ID
  // ... other fields
}
```

**Usage:** Product organization, inventory management

### **Directory Categories:**

**Available Categories:**
```prisma
// Also stored in directory_category table
model directory_category {
  id                 String
  tenantId           String   // 'platform' for GBP categories
  name               String   // "Grocery Store"
  slug               String   // "grocery-store"
  googleCategoryId   String?  // GBP category ID (gcid:*)
  // ... other fields
}
```

**Selected Categories:**
```prisma
// Stored in directory_settings_list table
model directory_settings_list {
  id                   String
  tenant_id            String
  primary_category     String?   // "Grocery Store"
  secondary_categories String[]  // ["Supermarket", "Organic Food Store"]
  // ... other fields
}
```

**Usage:** Directory listing, business classification, GBP sync

---

## User Workflows

### **Product Category Workflow:**

**Tenant wants to organize products:**
1. Navigate to `/t/{tenantId}/categories/manage`
2. Import from Google Product Taxonomy (6,000+ categories)
3. Create custom product categories
4. Assign categories to products
5. Use for inventory organization

### **Directory Category Workflow:**

**Tenant wants to appear in directory:**
1. Navigate to `/t/{tenantId}/settings/directory`
2. Select primary business category (e.g., "Grocery Store")
3. Add secondary categories (e.g., "Supermarket", "Organic Food Store")
4. Add description and keywords
5. Publish to directory
6. Categories sync to Google Business Profile

---

## Admin Workflows

### **Seed Product Categories:**

**Admin wants to provide product taxonomy:**
1. Navigate to `/admin/categories`
2. Bulk import from Google Product Taxonomy
3. Categories available to all tenants
4. Tenants can import for product organization

### **Seed Directory Categories:**

**Admin wants to provide business types:**
1. Navigate to `/admin/platform-categories`
2. Bulk import 25 GBP business types
3. Categories available to all tenants
4. Tenants select for directory listings

---

## Key Differences

### **Product Categories:**

**Flexibility:**
- ✅ Unlimited categories per tenant
- ✅ Full CRUD operations
- ✅ Custom categories encouraged
- ✅ Hierarchical organization
- ✅ No strict limits

**Purpose:**
- Organize products
- Inventory management
- Internal classification
- E-commerce categorization

### **Directory Categories:**

**Constraints:**
- ⚠️ 1 primary category (required)
- ⚠️ Up to 9 secondary (optional)
- ⚠️ Must match GBP taxonomy
- ⚠️ Total: 10 categories max
- ⚠️ GBP compliance required

**Purpose:**
- Business classification
- Directory listing
- Search & discovery
- Google Business Profile sync
- SEO optimization

---

## Navigation Structure

### **Tenant Navigation:**

```
Dashboard
Inventory
Categories ← Product Categories (/t/{tenantId}/categories/manage)
Tenants
Settings
  ├─ Profile
  ├─ Directory ← Directory Categories (/t/{tenantId}/settings/directory)
  ├─ Integrations
  └─ ...
```

### **Admin Navigation:**

```
Dashboard
Platform Categories ← Directory Categories (/admin/platform-categories)
Categories ← Product Categories (/admin/categories)
Tenants
Settings
```

---

## API Endpoints

### **Product Categories:**

```
# Platform Product Categories
GET    /api/platform/categories
POST   /api/platform/categories
PATCH  /api/platform/categories/:id
DELETE /api/platform/categories/:id

# Tenant Product Categories
GET    /api/v1/tenants/:tenantId/categories
POST   /api/v1/tenants/:tenantId/categories
PATCH  /api/v1/tenants/:tenantId/categories/:id
DELETE /api/v1/tenants/:tenantId/categories/:id
```

### **Directory Categories:**

```
# Platform Directory Categories (same endpoints, different data)
POST   /api/platform/categories/bulk-import  # Import 25 GBP types

# Tenant Directory Settings (category assignment)
GET    /api/tenants/:tenantId/directory
PUT    /api/tenants/:tenantId/directory
POST   /api/tenants/:tenantId/directory/publish
```

---

## Common Confusion Points

### **Q: Why same table for both?**

**A:** The `directory_category` table is flexible:
- **Product Categories:** `tenantId` = 'platform' or 't-abc123', used for products
- **Directory Categories:** `tenantId` = 'platform', used for business types
- **Assignment:** Stored separately in `directory_settings_list`

### **Q: Can I use product categories for directory?**

**A:** No, they serve different purposes:
- **Product Categories:** What you sell (internal organization)
- **Directory Categories:** What you are (public classification)

### **Q: Why two admin pages?**

**A:** Different sources and purposes:
- `/admin/categories` → Google Product Taxonomy (6,000+ product types)
- `/admin/platform-categories` → Google Business Profile (4,000+ business types)

### **Q: Why can't I create custom directory categories?**

**A:** Directory categories must match GBP taxonomy for:
- Google Business Profile sync
- SEO optimization
- Industry standards
- Search accuracy

(But you CAN create unlimited custom product categories!)

---

## Best Practices

### **For Product Categories:**

✅ **Do:**
- Create specific product categories
- Use hierarchies for organization
- Import from Google Product Taxonomy
- Customize for your inventory
- Use unlimited categories

❌ **Don't:**
- Use for business classification
- Confuse with directory categories
- Limit yourself to platform categories

### **For Directory Categories:**

✅ **Do:**
- Select accurate business type
- Choose primary carefully (most important)
- Add relevant secondary categories
- Match GBP taxonomy
- Stay within 1 + 9 limit

❌ **Don't:**
- Select unrelated categories
- Exceed 9 secondary categories
- Use product categories here
- Create custom directory categories

---

## Testing Checklist

### **Product Categories:**
- [ ] Admin can seed from Google Product Taxonomy
- [ ] Tenant can import platform categories
- [ ] Tenant can create unlimited custom categories
- [ ] Categories can be assigned to products
- [ ] No limit on category count

### **Directory Categories:**
- [ ] Admin can seed 25 GBP business types
- [ ] Tenant can select 1 primary category
- [ ] Tenant can add up to 9 secondary categories
- [ ] Cannot exceed 10 total categories
- [ ] Categories appear in directory listing
- [ ] Categories sync to Google Business Profile

---

## Summary

**Two Independent Systems:**

| System | Page | Purpose | Limit |
|--------|------|---------|-------|
| **Product** | `/t/{tenantId}/categories/manage` | Organize products | Unlimited |
| **Directory** | `/t/{tenantId}/settings/directory` | Classify business | 1 + 9 max |

**Admin Seeding:**

| System | Page | Source | Count |
|--------|------|--------|-------|
| **Product** | `/admin/categories` | Google Product Taxonomy | 6,000+ |
| **Directory** | `/admin/platform-categories` | Google Business Profile | 4,000+ (25 seeded) |

**Key Insight:**

These are **two completely separate systems** that happen to share the same underlying table structure but serve different purposes:
- **Product Categories** = Internal organization (what you sell)
- **Directory Categories** = External classification (what you are)

---

**Your understanding is 100% correct!** 🎉
