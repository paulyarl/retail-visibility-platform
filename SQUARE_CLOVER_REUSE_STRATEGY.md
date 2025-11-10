# Square + Clover: Reuse Strategy

**Goal:** Build Square UI efficiently by identifying reusable patterns from Clover

---

## 🔍 **Pattern Analysis**

### **What's Identical (100% Reusable)**

#### 1. **Status Badge Pattern**
- Both need: Disconnected, Connected, Syncing, Error states
- Clover adds: Demo state (unique)
- **Strategy:** Create generic `POSStatusBadge` with optional demo state

#### 2. **Connection Flow**
- Both use OAuth 2.0
- Both need: Connect → Authorize → Callback
- **Strategy:** Generic OAuth handler, POS-specific endpoints

#### 3. **Dashboard Card Structure**
- Both show: Status, Stats, Last Sync, Actions
- **Strategy:** Generic `POSDashboardCard` with POS-specific branding

#### 4. **State Management Pattern**
- Both need: fetch status, connect, disconnect, sync
- Clover adds: enableDemo, disableDemo
- **Strategy:** Generic hook with optional demo methods

---

## 🎯 **Reuse vs. Duplicate Decision Matrix**

| Component | Reuse? | Reason |
|-----------|--------|--------|
| **StatusBadge** | ✅ Yes | 80% identical, demo is optional |
| **ConnectionCard** | ✅ Yes | Structure identical, brand colors differ |
| **DashboardCard** | ✅ Yes | Layout identical, content differs |
| **DemoModeToggle** | ❌ No | Clover-specific feature |
| **DemoModeBanner** | ❌ No | Clover-specific feature |
| **State Hook** | ✅ Yes | Core logic identical |
| **Navigation** | ✅ Yes | Already supports both |

---

## 📐 **Architecture Plan**

### **Layer 1: Generic POS Components**
```
components/pos/
├── POSStatusBadge.tsx          // Generic, supports all POS types
├── POSConnectionCard.tsx       // Generic layout, POS-specific content
├── POSDashboardCard.tsx        // Generic widget structure
└── types.ts                    // Shared types
```

### **Layer 2: POS-Specific Components**
```
components/clover/
├── CloverDemoModeToggle.tsx    // Clover-only
├── CloverDemoModeBanner.tsx    // Clover-only
└── index.ts

components/square/
├── SquareSpecificFeature.tsx   // If needed
└── index.ts
```

### **Layer 3: State Management**
```
hooks/
├── usePOSIntegration.ts        // Generic hook
├── useCloverIntegration.ts     // Wrapper with demo support
└── useSquareIntegration.ts     // Wrapper without demo
```

---

## 🚀 **Implementation Strategy**

### **Phase 1: Refactor Clover (Minimal)**
1. Extract generic logic to `usePOSIntegration`
2. Keep Clover-specific components as-is
3. Update Clover to use generic hook internally

### **Phase 2: Build Square (Efficient)**
1. Create `useSquareIntegration` (wraps generic hook)
2. Reuse generic components with Square branding
3. Only create Square-specific components if needed

### **Phase 3: Consolidate (Optional)**
1. Migrate Clover to use generic components
2. Remove duplicate code
3. Maintain backward compatibility

---

## 💡 **Key Insights**

### **What Makes Them Different:**
1. **Clover:** Demo mode (unique feature)
2. **Square:** No demo mode
3. **Colors:** Green vs Blue
4. **Branding:** Different logos/icons

### **What Makes Them Same:**
1. OAuth flow
2. Sync operations
3. Status states (except demo)
4. Dashboard layout
5. Settings structure
6. Error handling

---

## 🎨 **Brand Differentiation**

### **Clover**
- Color: `#00A862` (green)
- Icon: Package
- Unique: Demo mode (amber `#F59E0B`)

### **Square**
- Color: `#0066FF` (blue)
- Icon: Square shape
- Unique: None (standard OAuth only)

---

## 📝 **Implementation Plan**

### **Step 1: Create Generic Hook** ✅
```typescript
usePOSIntegration({
  posType: 'clover' | 'square',
  tenantId: string,
  supportsDemo: boolean
})
```

### **Step 2: Create Square Hook**
```typescript
useSquareIntegration(tenantId) {
  return usePOSIntegration({
    posType: 'square',
    tenantId,
    supportsDemo: false
  });
}
```

### **Step 3: Create Square Components**
- Copy Clover components
- Remove demo-specific code
- Change colors (green → blue)
- Update branding

### **Step 4: Test Both**
- Ensure Clover still works
- Verify Square works
- Check no regressions

---

## ⚠️ **Caution Points**

### **Don't Over-Abstract**
- Keep components simple
- Don't create complex generic components
- Duplicate is better than wrong abstraction

### **Maintain Clarity**
- Each POS should be understandable independently
- Generic code should be obviously generic
- Don't hide POS-specific logic

### **Test Thoroughly**
- Clover shouldn't break when adding Square
- Square should work independently
- Generic code should handle both

---

## 🎯 **Success Criteria**

### **Code Efficiency**
- < 50% code duplication
- Generic hook handles 80% of logic
- POS-specific code is minimal

### **Maintainability**
- Changes to one don't break the other
- Generic changes benefit both
- Clear separation of concerns

### **User Experience**
- Both feel native (not generic)
- Branding is distinct
- Features work as expected

---

## 📊 **Estimated Effort**

### **With Reuse:**
- Generic hook: 30 min
- Square components: 1 hour
- Testing: 30 min
- **Total: 2 hours**

### **Without Reuse:**
- Duplicate everything: 2 hours
- **Total: 2 hours**

**Verdict:** Reuse is worth it for maintainability, not speed.

---

## 🚀 **Let's Proceed**

**Approach:**
1. Create generic `usePOSIntegration` hook
2. Create `useSquareIntegration` wrapper
3. Copy Clover components → Square components
4. Remove demo code, change branding
5. Test both work independently

**This balances reuse with pragmatism.** ✅
