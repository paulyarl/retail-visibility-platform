# Location Lifecycle Management - Implementation Plan

## Executive Summary

Implement comprehensive lifecycle management for locations (tenants) similar to the existing product lifecycle system. This enables proper handling of seasonal closures, renovations, permanent closures, and new location onboarding while maintaining data integrity and appropriate visibility across storefronts, directories, and platform features.

---

## Location Status Definitions

### Status Enum: `LocationStatus`

```prisma
enum LocationStatus {
  pending      // New location being set up (not yet operational)
  active       // Fully operational and visible
  inactive     // Temporarily closed (seasonal, renovations)
  closed       // Permanently closed (data retained)
  archived     // Historical record only (hidden from all public views)
}
```

### Status Descriptions

| Status | Description | Storefront | Directory | Sync | Billing |
|--------|-------------|------------|-----------|------|---------|
| **pending** | New location setup in progress | Hidden | Hidden | Disabled | Active |
| **active** | Fully operational | Visible | Visible | Enabled | Active |
| **inactive** | Temporarily closed | Hidden | Shows "Temporarily Closed" | Disabled | Active |
| **closed** | Permanently closed | Hidden | Shows "Permanently Closed" | Disabled | Grace period |
| **archived** | Historical record | Hidden | Hidden | Disabled | Suspended |

---

## Impact Analysis

### 1. **Storefront Impact**
- **Active:** Full storefront visibility
- **Inactive:** Show "Temporarily Closed" banner with reopening date (if set)
- **Closed:** Show "Permanently Closed" message
- **Pending/Archived:** No storefront access (404 or redirect)

### 2. **Directory Impact**
- **Active:** Listed in directory with full details
- **Inactive:** Listed with "Temporarily Closed" badge, limited info
- **Closed:** Listed with "Permanently Closed" badge, contact info only
- **Pending/Archived:** Not listed in directory

### 3. **Google Sync Impact**
- **Active:** Full sync enabled
- **Inactive:** Pause sync, mark location as temporarily closed in GBP
- **Closed:** Stop sync, mark location as permanently closed in GBP
- **Pending/Archived:** No sync

### 4. **Tier & Billing Impact**
- **Active/Inactive/Pending:** Count toward location limits, full billing
- **Closed:** 30-day grace period, then count toward limits but reduced billing
- **Archived:** Do not count toward location limits, no billing

### 5. **User Access Impact**
- **Active/Inactive/Pending:** Users retain full access
- **Closed:** Users retain read-only access for 90 days
- **Archived:** Only platform admins can access

### 6. **Chain/Organization Impact**
- **Active locations only** count toward "operational locations" metrics
- **Inactive/Closed** locations excluded from propagation targets by default
- **Archived** locations excluded from all chain operations

---

## Phase 1: Database Schema & Core Backend (Week 1)

### 1.1 Database Migration

**Priority:** CRITICAL
**Estimated Time:** 2 hours

**Tasks:**
- [ ] Add `locationStatus` enum to Prisma schema
- [ ] Add `locationStatus` field to `Tenant` model (default: `active`)
- [ ] Add `statusChangedAt` timestamp field
- [ ] Add `statusChangedBy` field (user ID)
- [ ] Add `reopeningDate` field (for inactive status)
- [ ] Add `closureReason` field (for closed/archived)
- [ ] Create migration file
- [ ] Test migration on development database

**Schema Changes:**
```prisma
enum LocationStatus {
  pending
  active
  inactive
  closed
  archived

  @@map("location_status")
}

model Tenant {
  // ... existing fields ...
  locationStatus     LocationStatus  @default(active) @map("location_status")
  statusChangedAt    DateTime?       @map("status_changed_at")
  statusChangedBy    String?         @map("status_changed_by")
  reopeningDate      DateTime?       @map("reopening_date")
  closureReason      String?         @map("closure_reason")
  // ... rest of model ...
}
```

**Migration SQL:**
```sql
-- Create enum
CREATE TYPE "location_status" AS ENUM ('pending', 'active', 'inactive', 'closed', 'archived');

-- Add columns
ALTER TABLE "Tenant" ADD COLUMN "location_status" "location_status" NOT NULL DEFAULT 'active';
ALTER TABLE "Tenant" ADD COLUMN "status_changed_at" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "status_changed_by" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "reopening_date" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "closure_reason" TEXT;

-- Add indexes
CREATE INDEX "Tenant_location_status_idx" ON "Tenant"("location_status");
```

### 1.2 Backend Utility Functions

**Priority:** CRITICAL
**Estimated Time:** 3 hours

**Create:** `apps/api/src/utils/location-status.ts`

**Functions:**
- `canAccessLocation(status, userRole)` - Check if user can access location
- `canSyncLocation(status)` - Check if location should sync to Google
- `shouldShowInDirectory(status)` - Check if location appears in directory
- `shouldShowStorefront(status)` - Check if storefront is accessible
- `getStatusTransitions(currentStatus)` - Get allowed status changes
- `validateStatusChange(from, to, reason?)` - Validate status transition
- `getLocationStatusInfo(status)` - Get display info for status

**Status Transition Rules:**
```typescript
const STATUS_TRANSITIONS = {
  pending: ['active', 'archived'],
  active: ['inactive', 'closed', 'archived'],
  inactive: ['active', 'closed', 'archived'],
  closed: ['archived'],
  archived: [], // Cannot transition from archived
};
```

### 1.3 Backend API Endpoints

**Priority:** CRITICAL
**Estimated Time:** 4 hours

**New Endpoints:**

1. **PATCH `/api/tenants/:id/status`** - Change location status
   - Requires: TENANT_ADMIN or PLATFORM_ADMIN
   - Body: `{ status, reason?, reopeningDate? }`
   - Validates transition rules
   - Logs status change
   - Returns updated tenant

2. **GET `/api/tenants/:id/status-history`** - Get status change history
   - Returns audit log of status changes
   - Includes: timestamp, changed by, old status, new status, reason

3. **GET `/api/tenants/by-status/:status`** - List tenants by status
   - Requires: PLATFORM_ADMIN
   - Returns paginated list of tenants with given status

**Update Existing Endpoints:**

4. **GET `/api/tenants`** - Add `status` query filter
   - Default: exclude `archived` locations
   - Support: `?status=active,inactive` (comma-separated)

5. **GET `/api/tenants/:id`** - Include status info in response
   - Add `locationStatus`, `statusChangedAt`, `reopeningDate`

### 1.4 Status Change Audit Logging

**Priority:** HIGH
**Estimated Time:** 2 hours

**Create:** `LocationStatusLog` model

```prisma
model LocationStatusLog {
  id            String         @id @default(cuid())
  tenantId      String         @map("tenant_id")
  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  oldStatus     LocationStatus @map("old_status")
  newStatus     LocationStatus @map("new_status")
  changedBy     String         @map("changed_by")
  reason        String?
  metadata      Json?
  createdAt     DateTime       @default(now()) @map("created_at")

  @@index([tenantId, createdAt])
  @@map("location_status_logs")
}
```

---

## Phase 2: Query Filtering & Business Logic (Week 1-2)

### 2.1 Update Tenant Queries

**Priority:** CRITICAL
**Estimated Time:** 4 hours

**Files to Update:**
- `apps/api/src/index.ts` - Main tenant queries
- `apps/api/src/routes/*.ts` - All route files using tenant queries

**Changes:**
1. **Default Filtering:** Exclude `archived` from all queries by default
2. **Explicit Filtering:** Add `includeArchived` flag for admin queries
3. **Status-Aware Queries:** Filter by status in list endpoints

**Example:**
```typescript
// Before
const tenants = await prisma.tenant.findMany({ where: { organizationId } });

// After
const tenants = await prisma.tenant.findMany({
  where: {
    organizationId,
    locationStatus: { not: 'archived' } // Exclude archived by default
  }
});
```

### 2.2 Storefront Access Control

**Priority:** CRITICAL
**Estimated Time:** 3 hours

**Update:** `apps/web/src/app/s/[slug]/...` (storefront routes)

**Logic:**
- **Active:** Full access
- **Inactive:** Show "Temporarily Closed" page with reopening date
- **Closed:** Show "Permanently Closed" page with contact info
- **Pending/Archived:** 404 or redirect to directory

**Create:** `apps/web/src/components/storefront/LocationClosedBanner.tsx`

### 2.3 Directory Visibility

**Priority:** HIGH
**Estimated Time:** 3 hours

**Update:** `apps/web/src/app/directory/...` (directory routes)

**Logic:**
- **Active:** Full listing
- **Inactive:** Show with "Temporarily Closed" badge
- **Closed:** Show with "Permanently Closed" badge (contact only)
- **Pending/Archived:** Exclude from directory

**Create:** `apps/web/src/components/directory/LocationStatusBadge.tsx`

### 2.4 Google Sync Integration

**Priority:** HIGH
**Estimated Time:** 4 hours

**Update:** Google sync services

**Logic:**
- **Active:** Normal sync
- **Inactive:** Pause sync, update GBP to "temporarily closed"
- **Closed:** Stop sync, update GBP to "permanently closed"
- **Pending/Archived:** No sync

**Files:**
- `apps/api/src/services/google-sync.ts`
- Add status check before sync operations

---

## Phase 3: Frontend UI & Status Management (Week 2)

### 3.1 Location Status Indicator Component

**Priority:** HIGH
**Estimated Time:** 3 hours

**Create:** `apps/web/src/components/tenant/LocationStatusBadge.tsx`

**Features:**
- Color-coded badges (green/yellow/red/gray)
- Status icons
- Tooltips with status description
- Reopening date display (for inactive)

**Variants:**
- `compact` - Small badge for lists
- `full` - Detailed card with actions
- `inline` - Text with icon

### 3.2 Status Change Modal

**Priority:** HIGH
**Estimated Time:** 4 hours

**Create:** `apps/web/src/components/tenant/ChangeLocationStatusModal.tsx`

**Features:**
- Status dropdown (shows only valid transitions)
- Reason text field (required for closed/archived)
- Reopening date picker (for inactive)
- Confirmation dialog for destructive changes
- Preview of impact (storefront, directory, sync)

**Validation:**
- Enforce transition rules
- Require reason for closed/archived
- Warn about billing implications

### 3.3 Tenant Settings Integration

**Priority:** HIGH
**Estimated Time:** 3 hours

**Update:** `apps/web/src/app/t/[tenantId]/settings/page.tsx`

**Add Section:** "Location Status"
- Current status display
- Status history timeline
- "Change Status" button
- Impact warnings

### 3.4 Tenant Switcher Updates

**Priority:** MEDIUM
**Estimated Time:** 2 hours

**Update:** `apps/web/src/components/app-shell/TenantSwitcher.tsx`

**Changes:**
- Show status badge next to tenant name
- Filter options: "Show All", "Active Only", "Include Closed"
- Sort: Active first, then inactive, then closed

---

## Phase 4: Admin Tools & Monitoring (Week 3)

### 4.1 Admin Dashboard - Location Status Overview

**Priority:** MEDIUM
**Estimated Time:** 4 hours

**Update:** `apps/web/src/app/(platform)/settings/admin/page.tsx`

**Add Section:** "Location Status Overview"
- Count by status (active, inactive, closed, archived)
- Recent status changes
- Locations approaching closure
- Seasonal patterns

### 4.2 Location Status Management Page

**Priority:** MEDIUM
**Estimated Time:** 5 hours

**Create:** `apps/web/src/app/(platform)/settings/admin/locations/page.tsx`

**Features:**
- Filterable list of all locations
- Bulk status change operations
- Status change history
- Export status reports

### 4.3 Billing Integration

**Priority:** HIGH
**Estimated Time:** 4 hours

**Update:** Billing calculation logic

**Rules:**
- **Active/Inactive/Pending:** Full billing, count toward limits
- **Closed:** 30-day grace period at full rate, then 50% rate for data retention
- **Archived:** No billing, don't count toward limits

**Create:** `apps/api/src/utils/location-billing.ts`

---

## Phase 5: Chain/Organization Features (Week 3-4)

### 5.1 Propagation Filtering

**Priority:** MEDIUM
**Estimated Time:** 3 hours

**Update:** `apps/web/src/components/propagation/PropagateModal.tsx`

**Changes:**
- Default: Only show active locations
- Checkbox: "Include inactive locations"
- Disable: Closed/archived locations (with explanation)

### 5.2 Organization Dashboard Updates

**Priority:** MEDIUM
**Estimated Time:** 3 hours

**Update:** Organization dashboard

**Add:**
- Operational locations count (active only)
- Total locations count (all statuses)
- Status breakdown chart
- Seasonal closure calendar

### 5.3 Chain Analytics

**Priority:** LOW
**Estimated Time:** 4 hours

**Create:** Location lifecycle analytics

**Metrics:**
- Average time in each status
- Seasonal closure patterns
- Closure reasons analysis
- Reopening success rate

---

## Phase 6: Notifications & Automation (Week 4)

### 6.1 Status Change Notifications

**Priority:** MEDIUM
**Estimated Time:** 3 hours

**Implement:**
- Email notification to location admins on status change
- Slack/webhook integration for organization admins
- In-app notifications

### 6.2 Automated Status Transitions

**Priority:** LOW
**Estimated Time:** 4 hours

**Features:**
- Auto-reopen on scheduled date (inactive → active)
- Auto-archive after X days in closed status
- Reminder emails before scheduled reopening

### 6.3 Seasonal Closure Templates

**Priority:** LOW
**Estimated Time:** 3 hours

**Create:** Seasonal closure presets

**Templates:**
- "Winter Closure" (Nov-Mar)
- "Summer Closure" (Jun-Aug)
- "Renovation" (custom duration)
- "Holiday Closure" (specific dates)

---

## Phase 7: Testing & Documentation (Week 4-5)

### 7.1 Comprehensive Testing

**Priority:** CRITICAL
**Estimated Time:** 8 hours

**Test Cases:**
1. Status transitions (all valid paths)
2. Access control (by status and role)
3. Storefront visibility
4. Directory filtering
5. Google sync behavior
6. Billing calculations
7. Propagation filtering
8. Tenant switcher display

### 7.2 Documentation

**Priority:** HIGH
**Estimated Time:** 4 hours

**Create:**
- User guide: "Managing Location Status"
- Admin guide: "Location Lifecycle Management"
- API documentation: Status endpoints
- Migration guide: Existing locations

### 7.3 Data Migration

**Priority:** CRITICAL
**Estimated Time:** 2 hours

**Tasks:**
- Set all existing locations to `active` status
- Identify any inactive subscriptions → mark as `closed`
- Audit and verify data integrity

---

## Implementation Priority Matrix

### Must Have (Phase 1-2) - Week 1-2
- ✅ Database schema and migration
- ✅ Backend API endpoints
- ✅ Query filtering (exclude archived)
- ✅ Storefront access control
- ✅ Directory visibility rules

### Should Have (Phase 3-4) - Week 2-3
- ✅ Status indicator components
- ✅ Status change modal
- ✅ Tenant settings integration
- ✅ Admin monitoring tools
- ✅ Billing integration

### Nice to Have (Phase 5-6) - Week 3-4
- ⭐ Propagation filtering
- ⭐ Organization dashboard updates
- ⭐ Notifications
- ⭐ Automated transitions

### Future Enhancement (Phase 7+)
- 🔮 Seasonal templates
- 🔮 Advanced analytics
- 🔮 Predictive closure detection
- 🔮 Integration with external systems

---

## Risk Mitigation

### High-Risk Areas

1. **Existing Data Migration**
   - Risk: Breaking existing locations
   - Mitigation: Default to `active`, thorough testing, rollback plan

2. **Storefront Access**
   - Risk: Accidentally hiding active storefronts
   - Mitigation: Conservative defaults, extensive testing, monitoring

3. **Google Sync**
   - Risk: Incorrect GBP status updates
   - Mitigation: Dry-run mode, manual verification, gradual rollout

4. **Billing Impact**
   - Risk: Incorrect billing calculations
   - Mitigation: Parallel calculation, audit logs, manual review

### Rollback Strategy

- Database migration is reversible (drop columns/enum)
- Feature flags for gradual rollout
- Status changes are logged and reversible
- Default behavior preserves existing functionality

---

## Success Metrics

### Technical Metrics
- Zero data loss during migration
- < 100ms query performance impact
- 100% test coverage for status transitions
- Zero critical bugs in first 30 days

### Business Metrics
- 50% of seasonal locations use inactive status
- 90% of closed locations properly marked
- 30% reduction in support tickets about "missing locations"
- Improved billing accuracy for closed locations

### User Experience Metrics
- < 3 clicks to change location status
- Clear status visibility in all contexts
- Positive feedback from chain customers
- Reduced confusion about location availability

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1 | Schema, API, backend logic |
| Phase 2 | Week 1-2 | Query filtering, access control |
| Phase 3 | Week 2 | UI components, status management |
| Phase 4 | Week 3 | Admin tools, billing integration |
| Phase 5 | Week 3-4 | Chain features, propagation |
| Phase 6 | Week 4 | Notifications, automation |
| Phase 7 | Week 4-5 | Testing, documentation |

**Total Estimated Time:** 4-5 weeks

---

## Next Steps

1. **Review and approve this plan**
2. **Start Phase 1: Database schema changes**
3. **Create feature branch: `feature/location-lifecycle`**
4. **Set up project tracking (GitHub issues/project board)**
5. **Begin implementation following phase order**

---

## Questions to Resolve

1. Should `pending` locations count toward location limits?
2. What's the grace period for `closed` locations before archiving?
3. Should users be notified when a location changes status?
4. How should we handle locations with active subscriptions that are marked closed?
5. Should we allow bulk status changes for organizations?

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Author:** Cascade AI
**Status:** Ready for Review
