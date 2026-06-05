# Square UI Integration - Quick Reference

**Quick visual guide for where Square appears in the platform**

---

## 🎯 Integration Points at a Glance

### 1. **Settings → Integrations** (Primary Hub)
```
/t/{tenantId}/settings/integrations

┌─────────────────────────────────────────────────────────┐
│ POS Integrations                                        │
│                                                         │
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ 🟦 Square POS       │  │ 🟢 Clover POS       │      │
│ │ ✅ Connected        │  │ ✅ Connected        │      │
│ │ Last: 5 min ago     │  │ Last: 10 min ago    │      │
│ │ [Manage] [Sync]     │  │ [Manage] [Sync]     │      │
│ └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

### 2. **Dashboard** (Status & Quick Actions)
```
/t/{tenantId}/dashboard

┌─────────────────────────────────────────────────────────┐
│ Dashboard                                               │
│                                                         │
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ 🟦 Square POS       │  │ Recent Syncs        │      │
│ │ ✅ Connected        │  │ ✅ Catalog (5m)     │      │
│ │ Last: 5 min ago     │  │ ✅ Inventory (15m)  │      │
│ │ [Sync] [Settings]   │  │ [View All]          │      │
│ └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

### 3. **Items Page** (Per-Item Status)
```
/t/{tenantId}/items

┌─────────────────────────────────────────────────────────┐
│ Items                    [Sync with Square ▼]           │
│                                                         │
│ Filters: [Square: Synced ▼] [Category ▼]               │
│                                                         │
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ Blue Widget         │  │ Red Gadget          │      │
│ │ $19.99              │  │ $24.99              │      │
│ │ 🟦 Synced ✓         │  │ ⏳ Pending sync     │      │
│ │ 2 hours ago         │  │                     │      │
│ └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

### 4. **Sidebar** (Quick Access)
```
All tenant pages

┌─────────────────┐
│ Dashboard       │
│ Items           │
│ Locations       │
│ Analytics       │
│                 │
│ INTEGRATIONS    │
│ 🟦 Square ✓     │  ← Click for quick actions
│ 🟢 Clover ✓     │
│                 │
│ Settings        │
└─────────────────┘
```

---

### 5. **Top Navigation** (Global Status)
```
All pages

┌─────────────────────────────────────────────────────────┐
│ [Logo] Tenant Name         🟦✓ 🔔 [User] ▼             │
└─────────────────────────────────────────────────────────┘
                              ↑
                    Square status indicator
                    Click for quick popup
```

---

### 6. **Tenant Switcher** (Multi-Location Status)
```
Top navigation dropdown

┌─────────────────────────────────┐
│ Your Locations                  │
│                                 │
│ ● Main Store                    │
│   🟦 Square  🟢 Clover          │
│                                 │
│ ● Downtown Branch               │
│   🟦 Square                     │
│                                 │
│ ● Westside Location             │
│   (No integrations)             │
│   [Connect POS →]               │
└─────────────────────────────────┘
```

---

## 🎨 Visual Design System

### Status Indicators

**Connected:**
```
🟦 ✓  Square POS
```

**Syncing:**
```
🟦 🔄  Syncing... (animated spinner)
```

**Error:**
```
🟦 ⚠️  Connection error
```

**Disconnected:**
```
🟦 ✗  Not connected
```

---

### Color Palette

```css
Square Blue:    #0066FF  ████
Success Green:  #10B981  ████
Warning Amber:  #F59E0B  ████
Error Red:      #EF4444  ████
Neutral Gray:   #6B7280  ████
```

---

### Button Styles

**Primary Action:**
```
┌─────────────────────┐
│ Connect with Square │  ← Blue background
└─────────────────────┘
```

**Secondary Action:**
```
┌─────────────────────┐
│ Sync Now            │  ← Blue outline
└─────────────────────┘
```

**Danger Action:**
```
┌─────────────────────┐
│ Disconnect          │  ← Red outline
└─────────────────────┘
```

---

## 📱 Mobile Views

### Dashboard (Mobile)
```
┌─────────────────────┐
│ 🟦 Square POS       │
│ ✅ Connected        │
│ Last: 5 min ago     │
│                     │
│ [Sync] [Settings]   │
└─────────────────────┘
```

### Items (Mobile)
```
┌─────────────────────┐
│ Blue Widget         │
│ $19.99              │
│ 🟦 Synced ✓         │
│ [Edit]              │
└─────────────────────┘
```

### Sidebar (Mobile)
```
☰ Menu

┌─────────────────────┐
│ Dashboard           │
│ Items               │
│                     │
│ INTEGRATIONS        │
│ 🟦 Square ✓         │
│ 🟢 Clover ✓         │
└─────────────────────┘
```

---

## 🔔 Notifications & Toasts

### Success
```
┌─────────────────────────────────┐
│ ✅ Square connected!            │
│ Syncing 42 items...             │
└─────────────────────────────────┘
```

### Error
```
┌─────────────────────────────────┐
│ ❌ Square sync failed           │
│ Check connection and try again  │
│ [View Details]                  │
└─────────────────────────────────┘
```

### Info
```
┌─────────────────────────────────┐
│ 🔄 Syncing with Square...       │
│ 42/150 items (28%)              │
└─────────────────────────────────┘
```

---

## 🎯 User Journey Map

### First-Time User
```
1. Dashboard → See "Connect Square" card
2. Click "Connect with Square"
3. OAuth flow → Authorize
4. Return → Success toast
5. Auto sync starts
6. Dashboard shows status
```

### Daily User
```
1. Items page → Make changes
2. Click "Sync with Square"
3. Progress shown
4. Success toast
5. Items updated
```

### Power User
```
1. Settings → Integrations → Square
2. Configure sync settings
3. View sync logs
4. Resolve conflicts
5. Monitor analytics
```

---

## 🚀 Quick Implementation Checklist

### Phase 1: Foundation
- [ ] Create SquareConnectionCard component
- [ ] Add to Settings → Integrations
- [ ] Implement OAuth flow
- [ ] Add sidebar status indicator
- [ ] Create dashboard widget

### Phase 2: Items Integration
- [ ] Add sync indicators to item cards
- [ ] Create sync status filter
- [ ] Add bulk sync actions
- [ ] Show sync progress banner

### Phase 3: Enhanced Experience
- [ ] Add global status indicator
- [ ] Enhance tenant switcher
- [ ] Create onboarding flow
- [ ] Add mobile views

### Phase 4: Advanced Features
- [ ] Build dedicated settings page
- [ ] Create sync logs page
- [ ] Implement conflict resolution
- [ ] Add analytics dashboard

### Phase 5: Polish
- [ ] Add loading states
- [ ] Implement error boundaries
- [ ] Add tooltips and help text
- [ ] User acceptance testing

---

## 📊 Component Hierarchy

```
App
├── Layout
│   ├── TopNav
│   │   ├── TenantSwitcher (Square status per location)
│   │   └── GlobalStatusIndicator (Square sync status)
│   └── Sidebar
│       └── IntegrationsSection (Square quick access)
│
├── Dashboard
│   ├── SquareStatusCard
│   ├── SquareSyncActivityWidget
│   └── SquareQuickActionsCard
│
├── Items
│   ├── ItemsHeader (Sync button)
│   ├── ItemsFilters (Square filter)
│   ├── ItemCard (Sync indicator)
│   └── SyncProgressBanner
│
└── Settings
    └── Integrations
        ├── SquareConnectionCard
        └── SquareSettingsPage
            ├── ConnectionStatus
            ├── SyncSettings
            ├── SyncHistory
            └── AdvancedSettings
```

---

## 🎓 Best Practices

### Do's ✅
- Show sync status prominently
- Provide clear error messages
- Use consistent Square branding
- Make actions easily discoverable
- Show progress for long operations
- Provide undo/rollback options

### Don'ts ❌
- Don't hide sync errors
- Don't auto-sync without permission
- Don't use technical jargon
- Don't overwhelm with options
- Don't block UI during sync
- Don't lose user's work

---

## 📚 Related Documentation

- **Full Plan:** `SQUARE_UI_INTEGRATION_PLAN.md`
- **Backend API:** `SQUARE_INTEGRATION_SUMMARY.md`
- **Component Specs:** `SQUARE_COMPONENT_LIBRARY.md` (TBD)
- **User Guide:** `SQUARE_USER_GUIDE.md` (TBD)

---

**Last Updated:** November 10, 2025  
**Status:** Planning Complete, Ready for Implementation
