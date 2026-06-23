# Subscription-Status-Aware Capability — Phase Plan (Phases 1-3)

**Reference:** `docs/EXPIRED_TENANT_TRIGGER_ACTIONS_ANALYSIS.md` Sections 6-9

**Architecture:** Make `EffectiveCapabilityResolver` subscription-status-aware so all 15 per-domain resolvers automatically degrade when a tenant's subscription expires. Single chokepoint change cascades to every frontend hook, component, and backend route that reads capabilities.

---

## Phase 1: Subscription-Status-Aware Capability Resolution (Backend Core)

**Goal:** The `EffectiveCapabilities` response includes a `subscription_context` field, and capability `enabled` flags are overridden based on the tenant's derived `internalStatus`.

### Step 1.1 — Add `SubscriptionContext` to types

**File:** `apps/api/src/services/resolvers/types.ts`

Add a new interface and include it in `EffectiveCapabilities`:

```typescript
export interface SubscriptionContext {
  internalStatus: InternalStatus;
  maintenanceState: MaintenanceState | null;
  isReadOnly: boolean;   // frozen || canceled || expired
  isLimited: boolean;    // maintenance || past_due
  writable: boolean;     // !isReadOnly (convenience for frontend)
}
```

Add `subscription_context: SubscriptionContext` to `EffectiveCapabilities`.

Import `InternalStatus` and `MaintenanceState` from `../../utils/subscription-status`.

### Step 1.2 — Implement override in `EffectiveCapabilityResolver`

**File:** `apps/api/src/services/EffectiveCapabilityResolver.ts`

Changes:
1. Import `deriveInternalStatus`, `getMaintenanceState` from `../utils/subscription-status`
2. Import `SubscriptionContext` type
3. Expand tenant fetch to include `trial_ends_at`, `subscription_ends_at`
4. Expand `organizations_list` select to include `subscription_status`
5. After all 15 resolvers run (after line 181), derive `internalStatus` for both tenant and org
6. Build `SubscriptionContext` from the tenant's `internalStatus`
7. Apply per-capability override based on degradation matrix
8. Attach `subscription_context` to the result

**Override logic (Option A — post-resolution):**

```typescript
const isReadOnly = internalStatus === 'frozen' || internalStatus === 'canceled' || internalStatus === 'expired';
const isLimited = internalStatus === 'maintenance' || internalStatus === 'past_due';

if (isReadOnly) {
  // Fully disabled capabilities
  result.effective.chatbot.enabled = false;
  result.effective.barcode_scan.enabled = false;
  result.effective.quickstart.enabled = false;
  result.effective.commerce.enabled = false;
  result.effective.fulfillment.enabled = false;
  result.effective.integrations.enabled = false;
  result.effective.payment_gateway.enabled = false;

  // Read-only capabilities (enabled stays true, but writable=false in subscription_context)
  // CRM, Storefront, Product Options, Featured, Storefront Options, Directory Entry, FAQ, Org Options
  // — frontend checks subscription_context.writable to lock write operations
}

if (isLimited) {
  // Maintenance: disable write-heavy capabilities
  result.effective.barcode_scan.enabled = false;
  result.effective.quickstart.enabled = false;
  result.effective.featured.enabled = false;  // featured disabled in maintenance
  result.effective.chatbot.enabled = false;
  // Payment Gateway stays active in maintenance
  // CRM stays active in maintenance
  // FAQ stays active in maintenance
}
```

**Org-level check:**
```typescript
const orgStatus = tenant.organizations_list?.subscription_status;
if (orgStatus) {
  const orgInternalStatus = deriveInternalStatus({
    subscriptionStatus: orgStatus,
    subscriptionTier: tenant.organizations_list.subscription_tier,
    trialEndsAt: null,
    subscriptionEndsAt: null,
  });
  const orgReadOnly = orgInternalStatus === 'frozen' || orgInternalStatus === 'canceled' || orgInternalStatus === 'expired';
  if (orgReadOnly) {
    result.effective.org_options.enabled = false;
  }
}
```

### Step 1.3 — Cache invalidation on status changes

**File:** `apps/api/src/services/subscription/TrialManagementService.ts`
- Import `invalidateEffectiveCapabilities` from `../EffectiveCapabilityResolver`
- Call `invalidateEffectiveCapabilities(tenantId)` at the end of `downgradeToExpired()`

**File:** `apps/api/src/services/subscription/SubscriptionStatusService.ts`
- Import `invalidateEffectiveCapabilities`
- Call after `handleGracePeriodExpiry()`, `handlePaymentSuccess()`, `handleCancellation()`
- Call after any status transition method

### Step 1.4 — Verify

- Run `checkapi` (TypeScript compile check)
- Verify the `/effective-capabilities` endpoint returns `subscription_context` in the response
- Test with a mock frozen tenant to confirm capabilities are overridden

---

## Phase 2: SubscriptionDisplayCard Visual Status Indicator

**Goal:** The `SubscriptionDisplayCard` displays subtle color-coded visual indicators based on the tenant's `internalStatus`.

### Step 2.1 — Update `getStatusColor` to use `internalStatus`

**File:** `apps/web/src/components/subscription/SubscriptionDisplayCard.tsx`

Replace the current `getStatusColor` (lines 95-103) which only maps raw `subscription_status`:

```typescript
const getStatusColor = (internalStatus: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  switch (internalStatus) {
    case 'active': return 'success';
    case 'trialing': return 'info';
    case 'past_due': return 'warning';
    case 'maintenance': return 'warning';
    case 'frozen': return 'error';
    case 'canceled': return 'error';
    case 'expired': return 'error';
    default: return 'default';
  }
};
```

### Step 2.2 — Add visual treatment to the card

Use `useSubscriptionUsage(tenantId)` inside the card to get `internalStatus`.

Apply to the outer `<Card>` element:
- Border: `border-{color}-200` (subtle)
- Background: `bg-{color}-50/30` (low opacity)
- Dark mode: `dark:bg-{color}-950/30 dark:border-{color}-800`
- Small colored dot next to "Subscription" title

**Color mapping:**
| Internal Status | Tailwind Color | Dot Class |
|---|---|---|
| `active` | emerald | `bg-emerald-500` |
| `trialing` | blue | `bg-blue-500` |
| `past_due` | amber | `bg-amber-500` |
| `maintenance` | yellow | `bg-yellow-500` |
| `frozen` | red | `bg-red-500` |
| `canceled` | red | `bg-red-500` |
| `expired` | red | `bg-red-500` |

### Step 2.3 — Verify

- Run `checkweb` (TypeScript compile check)
- Visual inspection on dashboard with different subscription states

---

## Phase 3: Frontend Widget Locking

**Goal:** Dashboard widgets and settings pages check capability `enabled` flags and `subscription_context.writable` to lock UI for expired tenants.

### Step 3.1 — Lock bot widget on dashboard

**File:** `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

Before rendering the bot widget section:
```typescript
const { data: capabilities } = useEffectiveCapabilities(tenantId);
const chatbotEnabled = capabilities?.chatbot?.enabled ?? true;
const isWritable = capabilities?.subscription_context?.writable ?? true;

if (!chatbotEnabled) {
  // Render locked bot widget with upgrade CTA
} else if (!isWritable) {
  // Render read-only bot widget
}
```

### Step 3.2 — Lock CRM widget on dashboard

**File:** `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

Before rendering the CRM widget:
```typescript
const crmEnabled = capabilities?.crm?.enabled ?? true;
if (!crmEnabled) {
  // Render locked CRM card
} else if (!isWritable) {
  // Render read-only CRM card (tickets visible, no new inquiries)
}
```

### Step 3.3 — Lock settings pages

**Files:** All settings pages under `apps/web/src/app/t/[tenantId]/settings/`

Each settings page already reads its capability via `useEffectiveCommerce`, `useEffectiveStorefrontOptions`, etc. Add a check:
- If `enabled === false` → render locked state with upgrade CTA
- If `subscription_context.writable === false` → render read-only form (inputs disabled)

### Step 3.4 — Disable premium nav links

**File:** `apps/web/src/hooks/useNavLinks.tsx` or client-side filtering

Filter navigation links based on capability state:
- Bot link → hidden when `chatbot.enabled === false`
- CRM link → hidden when `crm.enabled === false`
- Quick Start link → hidden when `quickstart.enabled === false`
- Scan link → hidden when `barcode_scan.enabled === false`

### Step 3.5 — Storefront & directory entry message panels

**Goal:** Show a message panel on public storefront and directory entry pages when the tenant's subscription is not active (frozen, canceled, expired, maintenance, past_due).

Similar to existing panel messages (e.g., maintenance banners, COVID notices), these panels appear on the public-facing pages:

- **Storefront page:** A dismissible info panel at the top of the storefront indicating limited availability (e.g., "This store is currently operating in limited mode. Some features may be unavailable.")
- **Directory entry page:** A similar panel on the directory listing for the tenant

**Panel behavior by status:**
| Status | Panel Style | Message |
|---|---|---|
| `frozen` / `canceled` / `expired` | Subtle red/amber | "This store is in read-only mode. Online ordering and some features are temporarily unavailable." |
| `maintenance` | Subtle yellow | "This store is in maintenance mode. Some features are temporarily limited." |
| `past_due` | Subtle amber | "This store is operating with limited features. Please check back soon." |
| `trialing` / `active` | No panel | — |

**Files to modify:**
- Storefront page component (public-facing) — add conditional message panel
- Directory entry page component — add conditional message panel
- The panels should use the tenant's `subscription_context` from the effective capabilities API or derive from `useSubscriptionUsage`

### Step 3.6 — Verify

- Run `checkweb`
- Test with mock frozen tenant: bot widget locked, CRM read-only, settings locked, nav links hidden, storefront/directory panels visible
- Test with mock active tenant: all features visible and writable, no panels
