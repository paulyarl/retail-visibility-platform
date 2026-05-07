# Phase 2: AI Image Generation - Implementation Status

## ✅ Completed (Step 1 of 3)

### 1. AIImageService Created
**File:** `apps/api/src/services/AIImageService.ts`

**Features:**
- ✅ Multi-provider support (DALL-E 3 primary, Imagen 3 placeholder)
- ✅ Image download from AI provider
- ✅ Sharp processing (resize to 1200x1200, create 300x300 thumbnail)
- ✅ Supabase storage upload
- ✅ photo_assets database record creation
- ✅ Error handling and fallback

**Methods:**
```typescript
generateProductImage(productName, tenantId, inventoryItemId, provider, quality)
  → Downloads AI image
  → Processes with Sharp
  → Uploads to Supabase
  → Creates photo_assets record
  → Returns { url, thumbnailUrl, width, height, bytes, photoAssetId }
```

### 2. API Schema Updated
**File:** `apps/api/src/routes/quick-start.ts`

**New Options:**
```typescript
{
  generateImages: boolean,  // Enable image generation
  imageQuality: 'standard' | 'hd'  // Image quality
}
```

### 3. Quick-Start Options Extended
**File:** `apps/api/src/lib/quick-start.ts`

**Interface Updated:**
```typescript
interface QuickStartOptions {
  // ... existing fields
  generateImages?: boolean;
  imageQuality?: 'standard' | 'hd';
}
```

## 🚧 In Progress (Step 2 of 3)

### Integration with Quick-Start Flow

**What's Needed:**
1. Update `generateQuickStartProducts()` to call AIImageService
2. Generate images after products are created
3. Link images to inventory_items via photo_assets
4. Store image URLs in cache for reuse

**Implementation:**
```typescript
// In generateQuickStartProducts():
if (options.generateImages) {
  for (const item of createdItems) {
    const image = await aiImageService.generateProductImage(
      item.name,
      item.tenant_id,
      item.id,
      'openai',  // Use DALL-E for now
      options.imageQuality || 'standard'
    );
    
    if (image) {
      // Image already linked via photo_assets
      console.log(`[Quick Start] ✓ Image generated for: ${item.name}`);
    }
  }
}
```

## 📋 TODO (Step 3 of 3)

### Frontend UI Updates

**Admin Quick-Start:**
- [ ] Add "Generate Images" checkbox
- [ ] Add "Image Quality" radio buttons (Standard/HD)
- [ ] Show cost estimate with images
- [ ] Update progress messages

**Tenant Quick-Start:**
- [ ] Same UI updates as admin

**Example UI:**
```tsx
<div className="mb-4">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={generateImages}
      onChange={(e) => setGenerateImages(e.target.checked)}
    />
    <span>Generate AI Product Images</span>
  </label>
  
  {generateImages && (
    <div className="ml-6 mt-2">
      <label className="text-sm">Quality:</label>
      <div className="flex gap-2 mt-1">
        <button onClick={() => setImageQuality('standard')}>
          Standard ($0.04/image)
        </button>
        <button onClick={() => setImageQuality('hd')}>
          HD ($0.08/image)
        </button>
      </div>
    </div>
  )}
</div>
```

## Cost Analysis

### Without Images (Current):
- Text generation: $0.004 per product (OpenAI)
- **Total: $0.004 per product**

### With Images (DALL-E 3):
- Text generation: $0.004
- Image (standard): $0.040
- **Total: $0.044 per product** (11x more expensive)

### With Images (Imagen 3 - Future):
- Text generation: $0.001
- Image (standard): $0.010
- **Total: $0.011 per product** (75% cheaper than DALL-E!)

### Cost for 5 Products:
| Configuration | Cost | Time |
|--------------|------|------|
| Text only | $0.02 | 30s |
| Text + Images (DALL-E) | $0.22 | 2-3 min |
| Text + Images (Imagen) | $0.06 | 2-3 min |

### Cost for 100 Products:
| Configuration | Cost | Time |
|--------------|------|------|
| Text only | $0.40 | 10 min |
| Text + Images (DALL-E) | $4.40 | 40 min |
| Text + Images (Imagen) | $1.10 | 40 min |

## Testing Plan

### Step 1: Test Without Images (Current)
```bash
# Already working!
POST /api/v1/tenants/:tenantId/quick-start
{
  "scenario": "pharmacy",
  "productCount": 5,
  "generateImages": false
}
```

### Step 2: Test With Images (Next)
```bash
POST /api/v1/tenants/:tenantId/quick-start
{
  "scenario": "pharmacy",
  "productCount": 5,
  "generateImages": true,
  "imageQuality": "standard"
}

# Expected:
# - 5 products created
# - 5 images generated with DALL-E
# - 5 photo_assets records created
# - Images visible in product list
```

### Step 3: Verify Images
```sql
-- Check photo_assets
SELECT 
  pa.id,
  pa.inventory_item_id,
  ii.name as product_name,
  pa.url,
  pa.width,
  pa.height,
  pa.bytes
FROM photo_assets pa
JOIN inventory_items ii ON pa.inventory_item_id = ii.id
WHERE ii.tenant_id = 't-lwx9znk8'
ORDER BY pa.created_at DESC
LIMIT 10;
```

## Known Limitations

### 1. Imagen 3 Not Yet Available
- Google Imagen 3 API is still in preview
- Currently using DALL-E 3 as primary
- Will switch to Imagen when API is available

### 2. Image Generation is Slow
- DALL-E takes ~10-15 seconds per image
- 5 products = ~1 minute just for images
- Consider generating images async in background

### 3. Storage Costs
- Images stored in Supabase storage
- ~150KB per image (after optimization)
- 1000 products = ~150MB storage

### 4. Rate Limits
- DALL-E: 5 images per minute (free tier)
- Need to add rate limiting for image generation
- Or generate images in batches

## Next Steps

**Immediate (30 minutes):**
1. Integrate AIImageService into generateQuickStartProducts()
2. Test with 1-2 products
3. Verify images appear in database and storage

**Short-term (1-2 hours):**
4. Add frontend UI controls
5. Test end-to-end flow
6. Add progress indicators

**Future Enhancements:**
7. Async image generation (background jobs)
8. Imagen 3 integration when available
9. Image caching (reuse images across tenants)
10. Batch image generation

## Summary

**✅ Infrastructure Ready:**
- AIImageService built
- API schema updated
- Database ready (photo_assets table)
- Storage ready (Supabase)

**🚧 Integration Needed:**
- Connect AIImageService to quick-start flow
- Add image generation loop
- Test with real products

**📋 UI Needed:**
- Add image generation toggle
- Add quality selector
- Show cost estimates

**Estimated Time to Complete: 2-3 hours**

**Current Status: 60% Complete** 🎯
