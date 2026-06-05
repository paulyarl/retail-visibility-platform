# Square POS Integration - UI/UX Implementation Plan

**Version:** 1.0  
**Date:** November 10, 2025  
**Status:** Planning Phase  
**Backend Status:** ✅ Complete (OAuth + Sync Services)

---

## Overview

### Objective
Seamlessly integrate Square POS presence throughout the platform UI, making it discoverable, accessible, and intuitive for users to connect and manage their Square integration.

### Integration Points Summary
1. **Settings → Integrations** - Primary setup hub
2. **Dashboard** - Status widgets and quick actions
3. **Items Page** - Per-item sync indicators
4. **Sidebar** - Quick access and status
5. **Tenant Switcher** - Integration status per location
6. **Onboarding** - First-time setup wizard
7. **Global Status** - Always-visible sync indicator

---

## Design Principles

1. **Progressive Disclosure** - Show basic info first, details on demand
2. **Contextual Awareness** - Show Square status where it matters
3. **Visual Consistency** - Use Square brand colors (blue: #0066FF)
4. **Clear Status Communication** - Connected, Syncing, Error states
5. **Parallel with Clover** - Mirror Clover integration patterns

---

## Priority 1: Core Integration Points

### 1. Settings → Integrations Page
**Location:** `/t/{tenantId}/settings/integrations`

**Components:**
- Square connection card with OAuth button
- Connection status display (Connected/Disconnected)
- Last sync timestamp
- Manual sync trigger button
- Disconnect/reconnect options
- Recent sync activity log (last 5 syncs)
- Error messages with troubleshooting links

**Features:**
- One-click OAuth connection
- Visual connection health indicator
- Sync frequency configuration (15min/30min/1hr/manual)
- Sync direction settings (bidirectional/from Square/to Square)

---

### 2. Dashboard Widgets

**A. Integration Status Card**
```
┌─────────────────────────────────────┐
│ 🟦 Square POS                       │
│ ✅ Connected                        │
│ Last sync: 5 minutes ago            │
│ [Sync Now] [Settings]               │
└─────────────────────────────────────┘
```

**B. Recent Sync Activity**
```
┌─────────────────────────────────────┐
│ Recent Square Syncs                 │
│ ✅ Catalog - 42 items (5 min ago)   │
│ ✅ Inventory - 156 items (15 min)   │
│ [View All Logs]                     │
└─────────────────────────────────────┘
```

**C. Quick Actions**
- Sync from Square
- Push to Square
- Manage Integration
- View Sync Logs

---

### 3. Items Page Integration

**Features:**
- **Global sync banner** (when syncing): "🔄 Syncing with Square... 42/150 items"
- **Item-level indicators**: "🟦 Synced with Square ✓"
- **Sync status filter**: All | Synced | Pending | Failed | Not synced
- **Bulk actions**: Sync selected items to Square
- **Item detail sync info**: Square ID, last synced, sync history

**Item Card Enhancement:**
```
┌─────────────────────────────────────┐
│ Product Name                        │
│ $19.99                              │
│ 🟦 Synced with Square ✓             │
│ Last: 2 hours ago                   │
└─────────────────────────────────────┘
```

---

### 4. Sidebar Navigation

**Implementation:**
```
INTEGRATIONS
🟦 Square ✓     ← Shows connection status
🟢 Clover ✓
```

**Hover behavior:**
```
┌─────────────────────────────────┐
│ Square POS                      │
│ ✅ Connected                    │
│ Last sync: 5 min ago            │
│ [Manage] [Sync Now]             │
└─────────────────────────────────┘
```

**Disconnected state:**
```
🟦 Square
   Connect →    ← Call to action
```

---

## Priority 2: Enhanced Experience

### 5. Tenant Switcher Enhancement

Show integration status per location:
```
┌─────────────────────────────────────┐
│ ● Main Store                        │
│   🟦 Square  🟢 Clover              │
│ ● Downtown Branch                   │
│   🟦 Square                         │
│ ● Westside Location                 │
│   (No integrations) [Connect →]     │
└─────────────────────────────────────┘
```

---

### 6. Onboarding Flow

**Step 1:** Welcome - Choose POS system
**Step 2:** Square connection benefits
**Step 3:** OAuth flow
**Step 4:** Success + initial sync

---

### 7. Global Status Indicator

**Location:** Top navigation bar

**States:**
- 🟦 ✓ Idle (connected)
- 🟦 🔄 Syncing (animated)
- 🟦 ⚠️ Error
- 🟦 ✗ Disconnected

**Click behavior:** Shows quick status popup with actions

---

### 8. Dedicated Square Settings Page

**Location:** `/t/{tenantId}/settings/integrations/square`

**Sections:**
1. **Connection Status** - Merchant info, connected date
2. **Sync Settings** - Frequency, direction, auto-resolve conflicts
3. **Sync History** - Recent syncs with status
4. **Advanced Settings** - Conflict resolution strategy, what to sync
5. **Troubleshooting** - Test connection, force sync, clear cache

---

## Priority 3: Advanced Features

### 9. Sync Logs Page
**Location:** `/t/{tenantId}/integrations/square/logs`

- Filterable log table (type, status, date range)
- Detailed log view with errors
- Retry failed syncs
- Export logs

---

### 10. Conflict Resolution UI
**Location:** `/t/{tenantId}/integrations/square/conflicts`

- List of pending conflicts
- Side-by-side comparison (Square vs RVP)
- Resolution options (Use Square/Use RVP/Custom)
- Bulk resolution

---

### 11. Analytics Dashboard

**Metrics:**
- Total syncs (7 days)
- Success rate
- Average duration
- Items synced
- Sync timeline chart

---

## Component Architecture

### Reusable Components

1. **SquareConnectionCard** - Connection status and actions
2. **SquareStatusBadge** - Visual status indicator
3. **SquareSyncButton** - Trigger sync with loading state
4. **SquareSyncIndicator** - Item-level sync status
5. **SquareSyncProgress** - Real-time sync progress
6. **SquareSettingsPanel** - Configuration form
7. **SquareSyncLogTable** - Log display with filters
8. **SquareConflictResolver** - Conflict resolution UI

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Create base components
- Add Square section to Settings → Integrations
- Implement OAuth connection flow
- Add connection status to sidebar
- Create basic dashboard widget

**Deliverable:** Users can connect Square and see status

---

### Phase 2: Items Integration (Week 2)
- Add sync indicators to item cards
- Create sync status filter
- Add bulk sync actions
- Implement item detail sync info
- Add sync progress banner

**Deliverable:** Items show Square sync status

---

### Phase 3: Enhanced Dashboard (Week 3)
- Create sync activity widget
- Add quick actions card
- Implement global status indicator
- Add sync performance metrics
- Create mobile-responsive views

**Deliverable:** Rich dashboard experience

---

### Phase 4: Advanced Features (Week 4)
- Build dedicated Square settings page
- Create sync logs page
- Implement conflict resolution UI
- Add analytics dashboard
- Create troubleshooting tools

**Deliverable:** Power user features

---

### Phase 5: Polish & Optimization (Week 5)
- Add loading states and skeletons
- Implement error boundaries
- Add success/error toasts
- Optimize performance
- Add comprehensive tooltips
- Create help documentation
- User acceptance testing

**Deliverable:** Production-ready experience

---

## Technical Specifications

### API Endpoints Required

```typescript
// Connection
GET  /api/square/status/:tenantId
POST /api/square/connect
POST /api/square/disconnect

// Sync
POST /api/square/sync/catalog
POST /api/square/sync/inventory
POST /api/square/sync/full
GET  /api/square/sync/status/:syncId

// Logs
GET  /api/square/logs/:tenantId
GET  /api/square/logs/:logId

// Conflicts
GET  /api/square/conflicts/:tenantId
POST /api/square/conflicts/:conflictId/resolve

// Settings
GET  /api/square/settings/:tenantId
PUT  /api/square/settings/:tenantId
```

---

### State Management

```typescript
// Zustand store
interface SquareStore {
  // Connection
  isConnected: boolean;
  merchantInfo: MerchantInfo | null;
  lastSync: Date | null;
  
  // Sync
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  
  // Settings
  settings: SquareSettings;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: (type: SyncType) => Promise<void>;
  updateSettings: (settings: Partial<SquareSettings>) => Promise<void>;
}
```

---

### Color Palette

```css
/* Square Brand */
--square-blue: #0066FF;
--square-blue-light: #3385FF;
--square-blue-dark: #0052CC;
--square-blue-bg: #E6F0FF;

/* Status Colors */
--status-connected: #10B981;  /* Green */
--status-syncing: #3B82F6;    /* Blue */
--status-error: #EF4444;      /* Red */
--status-warning: #F59E0B;    /* Amber */
--status-idle: #6B7280;       /* Gray */
```

---

## User Flows

### Flow 1: First-Time Connection
1. User sees "Connect Square" card on dashboard
2. Clicks "Connect with Square"
3. Redirected to Square OAuth
4. Authorizes RVP access
5. Redirected back with success toast
6. Initial sync starts automatically
7. Progress shown in real-time
8. Completion toast: "42 items synced"

---

### Flow 2: Manual Sync
1. User clicks "Sync with Square" button
2. Modal: Choose sync direction
3. Confirms sync
4. Progress banner appears
5. Items update in real-time
6. Success toast with count

---

### Flow 3: Conflict Resolution
1. Sync detects conflict
2. Notification: "2 conflicts need review"
3. User navigates to Conflicts page
4. Reviews and resolves each conflict
5. Confirmation toast
6. Items updated

---

## Testing Strategy

### Unit Tests
- Component rendering
- State management
- API integration
- Error handling

### Integration Tests
- OAuth flow end-to-end
- Sync operations
- Conflict resolution
- Settings updates

### E2E Tests
- Complete connection flow
- Manual sync from Items page
- Bulk sync operations
- Disconnect and reconnect

### User Acceptance Testing
- First-time user onboarding
- Daily sync operations
- Error recovery
- Mobile experience

---

## Success Metrics

- ✅ Users discover Square integration within 30 seconds
- ✅ Connection flow completes in < 2 minutes
- ✅ Sync status visible at all times
- ✅ Error states are clear and actionable
- ✅ 90%+ successful connection rate
- ✅ < 5% support tickets related to Square integration

---

## Documentation Requirements

1. **User Guide** - How to connect and use Square integration
2. **Admin Guide** - Configuration and troubleshooting
3. **Developer Guide** - Component API and customization
4. **Troubleshooting Guide** - Common issues and solutions
5. **Release Notes** - Feature updates and changes

---

## Next Steps

1. ✅ Review and approve this plan
2. Create detailed wireframes/mockups
3. Set up development environment
4. Implement Phase 1 (Foundation)
5. Internal testing and iteration
6. Beta release to select users
7. Gather feedback and refine
8. Production release

---

**Timeline:** 5 weeks  
**Team:** 2 frontend developers + 1 designer  
**Dependencies:** Backend Square integration (✅ Complete)
