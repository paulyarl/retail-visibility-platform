# Multi-Image Gallery Specification

## Overview
Enable multiple images per SKU (item) to support Google Product Feed requirements (1 primary + up to 10 additional images) and provide a richer product page experience similar to major retailers (CVS, Walmart).

## Business Value
- **Google Shopping**: Map primary image to `imageLink` and additional images to `additionalImageLinks` (up to 10) for better product visibility.
- **Product Pages**: Display image galleries like major retailers, improving customer experience.
- **Merchandising**: Allow merchants to showcase products from multiple angles, in-use, packaging, etc.

## Current State
- Single image per item stored in `items.imageUrl`
- Upload via POST `/api/items/:id/photos` → saves to Supabase Storage
- Client compresses images (maxWidth=1024px, quality=0.8) before upload
- Product page shows single image; JSON-LD includes single image URL

## Target State

### Data Model
**New Table: `item_photos`**
```sql
CREATE TABLE item_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  alt TEXT,
  caption TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, position)
);

CREATE INDEX idx_item_photos_item_id ON item_photos(item_id);
CREATE INDEX idx_item_photos_position ON item_photos(item_id, position);
```

**Relationships**
- One-to-many: `items` → `item_photos`
- Primary image: `position = 0`
- Additional images: `position = 1..10`
- Storage: Same Supabase bucket as current single-image flow

**Row-Level Security (RLS)**
```sql
-- item_photos are scoped by the item's tenantId
-- Users can only access photos for items in tenants they're members of
ALTER TABLE item_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_photos_tenant_isolation ON item_photos
  USING (
    item_id IN (
      SELECT id FROM items 
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );
```

### API Endpoints (apps/api)

All endpoints require authentication and tenant membership verification.

**GET /items/:id/photos**
- Returns: `[{ id, url, position, alt, caption, createdAt }]` ordered by position
- Auth: User must be member of item's tenant
- Response: 200 with array, or 404 if item not found

**POST /items/:id/photos**
- Body: `{ tenantId, dataUrl | url, contentType, alt?, caption? }`
- Behavior:
  - Validates user is member of tenantId
  - Validates item belongs to tenantId
  - Uploads image to Supabase Storage (reuse existing upload util)
  - Creates item_photos row with next available position (0 if first, else max+1)
  - Enforces limit: max 11 photos per item (1 primary + 10 additional)
- Returns: `{ id, url, position, alt, caption, createdAt }`
- Response: 201 on success, 400 if limit exceeded, 403 if unauthorized

**PUT /items/:id/photos/:photoId**
- Body: `{ alt?, caption?, position? }`
- Behavior:
  - Validates user is member of item's tenant
  - Updates alt/caption if provided
  - If position provided and different from current:
    - Swaps positions with existing photo at target position (if any)
    - Or reorders all photos to maintain uniqueness
  - Use case: Set a photo as primary by setting position=0
- Returns: `{ id, url, position, alt, caption }`
- Response: 200 on success, 404 if not found, 403 if unauthorized

**PUT /items/:id/photos/reorder**
- Body: `[{ id, position }, ...]`
- Behavior:
  - Validates user is member of item's tenant
  - Validates all photo IDs belong to the item
  - Updates positions in a transaction
  - Ensures position uniqueness per item
- Returns: 204 No Content
- Response: 204 on success, 400 if invalid, 403 if unauthorized

**DELETE /items/:id/photos/:photoId**
- Behavior:
  - Validates user is member of item's tenant
  - Deletes photo from Supabase Storage
  - Deletes item_photos row
  - Re-packs positions (e.g., if deleting position 2, shift 3→2, 4→3, etc.)
- Returns: 204 No Content
- Response: 204 on success, 404 if not found, 403 if unauthorized

### Web Proxy (apps/web)
All API calls proxied through `/api/items/:id/photos` with same signature as backend.
- Proxy adds Authorization header from client cookies/localStorage
- Maintains same error handling and response format

### Web UI (apps/web)

#### Items Page (Admin/Editor)
**Gallery Component** (`ItemsGallery.tsx`)
- Displays thumbnails of all photos for an item
- Features:
  - **Multi-upload**: Click or drag-and-drop to add images (up to 11 total)
  - **Compression**: Reuse existing client-side compression (maxWidth=1024px, quality=0.8, JPEG)
  - **Thumbnails**: Grid layout showing all images with position badges
  - **Primary indicator**: Visual badge on position 0 image
  - **Drag-to-reorder**: Drag thumbnails to change position; calls PUT /reorder on drop
  - **Set primary**: Button/action to set any image as primary (position=0)
  - **Inline edit**: Click thumbnail to edit alt/caption; autosave on blur
  - **Delete**: X button on each thumbnail; confirms before DELETE call
  - **Limit feedback**: Show "1/11 images" counter; disable upload when at limit
  - **Loading states**: Show spinners during upload/delete/reorder
  - **Error handling**: Toast notifications for failures

**Integration**
- Replace single "Photo" button with "Gallery" button that opens modal/drawer
- Or expand inline gallery below each item row
- Fetch photos on item row expand: GET /api/items/:id/photos
- Optimistic updates for better UX

#### Product Page (Public)
**Already Implemented** (apps/web/src/app/products/[id]/page.tsx)
- Calls `getProductPhotos(id)` which fetches GET /items/:id/photos
- Displays gallery:
  - Primary image large (position 0)
  - Thumbnails grid for additional images (up to 10)
- Fallback: If no photos, shows legacy items.imageUrl
- JSON-LD structured data includes image array for Google rich results

### Google Feed Publisher

**Content API Mapping**
```typescript
// In feed publisher/builder
const photos = await getItemPhotos(item.id);
const sortedPhotos = photos.sort((a, b) => a.position - b.position);

const product = {
  // ... other fields
  imageLink: sortedPhotos[0]?.url || item.imageUrl, // Primary
  additionalImageLinks: sortedPhotos.slice(1, 11).map(p => p.url), // Up to 10 more
};
```

**Requirements**
- Images must be publicly accessible URLs
- Min 100×100px (apparel 250×250px), recommended 800×800px+
- JPEG/PNG, non-animated
- Clean background, no overlays

### Migration & Backfill

**Prisma Migration**
```prisma
model ItemPhoto {
  id        String   @id @default(uuid())
  itemId    String   @map("item_id")
  url       String
  position  Int      @default(0)
  alt       String?
  caption   String?
  createdAt DateTime @default(now()) @map("created_at")

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId, position])
  @@index([itemId])
  @@index([itemId, position])
  @@map("item_photos")
}
```

**Backfill Script** (`apps/api/scripts/backfill-item-photos.ts`)
```typescript
// For each item with imageUrl:
// 1. Check if item_photos already exists for this item
// 2. If not, create item_photos row with position=0, url=item.imageUrl
// 3. Log progress and errors
// 4. Idempotent: safe to run multiple times
```

Run via:
```bash
doppler run --config local -- pnpm -C apps/api exec tsx scripts/backfill-item-photos.ts
```

### Backward Compatibility
- Keep `items.imageUrl` for now (don't drop column)
- All reads prefer item_photos; fallback to items.imageUrl if no photos
- Single-image upload can continue to work by creating/updating position 0 photo
- Gradual migration: backfill existing items, then deprecate items.imageUrl in future release

### Testing

#### Unit Tests (apps/api)
- `POST /items/:id/photos`
  - ✓ Creates photo with correct position
  - ✓ Enforces 11-photo limit
  - ✓ Requires tenant membership
  - ✓ Validates item belongs to tenant
- `PUT /items/:id/photos/:photoId`
  - ✓ Updates alt/caption
  - ✓ Swaps positions correctly
  - ✓ Requires tenant membership
- `PUT /items/:id/photos/reorder`
  - ✓ Reorders photos atomically
  - ✓ Maintains position uniqueness
  - ✓ Requires tenant membership
- `DELETE /items/:id/photos/:photoId`
  - ✓ Deletes from storage and DB
  - ✓ Re-packs positions
  - ✓ Requires tenant membership

#### E2E Tests (apps/web)
- `item-gallery.spec.ts`
  - ✓ Upload multiple images (2-3)
  - ✓ Drag to reorder; verify positions update
  - ✓ Set primary; verify position 0 changes
  - ✓ Edit alt/caption; verify saved
  - ✓ Delete image; verify removed and positions re-packed
  - ✓ Enforce 11-image limit; upload button disabled at limit
  - ✓ Product page shows all images in gallery
  - ✓ JSON-LD includes image array

### Security Considerations
- **Authentication**: All endpoints require valid access token
- **Authorization**: User must be member of item's tenant
- **RLS**: Database-level isolation ensures photos are scoped by tenant
- **Storage**: Supabase Storage bucket policies enforce tenant isolation
- **Input validation**: 
  - Validate image MIME types (jpeg/png only)
  - Enforce size limits (e.g., max 5MB per image)
  - Sanitize alt/caption text
- **Rate limiting**: Consider rate limits on upload endpoint to prevent abuse

### Performance Considerations
- **Indexing**: Indexes on (item_id, position) for fast ordered retrieval
- **Caching**: Consider CDN for image URLs
- **Lazy loading**: Product page loads thumbnails lazily
- **Compression**: Client-side compression reduces upload size and storage costs
- **Batch operations**: Reorder endpoint updates positions in single transaction

### Configuration
- `NEXT_PUBLIC_IMAGE_MAX_WIDTH`: Default 1024, configurable via env var
- `NEXT_PUBLIC_IMAGE_QUALITY`: Default 0.8, configurable via env var
- `MAX_PHOTOS_PER_ITEM`: Default 11 (1 primary + 10 additional)

### Rollout Plan
1. **Phase 1: Backend**
   - Add item_photos table and RLS policies
   - Implement API endpoints with tests
   - Run backfill script on staging
2. **Phase 2: Web UI**
   - Build gallery component
   - Wire to Items page
   - Add E2E tests
3. **Phase 3: Feed**
   - Update feed publisher to use additionalImageLinks
   - Verify Google Merchant Center accepts feed
4. **Phase 4: Production**
   - Deploy backend migration
   - Run backfill script
   - Deploy web UI
   - Monitor errors and performance
5. **Phase 5: Cleanup**
   - After stable for 1-2 weeks, consider deprecating items.imageUrl

### Success Metrics
- **Adoption**: % of items with >1 photo
- **Feed quality**: Google Merchant Center approval rate
- **Performance**: P95 upload latency <2s
- **Errors**: <1% error rate on photo operations
- **UX**: Product page bounce rate improves with galleries

### Open Questions
- Should we auto-generate thumbnails at multiple sizes (small/medium/large)?
- Should we support video in addition to images?
- Should we allow bulk upload via CSV with image URLs?
- Should we add image cropping/editing tools in the UI?

### References
- [Google Content API - Product Images](https://developers.google.com/shopping-content/reference/rest/v2.1/products#Product.FIELDS.image_link)
- [Google Merchant Center - Image Requirements](https://support.google.com/merchants/answer/6324350)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- Current single-image implementation: `apps/api/src/routes/items.ts` (POST /items/:id/photos)
