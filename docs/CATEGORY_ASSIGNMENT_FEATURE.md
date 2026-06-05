# Item Category Assignment Feature

## Overview
Complete UI workflow for assigning tenant categories to inventory items, with educational guidance, filtering, and seamless navigation between Items and Categories pages.

## Features Implemented

### 1. Category Assignment Modal
**File:** `apps/web/src/components/items/AssignCategoryModal.tsx`

- **Tenant Categories Selection**
  - Searchable list with real-time filtering
  - "Mapped only" toggle to show only Google-aligned categories
  - Recent categories section (persisted in localStorage)
  - Visual indicators for Google taxonomy mapping

- **Google Taxonomy Search**
  - Debounced autocomplete search
  - Displays full category path
  - Educational note with link to Categories page

- **API Integration**
  - Endpoint: `PATCH /api/v1/tenants/:tenantId/items/:itemId/category`
  - Payload: `{ tenantCategoryId: string }`
  - Error handling with user-friendly messages

### 2. Items Page Enhancements
**File:** `apps/web/src/components/items/ItemsClient.tsx`

- **Category Display on Item Cards**
  - Prominent box with tag icon
  - Blue badge for assigned categories
  - Orange "Unassigned" badge for items without categories
  - Smart button text: "Assign" or "Change"

- **Category Filter**
  - All: Show all items
  - Assigned: Only items with categories
  - Unassigned: Only items without categories (with warning icon)
  - Client-side filtering using `useMemo` for instant results

- **Category Organization CTA**
  - Positioned after Quick Stats Dashboard
  - White card with purple tag icon
  - Direct link to Categories page
  - Educational description

- **Two-Column Badge Legends**
  - Status Guide (blue): Active, Inactive, Private, Syncing
  - Category Guide (purple): Assigned, Unassigned, Tips, Quick actions

### 3. Categories Page Enhancements
**File:** `apps/web/src/app/t/[tenantId]/categories/page.tsx`

- **Educational Tip (Top)**
  - Blue info box explaining workflow
  - Links to Items page
  - Positioned before Alignment Status for first-time user guidance

- **"What's Next?" Section (Bottom)**
  - Gradient background with two action cards
  - "Assign to Products" → Links to Items page
  - "Preview Storefront" → Opens storefront in new tab
  - Hover effects and visual polish

### 4. Backend API
**File:** `apps/api/src/index.ts`

- **Category Assignment Endpoint**
  ```
  PATCH /api/v1/tenants/:tenantId/items/:itemId/category
  Body: { tenantCategoryId: string, categorySlug?: string }
  ```
  - Validates item and category existence
  - Updates `categoryPath` field on inventory item
  - Returns updated item data

**File:** `apps/api/src/routes/tenant-categories.ts`

- **Enhanced Categories Endpoint**
  ```
  GET /api/v1/tenants/:tenantId/categories
  Query params:
    - search: string (name/slug contains)
    - mapped: 'true' | 'false'
    - limit: number (max 50, default 50)
    - cursor: string (id-based pagination)
  ```
  - Server-backed pagination ready for scale
  - Returns `{ data, nextCursor, stats }`

### 5. API Client Enhancement
**File:** `apps/web/src/lib/api.ts`

- Exported `API_BASE_URL` for direct backend calls
- Proper URL handling to avoid Next.js route conflicts

## User Flow

### Assigning a Category
1. User navigates to Items page
2. Sees Quick Stats Dashboard, then Category Organization CTA
3. Can filter items by category status (All/Assigned/Unassigned)
4. Clicks "Assign" or "Change" on an item card
5. Modal opens with:
   - Recent categories (if any)
   - Searchable list of tenant categories
   - Google Taxonomy search
6. User selects a category
7. Clicks "Assign Category" button
8. Item card updates to show assigned category

### Creating a New Category
1. User clicks "Assign" but doesn't see suitable category
2. Clicks "Categories page" link in yellow tip box
3. Navigates to Categories page
4. Sees educational tip explaining workflow
5. Creates and aligns new category
6. Clicks "Assign to Products" in "What's Next?" section
7. Returns to Items page
8. Assigns the new category to product

## Technical Details

### State Management
- Category filter: `useState` with `useMemo` for derived state
- Recent categories: localStorage persistence (max 8 items)
- Modal state: Local component state with callbacks

### Performance
- Client-side filtering for instant results
- Server-backed pagination ready (limit/cursor)
- Debounced taxonomy search (300ms)
- Optimistic UI updates

### Styling
- Color coding:
  - 🟣 Purple: Category-related UI
  - 🔵 Blue: Status-related UI
  - 🟢 Green: Action/CTA elements
- Consistent with existing design system
- Responsive grid layouts
- Hover states and transitions

### Error Handling
- API errors displayed in modal
- Console logging for debugging
- User-friendly error messages
- Validation before API calls

## Files Modified

### New Files
- `apps/web/src/components/items/AssignCategoryModal.tsx`

### Modified Files
- `apps/web/src/components/items/ItemsClient.tsx`
- `apps/web/src/app/t/[tenantId]/categories/page.tsx`
- `apps/web/src/lib/api.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/tenant-categories.ts`

## Testing

### Manual Testing Checklist
- [ ] Assign category to item
- [ ] Change category on item
- [ ] Filter items by category status
- [ ] Search tenant categories in modal
- [ ] Search Google Taxonomy
- [ ] Recent categories persist across sessions
- [ ] Navigate to Categories page from Items
- [ ] Navigate to Items page from Categories
- [ ] Create category and assign to item (full flow)
- [ ] Modal shows correct state when no categories exist

### API Testing
```bash
# Assign category to item
curl -X PATCH http://localhost:4000/api/v1/tenants/{tenantId}/items/{itemId}/category \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"tenantCategoryId": "{categoryId}"}'

# Get categories with pagination
curl http://localhost:4000/api/v1/tenants/{tenantId}/categories?limit=20&cursor={id}

# Search categories
curl http://localhost:4000/api/v1/tenants/{tenantId}/categories?search=electronics&mapped=true
```

## Future Enhancements

### Planned
- Bulk category assignment (select multiple items)
- Category hierarchy display in modal
- Drag-and-drop category assignment
- Category suggestions based on product name/description
- Analytics: Most used categories, unassigned items count

### Server-Backed Pagination
The modal is ready for server-backed pagination:
- Modal already supports `limit` and `cursor` params
- API endpoint returns `nextCursor`
- Just need to wire "Load more" button to fetch next page

## Notes
- Categories must be created and aligned on Categories page before assignment
- Item `categoryPath` is an array to support future hierarchy
- Recent categories stored in localStorage (browser-specific)
- Modal uses direct backend URLs to avoid Next.js routing conflicts

## Related Documentation
- [Google Taxonomy Integration](./GOOGLE_TAXONOMY.md)
- [Tenant Categories](./TENANT_CATEGORIES.md)
- [Items Management](./ITEMS_MANAGEMENT.md)
