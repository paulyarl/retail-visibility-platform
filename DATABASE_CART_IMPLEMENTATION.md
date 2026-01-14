# Database-Persisted Shopping Carts Implementation

## 🎯 Overview

Extend the current localStorage-based cart system to support database persistence, enabling:
- **Cross-device shopping** - Same cart on phone, tablet, desktop
- **Persistent carts** - Carts saved for days/weeks
- **Guest-to-user migration** - Transfer guest cart when user logs in
- **Abandoned cart recovery** - Marketing opportunities
- **Better analytics** - Track shopping behavior

---

## 🏗️ Architecture

### **Hybrid Approach: localStorage + Database**

```
┌─────────────────────────────────────────────┐
│  Guest User (Not Logged In)                │
│  ├─ Cart stored in localStorage             │
│  ├─ Session ID tracks guest cart            │
│  └─ On login: Migrate to database           │
└─────────────────────────────────────────────┘
                    ↓ Login
┌─────────────────────────────────────────────┐
│  Authenticated User                         │
│  ├─ Cart synced to database                 │
│  ├─ localStorage as cache                   │
│  ├─ Auto-sync on changes                    │
│  └─ Load from DB on page load               │
└─────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### **shopping_carts Table**
```sql
- id (PK)
- user_id (FK to users, nullable for guests)
- tenant_id (FK to tenants)
- session_id (for guest tracking)
- tenant_name
- tenant_logo
- status (active, abandoned, converted, merged)
- created_at, updated_at, last_activity_at
- expires_at (for cleanup)
- metadata (JSONB)
```

**Key Features:**
- One active cart per user per tenant
- Guest carts tracked by session_id
- Automatic timestamp updates via trigger
- Status tracking for analytics

### **shopping_cart_items Table**
```sql
- id (PK)
- cart_id (FK to shopping_carts)
- inventory_item_id (FK to inventory_items, nullable)
- product_id, product_name, product_sku
- product_image_url
- unit_price_cents
- quantity
- added_at, updated_at
- metadata (JSONB)
```

**Key Features:**
- Product snapshot (handles deleted products)
- Unique constraint: one item per product per cart
- Auto-updates parent cart timestamp

---

## 🔄 Data Flow

### **Guest User Flow:**
```
1. Add to Cart
   ↓
2. Save to localStorage
   ↓
3. Generate session_id (if not exists)
   ↓
4. Optionally sync to DB with session_id
   (for abandoned cart tracking)
```

### **Authenticated User Flow:**
```
1. Add to Cart
   ↓
2. Save to database
   ↓
3. Update localStorage cache
   ↓
4. Broadcast to other tabs/devices
```

### **Login Migration Flow:**
```
1. User logs in
   ↓
2. Load guest cart from localStorage
   ↓
3. Load user carts from database
   ↓
4. Merge strategy:
   - If tenant cart exists: Merge items
   - If new tenant: Create cart
   ↓
5. Mark guest cart as 'merged'
   ↓
6. Clear localStorage guest data
```

---

## 🛠️ Implementation Plan

### **Phase 1: Database Setup** ✅
- [x] Create migration SQL
- [ ] Run migration in database
- [ ] Verify tables created
- [ ] Test helper functions

### **Phase 2: API Endpoints**
```typescript
// Cart Management
GET    /api/carts              // Get all user carts
GET    /api/carts/:cartId      // Get specific cart with items
POST   /api/carts              // Create new cart
PUT    /api/carts/:cartId      // Update cart metadata
DELETE /api/carts/:cartId      // Delete cart

// Cart Items
POST   /api/carts/:cartId/items           // Add item to cart
PUT    /api/carts/:cartId/items/:itemId   // Update item quantity
DELETE /api/carts/:cartId/items/:itemId   // Remove item

// Special Operations
POST   /api/carts/migrate      // Migrate guest cart to user
POST   /api/carts/merge        // Merge two carts
GET    /api/carts/session/:sessionId  // Get guest cart
```

### **Phase 3: Cart Context Updates**
```typescript
// Enhanced CartContext
interface CartContextType {
  // Existing
  carts: TenantCart[];
  addItem: (item, tenant) => void;
  
  // New
  isAuthenticated: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  
  // Methods
  syncToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
  migrateGuestCart: () => Promise<void>;
}
```

**Sync Strategy:**
- **Authenticated users:** Auto-sync on every change
- **Guest users:** localStorage only (optional DB sync for analytics)
- **On login:** Migrate guest cart to user account
- **On page load:** Load from DB if authenticated

### **Phase 4: Migration Logic**
```typescript
async function migrateGuestCart(userId: string) {
  // 1. Get guest carts from localStorage
  const guestCarts = getLocalStorageCarts();
  
  // 2. Get user carts from database
  const userCarts = await fetchUserCarts(userId);
  
  // 3. Merge strategy
  for (const guestCart of guestCarts) {
    const existingCart = userCarts.find(c => c.tenantId === guestCart.tenantId);
    
    if (existingCart) {
      // Merge items
      await mergeCartItems(existingCart.id, guestCart.items);
    } else {
      // Create new cart
      await createUserCart(userId, guestCart);
    }
  }
  
  // 4. Clear localStorage
  clearLocalStorageGuestCarts();
}
```

---

## 💡 Key Features

### **1. Cross-Device Sync**
- User logs in on phone → sees cart
- Adds items on phone
- Opens laptop → same cart appears
- Real-time sync via polling or WebSocket

### **2. Abandoned Cart Recovery**
- Track carts inactive for 24+ hours
- Email reminders with cart contents
- Special offers to encourage completion
- Analytics on abandonment reasons

### **3. Cart Expiration**
- Active carts: No expiration
- Abandoned carts: Marked after 30 days
- Cleanup: Delete after 90 days
- Configurable per tenant

### **4. Inventory Integration**
- Check stock availability on load
- Warn if item out of stock
- Auto-remove unavailable items
- Price update notifications

---

## 🔐 Security Considerations

### **Guest Carts**
- Session ID stored in localStorage
- No sensitive data in guest carts
- Rate limiting on cart operations
- CSRF protection

### **User Carts**
- Require authentication for DB access
- User can only access their own carts
- Tenant isolation enforced
- Audit logging for cart operations

### **Data Privacy**
- Cart data belongs to user
- User can delete all carts
- GDPR compliance (right to deletion)
- No sharing cart data between users

---

## 📈 Analytics Opportunities

### **Shopping Behavior**
- Average cart size per tenant
- Time to checkout
- Abandonment rate by tenant
- Popular product combinations

### **Conversion Tracking**
- Guest vs. authenticated conversion
- Cart age vs. conversion rate
- Impact of cart reminders
- Multi-session shopping patterns

---

## 🚀 Rollout Strategy

### **Phase 1: Database Setup** (Current)
- Run migration
- Test with sample data
- Verify constraints and indexes

### **Phase 2: API Development** (Next)
- Build cart CRUD endpoints
- Add authentication middleware
- Test with Postman/Thunder Client

### **Phase 3: Frontend Integration**
- Update CartContext
- Add sync logic
- Test guest-to-user migration

### **Phase 4: Testing**
- Unit tests for cart operations
- Integration tests for sync
- E2E tests for full flow

### **Phase 5: Production**
- Feature flag rollout
- Monitor performance
- Gather user feedback

---

## 🎯 Benefits Summary

### **For Users:**
✅ Shop across devices seamlessly
✅ Never lose cart contents
✅ Resume shopping anytime
✅ Faster checkout (saved carts)

### **For Platform:**
✅ Better user engagement
✅ Higher conversion rates
✅ Abandoned cart recovery
✅ Valuable shopping analytics

### **For Merchants:**
✅ Understand customer behavior
✅ Targeted marketing opportunities
✅ Reduced cart abandonment
✅ Increased sales

---

## 📋 Next Steps

1. **Run the migration SQL** in your database
2. **Create API endpoints** for cart operations
3. **Update CartContext** to support database sync
4. **Test migration flow** guest → authenticated
5. **Deploy and monitor**

---

**Status:** Migration SQL ready. Awaiting database execution and API implementation.
