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

### Pattern 4: Backend blanket auth middleware on `/api/tenants` catching public endpoints

A public route is defined without `authenticateToken` (e.g. `router.get('/tenants/:tenantId/active-featured', ...)`), but it's mounted at `/api` while other routers are mounted at `/api/tenants` with blanket `authenticateToken` middleware:

```ts
// index.ts — these apply authenticateToken to ALL /api/tenants/* requests
app.use('/api/tenants', authenticateToken, trialSetupRoutes);
app.use('/api/tenants', authenticateToken, tenantNotificationsRoutes);

// Public route — mounted at /api, path resolves to /api/tenants/:tenantId/active-featured
app.use('/api', activeFeaturedRoutes); // ← intercepted by the blanket auth above
```

Even though the public route handler itself has no auth middleware, Express processes `app.use('/api/tenants', authenticateToken, ...)` first because it matches the request path `/api/tenants/:tenantId/active-featured`. The `authenticateToken` middleware runs, finds no Auth0 session, and returns `401 authentication_required`.

**This affects ALL routes under `/api/tenants/*`**, regardless of which router defines them. The blanket middleware on the mount path runs before any individual route handler.

**Root cause note:** The blanket auth middleware is the amplifier, but the root cause is a URL namespace collision — a public route mounted under a private URL prefix. URL namespace isolation (`/api/public/...` vs `/api/tenants/...`) is the primary fix. See `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1 for the comprehensive spec.

**Route registry vector:** The same issue occurs via `routeRegistry.ts`. An entry with `authLevel: 'tenant'` mounted at `/api` whose router defines a route like `/tenants/:id/tier/public` resolves to `/api/tenants/:id/tier/public` — which matches the blanket auth on `/api/tenants`. The route handler has no `authenticateToken`, but the mount-level `authLevel` or sibling registry entries with `middleware: [authenticateToken]` at `/api/tenants` intercept the request first. Always check both `index.ts` and `routeRegistry.ts` for blanket auth on `/api/tenants`.

**Fix**: Move public tenant-scoped endpoints to `/api/public/tenants/:tenantId/*` — a path that never matches the `/api/tenants` mount point. Use a separate `publicTenantRouter` with `mergeParams: true`:

```ts
// active-featured.ts
const publicTenantRouter = express.Router({ mergeParams: true });

publicTenantRouter.get('/active-featured', async (req: express.Request<{ tenantId: string }>, res) => {
  const { tenantId } = req.params;
  // ... handler logic
});

export { publicTenantRouter };
export default router; // main router for platform-level + admin routes

// index.ts
import activeFeaturedRoutes, { publicTenantRouter as activeFeaturedPublicRouter } from './routes/active-featured';
app.use('/api', activeFeaturedRoutes); // platform-level + admin routes
app.use('/api/public/tenants/:tenantId', activeFeaturedPublicRouter); // public tenant-scoped route
```

Then update the frontend service to call `/api/public/tenants/:tenantId/active-featured` instead of `/api/tenants/:tenantId/active-featured`.

**Existing examples of this pattern**: `faq-public.ts` mounted at `/api/public/tenants/:tenantId`, `storefront-policies` at `/api/public/storefront-policies/:tenantId`, `bot` public routes at `/api/public/bot/*`, `tenant-tier.ts` public tier endpoint at `/api/public/tenants/:tenantId/tier`.

### Pattern 5: `/public` suffix anti-pattern — route path suffix instead of URL prefix

A route handler is defined with a `/public` suffix at the end of the path (e.g. `router.get('/tenants/:id/tier/public', ...)`), giving the false impression that it's a public endpoint. However, the route is still mounted under `/api` (resolving to `/api/tenants/:id/tier/public`), so it's caught by the same blanket `authenticateToken` middleware as Pattern 4.

**Why this is an anti-pattern:** The `/public` suffix is on the **route handler path**, not the **mount path**. Express middleware runs based on the mount path, not the route handler's path suffix. A `/public` suffix provides zero auth isolation — it's purely cosmetic. The authoritative auth scope indicator is the URL **prefix** (`/api/public/` vs `/api/tenants/`), not a suffix on the route path.

**Triggering incident:** `GET /api/tenants/tid-jcvzufq2/tier/public` returned `401 authentication_required` on a public storefront page. The route handler in `tenant-tier.ts` had no `authenticateToken`, but the route was mounted at `/api` with `authLevel: 'tenant'` in `routeRegistry.ts`. The path `/api/tenants/:id/tier/public` matched blanket auth on `/api/tenants`. Fix: extracted the handler into a `publicTenantRouter` with `mergeParams: true`, mounted at `/api/public/tenants/:tenantId` with `authLevel: 'public'`. Frontend updated from `/api/tenants/${tenantId}/tier/public` to `/api/public/tenants/${tenantId}/tier`.

**Fix**: Same as Pattern 4 — move to `/api/public/tenants/:tenantId/*` and drop the `/public` suffix from the route path. The URL prefix IS the auth scope; a suffix is meaningless.

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

6. **Check for backend route conflicts** — If the frontend service is correct (extends `PublicApiSingleton`, calls a public URL) but `curl` with no cookies still returns `401 authentication_required`, the problem is on the backend. Check two places:
   - `index.ts` — search for `app.use('/api/tenants', authenticateToken, ...)`
   - `routeRegistry.ts` — search for entries with `path: '/api/tenants'` or `path: '/api'` + `authLevel: 'tenant'` whose router defines routes starting with `/tenants/`
   Any of these applies `authenticateToken` to ALL `/api/tenants/*` paths, even public routes defined elsewhere. Also check for `/public` suffix routes (Pattern 5) — a route like `/tenants/:id/tier/public` is NOT public just because of the suffix. See **Pattern 4** and **Pattern 5** for the fix.

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
| `apps/api/src/index.ts` | Main API entry — mounts all routers; blanket `authenticateToken` on `/api/tenants` lives here |
| `apps/api/src/routes/routeRegistry.ts` | Route registry — `authLevel` field applies blanket auth per mount; check for `authLevel: 'tenant'` entries whose paths match `/api/tenants` |
| `apps/api/src/routes/tenant-tier.ts` | Public tier endpoint — extracted to `publicTenantRouter` with `mergeParams` (fixed, Pattern 5 triggering incident) |
| `apps/api/src/routes/active-featured.ts` | Public tenant-scoped route using `publicTenantRouter` with `mergeParams` (fixed) |
| `apps/api/src/routes/faq-public.ts` | Existing example of the `/api/public/tenants/:tenantId` pattern |
| `apps/web/src/services/ActiveFeaturedService.ts` | Frontend service — extends `PublicApiSingleton`, calls `/api/public/tenants/:tenantId/active-featured` |

---

## Prevention Rules

1. **Never call scoped hooks from globally-rendered components.** If a component is in `ClientRootLayout.tsx`, it must not call `useNavLinks()`, `useAuth()` with admin API calls, or any service that hits `/api/admin/*` or `/api/tenants/*` directly.

2. **Split global components into wrapper + inner.** The wrapper checks auth + pathname context. The inner component (which calls scoped hooks) only mounts when appropriate.

3. **Always wrap pathname-derived booleans in `Boolean(...)`.** This prevents `undefined` from destabilizing React dependency arrays.

4. **Public pages should only call `/api/public/*` endpoints.** No exceptions. If a public page needs data that's behind an admin/tenant endpoint, create a public proxy endpoint at `/api/public/tenants/:tenantId/*` using a `mergeParams` router.

5. **Never mount public routes under `/api/tenants`.** The `/api/tenants` path has blanket `authenticateToken` middleware from `trialSetupRoutes`, `tenantNotificationsRoutes`, and other routers. Public tenant-scoped endpoints must be mounted at `/api/public/tenants/:tenantId/*` instead. See **Pattern 4** and `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1.

6. **The URL prefix (`/api/public/` vs `/api/tenants/`) is the authoritative indicator of auth scope.** A public route at `/api/tenants/...` is a spec violation regardless of middleware configuration. See `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1.

7. **When adding a new global component**, audit every hook and service call it makes. Trace each one to the API endpoint it hits. If any endpoint is admin/tenant-scoped, add a guard in the wrapper.

8. **When adding a new public tenant-scoped backend route**, always mount it at `/api/public/tenants/:tenantId/*` using a `mergeParams` router. Never define public routes at `/tenants/:tenantId/*` on a router mounted at `/api` — the blanket auth middleware on `/api/tenants` will intercept them. See `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1, FR-2.

9. **Never use a `/public` suffix on a route path as a substitute for the `/api/public/` prefix.** A route like `router.get('/tenants/:id/tier/public', ...)` is NOT public — it resolves to `/api/tenants/:id/tier/public` and is caught by blanket auth on `/api/tenants`. The URL **prefix** (`/api/public/`) is the only authoritative auth scope indicator. See **Pattern 5** and `docs/AUTH_SCOPE_ISOLATION_SPEC.md` NFR-4.

10. **When checking for auth leaks, search both `index.ts` and `routeRegistry.ts`.** The route registry's `authLevel: 'tenant'` on an entry mounted at `/api` whose router defines `/tenants/...` routes is just as lethal as `app.use('/api/tenants', authenticateToken, ...)` in `index.ts`. The `mountFromRegistry()` function processes `middleware` arrays on registry entries, so any entry with `middleware: [authenticateToken]` at path `/api/tenants` applies auth to ALL sub-paths.

---

## Verification

After applying a fix:

1. Open a public product page (e.g. `/products/pid-xxx`) in the browser
2. Open DevTools Network tab
3. Filter for `admin` or `tenants`
4. Confirm no admin/tenant-scoped requests fire
5. Navigate to a tenant page (e.g. `/t/[tenantId]/dashboard`) and confirm the admin requests DO fire there
6. Check console for "changed size between renders" errors — should be gone
