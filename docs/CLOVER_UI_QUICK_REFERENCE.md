# Clover UI Integration - Quick Reference

**Quick visual guide for where Clover appears in the platform**

---

## 🎯 Key Differentiator: Demo Mode

**Unique to Clover:** Test with 25 sample products before connecting real account

---

## Integration Points at a Glance

### 1. **Settings → Integrations** (Primary Hub)
```
/t/{tenantId}/settings/integrations

┌─────────────────────────────────────────────────────────┐
│ POS Integrations                                        │
│                                                         │
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ 🟦 Square POS       │  │ 🟢 Clover POS       │      │
│ │ ✅ Connected        │  │ 📦 Demo Mode        │      │
│ │ Last: 5 min ago     │  │ 25 sample products  │      │
│ │ [Manage] [Sync]     │  │ [Connect] [Manage]  │      │
│ └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

### 2. **Dashboard** (Demo Mode Banner)
```
/t/{tenantId}/dashboard

┌─────────────────────────────────────────────────────────┐
│ 📦 Demo Mode Active - Using 25 sample products          │
│ Ready to connect your real Clover account?              │
│ [Connect Clover] [Learn More]                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ 🟢 Clover POS       │  │ Recent Syncs        │      │
│ │ 📦 Demo Mode        │  │ 📦 Demo (5m)        │      │
│ │ 25 products         │  │ ✅ Catalog (15m)    │      │
│ │ [Connect] [Manage]  │  │ [View All]          │      │
│ └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

### 3. **Items Page** (Demo Item Badges)
```
/t/{tenantId}/items

┌─────────────────────────────────────────────────────────┐
│ 📦 Demo Mode - Showing 25 sample products               │
│ These are test items. Connect Clover for real data.    │
│ [Connect Clover] [Disable Demo]                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Items                    [Sync with Clover ▼]           │
│                                                         │
│ Filters: [Clover: Demo Items ▼] [Category ▼]           │
│                                                         │
│ ┌─────────────────────┐  ┌─────────────────────┐      │
│ │ Blue Widget         │  │ Red Gadget          │      │
│ │ $19.99              │  │ $24.99              │      │
│ │ 📦 Demo Item        │  │ 🟢 Synced ✓         │      │
│ │ Sample for testing  │  │ 2 hours ago         │      │
│ └─────────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

### 4. **Sidebar** (Demo/Connected Status)
```
All tenant pages

┌─────────────────┐
│ Dashboard       │
│ Items           │
│ Locations       │
│ Analytics       │
│                 │
│ INTEGRATIONS    │
│ 🟦 Square ✓     │
│ 🟢 Clover 📦    │  ← Demo mode indicator
│                 │
│ Settings        │
└─────────────────┘

Hover on "Clover":
┌─────────────────────────────────┐
│ Clover POS                      │
│ 📦 Demo Mode Active             │
│ 25 sample products              │
│ [Connect Real] [Manage]         │
└─────────────────────────────────┘
```

---

### 5. **Top Navigation** (Global Status)
```
All pages

┌─────────────────────────────────────────────────────────┐
│ [Logo] Tenant Name         🟢📦 🔔 [User] ▼             │
└─────────────────────────────────────────────────────────┘
                              ↑
                    Clover demo mode indicator
```

---

### 6. **Tenant Switcher** (Demo Status Per Location)
```
Top navigation dropdown

┌─────────────────────────────────┐
│ Your Locations                  │
│                                 │
│ ● Main Store                    │
│   🟦 Square  🟢 Clover          │
│                                 │
│ ● Downtown Branch               │
│   🟢 Clover 📦 (Demo)           │
│                                 │
│ ● Westside Location             │
│   (No integrations)             │
│   [Connect POS →]               │
└─────────────────────────────────┘
```

---

### 7. **Onboarding** (Demo Option)
```
Welcome screen

┌─────────────────────────────────┐
│ Welcome to Retail Visibility!   │
│                                 │
│ Let's connect your POS system   │
│                                 │
│ [🟦 Connect Square]             │
│ [🟢 Connect Clover]             │
│ [📦 Try Clover Demo]  ← Unique! │
│ [Skip for now]                  │
└─────────────────────────────────┘
```

---

## 🎨 Visual Design System

### Status Indicators

**Demo Mode:**
```
🟢 📦  Clover POS (Demo)
```

**Connected:**
```
🟢 ✓  Clover POS
```

**Syncing:**
```
🟢 🔄  Syncing... (animated)
```

**Error:**
```
🟢 ⚠️  Connection error
```

**Disconnected:**
```
🟢 ✗  Not connected
```

---

### Color Palette

```css
Clover Green:   #00A862  ████
Demo Amber:     #F59E0B  ████
Success Green:  #10B981  ████
Warning Amber:  #F59E0B  ████
Error Red:      #EF4444  ████
Neutral Gray:   #6B7280  ████
```

---

## 📦 Unique Features: Demo Mode

### Demo Mode Dashboard
```
/t/{tenantId}/integrations/clover/demo

┌─────────────────────────────────────┐
│ Demo Mode Overview                  │
│                                     │
│ Status: 📦 Active                   │
│ Products: 25 sample items           │
│ Enabled: Nov 1, 2025                │
│                                     │
│ [View Products] [Connect Real]      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Demo Products (25)                  │
│                                     │
│ 📦 Blue Widget - $19.99             │
│ 📦 Red Gadget - $24.99              │
│ 📦 Green Tool - $14.99              │
│ ...                                 │
│                                     │
│ [Refresh] [Customize] [Clear]       │
└─────────────────────────────────────┘
```

---

### Migration Wizard
```
/t/{tenantId}/integrations/clover/migrate

Step 1: Preparation
┌─────────────────────────────────────┐
│ Migrate to Real Clover Data         │
│                                     │
│ Before we begin:                    │
│ ☑ You have a Clover account         │
│ ☑ You have merchant credentials     │
│ ☑ You understand demo data will     │
│   be archived                       │
│                                     │
│ [Continue] [Cancel]                 │
└─────────────────────────────────────┘

Step 2: Data Handling
┌─────────────────────────────────────┐
│ What should we do with demo items?  │
│                                     │
│ ○ Keep demo items                   │
│ ● Archive demo items (Recommended)  │
│ ○ Delete demo items                 │
│                                     │
│ [Continue] [Back]                   │
└─────────────────────────────────────┘

Step 3: Connect
┌─────────────────────────────────────┐
│ Connect Your Clover Account         │
│                                     │
│ [Connect with Clover]               │
│                                     │
│ [Back] [Cancel]                     │
└─────────────────────────────────────┘

Step 4: Progress
┌─────────────────────────────────────┐
│ Migrating to Production...          │
│                                     │
│ ✅ Connected to Clover              │
│ ✅ Archived demo items              │
│ 🔄 Syncing real products... 42/150  │
└─────────────────────────────────────┘

Step 5: Success
┌─────────────────────────────────────┐
│ ✅ Migration Complete!              │
│                                     │
│ 150 products imported               │
│ 25 demo items archived              │
│                                     │
│ [View Dashboard] [View Items]       │
└─────────────────────────────────────┘
```

---

## 🎯 User Journey Map

### Demo-First User
```
1. Dashboard → See "Try Clover Demo"
2. Click "Enable Demo Mode"
3. Success toast → 25 products loaded
4. Explore features with demo data
5. Ready to connect → Click "Connect Real Account"
6. Migration wizard → Choose data handling
7. OAuth flow → Authorize
8. Migration progress → Real data synced
9. Demo items archived
10. Dashboard shows production status
```

### Direct Connection User
```
1. Dashboard → See "Connect Clover"
2. Click "Connect with Clover"
3. OAuth flow → Authorize
4. Return → Success toast
5. Auto sync starts
6. Dashboard shows status
```

---

## 🚀 Quick Implementation Checklist

### Phase 1: Foundation + Demo
- [ ] Create CloverConnectionCard component
- [ ] Add to Settings → Integrations
- [ ] Implement demo mode toggle
- [ ] Implement OAuth flow
- [ ] Add sidebar status indicator
- [ ] Create dashboard widget
- [ ] Add demo mode banner

### Phase 2: Demo Experience
- [ ] Add demo item badges to items
- [ ] Create demo mode filter
- [ ] Build demo dashboard
- [ ] Add demo product management
- [ ] Create demo mode banner

### Phase 3: Items Integration
- [ ] Add sync indicators to item cards
- [ ] Create sync status filter
- [ ] Add bulk sync actions
- [ ] Show sync progress banner
- [ ] Distinguish demo vs real items

### Phase 4: Migration & Advanced
- [ ] Build migration wizard
- [ ] Create dedicated settings page
- [ ] Build sync logs page
- [ ] Implement conflict resolution
- [ ] Add analytics dashboard

### Phase 5: Polish
- [ ] Add loading states
- [ ] Implement error boundaries
- [ ] Add tooltips and help text
- [ ] User acceptance testing
- [ ] Demo mode documentation

---

## 📊 Component Hierarchy

```
App
├── Layout
│   ├── TopNav
│   │   ├── TenantSwitcher (Clover demo/connected per location)
│   │   └── GlobalStatusIndicator (Clover demo/sync status)
│   └── Sidebar
│       └── IntegrationsSection (Clover demo/connected)
│
├── Dashboard
│   ├── CloverDemoModeBanner (if demo active)
│   ├── CloverStatusCard (demo or connected)
│   ├── CloverSyncActivityWidget
│   └── CloverQuickActionsCard
│
├── Items
│   ├── CloverDemoModeBanner (if demo active)
│   ├── ItemsHeader (Sync button)
│   ├── ItemsFilters (Clover + demo filter)
│   ├── ItemCard (Demo badge or sync indicator)
│   └── SyncProgressBanner
│
├── Settings
│   └── Integrations
│       ├── CloverConnectionCard (with demo toggle)
│       ├── CloverDemoDashboard (demo management)
│       ├── CloverMigrationWizard (demo → production)
│       └── CloverSettingsPage
│           ├── ModeSelection (demo/production)
│           ├── ConnectionStatus
│           ├── SyncSettings
│           ├── SyncHistory
│           └── AdvancedSettings
```

---

## 🎓 Best Practices

### Do's ✅
- Encourage demo mode for new users
- Make migration wizard clear and easy
- Show demo vs real item distinction
- Provide rollback options
- Archive demo data (don't delete)
- Show demo benefits prominently

### Don'ts ❌
- Don't force demo mode
- Don't hide migration option
- Don't mix demo and real data without clear labels
- Don't lose demo data permanently
- Don't make migration scary
- Don't overwhelm with options

---

## 📚 Related Documentation

- **Full Plan:** `CLOVER_UI_INTEGRATION_PLAN.md`
- **Backend API:** `CLOVER_POS_INTEGRATION.md`
- **Setup Guide:** `CLOVER_SETUP_CONFIRMATION.md`
- **Component Specs:** `CLOVER_COMPONENT_LIBRARY.md` (TBD)
- **User Guide:** `CLOVER_USER_GUIDE.md` (TBD)
- **Migration Guide:** `CLOVER_MIGRATION_GUIDE.md` (TBD)

---

**Last Updated:** November 10, 2025  
**Status:** Planning Complete, Ready for Implementation  
**Unique Feature:** Demo Mode with 25 sample products + Migration Wizard
