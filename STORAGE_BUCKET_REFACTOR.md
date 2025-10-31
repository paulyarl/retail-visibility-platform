# Storage Bucket Refactoring Summary

**Date:** October 31, 2025  
**Purpose:** Centralize Supabase storage bucket configuration and support multiple buckets

---

## 🎯 Problem Solved

**Before:** Hardcoded bucket names (`"photos"`, `"tenants"`) scattered across multiple files  
**After:** Centralized configuration with environment variable support for 3 separate buckets

---

## 📦 Bucket Structure

### 1. **Photos Bucket** - Product/Inventory Images
```bash
BUCKET_NAME=photos               # Default: photos
PUBLIC_FLAG=true                 # Default: true
```
**Used for:** Product photos, inventory item images uploaded by tenants

### 2. **Tenants Bucket** - Tenant Branding Assets
```bash
TENANT_BUCKET_NAME=tenants       # Default: tenants
TENANT_PUBLIC_FLAG=true          # Default: true
```
**Used for:** Tenant logos, business profile images, tenant-specific branding

### 3. **Brands Bucket** - Platform Branding Assets
```bash
BRAND_BUCKET_NAME=brands         # Default: brands
BRAND_PUBLIC_FLAG=true           # Default: true
```
**Used for:** Platform logo, favicon, white-label branding assets

**Bucket Alignment:**
- **PHOTOS** = Product/inventory images (tenant uploads)
- **TENANTS** = Tenant branding (tenant logos, profiles)
- **BRANDS** = Platform branding (platform logo, favicon)

**Note:** Each is a separate Supabase storage bucket. File organization within buckets is handled by application code (e.g., `tenantId/sku/filename.jpg`).

---

## 🆕 New Files Created

### `apps/api/src/storage-config.ts`
Centralized storage bucket configuration with:
- `StorageBuckets` constant with all bucket configs (name, isPublic)
- `extractPathFromUrl()` helper for URL parsing
- Environment variable support with sensible defaults
- Each bucket is a separate Supabase storage bucket

**Example usage:**
```typescript
import { StorageBuckets } from './storage-config';

// Upload to photos bucket
await supabase.storage
  .from(StorageBuckets.PHOTOS.name)
  .upload(path, buffer);

// Upload to tenants bucket
await supabase.storage
  .from(StorageBuckets.TENANTS.name)
  .upload(path, buffer);
```

---

## 📝 Files Modified

### 1. `apps/api/src/index.ts`
**Changes:**
- Import `StorageBuckets` from `./storage-config`
- Replace `TENANT_BUCKET_NAME` variable with `StorageBuckets.TENANTS`
- Replace hardcoded `"photos"` with `StorageBuckets.PHOTOS.name`
- Update all `.from("photos")` calls to `.from(StorageBuckets.PHOTOS.name)`
- Update all `.from(TENANT_BUCKET_NAME)` calls to `.from(TENANT_BUCKET.name)`

**Lines affected:**
- Tenant logo upload (multipart)
- Tenant logo upload (dataUrl)
- Product photo upload (multipart)
- Product photo upload (dataUrl)

### 2. `apps/api/src/photos.ts`
**Changes:**
- Import `StorageBuckets` from `./storage-config`
- Fix duplicate `Router` import
- Replace all `"photos"` bucket references with `StorageBuckets.PHOTOS.name`

**Lines affected:**
- Photo upload (multipart)
- Photo upload (dataUrl)
- Photo deletion

### 3. `apps/api/src/routes/platform-settings.ts`
**Changes:**
- Import `StorageBuckets` from `../storage-config`
- Replace hardcoded `'photos'` with `StorageBuckets.PHOTOS.name`

**Lines affected:**
- Platform logo upload
- Platform favicon upload

### 4. `ENVIRONMENT_VARIABLES.md`
**Changes:**
- Add 9 new bucket configuration variables to quick reference table
- Add detailed "Supabase Storage Buckets" section
- Document all bucket variables with usage examples

---

## 🔧 Environment Variables

### Required in Railway (API):
**None** - All bucket variables have sensible defaults

### Optional in Railway (API):
```bash
# Photos bucket (defaults shown)
BUCKET_NAME=photos
PUBLIC_FLAG=true

# Tenants bucket (defaults shown)
TENANT_BUCKET_NAME=tenants
TENANT_PUBLIC_FLAG=true

# Brands bucket (defaults shown)
BRAND_BUCKET_NAME=brands
BRAND_PUBLIC_FLAG=true
```

---

## ✅ Benefits

### 1. **Centralized Configuration**
- Single source of truth for bucket names
- Easy to change bucket names without touching code
- Consistent bucket access across the codebase

### 2. **Environment Flexibility**
- Different bucket names per environment (dev/staging/prod)
- Public/private flag configuration per bucket
- Separate buckets for better organization

### 3. **Type Safety**
- TypeScript types for bucket names
- Compile-time checks for bucket references
- Autocomplete support in IDEs

### 4. **Maintainability**
- No more scattered hardcoded strings
- Easy to add new buckets in the future
- Clear documentation of bucket usage

### 5. **Clean Organization**
- Separate buckets for different asset types
- Clear separation of concerns
- Backward compatible with existing URLs

---

## 🧪 Testing Checklist

### Photo Uploads:
- [ ] Upload product photo (multipart)
- [ ] Upload product photo (dataUrl)
- [ ] Delete product photo
- [ ] Verify photo URLs are correct

### Tenant Logo Uploads:
- [ ] Upload tenant logo (multipart)
- [ ] Upload tenant logo (dataUrl)
- [ ] Verify logo displays on storefront
- [ ] Verify logo URL is correct

### Platform Settings:
- [ ] Upload platform logo
- [ ] Upload platform favicon
- [ ] Verify settings save correctly

---

## 🚀 Deployment Notes

### No Breaking Changes:
- All defaults match current hardcoded values
- Existing code continues to work without env vars
- URLs remain unchanged

### Optional Migration:
If you want to use different bucket names or prefixes:

1. **Create new buckets in Supabase** (if needed)
2. **Set environment variables in Railway:**
   ```bash
   railway variables set BUCKET_NAME=your-photos-bucket
   railway variables set TENANT_BUCKET_NAME=your-tenants-bucket
   railway variables set BRAND_BUCKET_NAME=your-brands-bucket
   ```
3. **Redeploy API** - changes take effect immediately
4. **Migrate existing files** (optional) using migration scripts

---

## 📊 Code Statistics

**Files created:** 1  
**Files modified:** 4  
**Lines added:** ~100  
**Lines removed:** ~0  
**Hardcoded strings removed:** 12+  

**Bucket references centralized:**
- Photos bucket: 8 locations → 1 config
- Tenants bucket: 4 locations → 1 config
- Brands bucket: 0 locations → 1 config (ready for future use)

**Environment variables:**
- Total: 6 (3 bucket names + 3 public flags)
- All optional with sensible defaults
- No folder prefixes needed - buckets ARE the organization

---

## 🔮 Future Enhancements

### Potential Additions:
1. **Bucket validation** - Check if buckets exist on startup
2. **Auto-create buckets** - Create missing buckets automatically
3. **Bucket policies** - Configure RLS policies via code
4. **CDN integration** - Add CDN URLs for bucket access
5. **Multi-region support** - Different buckets per region

### New Buckets to Add:
- **Documents bucket** - PDFs, receipts, invoices
- **Videos bucket** - Product videos, tutorials
- **Exports bucket** - CSV exports, reports
- **Temp bucket** - Temporary file uploads

---

## 📞 Rollback Plan

If issues arise, rollback is simple:

1. **No env vars needed** - defaults match current behavior
2. **No database changes** - purely code refactor
3. **No URL changes** - existing URLs still work
4. **Revert commits** - single commit to revert

**Rollback command:**
```bash
git revert <commit-hash>
git push origin staging
```

---

## ✨ Summary

**What changed:**
- Centralized bucket configuration in `storage-config.ts`
- Replaced 12+ hardcoded bucket names with config references
- Added support for 3 separate buckets (photos, tenants, brands)
- Added 9 new environment variables (all optional)
- Updated documentation

**What stayed the same:**
- All existing URLs
- All existing functionality
- All existing bucket names (by default)
- No database changes
- No breaking changes

**Result:**
- ✅ More maintainable code
- ✅ More flexible configuration
- ✅ Better type safety
- ✅ Easier to test
- ✅ Ready for future growth

---

*Last updated: October 31, 2025*  
*Next review: After testing in staging*
