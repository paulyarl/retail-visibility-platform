# Migration Example: Branding Page

Example of migrating the tenant branding page to use the centralized image upload middleware.

## Before (Current Code)

```typescript
// 60+ lines of custom compression logic
const compressImage = async (file: File, maxWidth = 800, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Preserve transparency for PNG images
      if (file.type === 'image/png') {
        ctx.clearRect(0, 0, width, height);
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Use original format to preserve transparency
      const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const outputQuality = file.type === 'image/png' ? 1 : quality;
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedReader = new FileReader();
            compressedReader.onloadend = () => {
              resolve(compressedReader.result as string);
            };
            compressedReader.readAsDataURL(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        outputFormat,
        outputQuality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    reader.readAsDataURL(file);
  });
};

// Manual validation in upload handler
const handleLogoUpload = async (file: File) => {
  try {
    setUploadingLogo(true);
    setError(null);

    // Validate file type (accept images and .ico files)
    const isIco = file.type === 'image/x-icon' || 
                  file.type === 'image/vnd.microsoft.icon' || 
                  file.name.endsWith('.ico');
    if (!file.type.startsWith('image/') && !isIco) {
      throw new Error('Please upload an image file (PNG, JPEG, or ICO)');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be less than 5MB');
    }

    // Validate aspect ratio (should be roughly square for logos)
    const img = document.createElement('img');
    const imageUrl = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });
    URL.revokeObjectURL(imageUrl);

    const aspectRatio = img.width / img.height;
    if (aspectRatio < 0.5 || aspectRatio > 2) {
      throw new Error('Logo should be roughly square (aspect ratio between 1:2 and 2:1).');
    }

    // Compress image
    const compressedBase64 = await compressImage(file);

    // Upload to backend with correct content type
    const contentType = (file.type === 'image/png' || isIco) ? 'image/png' : 'image/jpeg';
    const body = JSON.stringify({
      tenant_id: tenantId,
      dataUrl: compressedBase64,
      contentType 
    });

    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    // ... handle response
  } catch (err: any) {
    console.error('Logo upload error:', err);
    setError(err.message || 'Failed to upload logo');
  } finally {
    setUploadingLogo(false);
  }
};
```

## After (Using Middleware)

```typescript
import { uploadImage, ImageUploadPresets, getAcceptString } from '@/lib/image-upload';

// No custom compression function needed!

const handleLogoUpload = async (file: File) => {
  try {
    setUploadingLogo(true);
    setError(null);

    // All validation and compression handled by middleware
    const result = await uploadImage(file, ImageUploadPresets.logo);

    // Upload to backend
    const body = JSON.stringify({
      tenant_id: tenantId,
      dataUrl: result.dataUrl,
      contentType: result.contentType,
    });

    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || errorData.error || 'Upload failed');
    }

    const payload = await res.json();
    if (payload.url) {
      setLogoUrl(payload.url);
      setLogoPreview(payload.url);
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    }
  } catch (err: any) {
    console.error('Logo upload error:', err);
    setError(err.message || 'Failed to upload logo');
  } finally {
    setUploadingLogo(false);
  }
};

// Update file input accept attribute
const logoAcceptTypes = getAcceptString(ImageUploadPresets.logo.allowedTypes);

<input
  id="logo-upload"
  type="file"
  accept={logoAcceptTypes} // "image/png,image/jpeg,image/svg+xml,image/x-icon,.ico"
  onChange={handleLogoChange}
  disabled={uploadingLogo}
/>
```

## Code Reduction

**Before:**
- Custom compression function: ~60 lines
- Manual validation: ~30 lines
- Manual type detection: ~10 lines
- **Total: ~100 lines per component**

**After:**
- Import middleware: 1 line
- Use preset: 1 line
- **Total: ~2 lines per component**

**Savings: 98% code reduction per component!**

## Benefits of Migration

### 1. Less Code
- Remove 100+ lines of boilerplate per component
- Single import replaces entire compression function
- No manual validation logic needed

### 2. More Features
- ✅ SVG support (automatic, no compression)
- ✅ WebP support (modern format)
- ✅ Better error messages
- ✅ Compression ratio reporting
- ✅ Consistent behavior across platform

### 3. Easier Maintenance
- Fix bugs once in middleware
- Update compression algorithm in one place
- Add new formats without touching components

### 4. Better UX
- Descriptive error messages
- Proper transparency handling
- Automatic format detection
- Optimal compression settings

## Migration Checklist

For each component with image upload:

- [ ] Import `uploadImage` and appropriate preset
- [ ] Remove custom `compressImage` function
- [ ] Replace validation logic with middleware call
- [ ] Update `contentType` to use `result.contentType`
- [ ] Update `dataUrl` to use `result.dataUrl`
- [ ] Update file input `accept` attribute
- [ ] Remove manual file type checks
- [ ] Remove manual size checks
- [ ] Remove manual aspect ratio checks
- [ ] Test with PNG (transparency)
- [ ] Test with SVG (if applicable)
- [ ] Test with ICO (if applicable)

## Components to Migrate

1. **Tenant Branding Page** (`apps/web/src/app/t/[tenantId]/settings/branding/page.tsx`)
   - Logo upload → `ImageUploadPresets.logo`
   - Banner upload → `ImageUploadPresets.banner`

2. **Platform Branding Page** (`apps/web/src/app/(platform)/settings/admin/branding/page.tsx`)
   - Logo upload → `ImageUploadPresets.logo`
   - Favicon upload → `ImageUploadPresets.favicon`

3. **Business Profile Modal** (`apps/web/src/components/settings/EditBusinessProfileModal.tsx`)
   - Logo upload → `ImageUploadPresets.logo`

4. **Product Image Upload** (wherever products are created/edited)
   - Product images → `ImageUploadPresets.product`

5. **Storefront Customization** (if exists)
   - Storefront images → `ImageUploadPresets.storefront`

6. **User Avatar Upload** (if exists)
   - Avatar images → `ImageUploadPresets.avatar`

## Testing After Migration

Test each upload type with:

1. **PNG with transparency** - Should preserve transparency
2. **JPEG** - Should compress normally
3. **SVG** - Should upload without compression
4. **ICO** - Should treat as PNG with transparency
5. **WebP** - Should compress and upload
6. **Large file** - Should show size error
7. **Wrong aspect ratio** - Should show aspect ratio error
8. **Wrong file type** - Should show type error

## Rollout Strategy

1. **Phase 1:** Create middleware (✅ Done)
2. **Phase 2:** Migrate one component (test thoroughly)
3. **Phase 3:** Migrate remaining components
4. **Phase 4:** Remove old compression functions
5. **Phase 5:** Add new features (WebP conversion, etc.)
