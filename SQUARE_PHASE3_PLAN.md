# Square POS Integration - Phase 3: Sync Service

**Status:** 🚧 IN PROGRESS  
**Started:** November 10, 2025  
**Goal:** Bidirectional product and inventory sync between Square and Platform

---

## 🎯 **Phase 3 Objectives**

### **Core Functionality:**
1. ✅ Fetch products from Square Catalog API
2. ✅ Push products to Square Catalog API
3. ✅ Sync inventory levels (bidirectional)
4. ✅ Batch operations for efficiency
5. ✅ Conflict resolution logic
6. ✅ Error handling and retry logic

### **Architecture:**
- Sync Service - Orchestrates all sync operations
- Catalog Sync - Product data synchronization
- Inventory Sync - Stock level synchronization
- Conflict Resolver - Handles data conflicts
- Batch Processor - Efficient bulk operations

---

## 📋 **Implementation Checklist**

### **1. Sync Service Core (`square-sync.service.ts`)**
- [ ] Service class structure
- [ ] Sync orchestration logic
- [ ] Error handling framework
- [ ] Retry mechanism
- [ ] Progress tracking

### **2. Catalog Sync (`catalog-sync.ts`)**
- [ ] Fetch products from Square
- [ ] Map Square products to Platform format
- [ ] Push products to Square
- [ ] Map Platform products to Square format
- [ ] Handle product variations
- [ ] Image synchronization

### **3. Inventory Sync (`inventory-sync.ts`)**
- [ ] Fetch inventory from Square
- [ ] Update Platform inventory
- [ ] Push inventory to Square
- [ ] Handle location-specific inventory
- [ ] Track inventory changes

### **4. Conflict Resolution (`conflict-resolver.ts`)**
- [ ] Timestamp-based resolution
- [ ] Last-write-wins strategy
- [ ] Conflict detection
- [ ] Manual resolution queue
- [ ] Conflict logging

### **5. Batch Operations (`batch-processor.ts`)**
- [ ] Batch size optimization
- [ ] Rate limit handling
- [ ] Progress tracking
- [ ] Partial failure handling
- [ ] Batch retry logic

### **6. API Routes (Update `square.routes.ts`)**
- [ ] `POST /square/integrations/:tenantId/sync/products`
- [ ] `POST /square/integrations/:tenantId/sync/inventory`
- [ ] `POST /square/integrations/:tenantId/sync/full`
- [ ] `GET /square/integrations/:tenantId/sync/status`

---

## 🏗️ **Architecture Design**

### **Sync Flow:**
```
User/Webhook Trigger
    ↓
Sync Service (Orchestrator)
    ↓
├── Catalog Sync
│   ├── Fetch from Square
│   ├── Transform data
│   ├── Detect conflicts
│   ├── Resolve conflicts
│   └── Update Platform
│
├── Inventory Sync
│   ├── Fetch from Square
│   ├── Compare with Platform
│   ├── Resolve conflicts
│   └── Update Platform
│
└── Batch Processor
    ├── Queue operations
    ├── Execute in batches
    ├── Handle rate limits
    └── Log results
```

### **Data Flow:**

**Square → Platform (Import):**
1. Fetch catalog objects from Square
2. Transform to Platform format
3. Check for existing products
4. Resolve conflicts
5. Create/update in Platform
6. Log sync results

**Platform → Square (Export):**
1. Fetch products from Platform
2. Transform to Square format
3. Check for existing items
4. Resolve conflicts
5. Create/update in Square
6. Log sync results

---

## 📊 **Data Mapping**

### **Product Mapping:**
```typescript
Square Catalog Object → Platform Product
├── id → squareCatalogObjectId
├── item_data.name → name
├── item_data.description → description
├── item_data.variations[0].item_variation_data.price_money.amount → price
├── item_data.variations[0].id → squareItemVariationId
└── image_ids → images

Platform Product → Square Catalog Object
├── name → item_data.name
├── description → item_data.description
├── price → item_data.variations[0].item_variation_data.price_money.amount
├── sku → item_data.variations[0].item_variation_data.sku
└── images → image_ids
```

### **Inventory Mapping:**
```typescript
Square Inventory Count → Platform Inventory
├── catalog_object_id → squareCatalogObjectId
├── quantity → quantity
├── location_id → locationId
└── calculated_at → lastSyncedAt

Platform Inventory → Square Inventory Count
├── quantity → quantity
├── squareCatalogObjectId → catalog_object_id
├── locationId → location_id
└── updatedAt → occurred_at
```

---

## 🔧 **Technical Specifications**

### **Square API Endpoints:**
- `GET /v2/catalog/list` - List catalog objects
- `POST /v2/catalog/batch-upsert` - Batch create/update
- `GET /v2/inventory/counts` - Get inventory counts
- `POST /v2/inventory/changes/batch-create` - Batch inventory updates

### **Rate Limits:**
- Catalog API: 100 requests/minute
- Inventory API: 100 requests/minute
- Batch size: 1000 objects per request

### **Conflict Resolution Rules:**
1. **Timestamp-based:** Most recent update wins
2. **Source priority:** Square > Platform (for POS data)
3. **Manual review:** Price changes > $10 difference
4. **Auto-resolve:** Description, images (always sync)

### **Error Handling:**
- **Retry logic:** 3 attempts with exponential backoff
- **Partial failures:** Continue with remaining items
- **Error logging:** Detailed error messages in sync logs
- **User notification:** Alert on critical failures

---

## 🧪 **Testing Strategy**

### **Unit Tests:**
- [ ] Catalog sync transformations
- [ ] Inventory sync calculations
- [ ] Conflict resolution logic
- [ ] Batch processing
- [ ] Error handling

### **Integration Tests:**
- [ ] Full sync flow (Square → Platform)
- [ ] Full sync flow (Platform → Square)
- [ ] Conflict scenarios
- [ ] Rate limit handling
- [ ] Partial failure recovery

### **Manual Testing:**
- [ ] Sync 10 products from Square
- [ ] Sync 10 products to Square
- [ ] Update inventory in Square
- [ ] Update inventory in Platform
- [ ] Test conflict resolution
- [ ] Test batch operations

---

## 📁 **Files to Create**

```
Backend (API):
├── src/services/square/
│   ├── square-sync.service.ts (NEW)
│   ├── catalog-sync.ts (NEW)
│   ├── inventory-sync.ts (NEW)
│   ├── conflict-resolver.ts (NEW)
│   └── batch-processor.ts (NEW)
└── src/square/
    └── square.routes.ts (UPDATE)

Tests:
└── src/square/
    └── test-sync-service.ts (NEW)
```

---

## 🎯 **Success Criteria**

**Phase 3 is complete when:**
- ✅ Products sync from Square to Platform
- ✅ Products sync from Platform to Square
- ✅ Inventory syncs bidirectionally
- ✅ Conflicts are detected and resolved
- ✅ Batch operations work efficiently
- ✅ Error handling is robust
- ✅ Sync logs are detailed
- ✅ API routes are functional
- ✅ Tests pass

---

## 📊 **Estimated Timeline**

**Day 1:** Sync Service Core + Catalog Sync (4-6 hours)
**Day 2:** Inventory Sync + Conflict Resolution (4-6 hours)
**Day 3:** Batch Processing + Testing (4-6 hours)

**Total:** 2-3 days

---

## 🚀 **Let's Start!**

**First Step:** Build the Sync Service Core
- Create service class
- Define sync methods
- Set up error handling
- Implement progress tracking

**Ready to build?** 🎯
