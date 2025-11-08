# ItemsClient Refactoring Guide

## Status: Services & Hooks Complete ✅

All foundational services and hooks have been created. The component refactor can now proceed.

---

## What's Been Created

### Services (Business Logic)
1. ✅ **`itemsDataService.ts`** - All API operations, filtering, stats
2. ✅ **`scanSessionService.ts`** - Barcode scanning session management

### Hooks (State Management)
1. ✅ **`useItemsData.ts`** - Data loading, pagination, refresh
2. ✅ **`useItemsFilters.ts`** - Search, status, visibility, category filters
3. ✅ **`useItemsModals.ts`** - All 6 modals (edit, QR, bulk, gallery, category, propagate)
4. ✅ **`useItemsActions.ts`** - CRUD operations (create, update, delete, upload)
5. ✅ **`useItemsForm.ts`** - Create form state and validation
6. ✅ **`useItemsViewMode.ts`** - Grid/list view toggle with localStorage

---

## Refactored Component Structure

The new ItemsClient will look like this:

```typescript
export default function ItemsClient({ initialItems, initialTenantId }: Props) {
  // Data & Loading
  const { items, loading, error, pagination, stats, refresh, loadPage } = 
    useItemsData({ tenantId, initialItems });
  
  // Filters
  const { 
    searchQuery, statusFilter, visibilityFilter, categoryFilter,
    setSearchQuery, setStatusFilter, setVisibilityFilter, setCategoryFilter,
    applyClientFilters, hasActiveFilters 
  } = useItemsFilters();
  
  // Modals
  const {
    editingItem, showEditModal, openEditModal, closeEditModal,
    qrItem, showQRModal, openQRModal, closeQRModal,
    showBulkUpload, openBulkUpload, closeBulkUpload,
    galleryItem, showPhotoGallery, openPhotoGallery, closePhotoGallery,
    categoryItem, showCategoryModal, openCategoryModal, closeCategoryModal,
    propagateItem, showPropagateModal, openPropagateModal, closePropagateModal,
  } = useItemsModals();
  
  // Actions
  const {
    createItem, creating,
    updateItem, updating,
    deleteItem, deleting,
    uploadPhotos, uploading,
  } = useItemsActions({ tenantId, onSuccess: refresh });
  
  // Form
  const {
    formData, updateField, resetForm, isValid,
    showForm, openForm, closeForm,
  } = useItemsForm();
  
  // View Mode
  const { viewMode, toggleViewMode } = useItemsViewMode();
  
  // Apply client-side filters
  const filteredItems = applyClientFilters(items);
  
  // Render
  return (
    <div>
      <ItemsHeader 
        stats={stats}
        onCreateClick={openForm}
        onBulkUploadClick={openBulkUpload}
      />
      
      <ItemsFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        visibilityFilter={visibilityFilter}
        onVisibilityChange={setVisibilityFilter}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        viewMode={viewMode}
        onViewModeToggle={toggleViewMode}
      />
      
      {showForm && (
        <ItemsCreateForm
          formData={formData}
          onFieldChange={updateField}
          onSubmit={handleCreate}
          onCancel={closeForm}
          isValid={isValid}
          creating={creating}
        />
      )}
      
      {viewMode === 'grid' ? (
        <ItemsGrid 
          items={filteredItems}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onQRCode={openQRModal}
          onPhotos={openPhotoGallery}
          onCategory={openCategoryModal}
          onPropagate={openPropagateModal}
        />
      ) : (
        <ItemsList 
          items={filteredItems}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />
      )}
      
      <ItemsPagination
        pagination={pagination}
        onPageChange={loadPage}
      />
      
      {/* Modals */}
      {showEditModal && editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={handleUpdate}
          onClose={closeEditModal}
        />
      )}
      
      {showQRModal && qrItem && (
        <QRCodeModal
          item={qrItem}
          onClose={closeQRModal}
        />
      )}
      
      {/* ... other modals ... */}
    </div>
  );
}
```

---

## Component Breakdown

### New Components to Create

1. **`ItemsHeader.tsx`** (~50 lines)
   - Quick stats display
   - Action buttons (Create, Bulk Upload)
   
2. **`ItemsFilters.tsx`** (~100 lines)
   - Search input
   - Status filter dropdown
   - Visibility filter dropdown
   - Category filter dropdown
   - View mode toggle

3. **`ItemsCreateForm.tsx`** (~150 lines)
   - SKU, name, price, stock inputs
   - Validation
   - Submit/cancel buttons

4. **`ItemsGrid.tsx`** (~200 lines)
   - Grid layout
   - Item cards
   - Action buttons per item

5. **`ItemsList.tsx`** (~150 lines)
   - Table layout
   - Item rows
   - Action buttons per item

6. **`ItemsPagination.tsx`** (~50 lines)
   - Page controls
   - Page size selector

### Existing Components (Already Extracted)
- ✅ EditItemModal
- ✅ QRCodeModal
- ✅ BulkUploadModal
- ✅ ItemPhotoGallery

### Components to Extract
- ⏳ CategoryAssignmentModal
- ⏳ PropagateModal

---

## Migration Strategy

### Phase 1: Backup & Setup ✅
- [x] Create all services
- [x] Create all hooks
- [x] Backup original ItemsClient

### Phase 2: Create Sub-Components (2-3 hours)
- [ ] Create ItemsHeader
- [ ] Create ItemsFilters
- [ ] Create ItemsCreateForm
- [ ] Create ItemsGrid
- [ ] Create ItemsList
- [ ] Create ItemsPagination

### Phase 3: Extract Remaining Modals (1 hour)
- [ ] Extract CategoryAssignmentModal
- [ ] Extract PropagateModal

### Phase 4: Refactor Main Component (1-2 hours)
- [ ] Replace ItemsClient with new orchestrator
- [ ] Wire up all hooks
- [ ] Connect sub-components
- [ ] Remove old code

### Phase 5: Testing (1-2 hours)
- [ ] Test data loading
- [ ] Test filtering
- [ ] Test CRUD operations
- [ ] Test all modals
- [ ] Test pagination
- [ ] Test view mode toggle

---

## Benefits After Refactor

### Before (Current)
- ❌ 1,586 lines
- ❌ 25+ useState calls
- ❌ 15+ responsibilities
- ❌ Impossible to test
- ❌ Hard to maintain
- ❌ Hydration issues

### After (Target)
- ✅ ~300 lines (main component)
- ✅ 6 focused hooks
- ✅ Single responsibility
- ✅ Fully testable
- ✅ Easy to maintain
- ✅ No hydration issues

### Metrics
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Main Component | 1,586 lines | ~300 lines | **81% reduction** |
| useState Calls | 25+ | 6 | **76% reduction** |
| Responsibilities | 15+ | 2-3 | **80% reduction** |
| Testability | 0% | 100% | **∞ improvement** |

---

## Next Steps

1. **Create sub-components** (ItemsHeader, ItemsFilters, etc.)
2. **Extract remaining modals** (Category, Propagate)
3. **Refactor main component** to use hooks and sub-components
4. **Test thoroughly**
5. **Deploy to staging**

---

## Notes

- All services and hooks follow the same pattern as OnboardingWizard refactor
- Each hook is focused and testable
- Services handle all API calls
- Component becomes pure UI orchestration
- No business logic in component
- Clean separation of concerns

---

## Estimated Total Time

- Services & Hooks: ✅ **Complete**
- Sub-components: **2-3 hours**
- Modal extraction: **1 hour**
- Main component: **1-2 hours**
- Testing: **1-2 hours**

**Total: 5-8 hours remaining**

---

## Success Criteria

- [ ] Main component < 400 lines
- [ ] All business logic in services
- [ ] All state management in hooks
- [ ] All UI in sub-components
- [ ] 100% feature parity
- [ ] No regressions
- [ ] Better performance
- [ ] Fully testable

---

*This refactor follows the proven pattern from OnboardingWizard and will transform ItemsClient from a maintenance nightmare into a maintainable, professional component.*
