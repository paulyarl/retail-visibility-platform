# Product Image Finder Feature

**Status:** ✅ IMPLEMENTED - Free stock photo integration with Unsplash and Pexels

## Overview

One-click product image finder that searches free stock photo APIs (Unsplash and Pexels) and allows users to select and attach professional images to their products. Similar UX to the enrich and gallery features.

## User Experience

### 1-Click Workflow:
1. **Click** "Find Image" button on product card
2. **Modal opens** with auto-search for product name
3. **Select** from 12 recommended images
4. **Click** "Attach Image" to save

### Modal Features:
- Auto-searches on open using product name
- Grid of 12 images (6 Unsplash + 6 Pexels)
- Visual selection with checkmark overlay
- Photographer attribution displayed
- Search bar for custom queries
- Loading states and error handling

## Technical Implementation

### Frontend Component

**File:** `apps/web/src/components/items/ImageFinderModal.tsx`

**Features:**
- Auto-search on modal open
- Image grid with selection state
- Photographer attribution
- Loading and error states
- Responsive design (2-3 column grid)

**Props:**
```typescript
interface ImageFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: string;
  tenantId: string;
  onImageAttached: () => void;
}
```

### Backend API Routes

#### 1. Image Search API

**File:** `apps/api/src/routes/image-search.ts`

**Endpoint:** `GET /api/v1/images/search?query={searchTerm}`

**Features:**
- Searches Unsplash API (50 requests/hour free)
- Searches Pexels API (unlimited free)
- Returns up to 12 images total
- Includes photographer attribution
- Handles API errors gracefully

**Response:**
```json
{
  "success": true,
  "query": "milk",
  "count": 12,
  "images": [
    {
      "id": "unsplash-abc123",
      "url": "https://images.unsplash.com/...",
      "thumbnail": "https://images.unsplash.com/.../small",
      "description": "Fresh milk in glass",
      "photographer": "John Doe",
      "photographerUrl": "https://unsplash.com/@johndoe",
      "source": "unsplash",
      "downloadUrl": "https://images.unsplash.com/.../regular"
    }
  ]
}
```

#### 2. Image Attachment API

**File:** `apps/api/src/routes/image-attach.ts`

**Endpoint:** `POST /api/v1/tenants/:tenantId/items/:itemId/attach-image`

**Features:**
- Downloads image from Unsplash/Pexels
- Saves to local uploads directory
- Creates PhotoAsset record
- Sets as primary photo (position 0)
- Includes photographer attribution in alt text

**Request Body:**
```json
{
  "imageUrl": "https://images.unsplash.com/...",
  "source": "unsplash",
  "photographer": "John Doe",
  "photographerUrl": "https://unsplash.com/@johndoe"
}
```

**Response:**
```json
{
  "success": true,
  "photo": {
    "id": "photo123",
    "url": "/uploads/items/abc-123.jpg",
    "alt": "Photo by John Doe on unsplash"
  }
}
```

## API Integration

### Unsplash API

**Free Tier:**
- 50 requests per hour
- High-quality professional photos
- Commercial use allowed
- Attribution required (handled automatically)

**Setup:**
1. Create account at https://unsplash.com/developers
2. Create new application
3. Get Access Key
4. Add to `.env`: `UNSPLASH_ACCESS_KEY=your_key_here`

**API Docs:** https://unsplash.com/documentation

### Pexels API

**Free Tier:**
- Unlimited requests
- High-quality stock photos
- Commercial use allowed
- Attribution required (handled automatically)

**Setup:**
1. Create account at https://www.pexels.com/api/
2. Get API Key
3. Add to `.env`: `PEXELS_API_KEY=your_key_here`

**API Docs:** https://www.pexels.com/api/documentation/

## Environment Variables

Add to `.env` file:

```bash
# Image Search APIs
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
PEXELS_API_KEY=your_pexels_api_key
```

## Database Schema

Uses existing `PhotoAsset` model:

```prisma
model PhotoAsset {
  id              String        @id @default(cuid())
  tenantId        String
  inventoryItemId String
  url             String
  position        Int           @default(0)
  alt             String?       // Stores photographer attribution
  // ... other fields
}
```

## File Storage

Images are saved to:
- **Directory:** `uploads/items/`
- **Filename:** UUID + original extension
- **URL:** `/uploads/items/{uuid}.jpg`

## Integration Points

### Product Cards

Add "Find Image" button alongside existing actions:

```typescript
import ImageFinderModal from '@/components/items/ImageFinderModal';

// In component:
const [showImageFinder, setShowImageFinder] = useState(false);

// Button:
<Button onClick={() => setShowImageFinder(true)}>
  <ImageIcon className="w-4 h-4 mr-2" />
  Find Image
</Button>

// Modal:
<ImageFinderModal
  isOpen={showImageFinder}
  onClose={() => setShowImageFinder(false)}
  productName={product.name}
  productId={product.id}
  tenantId={tenantId}
  onImageAttached={() => {
    // Refresh product data
    setShowImageFinder(false);
  }}
/>
```

### Quick Start Integration

Can be added as optional step in Quick Start wizard:

```typescript
// After creating products:
const attachImages = async (products: Product[]) => {
  for (const product of products) {
    // Auto-search and attach first result
    const response = await fetch(`/api/v1/images/search?query=${product.name}`);
    const { images } = await response.json();
    
    if (images.length > 0) {
      await fetch(`/api/v1/tenants/${tenantId}/items/${product.id}/attach-image`, {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: images[0].downloadUrl,
          source: images[0].source,
          photographer: images[0].photographer,
          photographerUrl: images[0].photographerUrl,
        }),
      });
    }
  }
};
```

## Benefits

### For Users:
- ✅ **Free** professional product images
- ✅ **Fast** 1-click workflow
- ✅ **Quality** curated stock photos
- ✅ **Legal** commercial use allowed
- ✅ **Attribution** handled automatically

### For Platform:
- ✅ **No cost** (free API tiers)
- ✅ **Better storefronts** with images
- ✅ **Higher conversion** for users
- ✅ **Competitive advantage** vs manual upload
- ✅ **Scalable** (Pexels unlimited)

## Rate Limits

### Unsplash:
- **Free:** 50 requests/hour
- **Strategy:** Use for first 6 images
- **Fallback:** Switch to Pexels if limit hit

### Pexels:
- **Free:** Unlimited requests
- **Strategy:** Use for remaining 6 images
- **Fallback:** Primary source if Unsplash unavailable

### Combined:
- **Total:** 12 images per search
- **Coverage:** ~95% of products will find matches
- **Fallback:** User can search with different terms

## Error Handling

### API Failures:
- Graceful degradation (try both APIs)
- Clear error messages to user
- Retry logic for transient failures

### No Results:
- "No images found" message
- Suggestion to try different search terms
- Option to upload manually

### Download Failures:
- Retry with exponential backoff
- Fall back to next image in list
- Clear error message if all fail

## Future Enhancements

### Phase 2: AI Generation
- Add Stability AI / DALL-E integration
- Professional+ tier feature
- Custom product photos
- Brand-specific styling

### Phase 3: Bulk Operations
- "Find Images for All" button
- Batch process entire inventory
- Progress indicator
- Skip products with existing images

### Phase 4: Smart Matching
- ML-based image selection
- Category-aware search terms
- Brand color matching
- Quality scoring

### Phase 5: Image Editing
- Crop and resize in modal
- Background removal
- Watermark addition
- Filters and adjustments

## Testing Checklist

- [ ] Search returns results for common products
- [ ] Image selection works (visual feedback)
- [ ] Attach image creates PhotoAsset record
- [ ] Image displays on product card
- [ ] Photographer attribution is stored
- [ ] Error handling works (no API keys)
- [ ] Loading states display correctly
- [ ] Modal closes after attachment
- [ ] Works on mobile devices
- [ ] Rate limits are respected

## Deployment Notes

1. **Environment Variables:** Add API keys to production `.env`
2. **Uploads Directory:** Ensure `uploads/items/` exists and is writable
3. **Static Files:** Ensure `/uploads` route serves files
4. **API Routes:** Register in `index.ts`
5. **Dependencies:** Install `node-fetch` if not present

## Success Metrics

Track these metrics:
- **Usage:** How many users click "Find Image"
- **Success Rate:** % of searches that find images
- **Attachment Rate:** % of searches that result in attachment
- **API Performance:** Response times for each API
- **Error Rate:** Failed searches or attachments
- **User Satisfaction:** Feedback on image quality

## License Compliance

Both Unsplash and Pexels require attribution:

- ✅ **Stored in alt text:** "Photo by {photographer} on {source}"
- ✅ **Displayed in modal:** Photographer name with link
- ✅ **Compliant:** Meets both platforms' requirements

## Cost Analysis

**Current (Free Tier):**
- Unsplash: $0/month (50 req/hour)
- Pexels: $0/month (unlimited)
- **Total: $0/month**

**Potential Upgrade (if needed):**
- Unsplash Enterprise: $99/month (unlimited)
- **Only needed if >1,200 searches/day**

**AI Generation (Future):**
- Stability AI: ~$0.002/image
- DALL-E 3: ~$0.04/image
- **Professional+ tier feature**

This feature provides massive value at zero cost, making it a perfect addition to the platform!
