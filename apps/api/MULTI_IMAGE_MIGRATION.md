# Multi-Image Gallery Migration Guide

## Phase 1: Backend Implementation (COMPLETE)

### Changes Made

1. **Prisma Schema** (`prisma/schema.prisma`)
   - Added `position`, `alt`, and `caption` fields to `PhotoAsset` model
   - Added unique constraint on `(inventoryItemId, position)`
   - Added index on `(inventoryItemId, position)` for efficient ordered retrieval

2. **SQL Migration** (`prisma/migrations/20251029_add_photo_gallery_fields/migration.sql`)
   - Adds new columns to PhotoAsset table
   - Sets position=0 for all existing photos (they become primary)
   - Adds constraints and indexes

3. **API Endpoints** (`src/photos.ts`)
   - **POST /items/:id/photos**: Enhanced to support alt/caption, enforce 11-photo limit, assign next position
   - **GET /items/:id/photos**: Updated to order by position (ascending)
   - **PUT /items/:id/photos/:photoId**: New endpoint to update alt/caption/position with swap logic
   - **PUT /items/:id/photos/reorder**: New endpoint for bulk reordering
   - **DELETE /items/:id/photos/:photoId**: New endpoint with Supabase Storage cleanup and position re-packing

### Running the Migration

```bash
# 1. Navigate to API directory
cd apps/api

# 2. Generate Prisma client with new schema
doppler run --config local -- pnpm prisma generate

# 3. Run the migration
doppler run --config local -- pnpm prisma migrate deploy

# Or for development:
doppler run --config local -- pnpm prisma migrate dev --name add_photo_gallery_fields

# 4. Restart the API server
# The TypeScript errors in photos.ts will resolve after prisma generate
```

### Testing the Endpoints

```bash
# Get photos for an item (ordered by position)
curl http://localhost:4000/items/{itemId}/photos

# Upload a new photo with alt/caption
curl -X POST http://localhost:4000/items/{itemId}/photos \
  -H "Content-Type: application/json" \
  -d '{"url": "https://...", "alt": "Product front view", "caption": "Main image"}'

# Update photo alt/caption
curl -X PUT http://localhost:4000/items/{itemId}/photos/{photoId} \
  -H "Content-Type: application/json" \
  -d '{"alt": "Updated alt text", "caption": "Updated caption"}'

# Set a photo as primary (position 0)
curl -X PUT http://localhost:4000/items/{itemId}/photos/{photoId} \
  -H "Content-Type: application/json" \
  -d '{"position": 0}'

# Reorder photos
curl -X PUT http://localhost:4000/items/{itemId}/photos/reorder \
  -H "Content-Type: application/json" \
  -d '[{"id": "photo1", "position": 0}, {"id": "photo2", "position": 1}]'

# Delete a photo
curl -X DELETE http://localhost:4000/items/{itemId}/photos/{photoId}
```

### Verification

1. **Check existing photos have position=0**:
   ```sql
   SELECT id, "inventoryItemId", position, url FROM "PhotoAsset" LIMIT 10;
   ```

2. **Verify unique constraint**:
   ```sql
   -- This should fail (duplicate position for same item):
   INSERT INTO "PhotoAsset" ("id", "tenantId", "inventoryItemId", "url", "position")
   VALUES ('test', 'tenant1', 'item1', 'http://test.com', 0);
   ```

3. **Test multi-upload**:
   - Upload 2-3 photos to an item
   - Verify positions are 0, 1, 2
   - Verify GET returns them in order

4. **Test reorder**:
   - Call PUT /reorder with swapped positions
   - Verify GET returns new order
   - Verify item.imageUrl points to position 0

5. **Test delete**:
   - Delete position 1
   - Verify remaining photos are re-packed (2→1, 3→2, etc.)

### Security Notes

- All endpoints verify item exists before operating on photos
- Photos are scoped by inventoryItemId (can't access photos from other items)
- Supabase Storage cleanup on delete prevents orphaned files
- 11-photo limit enforced on POST

### Next Steps (Phase 2 - Web UI)

See `docs/MULTI_IMAGE_SPEC.md` for:
- Gallery component implementation
- Items page integration
- Drag-and-drop reordering
- Inline alt/caption editing
- E2E tests

### Rollback

If needed, rollback the migration:

```bash
cd apps/api
doppler run --config local -- pnpm prisma migrate resolve --rolled-back 20251029_add_photo_gallery_fields
```

Then manually remove the columns:
```sql
ALTER TABLE "PhotoAsset" DROP CONSTRAINT "PhotoAsset_inventoryItemId_position_key";
DROP INDEX "PhotoAsset_inventoryItemId_position_idx";
ALTER TABLE "PhotoAsset" DROP COLUMN "position";
ALTER TABLE "PhotoAsset" DROP COLUMN "alt";
ALTER TABLE "PhotoAsset" DROP COLUMN "caption";
```
