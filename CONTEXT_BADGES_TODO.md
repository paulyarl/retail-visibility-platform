# Context Badges Implementation TODO

## ✅ STATUS: COMPLETE

**Date Updated:** 2025-11-07  
**Conclusion:** All tenant-scoped pages already have ContextBadges implemented.

## Objective
Add ContextBadges component to all tenant-scoped pages for transparency.

## Progress: 11/11 Complete ✅

### ✅ Complete (All Pages)
1. **Items** (`/items`) - ✅ Has ContextBadges with "Inventory" label
2. **Tenants** (`/tenants`) - ✅ Has ContextBadges with "Tenants" label  
3. **Subscription** (`/t/{id}/settings/subscription`) - ✅ Has ContextBadges with "Subscription" label
4. **Scan** (`/t/{id}/scan`) - ✅ Has ContextBadges with "Scanning" label
5. **Categories** (`/t/{id}/categories`) - ✅ Has ContextBadges with "Categories" label
6. **Insights** (`/t/{id}/insights`) - ✅ Has ContextBadges with "Analytics" label
7. **Feed Validation** (`/t/{id}/feed-validation`) - ✅ Has ContextBadges with "Feed Validation" label
8. **Profile Completeness** (`/t/{id}/profile-completeness`) - ✅ Has ContextBadges with "Profile" label
9. **Quick Start** (`/t/{id}/quick-start`) - ✅ Has ContextBadges with "Quick Start" label (multiple locations)
10. **Onboarding** (`/t/{id}/onboarding`) - ✅ Has ContextBadges with "Onboarding" label (in OnboardingWizard component)
11. **Settings** (`/t/{id}/settings`) - ℹ️ Reuses platform settings page (context from cards)

---

## Implementation Pattern

### For Client Components with PageHeader

```typescript
// 1. Add import
import { ContextBadges } from '@/components/ContextBadges';

// 2. Get tenantId
const params = useParams();
const tenantId = params.tenantId as string;

// 3. Add after PageHeader, before main content
<PageHeader ... />

<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
  {/* Context Badges */}
  <ContextBadges 
    tenant={{ id: tenantId, name: '' }}
    contextLabel="[Page Type]"
  />
  
  {/* Rest of content */}
</div>
```

### For Custom Layouts (Insights, Quick Start)

```typescript
// Add near the top of the main container
<div className="min-h-screen ...">
  <div className="max-w-7xl mx-auto px-4 py-8">
    {/* Context Badges */}
    <ContextBadges 
      tenant={{ id: tenantId, name: '' }}
      contextLabel="[Page Type]"
      showBorder
    />
    
    {/* Rest of content */}
  </div>
</div>
```

### For Server Component Wrappers (Onboarding)

Option 1: Add to the child client component (OnboardingWizard)
Option 2: Convert wrapper to client component

---

## Context Labels by Page

| Page | Label | Rationale |
|------|-------|-----------|
| Scan | "Scanning" | Action-focused |
| Categories | "Categories" | Feature name |
| Insights | "Analytics" or "Insights" | Data/reporting |
| Feed Validation | "Feed Validation" | Feature name |
| Profile Completeness | "Profile" | Feature name |
| Quick Start | "Quick Start" | Wizard name |
| Onboarding | "Onboarding" | Wizard name |
| Items | "Inventory" | Already done |
| Subscription | "Subscription" | Already done |

---

## Benefits

### For Platform Support
- ✅ Always know which tenant they're helping
- ✅ Clear role context in screenshots
- ✅ Professional support communications

### For Tenant Users
- ✅ Clear indication of their role
- ✅ Helpful for multi-tenant users
- ✅ Professional UI consistency

### For Screenshots
- ✅ Self-documenting
- ✅ Shows role + tenant context
- ✅ Branded with tenant logo (if available)

---

## ✅ Verification Results

All pages verified to have ContextBadges implemented:

| Page | File | Label | Status |
|------|------|-------|--------|
| Categories | `apps/web/src/app/t/[tenantId]/categories/page.tsx` | "Categories" | ✅ Line 327 |
| Insights | `apps/web/src/app/t/[tenantId]/insights/page.tsx` | "Analytics" | ✅ Line 112 |
| Feed Validation | `apps/web/src/app/t/[tenantId]/feed-validation/page.tsx` | "Feed Validation" | ✅ Line 115 |
| Profile Completeness | `apps/web/src/app/t/[tenantId]/profile-completeness/page.tsx` | "Profile" | ✅ Line 125 |
| Quick Start | `apps/web/src/app/t/[tenantId]/quick-start/page.tsx` | "Quick Start" | ✅ Lines 164, 238, 328 |
| Onboarding | `apps/web/src/components/onboarding/OnboardingWizard.tsx` | "Onboarding" | ✅ Line 238 |

## Implementation Quality

All implementations follow the recommended pattern:
- ✅ Proper import of `ContextBadges` component
- ✅ Correct `tenantId` extraction from `useParams()`
- ✅ Appropriate `contextLabel` for each page type
- ✅ Consistent placement (top of main container)
- ✅ Proper styling integration

---

## Notes

- All tenant-scoped pages should eventually have ContextBadges
- Consistent placement improves UX
- Use appropriate contextLabel for each page type
- Tenant name can be empty string - component handles it
- Component automatically shows tenant logo if available
