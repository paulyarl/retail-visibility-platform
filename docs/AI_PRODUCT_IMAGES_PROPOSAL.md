# AI Product Images Integration Proposal

## Overview

Integrate DALL-E 3 image generation into quick-start to create professional product photos that follow the existing photo upload pipeline with size optimizations.

## Architecture

```
Quick-Start Request
        ↓
Generate Products with AI (GPT-4)
        ↓
For Each Product:
  1. Generate Image (DALL-E 3)
  2. Download Image from OpenAI URL
  3. Process with Sharp (resize, optimize)
  4. Upload to Supabase (photos bucket)
  5. Create photo_assets record
  6. Link to inventory_items
```

## Implementation

### 1. Image Generation Service

```typescript
// apps/api/src/services/AIImageService.ts

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { StorageBuckets } from '../storage-config';
import { prisma } from '../prisma';

export class AIImageService {
  private openai: any;
  private supabase: any;

  constructor() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai').default;
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    // Initialize Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Generate product image with DALL-E and upload to Supabase
   */
  async generateProductImage(
    productName: string,
    tenantId: string,
    itemId: string,
    sku: string,
    options: {
      quality?: 'standard' | 'hd';
      size?: '1024x1024' | '1792x1024' | '1024x1792';
    } = {}
  ): Promise<{
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    bytes: number;
  }> {
    if (!this.openai || !this.supabase) {
      throw new Error('OpenAI or Supabase not configured');
    }

    // Step 1: Generate image with DALL-E
    console.log(`[AIImage] Generating image for: ${productName}`);
    
    const prompt = `Professional product photography of ${productName}, 
      white background, studio lighting, high quality, e-commerce style, 
      centered composition, sharp focus`;

    const imageResponse = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: options.size || "1024x1024",
      quality: options.quality || "standard",
      n: 1,
    });

    const dalleUrl = imageResponse.data[0].url;
    console.log(`[AIImage] DALL-E generated image: ${dalleUrl}`);

    // Step 2: Download image from OpenAI
    const imageBuffer = await this.downloadImage(dalleUrl);

    // Step 3: Process with Sharp - create multiple sizes
    const processed = await this.processImage(imageBuffer);

    // Step 4: Upload to Supabase
    const timestamp = Date.now();
    const basePath = `${tenantId}/${sku || itemId}`;

    // Upload original (optimized)
    const originalPath = `${basePath}/${timestamp}-original.jpg`;
    const { error: originalError } = await this.supabase.storage
      .from(StorageBuckets.PHOTOS.name)
      .upload(originalPath, processed.original, {
        cacheControl: "3600",
        contentType: "image/jpeg",
        upsert: false,
      });

    if (originalError) throw new Error(`Upload failed: ${originalError.message}`);

    // Upload thumbnail
    const thumbnailPath = `${basePath}/${timestamp}-thumb.jpg`;
    await this.supabase.storage
      .from(StorageBuckets.PHOTOS.name)
      .upload(thumbnailPath, processed.thumbnail, {
        cacheControl: "3600",
        contentType: "image/jpeg",
        upsert: false,
      });

    // Get public URLs
    const originalUrl = this.supabase.storage
      .from(StorageBuckets.PHOTOS.name)
      .getPublicUrl(originalPath).data.publicUrl;

    const thumbnailUrl = this.supabase.storage
      .from(StorageBuckets.PHOTOS.name)
      .getPublicUrl(thumbnailPath).data.publicUrl;

    console.log(`[AIImage] Uploaded to Supabase: ${originalUrl}`);

    return {
      url: originalUrl,
      thumbnailUrl,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    };
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Process image with Sharp - resize and optimize
   */
  private async processImage(buffer: Buffer): Promise<{
    original: Buffer;
    thumbnail: Buffer;
    width: number;
    height: number;
    bytes: number;
  }> {
    // Original - optimize but keep size
    const original = await sharp(buffer)
      .resize(1200, 1200, { // Max 1200x1200 for web
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();

    // Thumbnail - 300x300
    const thumbnail = await sharp(buffer)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 80,
        progressive: true
      })
      .toBuffer();

    // Get metadata
    const metadata = await sharp(original).metadata();

    return {
      original,
      thumbnail,
      width: metadata.width || 1200,
      height: metadata.height || 1200,
      bytes: original.length,
    };
  }

  /**
   * Create photo_assets record
   */
  async createPhotoAsset(
    itemId: string,
    imageData: {
      url: string;
      thumbnailUrl: string;
      width: number;
      height: number;
      bytes: number;
    },
    isPrimary: boolean = true
  ): Promise<any> {
    // Check existing photo count
    const existingCount = await prisma.photo_assets.count({
      where: { inventory_item_id: itemId }
    });

    if (existingCount >= 11) {
      console.warn(`[AIImage] Item ${itemId} already has 11 photos, skipping`);
      return null;
    }

    // Create photo_assets record
    const photoAsset = await prisma.photo_assets.create({
      data: {
        inventory_item_id: itemId,
        url: imageData.url,
        thumbnail_url: imageData.thumbnailUrl,
        width: imageData.width,
        height: imageData.height,
        bytes: imageData.bytes,
        content_type: 'image/jpeg',
        exif_removed: true,
        is_primary: isPrimary && existingCount === 0, // First photo is primary
        alt: null,
        caption: 'AI-generated product image',
        created_at: new Date(),
        updated_at: new Date(),
      }
    });

    console.log(`[AIImage] Created photo_assets record: ${photoAsset.id}`);
    return photoAsset;
  }
}

export const aiImageService = new AIImageService();
```

### 2. Integration with ProductCacheService

```typescript
// In ProductCacheService.ts

async getProductsForScenario(request: ProductRequest & { 
  generateImages?: boolean;
  imageQuality?: 'standard' | 'hd';
}): Promise<GeneratedProduct[]> {
  // ... existing logic ...
  
  // If images requested, generate them
  if (request.generateImages && aiProducts.length > 0) {
    console.log(`[ProductCache] Generating images for ${aiProducts.length} products`);
    
    for (const product of aiProducts) {
      try {
        // Generate and upload image
        const imageData = await aiImageService.generateProductImage(
          product.name,
          request.tenantId,
          product.id, // Will be set after product creation
          product.sku,
          { quality: request.imageQuality }
        );
        
        // Attach image URL to product
        product.imageUrl = imageData.url;
        product.thumbnailUrl = imageData.thumbnailUrl;
      } catch (error: any) {
        console.error(`[ProductCache] Failed to generate image for ${product.name}:`, error.message);
        // Continue without image
      }
    }
  }
  
  return [...cachedConverted, ...aiProducts];
}
```

### 3. Update Quick-Start API

```typescript
// In routes/quick-start.ts

const quickStartSchema = z.object({
  scenario: z.enum([...]),
  productCount: z.number().int().min(5).max(200).default(50),
  assignCategories: z.boolean().optional().default(true),
  createAsDrafts: z.boolean().optional().default(true),
  generateImages: z.boolean().optional().default(false), // NEW
  imageQuality: z.enum(['standard', 'hd']).optional().default('standard'), // NEW
});
```

### 4. Update Frontend UI

```typescript
// In quick-start/page.tsx

const [generateImages, setGenerateImages] = useState(false);
const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');

// In the form
<div className="mb-6">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={generateImages}
      onChange={(e) => setGenerateImages(e.target.checked)}
      className="rounded"
    />
    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
      Generate AI Product Images
    </span>
  </label>
  
  {generateImages && (
    <div className="mt-2 ml-6">
      <label className="text-xs text-gray-600 dark:text-gray-400">
        Image Quality:
      </label>
      <select
        value={imageQuality}
        onChange={(e) => setImageQuality(e.target.value as 'standard' | 'hd')}
        className="ml-2 text-xs rounded border"
      >
        <option value="standard">Standard ($0.04/image)</option>
        <option value="hd">HD ($0.08/image)</option>
      </select>
    </div>
  )}
  
  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
    AI-generated product photos with professional styling
  </p>
</div>
```

## Size Optimizations

### Image Sizes Created:

1. **Original (Optimized):** 1200x1200 max, JPEG quality 85
   - Size: ~100-200KB
   - Use: Product detail pages, zoom

2. **Thumbnail:** 300x300, JPEG quality 80
   - Size: ~20-30KB
   - Use: Grid views, lists

### Optimization Techniques:

- ✅ **Sharp Processing:** Fast, efficient image manipulation
- ✅ **JPEG Compression:** Quality 85 (original), 80 (thumbnail)
- ✅ **Progressive JPEG:** Better perceived loading
- ✅ **MozJPEG:** Superior compression algorithm
- ✅ **Responsive Sizing:** Max 1200px (perfect for web)
- ✅ **Fit Inside:** Maintains aspect ratio

## Cost Analysis

### Per Product with Image:

**Standard Quality:**
- Product data (GPT-4): $0.004
- Product image (DALL-E): $0.040
- **Total: $0.044 per product**

**HD Quality:**
- Product data (GPT-4): $0.004
- Product image (DALL-E): $0.080
- **Total: $0.084 per product**

### Example Costs:

| Products | Standard | HD |
|----------|----------|-----|
| 5 | $0.22 | $0.42 |
| 10 | $0.44 | $0.84 |
| 25 | $1.10 | $2.10 |
| 50 | $2.20 | $4.20 |
| 100 | $4.40 | $8.40 |

## Performance

### Time Per Product:

- Product generation: ~1-2 seconds
- Image generation (DALL-E): ~5-10 seconds
- Image processing (Sharp): ~0.5 seconds
- Upload to Supabase: ~1 second
- **Total: ~7-14 seconds per product**

### Optimization Strategies:

1. **Parallel Processing:** Generate images in parallel (max 3-5 concurrent)
2. **Optional Feature:** Default OFF, user opts in
3. **Progress Tracking:** Show "Generating images X of Y..."
4. **Graceful Degradation:** Continue if image generation fails

## Dependencies

```bash
# Install Sharp for image processing
pnpm add sharp

# OpenAI already installed
# Supabase client already installed
```

## Database Schema

No changes needed! Uses existing `photo_assets` table:

```sql
-- Existing table structure
photo_assets (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT,
  url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  content_type TEXT,
  exif_removed BOOLEAN,
  is_primary BOOLEAN,
  alt TEXT,
  caption TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Benefits

✅ **Professional Appearance:** Products look real and polished
✅ **Better Testing:** Merchants see complete product experience
✅ **Demo-Ready:** Instant professional inventory
✅ **Size Optimized:** Multiple sizes for performance
✅ **Existing Infrastructure:** Uses proven photo upload pipeline
✅ **Optional Feature:** No cost unless user opts in
✅ **Graceful Fallback:** Products created even if images fail

## Rollout Plan

### Phase 1: Core Implementation (Week 1)
- [ ] Create AIImageService
- [ ] Add Sharp image processing
- [ ] Integrate with ProductCacheService
- [ ] Test with 5 products

### Phase 2: Frontend Integration (Week 2)
- [ ] Add checkbox to quick-start UI
- [ ] Add quality selector
- [ ] Add progress indicator
- [ ] Show cost estimate

### Phase 3: Optimization (Week 3)
- [ ] Parallel image generation
- [ ] Better error handling
- [ ] Progress tracking
- [ ] Performance monitoring

### Phase 4: Polish (Week 4)
- [ ] Image quality improvements
- [ ] Prompt engineering for better results
- [ ] Cost tracking and reporting
- [ ] Documentation

## Example Output

**Generated Product:**
```json
{
  "name": "Tylenol Extra Strength 500mg (100 caplets)",
  "price": 1299,
  "brand": "Tylenol",
  "description": "Fast-acting pain reliever and fever reducer...",
  "imageUrl": "https://supabase.co/storage/photos/t-abc/sku-123/1234567890-original.jpg",
  "thumbnailUrl": "https://supabase.co/storage/photos/t-abc/sku-123/1234567890-thumb.jpg"
}
```

**This creates a complete, professional-looking product ready for testing! 📸**
