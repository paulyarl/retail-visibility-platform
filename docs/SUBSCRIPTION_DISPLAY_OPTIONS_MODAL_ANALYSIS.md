# SubscriptionDisplayOptionsModal — Capability Integration & Enhancement Report

## 1. Current Architecture

### Component Chain

```
TenantDashboard / TenantDashboardV2
  ├─ SubscriptionDisplayCard (renders selected fields)
  │    └─ SubscriptionDisplayOptionsModal (field toggle modal)
  └─ PlanSummaryPanel (already capability-aware, uses AllCapabilitiesState)
```

### Data Flow

- **SubscriptionDisplayCard** receives `tierData` prop (tier info + raw feature list from tier API)
- **SubscriptionDisplayOptionsModal** manages which fields are visible via `useSubscriptionDisplay` hook (localStorage-persisted config)
- **PlanSummaryPanel** (sibling component) already consumes `AllCapabilitiesState` from `useEffectiveCapabilities` hook — the unified capability manifest

### Key Files

| File | Role |
|---|---|
| `apps/web/src/components/subscription/SubscriptionDisplayOptionsModal.tsx` | Field toggle modal |
| `apps/web/src/components/subscription/SubscriptionDisplayCard.tsx` | Renders selected fields on dashboard |
| `apps/web/src/hooks/useSubscriptionDisplay.ts` | localStorage config hook |
| `apps/web/src/hooks/useEffectiveCapabilities.ts` | React Query hook for capability manifest |
| `apps/web/src/services/CapabilityResolutionService.ts` | `AllCapabilitiesState` type + resolution logic |
| `apps/web/src/services/UnifiedCapabilityService.ts` | API service, maps backend → frontend state |
| `apps/web/src/components/settings/PlanSummaryPanel.tsx` | Reference: already renders full capability summaries |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Backend: resolves 16 capability domains |

---

## 2. Capability System Overview

The platform has a mature **Effective Capabilities** system with 16 domains:

| Domain Key | Display Name | State Interface |
|---|---|---|
| `commerce` | Commerce | `CommerceState` |
| `paymentGateway` | Payment Gateway | `PaymentGatewayState` |
| `storefront` | Storefront | `StorefrontState` |
| `barcodeScan` | Barcode Scanning | `BarcodeScanState` |
| `fulfillment` | Fulfillment | `FulfillmentState` |
| `productOptions` | Product Options | `ProductOptionsState` |
| `featuredOptions` | Featured Options | `FeaturedOptionsState` |
| `integrationOptions` | Integrations | `IntegrationOptionsState` |
| `quickstartOptions` | Quickstart | `QuickstartOptionsState` |
| `storefrontOptions` | Storefront Options | `StorefrontOptionsState` |
| `directoryEntryOptions` | Directory Entry | `DirectoryEntryOptionsState` |
| `faqOptions` | FAQ Options | `FaqOptionsState` |
| `crmOptions` | CRM | `CrmOptionsState` |
| `chatbotOptions` | Chatbot | `ChatbotOptionsState` |
| `socialCommerceOptions` | Social Commerce | `SocialCommerceOptionsState` |
| (org_options) | Organization | `EffectiveOrgOptions` (backend only) |

Each domain has:
- `enabled: boolean` — master gate
- Sub-features with tier-gate and merchant-gate status
- `isFlexible` flag — master unlock
- Merchant preference overrides (soft gates)

### Existing Capability Summary Logic

`PlanSummaryPanel.resolveCapabilitySummaries()` (line 285) already extracts a `CapabilitySummary[]` from `AllCapabilitiesState` with:
- `key`, `label`, `icon`, `enabled`, `merchantGated`
- `specificFeatures: string[]` — human-readable feature names
- `featureStatuses: FeatureItem[]` — per-feature enabled/merchant-gated/tier-gated status
- `settingsPath` — deep link to settings page

**This function is directly reusable** for the SubscriptionDisplayCard/Modal.

---

## 3. The "Features" Field Problem

### Current Implementation

In `SubscriptionDisplayCard.tsx:84`:
```typescript
const featureCount = effectiveTier?.features?.filter(f => f.is_enabled).length || 0;
```

Renders as: `Features: 12 enabled`

### Issues

1. **Meaningless count** — "12 enabled" tells the merchant nothing about *what* they can do
2. **Wrong data source** — counts raw `tier.features` from the tier API, not the effective capability manifest. This misses merchant-gate overrides, subscription-status overrides (frozen/maintenance), and purchased feature additions
3. **No granularity** — a tenant with 12 features enabled but commerce disabled (merchant-gated) still sees "12 enabled"
4. **Redundant with PlanSummaryPanel** — the dashboard already shows full capability details below this card via `PlanSummaryPanel`
5. **Stale data** — tier features come from a different API call than capabilities, so they can drift

---

## 4. Recommended Changes

### 4A. Replace "Features" Field with "Capabilities" Field

#### Modal Changes (`useSubscriptionDisplay.ts` + `SubscriptionDisplayOptionsModal.tsx`)

**In `useSubscriptionDisplay.ts`:**

1. Add `'capabilities'` to `SubscriptionDisplayField` type (replace `'features'`)
2. Add field metadata:
   ```typescript
   capabilities: {
     label: 'Capabilities',
     description: 'Enabled capability domains and count',
     icon: 'Shield',
     category: 'subscription',
   },
   ```
3. Update `FIELD_CATEGORIES.subscription.fields` to replace `'features'` with `'capabilities'`
4. Update default visible fields to include `'capabilities'` instead of `'features'`

**In `SubscriptionDisplayOptionsModal.tsx`:**

5. Update `FIELD_CATEGORIES.subscription.fields` array: replace `'features'` with `'capabilities'`

#### Card Changes (`SubscriptionDisplayCard.tsx`)

6. Accept `capabilities?: AllCapabilitiesState | null` as a new prop
7. Replace the `case 'features':` render block with `case 'capabilities':`:
   - Count enabled domains: `const enabledCount = Object.values(capabilities).filter(c => c?.enabled).length`
   - Show as: `Capabilities: 14/16 active`
   - Optionally show a tooltip or expandable list of enabled capability names
8. Fallback: if no `capabilities` prop, show nothing (don't fall back to tier features)

#### Dashboard Changes (`TenantDashboard.tsx` + `TenantDashboardV2.tsx`)

9. Pass `capabilities={allCaps.data}` to `SubscriptionDisplayCard` — both dashboards already have `allCaps` from `useEffectiveCapabilities`

#### Migration Consideration

- The `'features'` field key is stored in localStorage configs. Add a migration step in `useSubscriptionDisplay.ts` that maps `'features'` → `'capabilities'` on load:
  ```typescript
  visibleFields: (parsed.visibleFields || DEFAULT_CONFIG.visibleFields)
    .map(f => f === 'features' ? 'capabilities' : f),
  ```

### 4B. Optional: Capability Detail Popover in Card

Instead of just showing "14/16 active", add a popover/tooltip that lists the enabled capability names. Reuse `CAPABILITY_DISPLAY` labels from `PlanSummaryPanel.tsx` (or extract to a shared constant).

---

## 5. Enhancement Opportunities

### 5A. Style Issues

| # | Issue | Location | Fix |
|---|---|---|---|
| S1 | **Save button text color hardcoded to gray** — `style={{ color: '#9ca3af' }}` on a `variant="filled"` button makes text nearly invisible on primary background | Line 262 | Remove the inline style; Mantine's filled variant already handles contrast |
| S2 | **Inline styles for selected/unselected cards** — uses `var(--mantine-color-primary-5)` etc. directly in `style` props | Lines 162-167, 203-207 | Use Mantine's `className` with `data-selected` attribute or Mantine's `Checkbox.Card` pattern |
| S3 | **No visual loading state** — when `isLoading` is true, modal renders with empty checkboxes | Lines 57-63 | Show a `Skeleton` or `Loader` overlay while loading |
| S4 | **Layout radio cards lack visual hierarchy** — no preview of what each layout looks like | Lines 198-219 | Add small icon/diagram previews (3-line, 2-col, multi-col) |
| S5 | **Divider with no label** — bare `<Divider />` between sections | Lines 188, 224 | Use `<Divider label="Layout" />` or `<Divider labelPosition="left">` for context |

### 5B. Content / UX Issues

| # | Issue | Location | Fix |
|---|---|---|---|
| C1 | **Upgrade prompt toggle saves immediately** — `toggleUpgradePrompt()` writes to localStorage on click, bypassing the "Save Changes" flow. If user clicks Cancel, the toggle is already persisted | Lines 236-238 | Use local state for the toggle, save it in `handleSave()` |
| C2 | **`handleReset` hardcodes defaults** — doesn't use `resetToDefaults` from the hook, and doesn't sync with `DEFAULT_CONFIG` constant | Lines 117-120 | Use `resetToDefaults()` or at least reference `DEFAULT_CONFIG` |
| C3 | **`window.location.reload()` on save** — full page reload is jarring and loses React state | Lines 110-113 | Remove reload; the hook already updates state. If parent needs re-render, use a callback prop |
| C4 | **No "Apply" vs "Save" distinction** — user can't preview changes before committing | N/A | Consider live-preview in the card behind the modal, or an "Apply" button that updates without closing |
| C5 | **Field descriptions are generic** — "Available feature count" doesn't help users understand what they're toggling | `FIELD_METADATA` | Improve descriptions, e.g. "Show which platform capabilities are active" |
| C6 | **No capability count preview in modal** — when toggling the new "Capabilities" field, the modal doesn't show what will appear | N/A | Add a small preview text like "Will show: 14/16 active" |

### 5C. Function / Logic Issues

| # | Issue | Location | Fix |
|---|---|---|---|
| F1 | **`useEffect` dependency on entire `config` object** — causes unnecessary re-runs because `config` is a new object reference each render | Line 63 | Destructure `config.visibleFields` and `config.layout` in the dependency array |
| F2 | **`toggleUpgradePrompt` uses stale `config` closure** — `saveConfig({ ...config, ...})` captures `config` at callback creation time | `useSubscriptionDisplay.ts:189-191` | Use functional `setConfig` update like `setVisibleFields` already does |
| F3 | **Console.log statements left in production code** — `setVisibleFields` and `setLayout` have active `console.log` calls | `useSubscriptionDisplay.ts:168, 181` | Remove or gate behind `process.env.NODE_ENV === 'development'` |
| F4 | **No keyboard accessibility on clickable Papers** — `onClick` on `<Paper>` lacks `role="button"`, `tabIndex`, `onKeyDown` | Lines 158-181 | Add `role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleToggleField(field)}` |
| F5 | **Category "Select all" doesn't update `hasChanges` correctly** — the `useEffect` on line 66 compares against `config.visibleFields` but local state may have been modified by reset | Lines 66-72 | This works but is fragile; consider explicit dirty-checking |
| F6 | **No persistence error feedback** — localStorage write failures are silently caught | `useSubscriptionDisplay.ts:148-150` | Show a Mantine notification on failure |

### 5D. Architecture Opportunities

| # | Opportunity | Benefit |
|---|---|---|
| A1 | **Extract `CAPABILITY_DISPLAY` labels to shared constant** — `PlanSummaryPanel.tsx` has label maps that `SubscriptionDisplayCard` would need for capability rendering | DRY, single source of truth |
| A2 | **Extract `resolveCapabilitySummaries()` to a utility** — currently embedded in `PlanSummaryPanel.tsx`, but it's a pure function that could be shared | Reusable across components |
| A3 | **Consider merging SubscriptionDisplayCard + PlanSummaryPanel** — both show subscription/capability info on the dashboard. The card is customizable but shallow; the panel is detailed but not customizable. A unified component with toggle-able detail levels would reduce confusion | Simpler UX, less code |
| A4 | **Add `capabilities` to the `useSubscriptionDisplay` config as a first-class concept** — instead of just a toggle field, allow users to pick *which* capability domains to show in the card | Fine-grained control |

---

## 6. Implementation Priority

| Priority | Item | Effort | Impact |
|---|---|---|---|
| **P0** | 4A: Replace Features with Capabilities field | Medium | High — fixes misleading data |
| **P0** | S1: Fix Save button color | Trivial | High — visible bug |
| **P0** | C1: Upgrade prompt toggle bypasses save flow | Small | Medium — UX correctness |
| **P1** | C3: Remove `window.location.reload()` | Small | Medium — UX smoothness |
| **P1** | F1-F2: Fix stale closure / effect dependencies | Small | Medium — correctness |
| **P1** | F3: Remove console.log statements | Trivial | Low — cleanup |
| **P2** | S3: Add loading state | Small | Low — polish |
| **P2** | F4: Keyboard accessibility | Small | Medium — a11y |
| **P2** | S4: Layout previews | Medium | Low — polish |
| **P2** | A1-A2: Extract shared constants/utilities | Medium | Medium — DRY |
| **P3** | A3: Merge with PlanSummaryPanel | Large | Strategic |
| **P3** | A4: Per-domain capability toggles | Large | Nice-to-have |

---

## 7. Data Flow Diagram (Proposed)

```
TenantDashboard
  ├─ useEffectiveCapabilities(tenantId) → AllCapabilitiesState
  │
  ├─ SubscriptionDisplayCard
  │    ├─ props: tierData, capabilities (NEW)
  │    ├─ useSubscriptionDisplay(tenantId) → config
  │    ├─ renders: tier, status, SKU limit, location limit, capabilities (NEW)
  │    └─ SubscriptionDisplayOptionsModal
  │         └─ toggles fields including 'capabilities' (NEW)
  │
  └─ PlanSummaryPanel
       └─ props: capabilities (AllCapabilitiesState)
       └─ resolveCapabilitySummaries() → detailed list
```

The key change: `SubscriptionDisplayCard` receives the same `AllCapabilitiesState` that `PlanSummaryPanel` already consumes, enabling a summary "14/16 capabilities active" display that reflects the true effective state (tier gates + merchant gates + subscription status overrides).

---

## 8. Conclusion

The current "Features" field is the weakest part of the SubscriptionDisplayCard — it shows a raw count from a secondary data source that doesn't reflect merchant gates, subscription status, or purchased features. Replacing it with a capability-aware field is straightforward because:

1. The `AllCapabilitiesState` manifest is already fetched in both dashboards
2. `PlanSummaryPanel.resolveCapabilitySummaries()` already extracts human-readable summaries
3. The modal's field-toggle pattern requires only a type change and metadata update

The modal itself has several quality issues worth fixing: a visible Save button color bug, an upgrade-prompt toggle that bypasses the save flow, a full-page reload on save, stale closures, and missing keyboard accessibility. These are all small, independent fixes.
