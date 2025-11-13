# Image Compression Levels

The middleware now supports **3 compression levels** based on **IMAGE VOLUME** strategy.

## 🎯 Volume-Based Strategy

**Key Insight:** Compression should be based on how many images you'll have:

- **MANY images** (products: 100s-1000s) → **HIGH compression** → Smaller files
- **FEW images** (platform: just 1 logo) → **LOW compression** → High quality
- **SOME images** (tenants: ~5-10 per tenant) → **MEDIUM compression** → Balanced

**Why?** 
- 1 platform logo @ 500KB = 500KB total ✅ Acceptable
- 1000 products @ 500KB each = 500MB total ❌ Too much!
- 1000 products @ 80KB each = 80MB total ✅ Much better!

## 🎯 Compression Levels

### LOW Compression (High Quality)
**Best for: Platform Branding (Only 1 Image)**

- **Max Width:** 1920px
- **Quality:** 92% (0.92) - Highest quality
- **File Size:** Larger (~500KB)
- **Volume:** 1 image = 500KB total
- **Use When:** You only have ONE image and want maximum quality

**Example Use Cases:**
- Platform logo (loaded once, displayed everywhere)
- Main hero image
- Key marketing asset

```typescript
uploadImage(file, { compressionLevel: 'low' })
// or
uploadImage(file, ImageUploadPresets.platformBranding)
```

### MEDIUM Compression (Medium Quality)
**Best for: Tenant Branding (Few Images Per Tenant)**

- **Max Width:** 1200px
- **Quality:** 85% (0.85) - Good quality
- **File Size:** Balanced (~200KB)
- **Volume:** ~5-10 images per tenant = ~1-2MB per tenant
- **Use When:** Few images per entity, need good quality

**Example Use Cases:**
- Tenant logos (1 per tenant)
- Tenant banners (1-2 per tenant)
- Storefront hero images (2-3 per tenant)
- Marketing materials
- Social media images

```typescript
uploadImage(file, { compressionLevel: 'medium' })
// or
uploadImage(file, ImageUploadPresets.logo)
uploadImage(file, ImageUploadPresets.banner)
uploadImage(file, ImageUploadPresets.tenantBranding)
uploadImage(file, ImageUploadPresets.storefront)
```

### HIGH Compression (Lower Quality, Smaller Files)
**Best for: Products (MANY Images)**

- **Max Width:** 800px
- **Quality:** 75% (0.75) - Lower quality, but acceptable
- **File Size:** Smallest (~80KB)
- **Volume:** 1000 products = 80MB total (vs 500MB with low compression!)
- **Use When:** You have HUNDREDS or THOUSANDS of images

**Example Use Cases:**
- Product photos (100s-1000s per platform)
- User avatars (many users)
- Thumbnails
- Gallery images
- Any high-volume image collection

**Why Lower Quality is OK:**
- Products are viewed briefly in lists/grids
- Users can see full details on product page
- 75% quality is still good enough for most displays
- File size savings are MASSIVE at scale

```typescript
uploadImage(file, { compressionLevel: 'high' })
// or
uploadImage(file, ImageUploadPresets.product)
uploadImage(file, ImageUploadPresets.avatar)
uploadImage(file, ImageUploadPresets.favicon)
```

## 📊 Comparison Table (Volume-Based Strategy)

| Compression | Quality | File Size | Volume | Total Size | Best For |
|-------------|---------|-----------|--------|------------|----------|
| **LOW** | 92% | ~500KB | 1 image | 500KB | Platform logo |
| **MEDIUM** | 85% | ~200KB | ~10 images | ~2MB | Tenant branding |
| **HIGH** | 75% | ~80KB | 1000 images | ~80MB | Products |

*File sizes are approximate for a typical 2MB source image*

**Key Insight:** Total storage matters more than individual file size!

## 🎨 Preset Mappings

All presets now use compression levels based on volume:

```typescript
// HIGH compression (MANY images)
ImageUploadPresets.product          // Products: 100s-1000s
ImageUploadPresets.avatar           // Users: many
ImageUploadPresets.favicon          // Icons: many

// MEDIUM compression (SOME images)
ImageUploadPresets.logo             // Tenant logos: ~1 per tenant
ImageUploadPresets.banner           // Tenant banners: ~1-2 per tenant
ImageUploadPresets.tenantBranding   // Tenant assets: ~5-10 per tenant
ImageUploadPresets.storefront       // Hero images: ~2-3 per tenant

// LOW compression (FEW images)
ImageUploadPresets.platformBranding // Platform logo: just 1
```

## 🔧 Custom Configuration

You can still override compression settings:

```typescript
// Use preset but override quality
uploadImage(file, {
  ...ImageUploadPresets.product,
  quality: 0.9, // Override to 90%
})

// Use compression level but override maxWidth
uploadImage(file, {
  compressionLevel: 'medium',
  maxWidth: 1500, // Override to 1500px
})

// Full custom configuration
uploadImage(file, {
  maxWidth: 2000,
  quality: 0.8,
  maxSizeMB: 10,
  // compressionLevel not needed when specifying manually
})
```

## 💡 Smart Defaults

The middleware intelligently applies compression:

1. **If `compressionLevel` is specified:** Apply preset maxWidth and quality
2. **If `maxWidth` or `quality` are explicitly set:** Use those values (override preset)
3. **If neither:** Use default medium compression

## 🎯 Use Case Guide

### E-commerce Products
```typescript
// LOW compression - customers need to see details
uploadImage(productImage, ImageUploadPresets.product)
```

### Tenant Branding
```typescript
// MEDIUM compression - balance quality and performance
uploadImage(logo, ImageUploadPresets.logo)
uploadImage(banner, ImageUploadPresets.banner)
```

### Platform Branding
```typescript
// HIGH compression - loaded on every page, needs to be fast
uploadImage(platformLogo, ImageUploadPresets.platformBranding)
```

### User Avatars
```typescript
// HIGH compression - small display size, many users
uploadImage(avatar, ImageUploadPresets.avatar)
```

## 📈 Performance Impact

### Before (No Compression Levels):
- All images: 1200px @ 85% quality
- Product image: ~200KB @ 85% (too compressed, not enough quality)
- Platform logo: ~200KB @ 85% (too large, slows page loads)
- Inconsistent quality across use cases

### After (With Compression Levels):
- Product image: ~500KB @ 92% quality (BETTER quality, worth the size)
- Tenant logo: ~200KB @ 85% quality (balanced, same as before)
- Platform logo: ~80KB @ 75% quality (FASTER loading, 60% smaller)
- Optimized for each use case

## 🚀 Benefits

### 1. **Better Product Images**
- Lower compression = better quality
- Customers see more detail
- Higher conversion rates

### 2. **Faster Platform Performance**
- High compression for platform assets
- Smaller files = faster page loads
- Better user experience

### 3. **Balanced Tenant Branding**
- Medium compression for tenant assets
- Good quality without bloat
- Professional appearance

### 4. **Flexibility**
- Can still override any setting
- Presets provide smart defaults
- Easy to customize per use case

## 🔄 Migration

Existing code continues to work:

```typescript
// Old code (still works, uses medium compression by default)
uploadImage(file, ImageUploadPresets.logo)

// New code (explicit compression level)
uploadImage(file, { compressionLevel: 'low' })
```

All existing presets have been updated to use appropriate compression levels, so no code changes are required!

## 📝 Summary

The middleware now handles compression intelligently based on use case:

- **Products:** LOW compression (best quality)
- **Tenant Branding:** MEDIUM compression (balanced)
- **Platform Branding:** HIGH compression (best performance)

This ensures optimal quality and performance across your entire platform!
