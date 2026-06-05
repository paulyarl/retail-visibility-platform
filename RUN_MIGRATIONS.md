# Featured Products Dual System - Migration Instructions

## 🚀 **Ready to Run! - FIXED**

The dual featured products system is complete and ready for deployment. Database schema issues have been resolved.

## 📋 **Migration Steps**

### **1. Database Migrations (Run in Order)**

```bash
# Step 1: Add featured types to inventory_items table
psql -f apps/api/migrations/add_featured_types.sql

# Step 2: Update materialized view with featured_type support
psql -f apps/api/migrations/add_featured_type_to_mv.sql
```

### **2. What These Migrations Do**

#### **Migration 1: `add_featured_types.sql` - FIXED**
- ✅ Adds `featured_type` column to `inventory_items` table
- ✅ Uses existing `featured_at`, `featured_priority` fields (already in schema)
- ✅ Creates optimized indexes for fast queries
- ✅ Updates existing featured products to `store_selection` type
- ✅ Adds check constraint for valid featured types

#### **Migration 2: `add_featured_type_to_mv.sql` - FIXED**
- ✅ Updates `storefront_products` materialized view
- ✅ Uses correct `directory_category_id` field (not `category_id`)
- ✅ Includes `featured_type` field for type-based filtering
- ✅ Creates optimized indexes for featured type queries
- ✅ Refreshes materialized view with new data

## 🔧 **Database Schema Fixes Applied**

### **Fixed Issues:**
1. **Column Name:** `category_id` → `directory_category_id` ✅
2. **Field Conflicts:** Removed duplicate field additions ✅
3. **Array Function:** `json_array_length()` → `array_length()` for text arrays ✅
4. **Join Condition:** Fixed platform_categories join to use `pc.id = ii.directory_category_id` ✅
5. **Tenant Status:** `t.is_active` → `t.location_status = 'active'` ✅
6. **Missing Joins:** Added `directory_listings_list` join and proper WHERE conditions ✅
7. **Index References:** Updated to use correct field names ✅
8. **Field Aliases:** Updated `gc` → `pc` throughout query ✅

### **Schema Alignment:**
- ✅ Uses existing `featured_at`, `featured_until`, `featured_priority`
- ✅ Only adds new `featured_type` field
- ✅ Correctly references `directory_category_id`
- ✅ Proper join with `platform_categories.id`
- ✅ Correct array handling for `image_gallery` field
- ✅ Proper tenant status: `t.location_status = 'active'`
- ✅ Complete WHERE clause matching working MV

## 🎯 **Featured Types Available**

| Type | Purpose | Location | Max Products |
|------|---------|----------|--------------|
| `store_selection` | Directory featured products | Directory page | 6 |
| `new_arrival` | New products | Storefront page | 12 |
| `seasonal` | Seasonal promotions | Storefront page | 8 |
| `sale` | Sale items | Storefront page | 10 |
| `staff_pick` | Staff favorites | Storefront page | 8 |

## 🔧 **API Endpoints Ready**

### **Tenant Featured Management**
```typescript
GET /api/tenants/:tenantId/featured?type=new_arrival
PUT /api/tenants/:tenantId/featured/:type
GET /api/tenants/:tenantId/available-featured?type=seasonal
```

### **Storefront Featured Display**
```typescript
GET /api/storefront/:tenantId/featured-products?type=store_selection
GET /api/storefront/:tenantId/featured-products?type=new_arrival
```

## 🎨 **UI Components Ready**

### **Management Interface**
- ✅ `FeaturedProductsManager.tsx` - Complete management UI
- ✅ Added to tenant settings navigation
- ✅ Settings page: `/t/[tenantId]/settings/featured-products`

### **Display Components**
- ✅ `StorefrontFeaturedProducts.tsx` - Dynamic storefront sections
- ✅ Directory page updated for `store_selection` type
- ✅ Storefront page includes all promotional types

## 🚀 **Integration Points**

### **Directory Page Updates**
- ✅ Fetches `type=store_selection` featured products
- ✅ Shows 6 best products for new customer acquisition
- ✅ "Visit Storefront" call-to-action

### **Storefront Page Updates**
- ✅ Dynamic sections for each featured type
- ✅ Only shows sections that have products
- ✅ Color-coded by type (green, orange, red, purple)

### **Settings Integration**
- ✅ Added "Featured Products" to Store Settings
- ✅ Complete management interface with 5 type tabs
- ✅ Visual dashboard with counts and controls

## 🎯 **Customer Journey Strategy**

### **Directory Page (Acquisition)**
1. Header
2. **Directory Featured** (6 best products) ⭐
3. Brief About (Trust building)
4. Photo Gallery (Visual proof)
5. Categories (Discovery)
6. Reviews (Social proof)

### **Storefront Page (Conversion)**
1. Header
2. **New Arrivals** (Fresh content)
3. **Seasonal Items** (Timely relevance)
4. **Sale Items** (Urgency/promotions)
5. **Staff Picks** (Personal touch)
6. Full Catalog (Complete discovery)

## 📊 **Business Benefits**

### **✅ No Redundancy**
- Different products for different purposes
- Directory: Best overall products
- Storefront: Dynamic, timely content

### **✅ Strategic Value**
- **Acquisition:** Directory hooks new customers
- **Engagement:** Storefront keeps customers interested
- **Conversion:** Multiple touchpoints with different motivations

### **✅ User Experience**
- Progressive discovery (best → fresh → timely)
- Clear value propositions
- Dynamic, engaging content

## 🔍 **Testing Checklist**

After running migrations:

### **API Testing**
```bash
# Test featured products by type
curl "http://localhost:4000/api/storefront/YOUR_TENANT_ID/featured-products?type=store_selection"
curl "http://localhost:4000/api/storefront/YOUR_TENANT_ID/featured-products?type=new_arrival"

# Test management endpoints
curl "http://localhost:4000/api/tenants/YOUR_TENANT_ID/featured"
```

### **UI Testing**
1. Visit `/t/[tenantId]/settings/featured-products`
2. Verify 5 featured type tabs appear
3. Test product selection and saving
4. Check directory page shows store_selection products
5. Check storefront page shows promotional sections

### **Data Migration**
```sql
-- Verify existing featured products migrated correctly
SELECT COUNT(*) FROM inventory_items WHERE is_featured = true AND featured_type = 'store_selection';

-- Verify materialized view updated
SELECT COUNT(*) FROM storefront_products WHERE featured_type = 'store_selection';
```

## 🎉 **Ready to Launch!**

The dual featured products system is:
- ✅ **Database migrations ready**
- ✅ **API endpoints implemented**
- ✅ **UI components complete**
- ✅ **Integration points connected**
- ✅ **Customer journey optimized**

**Run the migrations and the system will be live!** 🚀

## 📞 **Support**

If you encounter any issues:
1. Check migration logs for errors
2. Verify API endpoints respond correctly
3. Test UI components load properly
4. Validate data migration completed

The system is designed for backward compatibility and will gracefully handle missing data.
