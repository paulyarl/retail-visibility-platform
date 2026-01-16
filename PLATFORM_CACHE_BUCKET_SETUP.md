# Platform Cache Bucket Setup

## Overview
The platform cache bucket stores AI-generated product images that can be reused across multiple tenants, reducing storage costs and AI generation costs.

## Supabase Storage Bucket Configuration

### Create the Bucket

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `product-cache`
3. Settings:
   - **Public:** Yes (images need to be publicly accessible)
   - **File size limit:** 10 MB
   - **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`

### Bucket Structure

```
product-cache/
└── ai-generated/
    ├── {product-hash-1}/
    │   ├── original-{timestamp}.jpg
    │   └── thumb-{timestamp}.jpg
    ├── {product-hash-2}/
    │   ├── original-{timestamp}.jpg
    │   └── thumb-{timestamp}.jpg
    └── ...
```

### Storage Policies

**Policy 1: Public Read Access**
```sql
CREATE POLICY "Public read access for cached images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-cache');
```

**Policy 2: Service Role Write Access**
```sql
CREATE POLICY "Service role can upload cached images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'product-cache');
```

**Policy 3: Service Role Delete Access**
```sql
CREATE POLICY "Service role can delete cached images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'product-cache');
```

## Usage in Quick Start

### When to Use Platform Cache

**Use platform cache (`useCache: true`) when:**
- Generating images for Quick Start products
- Product will be reused across multiple tenants
- Image is generic and not tenant-specific

**Use tenant bucket (`useCache: false`) when:**
- User manually uploads image
- Image is tenant-specific or branded
- Product is unique to one tenant

### Code Example

```typescript
// Quick Start with cached images
const imageService = new AIImageService();
const result = await imageService.generateProductImage(
  productName,
  tenantId,
  inventoryItemId,
  'google',
  'standard',
  true  // ← Use platform cache
);
```

## Benefits

### Cost Savings
- **Storage:** One image serves multiple tenants
- **AI Generation:** Generate once, reuse many times
- **Bandwidth:** Cached images served from CDN

### Performance
- **Faster Quick Start:** Reuse existing images
- **Lower Latency:** CDN-cached images
- **Reduced API Calls:** No regeneration needed

### Example Savings

**Scenario:** 100 tenants use Quick Start with 50 products each

**Without Cache:**
- Images generated: 100 × 50 = 5,000
- Storage: 5,000 × 500KB = 2.5 GB
- AI API calls: 5,000
- Cost: ~$250 (AI) + $0.10/GB storage

**With Cache:**
- Images generated: 50 (first tenant only)
- Storage: 50 × 500KB = 25 MB (cache) + tenant references
- AI API calls: 50
- Cost: ~$2.50 (AI) + minimal storage
- **Savings: ~$247.50 (99% reduction)**

## Maintenance

### Cache Cleanup

Periodically clean up unused cached images:

```sql
-- Find cached images older than 6 months with no references
SELECT name, created_at
FROM storage.objects
WHERE bucket_id = 'product-cache'
  AND created_at < NOW() - INTERVAL '6 months'
  AND NOT EXISTS (
    SELECT 1 FROM photo_assets
    WHERE url LIKE '%' || name || '%'
  );
```

### Monitoring

Track cache usage:

```sql
-- Cache bucket size
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint / 1024 / 1024 as size_mb
FROM storage.objects
WHERE bucket_id = 'product-cache'
GROUP BY bucket_id;
```

## Migration Notes

### Existing Tenants

Existing tenant-specific images remain in the `photos` bucket. Only new Quick Start images with caching enabled will use the platform cache.

### Rollout Plan

1. **Phase 1:** Create `product-cache` bucket
2. **Phase 2:** Deploy updated AIImageService
3. **Phase 3:** Enable caching in Quick Start
4. **Phase 4:** Monitor usage and savings

## Security Considerations

- ✅ Public read access (images are product photos)
- ✅ Service role only write access
- ✅ No tenant-specific data in cached images
- ✅ Generic product images only
- ✅ CDN caching for performance

## Environment Variables

No new environment variables needed. Uses existing:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing

Test the platform cache:

```bash
# Generate image with cache
curl -X POST http://localhost:4000/api/ai/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Red Running Shoes",
    "tenantId": "tid-test",
    "inventoryItemId": "item-123",
    "useCache": true
  }'

# Verify image in cache bucket
# Check Supabase Dashboard → Storage → product-cache
```

## Troubleshooting

**Issue: Images not appearing in cache**
- Check Supabase service role key is configured
- Verify bucket exists and is public
- Check storage policies are applied

**Issue: Cache bucket permission denied**
- Ensure service role has INSERT/DELETE policies
- Verify bucket_id in policies matches 'product-cache'

**Issue: Images not loading**
- Check bucket is set to public
- Verify public read policy is active
- Test public URL directly in browser
