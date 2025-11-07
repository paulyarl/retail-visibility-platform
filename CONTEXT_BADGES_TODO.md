# Context Badges Implementation TODO

## Objective
Add ContextBadges component to all tenant-scoped pages for transparency.

## Progress: 4/11 Complete

### ✅ Complete
1. **Items** (`/items`) - Has ContextBadges with "Inventory" label
2. **Tenants** (`/tenants`) - Has ContextBadges with "Tenants" label  
3. **Subscription** (`/t/{id}/settings/subscription`) - Has ContextBadges with "Subscription" label
4. **Scan** (`/t/{id}/scan`) - Has ContextBadges with "Scanning" label

### ⚠️ Needs Implementation

#### High Priority (Main Features)
5. **Categories** (`/t/{id}/categories`)
   - Label: "Categories"
   - Add after PageHeader or in main container

6. **Insights** (`/t/{id}/insights`)
   - Label: "Insights" or "Analytics"
   - Custom layout - add near top

7. **Feed Validation** (`/t/{id}/feed-validation`)
   - Label: "Feed Validation"
   - Add in main container

8. **Profile Completeness** (`/t/{id}/profile-completeness`)
   - Label: "Profile"
   - Add in main container

#### Medium Priority (Onboarding/Setup)
9. **Quick Start** (`/t/{id}/quick-start`)
   - Label: "Quick Start"
   - Multiple return statements - add to each

10. **Onboarding** (`/t/{id}/onboarding`)
    - Label: "Onboarding"
    - Server component wrapper - add to OnboardingWizard component

#### Low Priority (Already Has Context)
11. **Settings** (`/t/{id}/settings`)
    - Reuses platform settings page
    - May already have context from cards
    - Consider adding if needed

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

## Next Steps

1. Add to Categories page (most used)
2. Add to Insights page (analytics)
3. Add to Feed Validation (important for merchants)
4. Add to Profile Completeness
5. Add to Quick Start
6. Add to Onboarding wizard
7. Test all pages
8. Update this document

---

## Notes

- All tenant-scoped pages should eventually have ContextBadges
- Consistent placement improves UX
- Use appropriate contextLabel for each page type
- Tenant name can be empty string - component handles it
- Component automatically shows tenant logo if available
