---
description: Fix tenant dashboard startup latency and load loop — covers the broken server-resolved auth optimization, 4-step serialized waterfall, hydration spinner, and blocking loading gates
---

# Fix Tenant Dashboard Startup & Load Loop

Use this skill when the tenant dashboard at `/t/{tenantId}/dashboard` is slow to display content, shows a skeleton for an unusually long time, or appears to "loop" through a loading state before settling. Also applies when the server-resolved context optimization is producing no benefit despite being implemented.

## Symptom Signature

- **Skeleton shown for 2–5+ seconds** on every navigation to the tenant dashboard
- **Network tab shows 3–4 sequential API calls** before the dashboard renders: `/api/auth/me` → `/api/tenants/:id` → tier and usage endpoints (each depends on the previous)
- **Console may show** `[useTenantComplete]` warnings because primary query has no `authUser` yet
- **`ServerResolvedContextProvider` is present in the tree but has no effect** on `AuthProvider` — `isLoading` still starts `true`, `fetchUser()` still fires
- **React Query DevTools** show `['tenant', 'info', tenantId]` query in `pending` state until after auth resolves

## Architecture Context

The tenant page tree (outer to inner):

```
Root layout.tsx           → ClientRootLayout (client)
  CustomAuthProvider      ← useServerAuth() here returns NULL (ServerResolvedContext not yet provided)
    ...children...
      Tenant layout.tsx   → ServerResolvedContextProvider (wraps all /t/* pages)
        TenantAuthGate    ← useServerAuth() here correctly returns auth ✓
          TenantDashboardV2
            useTenantComplete  ← blocked by authUser=null until fetchUser() resolves
```

`AuthProvider` lives at the ROOT but `ServerResolvedContextProvider` is a CHILD layout. React context reads upward — so `AuthProvider` calling `useServerAuth()` will always get `null`.

---

## Root Cause Map

### Bug 1 — `AuthProvider` is outside `ServerResolvedContextProvider` (critical)

**File:** `apps/web/src/components/ClientRootLayout.tsx`  
**File:** `apps/web/src/contexts/AuthContext.tsx`

`AuthProvider` wraps all pages in `ClientRootLayout`. `ServerResolvedContextProvider` only wraps `/t/*` pages in the tenant layout. Because context flows upward, `AuthProvider.useServerAuth()` always returns `null`:

```typescript
// AuthContext.tsx — initialization
const serverAuth = useServerAuth();   // Always null — AuthProvider is ABOVE ServerResolvedContextProvider
const serverUser = serverAuth?.isAuthenticated ? serverAuth.user : null;
const [isLoading, setIsLoading] = useState(!serverAuth);  // Always true
// serverProvidedRef.current is always false → fetchUser() always fires
```

**Effect chain:**
1. `isLoading=true` on every mount
2. `fetchUser()` fires → `GET /api/auth/me` (one wasted round-trip)
3. `useTenantComplete` primary query is `enabled: !!authUser` → blocked until step 2 completes
4. Secondary queries (tier, usage) gated on `!!tenantData` → blocked until step 3 completes
5. Dashboard skeleton shown until ALL of the above complete

---

### Bug 2 — `ClientRootLayout` hydration spinner blocks entire tree

**File:** `apps/web/src/components/ClientRootLayout.tsx`

```typescript
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => { setMounted(true); }, []);
if (!mounted) {
  return <QueryClientWrapper><div>Loading spinner...</div></QueryClientWrapper>;
}
```

This guarantees a full-page blank spinner before any SSR HTML is usable and before `AuthProvider` can even start. The `ThemeProvider` it is protecting is already loaded with `{ ssr: false }`, so the guard is unnecessary.

---

### Bug 3 — Full-page `DashboardSkeleton` gates on ALL data including secondary queries

**File:** `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

```typescript
const loading = completeLoading || profileLoading;
if (loading) return <DashboardSkeleton />;  // Blocks everything
```

`completeLoading` is true until both primary AND secondary queries (tier, usage, organization) complete. The page title, header, and KPI cards could render with just primary data, but they are all blocked by the combined loading gate.

---

### Bug 4 — `useUserProfile` delays synchronously-derivable profile data

**File:** `apps/web/src/hooks/useUserProfile.ts`

```typescript
const [loading, setLoading] = useState(true);  // Starts true
useEffect(() => {
  if (authLoading) return;   // Waits for full auth cycle
  const fallbackProfile = createFallbackProfile(user);  // Synchronous!
  setProfile(fallbackProfile);
  setLoading(false);
}, [user, authLoading]);
```

`useUserProfile` makes no API calls — it derives from the auth `user` object synchronously. Yet `profileLoading` starts `true` and stays `true` until auth resolves, contributing to the dashboard skeleton gate.

---

### Bug 5 — Server-fetched tenant info is not seeded into React Query cache

**File:** `apps/web/src/app/t/[tenantId]/layout.tsx`  
**File:** `apps/web/src/hooks/dashboard/useTenantComplete.ts`

The server layout already fetches tenant info server-side and passes it through `ServerResolvedTenant.tenantInfo`. The `useTenantComplete` hook ignores this and re-fetches client-side:

```typescript
// layout.tsx — already fetched on the server
tenantInfoService.getTenantInfo(tenantId, { auth0Email, auth0Id })
// → passed into ServerResolvedContextProvider as serverTenant.tenantInfo

// useTenantComplete — fetches again, duplicating the work
queryFn: async () => tenantInfoService.getCompleteTenantInfo(tenantId)
```

`useServerTenant()` in `useTenantComplete` could seed `queryClient` with the server data, eliminating the client-side primary fetch entirely.

---

## Fix Recommendations (ordered by impact)

### Fix 1 — Remove `ClientRootLayout` hydration spinner (Quick Win)

**File:** `apps/web/src/components/ClientRootLayout.tsx`

Remove the `mounted` state guard. `ThemeProvider` is already `ssr: false`, so it won't cause hydration mismatch without the guard:

```typescript
// REMOVE this block entirely:
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => { setMounted(true); }, []);
if (!mounted) { return <spinner>; }

// Also move ThemeProvider dynamic import outside the function (it re-creates on every render currently)
const ThemeProvider = dynamic(...);  // ← Move to module scope, not inside the component
```

---

### Fix 2 — Bridge server-resolved auth into `AuthProvider` (Core Fix)

The safest approach that avoids restructuring the provider tree is to pass the server-resolved user into the root layout as a serializable prop. There are two sub-options:

**Option A — Slot prop from root layout (preferred)**  
Add an optional `initialUser` prop to `AuthProvider` and pass it from the server root layout. The root `layout.tsx` already calls `auth0.getSession()` — extract the user from there and forward it.

```typescript
// ClientRootLayout.tsx — accept optional initialUser
interface ClientRootLayoutProps {
  children: React.ReactNode;
  initialUser?: ServerResolvedAuth['user'] | null;
}

// AuthContext.tsx — AuthProvider accepts initialUser
export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(!initialUser);  // false if seeded
  const serverProvidedRef = React.useRef(!!initialUser);
  ...
}
```

**Option B — Tenant layout creates a scoped auth bridge component**  
A lightweight `ServerAuthBridge` client component, placed INSIDE `ServerResolvedContextProvider`, reads `useServerAuth()` and syncs it into the `AuthContext` via an exported setter. This requires exposing a `setUserFromServer` escape hatch on the auth context.

---

### Fix 3 — Seed React Query cache with server-resolved tenant info

**File:** `apps/web/src/hooks/dashboard/useTenantComplete.ts`

```typescript
import { useServerTenant } from '@/components/tenant/ServerResolvedContextProvider';
import { useQueryClient } from '@tanstack/react-query';

export function useTenantComplete(tenantId: string | null, loadSecondary: boolean = true) {
  const serverTenant = useServerTenant();
  const queryClient = useQueryClient();

  // Seed the primary query cache with server data before the query fires
  React.useEffect(() => {
    if (serverTenant?.tenantInfo && tenantId) {
      queryClient.setQueryData(['tenant', 'info', tenantId], serverTenant.tenantInfo);
    }
  }, [serverTenant, tenantId, queryClient]);
  ...
```

This eliminates the primary tenant fetch on initial load. `staleTime: 30 * 1000` ensures it won't immediately re-fetch.

---

### Fix 4 — Remove full-page loading gate; use per-section skeletons

**File:** `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

```typescript
// BEFORE — blocks entire page on all data
const loading = completeLoading || profileLoading;
if (loading) return <DashboardSkeleton />;

// AFTER — only block on primary tenant data; secondary data fills in reactively
const primaryLoading = tenantLoading;  // from useTenantComplete split
if (primaryLoading) return <DashboardSkeleton />;
// Tier/usage/org data renders as null-safe components with inline skeletons
```

This requires splitting `isLoading` into `tenantLoading` (primary) and `secondaryLoading` (tier/usage). Expose both separately from `useTenantComplete`:

```typescript
// useTenantComplete return type — add split loading states
primaryLoading: boolean;   // true only while /api/tenants/:id is in-flight
secondaryLoading: boolean; // true while tier/usage are in-flight
```

---

### Fix 5 — Initialize `useUserProfile` synchronously from auth user

**File:** `apps/web/src/hooks/useUserProfile.ts`

```typescript
// BEFORE — always starts loading=true, waits for useEffect
const [loading, setLoading] = useState(true);

// AFTER — if user already exists (e.g., from server-resolved auth), initialize synchronously
const [profile, setProfile] = useState<UserProfileData | null>(
  user ? createFallbackProfile(user) : null
);
const [loading, setLoading] = useState(!user);  // false if user already present
```

---

## Verification Steps

After applying fixes:

1. Open DevTools Network tab, navigate to `/t/{tenantId}/dashboard`
2. Confirm no `/api/auth/me` call fires on initial load (Fix 2 success)
3. Confirm no `/api/tenants/:id` client call fires on initial load (Fix 3 success)
4. Confirm the page header/title renders before tier/usage data arrives (Fix 4 success)
5. Confirm no full-page spinner before page content on any route (Fix 1 success)
6. Time from navigation to visible content should be under 500ms for cached users

---

## Files Involved

| File | Issue |
|---|---|
| `apps/web/src/components/ClientRootLayout.tsx` | Hydration spinner blocks all rendering; `ThemeProvider` re-created inline |
| `apps/web/src/contexts/AuthContext.tsx` | `AuthProvider` above `ServerResolvedContextProvider` — optimization dead |
| `apps/web/src/hooks/dashboard/useTenantComplete.ts` | Server tenant data not seeded into React Query; secondary loading gates skeleton |
| `apps/web/src/components/dashboard/TenantDashboardV2.tsx` | Full-page skeleton gates on secondary data (tier/usage); `profileLoading` in gate |
| `apps/web/src/hooks/useUserProfile.ts` | Async-initializes profile that is synchronously derivable |
| `apps/web/src/app/t/[tenantId]/layout.tsx` | Server-fetched `tenantInfo` not forwarded to client cache |
| `apps/web/src/app/t/[tenantId]/dashboard/page.tsx` | `TenantAuthGate` is redundant (layout already handles server-side redirect) but harmless |

---

## Key Principles

1. **React context reads upward.** A provider at the root cannot benefit from a context provided by a child layout. `AuthProvider` must either be inside `ServerResolvedContextProvider` or receive server state through a different channel (props, cache seeding, escape-hatch setter).
2. **Waterfall = `enabled` depending on upstream query result.** Every `enabled: !!someQueryResult` creates a serial dependency. Map these explicitly and ask: "Can the UI render with partial data?"
3. **Seeding React Query cache eliminates duplicate fetches.** Server components already have data that client components will re-fetch. Use `queryClient.setQueryData()` on mount to bridge them.
4. **Loading gates should be proportional to what they block.** A skeleton for the entire page is only justified if zero structure is renderable without the data. Use per-section skeletons so layout appears immediately.
5. **Synchronous derivation should never be async.** If a hook derives state from existing state (no API call), it should initialize synchronously using `useState(derive(existingState))`, not a `useEffect` with `setLoading(false)`.

---

## Related Skills

- `fix-auth0-redirect-loop.md` — Full-page redirect loop caused by httpOnly cookie being invisible to `document.cookie`
- `server-resolved-context-delegator.md` — Architecture of the `ServerResolvedContextProvider` pattern and how auth/tenant state is passed from server to client
- `database-navigation-system.md` — Navigation links DB system (separate from auth/load concerns)
