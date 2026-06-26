---
description: Single source of truth resolver that eliminates redundant auth/tenant resolution across server and client by passing server-resolved state to client components via a provider
---

# Server-Resolved Context Delegator

## Problem

Five independent actors resolve the same auth/session/tenant state through different mechanisms. They can disagree, causing redirect loops, duplicate API calls, and render thrash:

| Actor | Resolves | How | Runs |
|---|---|---|---|
| `proxy.ts` | Auth + tenant cookie | `auth0.middleware()` + `auth0.getSession()` | Every request |
| Server `layout.tsx` | Auth + tenant info | `auth0.getSession()` + `tenantInfoService.getTenantInfo()` | Every server render |
| Client `AuthContext` | Auth user | `securitySingletonService.getSessionInfo()` → API call | On mount + protected page nav |
| Client `TenantAuthGate` | Auth check | Reads `useAuth()` | Every render |
| Client `useTenantComplete` | Auth user + tenant data | `useAuth()` + multiple `useQuery` calls | Every render |

The server layout already resolves auth and tenant info correctly but **discards the result** — it only passes `tenantId`/`slug` to `TenantContextProvider`. The client then independently re-resolves everything, and the two resolvers can disagree (e.g., server sees httpOnly session cookie, client's `document.cookie` check fails).

## Solution: Server-Resolved Context Provider

A client component that receives the server's resolved auth + tenant state as props and provides it via React context. All client actors read from this single source of truth instead of independently resolving.

### Data Flow

```
Request → proxy.ts (sets tcx cookie, Auth0 middleware)
         ↓
    Server layout.tsx
         ↓ resolve once:
         ├── auth0.getSession() → { user, email, sub }
         ├── getTenantContext() → { tenantId, slug, aud }
         └── tenantInfoService.getTenantInfo() → { name, tier, status, ... }
         ↓
    ServerResolvedContextProvider (client component, receives all resolved state)
         ↓
    ┌────────────────────────────────────────────────────┐
    │  ServerResolvedContext (React context)             │
    │                                                    │
    │  Consumers:                                        │
    │  ├── AuthContext → initializes user from server    │
    │  │                  state, skips API call on init  │
    │  ├── TenantAuthGate → trusts server auth, no       │
    │  │                    redirect if server confirmed │
    │  ├── useTenantComplete → uses server tenant info   │
    │  │                      for initial cache seed     │
    │  └── Any future hook → reads from context          │
    └────────────────────────────────────────────────────┘
```

### What This Eliminates

1. **Client `fetchUser()` on initial load** — server already resolved auth, no API call needed
2. **`TenantAuthGate` redirect logic on server-confirmed pages** — server already confirmed auth, gate is a no-op
3. **`document.cookie` guard in `AuthContext`** — no longer needed for protected pages since server provides state
4. **Double API calls** — server layout's `getTenantInfo` result seeds client cache, `useTenantComplete` skips refetch
5. **Resolver disagreements** — single source of truth, no possibility of server/client divergence

## Phased Implementation Plan

### Phase 1: Foundation (this session)

**Goal**: Create the provider, wire it into the tenant layout, and make `AuthContext` + `TenantAuthGate` consume it.

**Files**:
- `apps/web/src/components/tenant/ServerResolvedContextProvider.tsx` (NEW)
- `apps/web/src/app/t/[tenantId]/layout.tsx` (modify — resolve once, pass to provider)
- `apps/web/src/contexts/AuthContext.tsx` (modify — initialize from server state)
- `apps/web/src/components/tenant/TenantAuthGate.tsx` (modify — trust server auth)

**Changes**:
1. Create `ServerResolvedContextProvider` — a client component with React context
2. Server layout resolves auth + tenant info in parallel (`Promise.all`), passes to provider
3. `AuthContext` reads `useServerResolved()` for initial user state — skips `fetchUser()` if server provided
4. `TenantAuthGate` checks `useServerResolved().isAuthenticated` first — returns children immediately if true

### Phase 2: Tenant Data Seeding (next session)

**Goal**: Use server-resolved tenant info to seed React Query cache, eliminating the initial `GET /api/tenants/:id` call from `useTenantComplete`.

**Files**:
- `apps/web/src/hooks/dashboard/useTenantComplete.ts` (modify — seed query cache)
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx` (modify — pass server tenant info)

**Changes**:
1. `ServerResolvedContextProvider` includes `tenantInfo` from server layout's `tenantInfoService.getTenantInfo()` call
2. `useTenantComplete` calls `queryClient.setQueryData(['tenant', 'info', tenantId], serverTenantInfo)` on mount
3. React Query returns cached data instantly — no network call on initial load

### Phase 3: Full Migration (future)

**Goal**: Extend the pattern to all protected layouts (`/admin/*`, `/settings/*`, `/dashboard/*`).

**Files**:
- `apps/web/src/app/(platform)/layout.tsx` or equivalent
- `apps/web/src/app/admin/layout.tsx` or equivalent
- All route guards and auth gates

**Changes**:
1. Each protected server layout resolves auth once and wraps children in `ServerResolvedContextProvider`
2. `AuthContext` becomes a pure consumer of server-resolved state with fallback to API for SPA navigations
3. `proxy.ts` can set a header with resolved auth state for edge cases

## Architecture Decisions

### Why not middleware-level resolution?

Next.js middleware (`proxy.ts`) runs on every request but can't pass React context to components. It can set headers/cookies, but those are strings — not typed objects. Server components can read headers, but client components would need to re-parse them.

**Decision**: Resolve in server layout (which has access to `auth0.getSession()` and can make API calls) and pass as typed props to a client provider.

### Why not a single API endpoint?

A `/api/context/resolve` endpoint that returns `{ user, tenant, tier, ... }` in one call would reduce client-side API calls, but:
- Server layout still needs to resolve auth for redirect decisions before the page renders
- Client would still need to call the endpoint on mount
- Can't provide instant state on first render (causes loading flash)

**Decision**: Server layout resolves everything, client receives it as props. No client API call needed on initial load.

### Fallback for SPA navigations

When the user navigates between protected pages without a full page reload (client-side navigation), the server layout runs again (Next.js App Router server components), so `ServerResolvedContextProvider` receives fresh state. If for some reason the server state is stale, `AuthContext` falls back to its existing `fetchUser()` API call.

### Type Safety

The `ServerResolvedState` interface is defined once and shared between server and client. Server layout constructs it, client components consume it. TypeScript ensures field names match.

## Key Principles

1. **Server is the source of truth** — Auth0 session is httpOnly, only the server can read it reliably
2. **Resolve once, consume everywhere** — Don't re-resolve what the server already knows
3. **Client falls back, doesn't lead** — Client `AuthContext` uses server state first, API call is fallback
4. **Typed context, not headers** — React context with TypeScript interfaces, not string headers
5. **Parallel resolution** — `Promise.all([getSession(), getTenantContext(), getTenantInfo()])` to minimize server render time

## Verification

After Phase 1:
- Navigate to `/t/{tenantId}/dashboard` — page loads once, no flashing
- Network tab: no `GET /api/auth/me` call on initial load (server provided auth state)
- Console: no `[TenantAuthGate] redirecting to login` messages
- `AuthContext.isLoading` is `false` on first render (server provided user)

After Phase 2:
- Network tab: no `GET /api/tenants/{tenantId}` call on initial load (server provided tenant info)
- Dashboard renders instantly with server-provided data, React Query refetches in background

## Related Skills

- `fix-auth0-redirect-loop.md` — The bug that motivated this architecture
- `debug-infinite-render-loops.md` — General render loop debugging
- `dashboard-performance-audit.md` — Dashboard API call optimization
