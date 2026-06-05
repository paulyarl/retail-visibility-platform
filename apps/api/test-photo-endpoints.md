# Test Photo Gallery Endpoints

## Prerequisites
- API server running on http://localhost:4000
- At least one item exists in the database
- Replace `{itemId}` with an actual item ID from your database

## Get Item ID
First, get an item ID to test with:

```bash
curl http://localhost:4000/items | jq '.[0].id'
```

Set it as a variable (PowerShell):
```powershell
$itemId = "YOUR_ITEM_ID_HERE"
$tenantId = "YOUR_TENANT_ID_HERE"
```

Or (bash):
```bash
export ITEM_ID="YOUR_ITEM_ID_HERE"
export TENANT_ID="YOUR_TENANT_ID_HERE"
```

## 1. GET /items/:id/photos (List photos)

```bash
curl http://localhost:4000/items/$itemId/photos
```

Expected: Empty array `[]` or existing photos ordered by position

## 2. POST /items/:id/photos (Upload photo)

### Test with JSON (simpler for testing)
```bash
curl -X POST http://localhost:4000/items/$itemId/photos \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$tenantId\",
    \"url\": \"https://via.placeholder.com/800x800.jpg?text=Photo1\",
    \"alt\": \"Test photo 1\",
    \"caption\": \"First test photo\"
  }"
```

Expected: Returns created photo with position=0

### Upload a second photo
```bash
curl -X POST http://localhost:4000/items/$itemId/photos \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$tenantId\",
    \"url\": \"https://via.placeholder.com/800x800.jpg?text=Photo2\",
    \"alt\": \"Test photo 2\",
    \"caption\": \"Second test photo\"
  }"
```

Expected: Returns created photo with position=1

### Upload a third photo
```bash
curl -X POST http://localhost:4000/items/$itemId/photos \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$tenantId\",
    \"url\": \"https://via.placeholder.com/800x800.jpg?text=Photo3\",
    \"alt\": \"Test photo 3\"
  }"
```

Expected: Returns created photo with position=2

## 3. GET /items/:id/photos (Verify order)

```bash
curl http://localhost:4000/items/$itemId/photos | jq '.[] | {position, alt, url}'
```

Expected: Array of 3 photos ordered by position (0, 1, 2)

## 4. PUT /items/:id/photos/:photoId (Update alt/caption)

Get the second photo's ID:
```bash
$photoId = (curl http://localhost:4000/items/$itemId/photos | ConvertFrom-Json)[1].id
```

Update its alt/caption:
```bash
curl -X PUT http://localhost:4000/items/$itemId/photos/$photoId \
  -H "Content-Type: application/json" \
  -d "{
    \"alt\": \"Updated alt text\",
    \"caption\": \"Updated caption\"
  }"
```

Expected: Returns updated photo with new alt/caption

## 5. PUT /items/:id/photos/:photoId (Set as primary)

Set the third photo (position 2) as primary:
```bash
$photo3Id = (curl http://localhost:4000/items/$itemId/photos | ConvertFrom-Json)[2].id

curl -X PUT http://localhost:4000/items/$itemId/photos/$photo3Id \
  -H "Content-Type: application/json" \
  -d "{\"position\": 0}"
```

Expected: Photo 3 is now position 0, old primary swapped to position 2

Verify:
```bash
curl http://localhost:4000/items/$itemId/photos | jq '.[] | {position, alt}'
```

## 6. PUT /items/:id/photos/reorder (Bulk reorder)

Get all photo IDs:
```bash
$photos = curl http://localhost:4000/items/$itemId/photos | ConvertFrom-Json
```

Reorder them (reverse order):
```bash
curl -X PUT http://localhost:4000/items/$itemId/photos/reorder \
  -H "Content-Type: application/json" \
  -d "[
    {\"id\": \"$($photos[2].id)\", \"position\": 0},
    {\"id\": \"$($photos[1].id)\", \"position\": 1},
    {\"id\": \"$($photos[0].id)\", \"position\": 2}
  ]"
```

Expected: 204 No Content

Verify new order:
```bash
curl http://localhost:4000/items/$itemId/photos | jq '.[] | {position, alt}'
```

## 7. DELETE /items/:id/photos/:photoId (Delete photo)

Delete the middle photo (position 1):
```bash
$photo2Id = (curl http://localhost:4000/items/$itemId/photos | ConvertFrom-Json)[1].id

curl -X DELETE http://localhost:4000/items/$itemId/photos/$photo2Id
```

Expected: 204 No Content

Verify positions re-packed (should now be 0, 1 instead of 0, 1, 2):
```bash
curl http://localhost:4000/items/$itemId/photos | jq '.[] | {position, alt}'
```

## 8. Test 11-photo limit

Try uploading 11 more photos (should fail on the 10th):
```bash
for ($i=4; $i -le 13; $i++) {
  curl -X POST http://localhost:4000/items/$itemId/photos `
    -H "Content-Type: application/json" `
    -d "{
      \"tenantId\": \"$tenantId\",
      \"url\": \"https://via.placeholder.com/800x800.jpg?text=Photo$i\"
    }"
  Write-Host "Uploaded photo $i"
}
```

Expected: First 9 succeed (bringing total to 11), 10th returns 400 "maximum 11 photos per item"

## 9. Verify item.imageUrl updated

Check that the item's imageUrl points to the primary photo:
```bash
curl http://localhost:4000/items/$itemId | jq '{imageUrl, id}'
```

Compare with primary photo URL:
```bash
curl http://localhost:4000/items/$itemId/photos | jq '.[0].url'
```

Expected: Both URLs should match

## Cleanup

Delete all test photos:
```bash
$photos = curl http://localhost:4000/items/$itemId/photos | ConvertFrom-Json
foreach ($photo in $photos) {
  curl -X DELETE http://localhost:4000/items/$itemId/photos/$($photo.id)
}
```

Verify empty:
```bash
curl http://localhost:4000/items/$itemId/photos
```

Expected: `[]`

## Success Criteria

✅ GET returns photos ordered by position  
✅ POST creates photo with next position  
✅ POST enforces 11-photo limit  
✅ PUT updates alt/caption  
✅ PUT with position swaps photos  
✅ PUT /reorder updates all positions  
✅ DELETE removes photo and re-packs positions  
✅ item.imageUrl always points to primary (position 0)  
✅ Existing photos have position=0 after migration  

## Troubleshooting

### "item not found"
- Verify item ID exists: `curl http://localhost:4000/items | jq '.[].id'`

### "tenantId required"
- Ensure you're passing tenantId in POST body

### TypeScript errors in photos.ts
- Run `pnpm prisma generate` in apps/api

### Migration not applied
- Check: `doppler run --config local -- pnpm prisma migrate status`
- Apply: `doppler run --config local -- pnpm prisma migrate deploy`
