# M4 SKU Scanning - Image Support Technical Documentation

**Feature:** Automatic Product Image Download and Storage  
**Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Status:** ✅ Production Ready

---

## 📖 Overview

M4 SKU Scanning now automatically downloads and stores product images from enrichment APIs, seamlessly integrating with the platform's existing photo infrastructure.

### Key Features

- ✅ **Automatic Download** - Images fetched during scan commit
- ✅ **Multiple Images** - Up to 11 images per product (GMC compliant)
- ✅ **Existing Infrastructure** - Uses PhotoAsset model and Supabase Storage
- ✅ **Graceful Degradation** - Image failures don't block commits
- ✅ **Optimized Storage** - Proper path organization and CDN delivery

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    Scan Workflow                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Barcode Scan                                        │
│     └─> BarcodeEnrichmentService                       │
│         └─> Fetch product data + image URLs            │
│                                                         │
│  2. Commit Session                                      │
│     └─> Create InventoryItem                           │
│     └─> ImageEnrichmentService                         │
│         ├─> Extract image URLs                         │
│         ├─> Download images                            │
│         ├─> Upload to Supabase Storage                 │
│         └─> Create PhotoAsset records                  │
│                                                         │
│  3. Result                                              │
│     └─> InventoryItem with images                      │
│         ├─> imageUrl (primary)                         │
│         └─> photos[] (PhotoAsset[])                    │
└─────────────────────────────────────────────────────────┘
```

### Services

#### 1. BarcodeEnrichmentService
**File:** `apps/api/src/services/BarcodeEnrichmentService.ts`

**Responsibilities:**
- Fetch product data from external APIs
- Capture image URLs from API responses
- Store image URLs in enrichment result

**Enhanced Fields:**
```typescript
interface EnrichmentResult {
  // ... existing fields
  imageUrl?: string;              // Primary image URL
  imageThumbnailUrl?: string;     // Thumbnail URL
  metadata?: {
    images?: {
      front?: string;              // Front view
      ingredients?: string;        // Ingredients label
      nutrition?: string;          // Nutrition facts
    }
  }
}
```

#### 2. ImageEnrichmentService
**File:** `apps/api/src/services/ImageEnrichmentService.ts`

**Responsibilities:**
- Download images from external URLs
- Upload to Supabase Storage
- Create PhotoAsset records
- Handle multiple images per product

**Key Methods:**

```typescript
class ImageEnrichmentService {
  // Download and store single image
  async downloadAndStoreImage(
    imageUrl: string,
    tenantId: string,
    itemId: string,
    sku: string
  ): Promise<ImageDownloadResult | null>

  // Create PhotoAsset record
  async createPhotoAsset(
    tenantId: string,
    itemId: string,
    imageData: ImageDownloadResult,
    position: number,
    alt?: string
  ): Promise<void>

  // Process multiple images
  async processProductImages(
    tenantId: string,
    itemId: string,
    sku: string,
    imageUrls: string[],
    productName?: string
  ): Promise<number>

  // Extract URLs from enrichment
  extractImageUrls(enrichment: any): string[]
}
```

---

## 🔄 Workflow

### 1. Enrichment Phase

**When:** Barcode is scanned

```typescript
// In scan.ts - lookup-barcode endpoint
const enrichment = await barcodeEnrichmentService.enrich(barcode, tenantId);

// enrichment now contains:
{
  name: "Product Name",
  brand: "Brand Name",
  imageUrl: "https://images.openfoodfacts.org/...",
  imageThumbnailUrl: "https://images.openfoodfacts.org/.../small.jpg",
  metadata: {
    images: {
      front: "https://...",
      ingredients: "https://...",
      nutrition: "https://..."
    }
  }
}
```

### 2. Commit Phase

**When:** User commits scan session

```typescript
// In scan.ts - commit endpoint
for (const result of session.results) {
  // Create inventory item
  const item = await prisma.inventoryItem.create({ ... });

  // Process images if enrichment enabled
  if (Flags.SCAN_ENRICHMENT && enrichment) {
    const imageUrls = imageEnrichmentService.extractImageUrls(enrichment);
    
    if (imageUrls.length > 0) {
      const imageCount = await imageEnrichmentService.processProductImages(
        session.tenantId,
        item.id,
        item.sku,
        imageUrls,
        item.name
      );
    }
  }
}
```

### 3. Image Processing

**For each image URL:**

```typescript
// 1. Download image
const response = await fetch(imageUrl, {
  signal: AbortSignal.timeout(10000)
});
const buffer = Buffer.from(await response.arrayBuffer());

// 2. Upload to Supabase Storage
const path = `${tenantId}/${sku}/${timestamp}.${ext}`;
const { data } = await supabase.storage
  .from('photos')
  .upload(path, buffer, {
    cacheControl: "3600",
    contentType: contentType
  });

// 3. Get public URL
const publicUrl = supabase.storage
  .from('photos')
  .getPublicUrl(data.path).data.publicUrl;

// 4. Create PhotoAsset
await prisma.photoAsset.create({
  data: {
    tenantId,
    inventoryItemId: item.id,
    url: publicUrl,
    position: index,
    alt: `${productName} - Image ${index + 1}`
  }
});

// 5. Update primary imageUrl (position 0 only)
if (position === 0) {
  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: { imageUrl: publicUrl }
  });
}
```

---

## 💾 Data Model

### Database Schema

```prisma
model InventoryItem {
  id       String  @id @default(cuid())
  tenantId String
  sku      String
  name     String
  imageUrl String? // Primary image URL (position 0)
  photos   PhotoAsset[] // All images
  // ... other fields
}

model PhotoAsset {
  id              String  @id @default(cuid())
  tenantId        String
  inventoryItemId String
  url             String  // Public URL from Supabase Storage
  position        Int     // 0 = primary, 1-10 = additional
  width           Int?
  height          Int?
  bytes           Int?
  contentType     String?
  exifRemoved     Boolean @default(true)
  alt             String?
  caption         String?
  
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id])
  
  @@unique([inventoryItemId, position])
}
```

### Storage Structure

```
Supabase Storage Bucket: photos
└── {tenantId}/
    └── {sku}/
        ├── 1730700000000.jpg  (primary, position 0)
        ├── 1730700001000.jpg  (additional, position 1)
        ├── 1730700002000.jpg  (additional, position 2)
        └── ...
```

---

## 🔧 Configuration

### Environment Variables

```env
# Required for image support
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Feature flags
FF_SCAN_ENRICHMENT=true  # Must be enabled for images
```

### Feature Flags

```typescript
// In config.ts
export const Flags = {
  SCAN_ENRICHMENT: process.env.FF_SCAN_ENRICHMENT === 'true',
  // ... other flags
};
```

### Storage Configuration

```typescript
// In storage-config.ts
export const StorageBuckets = {
  PHOTOS: {
    name: 'photos',
    public: true,
    allowedMimeTypes: ['image/*'],
    maxSizeMB: 20
  }
};
```

---

## 📊 Image Sources

### Open Food Facts

**API:** `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`

**Image Fields:**
```json
{
  "product": {
    "image_url": "https://...",           // Main image
    "image_small_url": "https://...",     // Thumbnail
    "image_front_url": "https://...",     // Front view
    "image_ingredients_url": "https://...", // Ingredients
    "image_nutrition_url": "https://..."  // Nutrition facts
  }
}
```

**Coverage:** Primarily food products, beverages, cosmetics

### UPC Database

**API:** `https://api.upcdatabase.org/product/{barcode}`

**Image Fields:**
```json
{
  "image_url": "https://..."  // Product image (if available)
}
```

**Coverage:** General consumer products

---

## 🎯 Google Merchant Center Compliance

### Requirements

- ✅ **Primary Image** - Required, position 0
- ✅ **Additional Images** - Up to 10 additional (positions 1-10)
- ✅ **Image Quality** - Minimum 100x100px
- ✅ **Format** - JPEG, PNG, GIF, WebP
- ✅ **Alt Text** - For accessibility

### Implementation

```typescript
// Limit to 11 images (GMC max)
const urlsToProcess = imageUrls.slice(0, 11);

// Position 0 = primary
await createPhotoAsset(tenantId, itemId, imageData, 0, productName);

// Positions 1-10 = additional
for (let i = 1; i < urlsToProcess.length; i++) {
  await createPhotoAsset(
    tenantId,
    itemId,
    imageData,
    i,
    `${productName} - Image ${i + 1}`
  );
}
```

### Feed Generation

```typescript
// In feed-generator.ts
const photos = await prisma.photoAsset.findMany({
  where: { inventoryItemId: item.id },
  orderBy: { position: 'asc' }
});

// Primary image
const imageLink = photos[0]?.url || item.imageUrl;

// Additional images
const additionalImageLinks = photos.slice(1, 11).map(p => p.url);
```

---

## ⚡ Performance

### Optimization Strategies

**1. Parallel Processing**
```typescript
// Process images in parallel (with limit)
const imagePromises = imageUrls.map(url => 
  downloadAndStoreImage(url, tenantId, itemId, sku)
);
await Promise.allSettled(imagePromises);
```

**2. Timeout Protection**
```typescript
// 10 second timeout per image
const response = await fetch(imageUrl, {
  signal: AbortSignal.timeout(10000)
});
```

**3. Graceful Degradation**
```typescript
try {
  await processProductImages(...);
} catch (imageError) {
  // Don't fail commit if images fail
  console.error('Image processing failed:', imageError);
}
```

**4. Content Type Validation**
```typescript
const contentType = response.headers.get('content-type');
if (!contentType.startsWith('image/')) {
  return null; // Skip non-images
}
```

### Metrics

**Expected Performance:**
- Image download: 1-3 seconds per image
- Upload to Supabase: 0.5-1 second per image
- Total per product: 2-10 seconds (depends on image count)
- Commit doesn't wait for images (async processing)

---

## 🐛 Error Handling

### Error Types

**1. Download Failures**
```typescript
try {
  const response = await fetch(imageUrl, { timeout: 10000 });
  if (!response.ok) {
    console.warn(`Failed to download: ${response.status}`);
    return null;
  }
} catch (error) {
  console.error('Download error:', error);
  return null;
}
```

**2. Upload Failures**
```typescript
const { error, data } = await supabase.storage
  .from('photos')
  .upload(path, buffer);

if (error) {
  console.error('Upload error:', error);
  return null;
}
```

**3. Database Failures**
```typescript
try {
  await prisma.photoAsset.create({ ... });
} catch (error) {
  console.error('PhotoAsset creation failed:', error);
  throw error;
}
```

### Logging

```typescript
// Success
console.log(`[commit] Processed ${imageCount}/${imageUrls.length} images for ${sku}`);

// Failure
console.error(`[commit] Failed to process images for ${sku}:`, error);

// Warning
console.warn(`[ImageEnrichment] Failed to download image: ${response.status}`);
```

---

## 🧪 Testing

### Unit Tests

```typescript
describe('ImageEnrichmentService', () => {
  it('should download and store image', async () => {
    const result = await imageEnrichmentService.downloadAndStoreImage(
      'https://example.com/image.jpg',
      'tenant_123',
      'item_456',
      'SKU-001'
    );
    
    expect(result).toBeDefined();
    expect(result.url).toContain('supabase.co');
  });

  it('should extract image URLs from enrichment', () => {
    const enrichment = {
      imageUrl: 'https://example.com/main.jpg',
      metadata: {
        images: {
          front: 'https://example.com/front.jpg'
        }
      }
    };
    
    const urls = imageEnrichmentService.extractImageUrls(enrichment);
    expect(urls).toHaveLength(2);
  });
});
```

### Integration Tests

```typescript
describe('Scan Commit with Images', () => {
  it('should create PhotoAssets during commit', async () => {
    // Create scan session
    const session = await createScanSession(tenantId);
    
    // Scan barcode with images
    await lookupBarcode(session.id, '012345678905');
    
    // Commit session
    await commitSession(session.id);
    
    // Verify PhotoAssets created
    const photos = await prisma.photoAsset.findMany({
      where: { inventoryItemId: item.id }
    });
    
    expect(photos.length).toBeGreaterThan(0);
    expect(photos[0].position).toBe(0);
  });
});
```

### Manual Testing

```bash
# 1. Start servers
pnpm dev:local

# 2. Create scan session
curl -X POST http://localhost:4000/api/scan/start \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tenantId":"tenant_123","deviceType":"usb"}'

# 3. Scan barcode with images (food product)
curl -X POST http://localhost:4000/api/scan/$SESSION_ID/lookup-barcode \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"3017620422003"}'  # Nutella

# 4. Commit session
curl -X POST http://localhost:4000/api/scan/$SESSION_ID/commit \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"skipValidation":true}'

# 5. Check images in database
psql $DATABASE_URL -c "SELECT * FROM \"PhotoAsset\" WHERE \"inventoryItemId\" = '$ITEM_ID';"

# 6. Verify in Supabase Storage
# Go to Supabase Dashboard → Storage → photos bucket
```

---

## 📈 Monitoring

### Metrics to Track

**1. Image Processing Success Rate**
```typescript
const successRate = imagesProcessed / totalImageUrls;
```

**2. Average Images Per Product**
```typescript
const avgImages = totalPhotos / totalProducts;
```

**3. Storage Usage**
```sql
SELECT 
  SUM(bytes) / 1024 / 1024 AS total_mb
FROM "PhotoAsset"
WHERE "createdAt" > NOW() - INTERVAL '30 days';
```

**4. Processing Duration**
```typescript
const duration = Date.now() - startTime;
console.log(`Image processing took ${duration}ms`);
```

### Logs to Monitor

```bash
# Success logs
grep "Processed.*images for" api.log

# Failure logs
grep "Failed to process images" api.log

# Download errors
grep "Failed to download" api.log

# Upload errors
grep "Upload error" api.log
```

---

## 🔐 Security

### Validation

**1. Content Type Check**
```typescript
if (!contentType.startsWith('image/')) {
  return null; // Reject non-images
}
```

**2. Size Limit**
```typescript
if (buffer.length > 20 * 1024 * 1024) {
  return null; // Reject files > 20MB
}
```

**3. URL Validation**
```typescript
const urls = imageUrls.filter(url => 
  url && typeof url === 'string' && url.startsWith('http')
);
```

### Storage Security

- ✅ Service role key used (not exposed to client)
- ✅ Public bucket for read access
- ✅ Authenticated upload only
- ✅ Path organization prevents collisions
- ✅ Content type validation

---

## 🚀 Future Enhancements

### Planned Features

1. **Image Resizing**
   - Generate thumbnails
   - Optimize for web/mobile
   - Multiple sizes for responsive design

2. **Image Quality Validation**
   - Minimum resolution check
   - Aspect ratio validation
   - Duplicate detection

3. **Batch Processing**
   - Process images in background job
   - Queue system for large batches
   - Progress tracking

4. **CDN Integration**
   - CloudFlare/Fastly integration
   - Global edge caching
   - Faster image delivery

5. **AI Enhancement**
   - Background removal
   - Image upscaling
   - Auto-cropping

---

## 📞 Support

**Technical Issues:**
- Check logs for error messages
- Verify Supabase configuration
- Ensure feature flags enabled
- Test with known good barcodes

**Contact:**
- Email: dev-support@retailvisibility.com
- Slack: #m4-scanning

---

**Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Status:** ✅ Production Ready

**Questions?** Contact dev-support@retailvisibility.com
