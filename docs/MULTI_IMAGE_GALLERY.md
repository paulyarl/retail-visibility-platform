# Multi-Image Gallery Feature Documentation

## Overview
The multi-image gallery feature allows merchants to upload up to 11 photos per product (1 primary + 10 additional), manage them through an intuitive UI, and automatically sync them to Google Shopping feeds.

## Table of Contents
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Web UI Components](#web-ui-components)
- [Google Feed Integration](#google-feed-integration)
- [Usage Guide](#usage-guide)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

---

## Architecture

### Data Flow
```
User Upload → Client Compression (1024px/0.8) → API Endpoint → Supabase Storage → PhotoAsset DB Record → Product Page Carousel + Google Feed
```

### Key Components
1. **Backend (apps/api)**
   - Prisma schema with PhotoAsset model
   - Photos router with 5 CRUD endpoints
   - Feed generator with multi-image support

2. **Frontend (apps/web)**
   - ItemPhotoGallery component (admin)
   - ProductGallery carousel (public)
   - API proxy routes

3. **Storage**
   - Supabase Storage bucket: `photos`
   - Path format: `{tenantId}/{sku}/{timestamp}-{filename}`

---

## Database Schema

### PhotoAsset Model
```prisma
model PhotoAsset {
  id              String        @id @default(cuid())
  tenantId        String
  inventoryItemId String
  url             String
  width           Int?
  height          Int?
  contentType     String?
  bytes           Int?
  exifRemoved     Boolean       @default(false)
  capturedAt      DateTime?
  createdAt       DateTime      @default(now())
  publicUrl       String?
  signedUrl       String?
  position        Int           @default(0)      // NEW: 0 = primary, 1-10 = additional
  alt             String?                        // NEW: Alt text for accessibility
  caption         String?                        // NEW: Display caption
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([inventoryItemId, position])
  @@index([tenantId])
  @@index([inventoryItemId])
  @@index([capturedAt])
  @@index([inventoryItemId, position])
}
```

### Key Fields
- **position**: Integer (0-10), 0 = primary image shown in `item.imageUrl`
- **alt**: Optional alt text for SEO and accessibility
- **caption**: Optional caption displayed below image
- **Unique constraint**: One photo per position per item

### Migration
- **File**: `prisma/migrations/20251029_add_photo_gallery_fields/migration.sql`
- **Backfill**: All existing photos set to position=0 (primary)
- **Backward compatible**: Legacy `item.imageUrl` still works

---

## API Endpoints

All endpoints require authentication and tenant membership verification.

### 1. GET /items/:id/photos
**List all photos for an item, ordered by position**

**Response:**
```json
[
  {
    "id": "photo123",
    "url": "https://...storage.../photo.jpg",
    "position": 0,
    "alt": "Product front view",
    "caption": "Main product image",
    "createdAt": "2025-10-29T12:00:00Z"
  },
  {
    "id": "photo456",
    "url": "https://...storage.../photo2.jpg",
    "position": 1,
    "alt": "Product side view",
    "caption": "Side angle",
    "createdAt": "2025-10-29T12:01:00Z"
  }
]
```

### 2. POST /items/:id/photos
**Upload a new photo**

**Request Body (JSON):**
```json
{
  "tenantId": "tenant123",
  "dataUrl": "data:image/jpeg;base64,...",  // Base64 encoded image
  "contentType": "image/jpeg",
  "alt": "Product front view",              // Optional
  "caption": "Main product image"           // Optional
}
```

**OR (Multipart Form Data):**
```
file: [binary image data]
alt: "Product front view"
caption: "Main product image"
```

**Response (201):**
```json
{
  "id": "photo123",
  "url": "https://...storage.../photo.jpg",
  "position": 2,  // Auto-assigned (max + 1)
  "alt": "Product front view",
  "caption": "Main product image",
  "createdAt": "2025-10-29T12:00:00Z"
}
```

**Error (400):**
```json
{
  "error": "maximum 11 photos per item"
}
```

### 3. PUT /items/:id/photos/:photoId
**Update photo metadata or position**

**Request Body:**
```json
{
  "alt": "Updated alt text",      // Optional
  "caption": "Updated caption",   // Optional
  "position": 0                   // Optional: Set as primary
}
```

**Behavior:**
- If position changes, swaps with photo at target position
- Uses transaction to avoid unique constraint violations
- Updates `item.imageUrl` if setting as primary (position=0)

**Response (200):**
```json
{
  "id": "photo123",
  "url": "https://...storage.../photo.jpg",
  "position": 0,
  "alt": "Updated alt text",
  "caption": "Updated caption"
}
```

### 4. PUT /items/:id/photos/reorder
**Bulk reorder multiple photos**

**Request Body:**
```json
[
  { "id": "photo123", "position": 0 },
  { "id": "photo456", "position": 1 },
  { "id": "photo789", "position": 2 }
]
```

**Response (204):** No content on success

**Use Case:** Drag-and-drop reordering in UI

### 5. DELETE /items/:id/photos/:photoId
**Delete a photo**

**Response (204):** No content on success

**Behavior:**
- Deletes from Supabase Storage
- Deletes from database
- Re-packs positions (e.g., 0,1,3,4 → 0,1,2,3)
- Updates `item.imageUrl` to new primary or null if no photos left

---

## Web UI Components

### 1. ItemPhotoGallery (Admin)
**Location:** `apps/web/src/components/items/ItemPhotoGallery.tsx`

**Features:**
- Multi-upload with client-side compression (1024px max width, 0.8 quality)
- Thumbnail grid display
- Set primary button (swaps to position 0)
- Inline alt/caption editing with autosave
- Delete with confirmation
- 11-photo limit with visual feedback
- Error handling and loading states

**Usage:**
```tsx
<ItemPhotoGallery
  item={item}
  tenantId={tenantId}
  onUpdate={() => refreshItems()}
/>
```

**Access:** Items page → Click "Gallery" button next to any item

### 2. ProductGallery (Public Carousel)
**Location:** `apps/web/src/components/products/ProductGallery.tsx`

**Features:**
- Responsive carousel (aspect-video, max-w-3xl)
- Prev/Next navigation buttons (loops)
- Image counter (e.g., "3 / 5")
- Zoom button (opens full-size in new tab)
- Horizontal thumbnail strip
- Alt text for accessibility
- Captions displayed below images
- Smooth transitions and hover effects

**Usage:**
```tsx
<ProductGallery
  gallery={photos}  // Array of Photo objects
  productTitle={product.title}
/>
```

**Display:** Product page, positioned before store contact information

### 3. API Proxy Routes
**Location:** `apps/web/src/app/api/items/[id]/photos/`

- `route.ts` - GET and POST handlers
- `[photoId]/route.ts` - PUT and DELETE handlers
- `reorder/route.ts` - PUT handler for bulk reorder

**Purpose:** Proxy requests from web app to API with authentication

---

## Google Feed Integration

### Feed Generator
**Location:** `apps/api/src/lib/google/feed-generator.ts`

**Mapping:**
```javascript
{
  "imageUrl": photos[position=0].url,           // Primary image → imageLink
  "additionalImageLinks": [                     // Positions 1-10 → additionalImageLinks
    photos[position=1].url,
    photos[position=2].url,
    // ... up to position 10
  ]
}
```

**Fallback:** If no photos exist, uses legacy `item.imageUrl`

**Google Shopping Limits:**
- 1 primary image (imageLink) - **required**
- Up to 10 additional images (additionalImageLinks) - optional

**Feed Endpoint:** `GET /google/feed?tenantId={id}`

---

## Usage Guide

### For Merchants

#### Uploading Photos
1. Navigate to **Items** page
2. Click **Gallery** button next to any item
3. Click **Add Photo** button
4. Select image file (JPEG/PNG)
5. Image is automatically compressed and uploaded
6. Repeat up to 11 photos total

#### Managing Photos
- **Set Primary:** Hover over thumbnail → Click "Set Primary"
- **Edit Alt/Caption:** Hover → Click "Edit" → Enter text → Click "Save"
- **Delete:** Hover → Click "Delete" → Confirm
- **Reorder:** Click thumbnails to view in carousel (admin can implement drag-drop later)

#### Viewing on Product Page
- Visit `/products/{itemId}` to see carousel
- Use prev/next arrows to navigate
- Click zoom button to view full-size
- Thumbnails show all available photos

### For Developers

#### Adding a Photo Programmatically
```javascript
const response = await fetch(`/api/items/${itemId}/photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'tenant123',
    dataUrl: 'data:image/jpeg;base64,...',
    alt: 'Product image',
    caption: 'Optional caption'
  })
});

const photo = await response.json();
console.log('Uploaded:', photo.url, 'Position:', photo.position);
```

#### Fetching Photos
```javascript
const response = await fetch(`/api/items/${itemId}/photos`);
const photos = await response.json();
// photos is array ordered by position (0, 1, 2, ...)
```

#### Setting Primary Photo
```javascript
await fetch(`/api/items/${itemId}/photos/${photoId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ position: 0 })
});
```

---

## Migration Guide

### Running the Migration

```bash
cd apps/api

# Generate Prisma client
doppler run --config local -- pnpm prisma generate

# Apply migration
doppler run --config local -- pnpm prisma migrate deploy

# Verify
doppler run --config local -- pnpm prisma migrate status
```

### Verification Steps

1. **Check schema:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'PhotoAsset';
   ```
   Should include: `position`, `alt`, `caption`

2. **Check existing photos:**
   ```sql
   SELECT id, "inventoryItemId", position, url 
   FROM "PhotoAsset" 
   LIMIT 10;
   ```
   All should have `position = 0`

3. **Test upload:**
   - Go to Items page
   - Click Gallery on any item
   - Upload a photo
   - Verify it appears with position 1 (or 0 if first)

### Rollback (if needed)

```bash
cd apps/api
doppler run --config local -- pnpm prisma migrate resolve --rolled-back 20251029_add_photo_gallery_fields
```

Then manually remove columns:
```sql
ALTER TABLE "PhotoAsset" DROP CONSTRAINT "PhotoAsset_inventoryItemId_position_key";
DROP INDEX "PhotoAsset_inventoryItemId_position_idx";
ALTER TABLE "PhotoAsset" DROP COLUMN "position";
ALTER TABLE "PhotoAsset" DROP COLUMN "alt";
ALTER TABLE "PhotoAsset" DROP COLUMN "caption";
```

---

## Troubleshooting

### Issue: "Maximum 11 photos per item" error
**Cause:** Trying to upload when item already has 11 photos  
**Solution:** Delete some photos before uploading new ones

### Issue: Photos not appearing in carousel
**Cause:** Photos router not mounted or proxy routes missing  
**Solution:** 
1. Check API logs for "Photos router mounted"
2. Verify proxy routes exist in `apps/web/src/app/api/items/[id]/photos/`
3. Check browser console for 404 errors

### Issue: "Unique constraint failed" on upload
**Cause:** Position conflict (shouldn't happen with proper logic)  
**Solution:**
1. Check database for duplicate positions:
   ```sql
   SELECT "inventoryItemId", position, COUNT(*) 
   FROM "PhotoAsset" 
   GROUP BY "inventoryItemId", position 
   HAVING COUNT(*) > 1;
   ```
2. Fix manually or re-run migration

### Issue: Primary photo not updating item.imageUrl
**Cause:** Logic not triggered or transaction failed  
**Solution:**
1. Check API logs for errors
2. Manually sync:
   ```sql
   UPDATE "InventoryItem" i
   SET "imageUrl" = (
     SELECT url FROM "PhotoAsset" 
     WHERE "inventoryItemId" = i.id 
     AND position = 0 
     LIMIT 1
   );
   ```

### Issue: Photos not in Google feed
**Cause:** Feed generator not updated or cache issue  
**Solution:**
1. Verify feed generator includes `photos` relation
2. Clear feed cache (if applicable)
3. Check feed output: `GET /google/feed?tenantId={id}`

### Issue: Image compression too aggressive
**Cause:** Default settings (1024px, 0.8 quality)  
**Solution:** Adjust in `ItemPhotoGallery.tsx`:
```javascript
const compressImage = async (file: File, maxWidth = 1920, quality = 0.9) => {
  // ... compression logic
};
```

---

## Performance Considerations

### Image Optimization
- **Client-side compression:** Reduces upload size and bandwidth
- **Max dimensions:** 1024px width (configurable)
- **Quality:** 0.8 JPEG (configurable)
- **Format:** Always JPEG for consistency

### Database Queries
- **Indexed:** `inventoryItemId + position` for fast ordered retrieval
- **Cascade delete:** Photos automatically deleted when item deleted
- **Transaction:** Position swaps use atomic transactions

### Storage
- **Bucket:** Supabase Storage `photos` bucket
- **Cleanup:** DELETE endpoint removes from storage and DB
- **Path structure:** Organized by tenant and SKU for easy management

### Caching
- **Product page:** Photos fetched on page load (no-store cache)
- **Feed:** Generated on-demand (consider caching in production)
- **Thumbnails:** Browser caches images automatically

---

## Future Enhancements

### Potential Features
- [ ] Drag-and-drop reordering in gallery UI
- [ ] Multiple file selection for batch upload
- [ ] Image cropping/editing tools
- [ ] Automatic thumbnail generation (multiple sizes)
- [ ] CDN integration for faster delivery
- [ ] Lazy loading for large galleries
- [ ] Keyboard shortcuts (arrow keys for carousel)
- [ ] Bulk actions (delete multiple, copy between items)
- [ ] Image search/filter in gallery
- [ ] Video support
- [ ] 360° product views

### E2E Tests (Recommended)
```typescript
// apps/web/tests/e2e/item-gallery.spec.ts
test('should upload multiple photos', async ({ page }) => {
  // Test multi-upload flow
});

test('should set primary photo', async ({ page }) => {
  // Test set primary button
});

test('should edit alt and caption', async ({ page }) => {
  // Test inline editing
});

test('should delete photo and re-pack positions', async ({ page }) => {
  // Test delete and verify positions
});

test('should enforce 11-photo limit', async ({ page }) => {
  // Test limit feedback
});
```

---

## API Reference Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/items/:id/photos` | GET | List photos | Yes |
| `/items/:id/photos` | POST | Upload photo | Yes |
| `/items/:id/photos/:photoId` | PUT | Update photo | Yes |
| `/items/:id/photos/:photoId` | DELETE | Delete photo | Yes |
| `/items/:id/photos/reorder` | PUT | Bulk reorder | Yes |

## Component Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `ItemPhotoGallery` | `apps/web/src/components/items/` | Admin gallery management |
| `ProductGallery` | `apps/web/src/components/products/` | Public carousel display |
| `TierBasedLandingPage` | `apps/web/src/components/landing-page/` | Product page layout |

## Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `PhotoAsset` | Store photo metadata | `position`, `alt`, `caption`, `url` |
| `InventoryItem` | Product data | `imageUrl` (synced with position 0) |

---

## Support

For issues or questions:
1. Check this documentation
2. Review API logs for errors
3. Check browser console for client-side errors
4. Verify database schema matches expected structure
5. Test with curl/Postman to isolate API vs UI issues

## Changelog

### v1.0.0 (2025-10-29)
- Initial release
- Backend: Prisma schema, migration, 5 API endpoints
- Frontend: Gallery management UI, product carousel
- Integration: Google Shopping feed with additionalImageLinks
- Migration: Backfill existing photos with position=0
- Documentation: Complete API and usage guide

---

**Last Updated:** October 29, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅
