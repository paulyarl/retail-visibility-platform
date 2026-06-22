# Troubleshooting: Admin/Tenant API Calls Leaking on Public Pages

> **USE WHEN**: Browser network tab shows admin or tenant-scoped API requests (e.g. `/api/admin/*`, `/api/tenants/*`) firing on public pages (product pages, storefront, directory, etc.). These requests should never happen on public routes.

---

## Symptom

Public page load (e.g. `/products/[id]`, `/stores/[tenantId]`) triggers authenticated/admin API calls in the browser network tab:

```
GET http://localhost:4000/api/admin/navigation-links   ← SHOULD NOT fire on public pages
GET http://localhost:4000/api/auth/me                   ← MAY fire if auth cookie exists, but unnecessary
```

Console may also show:
```
The final argument passed to useEffect changed size between renders.
```

## Root Cause Patterns

### Pattern 1: Global component calling scoped hooks

A component rendered in the root layout (`ClientRootLayout.tsx`) calls a hook that fetches admin/tenant data unconditionally. The hook may have internal pathname guards, but the hook itself still runs (and may fetch if guards are unstable).

**Example**: `CommandPalette` was rendered globally in `ClientRootLayout.tsx` and called `useNavLinks()` on every page. Even though `useNavLinks` had a pathname check, the admin `/api/admin/navigation-links` request still fired on public product pages.

**Fix**: Split the global component into a thin wrapper that checks `isAuthenticated` + `isTenantOrAdminPage` before rendering an inner component that calls the scoped hook. The inner component only mounts on qualifying pages.

```tsx
// Wrapper — rendered globally, guards the hook
export function CommandPalette() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const isTenantOrAdminPage = Boolean(
    pathname?.startsWith('/t/') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/tenants') ||
    pathname?.startsWith('/onboarding')
  );
  if (!isAuthenticated || !isTenantOrAdminPage) return null;
  return <CommandPaletteInner pathname={pathname} />;
}

// Inner — only mounts on tenant/admin pages, safe to call scoped hooks
function CommandPaletteInner({ pathname }: { pathname: string }) {
  const { adminLinks, allLinks, tenantLinks } = useNavLinks();
  // ...
}
```

### Pattern 2: Unstable boolean in useEffect/useCallback dependency arrays

A pathname-derived boolean (e.g. `isTenantOrAdminPage`) is `undefined` on first render (when `pathname` is not yet available) and becomes `true`/`false` on subsequent renders. This changes the **size** of the dependency array between renders, triggering React's "changed size between renders" error.

**Fix**: Wrap the expression in `Boolean(...)` to guarantee a stable `true`/`false` value:

```tsx
// BAD — can be undefined when pathname is undefined
const isTenantOrAdminPage = pathname?.startsWith('/t/') || pathname?.startsWith('/admin');

// GOOD — always boolean
const isTenantOrAdminPage = Boolean(
  pathname?.startsWith('/t/') || pathname?.startsWith('/admin')
);
```

### Pattern 3: Hook guards that don't prevent execution

A hook has an internal `if (!isAuthenticated) return;` guard inside `useEffect`, but the hook itself still runs on every render. If the hook calls `useState`, `useCallback`, or other hooks, those all execute even when the guard would skip the fetch. This is wasteful and can cause side effects.

**Fix**: Move the guard to the **caller** level (see Pattern 1) so the hook is never called on pages where it's not needed. Hooks cannot be conditionally called, so the component that calls them must be conditionally rendered.

---

## Diagnostic Steps

1. **Identify the leaking request** — Check browser DevTools Network tab for admin/tenant API calls on public pages.

2. **Trace the call stack** — Use the network request's Initiator column or console error stack trace to find the calling component/hook.

3. **Check if the caller is globally rendered** — Search for the component in `ClientRootLayout.tsx` or any layout file that wraps public routes:
   ```
   grep_search for "ComponentName" in apps/web/src/components/ClientRootLayout.tsx
   ```

4. **Check if the caller uses a scoped hook** — Look for `useNavLinks()`, `useAuth()` with admin/tenant API calls, or any service that hits `/api/admin/*` or `/api/tenants/*`.

5. **Check dependency array stability** — If there's a "changed size between renders" error, look for `undefined`-able values in `useEffect`/`useCallback` dependency arrays.

---

## Key Files

| File | Role |
|------|------|
| `apps/web/src/components/ClientRootLayout.tsx` | Root layout — globally rendered components live here |
| `apps/web/src/components/app-shell/CommandPalette.tsx` | Global Cmd+K palette — was the culprit (fixed) |
| `apps/web/src/hooks/useNavLinks.tsx` | Navigation links hook — calls `/api/admin/navigation-links` |
| `apps/web/src/services/NavigationLinksService.ts` | Frontend service for nav links (5-min cache) |
| `apps/web/src/components/navigation/SettingsLayoutRouter.tsx` | Settings-only router that uses `useNavLinks` (safe) |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | Tenant sidebar — uses `useNavLinks` (safe, only on /t/ pages) |

---

## Prevention Rules

1. **Never call scoped hooks from globally-rendered components.** If a component is in `ClientRootLayout.tsx`, it must not call `useNavLinks()`, `useAuth()` with admin API calls, or any service that hits `/api/admin/*` or `/api/tenants/*` directly.

2. **Split global components into wrapper + inner.** The wrapper checks auth + pathname context. The inner component (which calls scoped hooks) only mounts when appropriate.

3. **Always wrap pathname-derived booleans in `Boolean(...)`.** This prevents `undefined` from destabilizing React dependency arrays.

4. **Public pages should only call `/api/public/*` endpoints.** No exceptions. If a public page needs data that's behind an admin/tenant endpoint, create a public proxy endpoint.

5. **When adding a new global component**, audit every hook and service call it makes. Trace each one to the API endpoint it hits. If any endpoint is admin/tenant-scoped, add a guard in the wrapper.

---

## Verification

After applying a fix:

1. Open a public product page (e.g. `/products/pid-xxx`) in the browser
2. Open DevTools Network tab
3. Filter for `admin` or `tenants`
4. Confirm no admin/tenant-scoped requests fire
5. Navigate to a tenant page (e.g. `/t/[tenantId]/dashboard`) and confirm the admin requests DO fire there
6. Check console for "changed size between renders" errors — should be gone
