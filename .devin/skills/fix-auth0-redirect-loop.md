---
description: Fix Auth0 redirect loop on protected pages where the dashboard flashes and reloads every ~2 seconds due to httpOnly session cookie being invisible to client-side auth checks
---

# Fix Auth0 Redirect Loop on Protected Pages

Use this skill when the tenant dashboard (or any protected page under `/t/*`, `/admin/*`, `/settings/*`) exhibits an extreme render loop: the page flashes, reloads continuously, and the network tab shows repeated full-page navigations to the same URL every ~2 seconds.

## Symptom Signature

- **Full-page navigation loop** (not just client-side re-renders) — browser URL bar flickers
- **Interval**: ~2 seconds per cycle (distinguishes from React Query `refetchInterval` which is 30s+)
- **Network tab**: Same page URL requested repeatedly with HTTP 200 responses
- **Server logs**: `[Proxy] Auth0 handled request: /t/{tenantId}/dashboard Status: 200` repeated every ~2s
- **Console**: `[TenantAuthGate] redirecting to login` followed by immediate return to the same page
- **No `setInterval` or `refetchInterval`** matching the ~2s cadence

## Root Cause Pattern

The loop is a **redirect bounce** between client-side auth gates and Auth0's middleware:

1. Browser loads a protected page (e.g., `/t/{tenantId}/dashboard`)
2. Server layout confirms Auth0 session exists via `auth0.getSession()` — renders the page
3. Client `AuthContext.fetchUser()` checks `document.cookie` for non-httpOnly Auth0 cookies (`auth0_email`, `auth0_id`, `auth0.`)
4. Auth0's actual session cookie (`appSession` or `auth0-session`) is **httpOnly** — invisible to `document.cookie`
5. `fetchUser()` sees no auth cookies → **skips the API session check entirely** → sets `user=null`, `isAuthenticated=false`
6. `TenantAuthGate` (or any component using `useAuth()`) sees unauthenticated → calls `router.push('/auth/login?returnTo=...')`
7. Auth0 middleware sees valid session → redirects back to the original page
8. Full page reload → repeat indefinitely

### Key Insight

The `document.cookie` check was added to prevent 401 errors on public pages (where no auth cookies exist). But it was applied to **all** contexts, including protected pages where the Auth0 session cookie is httpOnly and cannot be read by JavaScript. On protected pages, the only way to verify authentication is to call the session API endpoint (`/api/auth/me` or equivalent), which sends the httpOnly cookie automatically.

## Diagnosis Steps

### 1. Confirm it's a full-page loop, not client-side re-renders

- Open browser DevTools Network tab
- Check if the page URL itself is being requested repeatedly (full navigation) vs. just API calls
- Full-page navigation = redirect loop; API-only = React Query or useEffect issue

### 2. Check for the cookie guard in AuthContext

```bash
grep -n "hasAuthCookies" apps/web/src/contexts/AuthContext.tsx
```

If the guard skips the API call when no non-httpOnly cookies are found, and this applies to protected routes, that's the bug.

### 3. Verify the Auth0 session cookie is httpOnly

```bash
grep -rn "httpOnly\|http_only" apps/web/src/lib/auth0* apps/web/src/proxy.ts
```

Auth0 SDK sets `appSession` as httpOnly by default. `document.cookie` will never see it.

### 4. Check TenantAuthGate redirect logic

```bash
grep -n "router.push.*login" apps/web/src/components/tenant/TenantAuthGate.tsx
```

The gate should have a `useRef` guard (`hasRedirectedRef`) to prevent multiple redirects, but the root cause is upstream — `useAuth()` returning `isAuthenticated=false` despite a valid session.

## Fix

### Primary Fix: AuthContext `fetchUser` — bypass cookie guard on protected pages

In `apps/web/src/contexts/AuthContext.tsx`, the `fetchUser` callback has an early return that skips the API session check when no non-httpOnly auth cookies are found. Add a `isProtectedContext` check so the early return only applies to public pages:

```typescript
// BEFORE (broken — skips API check on ALL pages when no non-httpOnly cookies)
if (!hasAuthCookies && !forceRefresh) {
  setUser(null);
  setIsLoading(false);
  return;
}

// AFTER (fixed — only skip on public pages; protected pages always hit the API)
const isProtectedContext = isAdminContext || isTenantContext;
if (!hasAuthCookies && !forceRefresh && !isProtectedContext) {
  setUser(null);
  setIsLoading(false);
  return;
}
```

The `isAdminContext` and `isTenantContext` variables are already computed above the guard — they check `window.location.pathname` for `/admin`, `/t/`, `/dashboard`, `/tenants`, `/settings`, `/onboarding` prefixes.

### Secondary: Remove verbose console.log from hot paths

Render-loop debugging typically leaves behind `console.log` statements in hot render paths. These fire on every render and should be removed or commented out after the fix:

- `TenantAuthGate.tsx` — remove per-render count logging
- `SetTenantId.tsx` — remove per-effect timestamp logging
- `RememberTenantRoute.tsx` — remove per-effect timestamp logging
- `layout.tsx` (server) — remove per-render auth status logging
- `dashboard/page.tsx` (server) — remove per-render tenantId logging

## Verification

1. Navigate to `/t/{tenantId}/dashboard` while authenticated
2. Confirm the page loads once and stays stable (no flashing, no repeated navigations)
3. Open Network tab — verify only one page navigation, not repeated requests
4. Open Console — verify no `[TenantAuthGate] redirecting to login` messages after initial load
5. Verify public pages (e.g., `/`, `/shops`, `/directory`) still skip the auth API call (no unnecessary 401s)

## Files Involved

| File | Role |
|---|---|
| `apps/web/src/contexts/AuthContext.tsx` | **Root cause** — `fetchUser` cookie guard skips API check on protected pages |
| `apps/web/src/components/tenant/TenantAuthGate.tsx` | Redirect trigger — calls `router.push('/auth/login')` when `useAuth()` says unauthenticated |
| `apps/web/src/proxy.ts` | Auth0 middleware — bounces authenticated users back from `/auth/login` to the original page |
| `apps/web/src/app/t/[tenantId]/layout.tsx` | Server layout — confirms session exists, but client-side auth gate overrides |
| `apps/web/src/app/t/[tenantId]/dashboard/page.tsx` | Dashboard page — wraps content in `TenantAuthGate` |

## Related Skills

- `debug-infinite-render-loops.md` — General render loop debugging (covers React Query, useEffect, setInterval causes)
- `dashboard-performance-audit.md` — Dashboard API call deduplication and React Query optimization

## Key Principles

1. **httpOnly cookies are invisible to JavaScript** — `document.cookie` cannot read Auth0's session cookie. Client-side auth checks on protected pages must call the session API.
2. **Cookie guards are for public pages only** — The optimization of skipping auth API calls when no cookies exist should never apply to protected routes.
3. **Distinguish loop types** — Full-page navigation loops (~2s) are redirect bounces; client-side re-render loops (6s+) are auth state changes; API polling (30s+) is React Query intervals.
4. **Check the bounce pattern** — If Auth0 middleware redirects back to the same page the client just redirected away from, the client-side auth check is the problem, not Auth0.
