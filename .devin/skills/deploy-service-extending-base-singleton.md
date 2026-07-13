---
description: How to deploy a new service that extends a domain base singleton class in the web or API layer
---

# Deploy a Service Extending a Base Singleton

## Overview

The platform has a **two-tier singleton infrastructure** — one in `apps/web` (client-side API request services) and one in `apps/api` (server-side data services).  Most new services do **not** extend the root `UniversalSingleton` directly.  Instead they extend a **domain base class** that sets the correct `RequestType`, `RequestTarget`, `AppContext`, `CacheIsolation`, TTL, and authentication headers for that domain.

This skill shows the exact class hierarchy, the defaults each domain base injects, and the minimal boilerplate required to deploy a concrete service in each domain.

---

## 1. Frontend (Web) Hierarchy

```
UniversalSingleton
└── EnhancedFlexibleApiSingleton
    └── FlexibleApiSingleton
        ├── PublicApiSingleton
        ├── AuthenticatedApiSingleton
        ├── TenantApiSingleton
        │   └── OrganizationApiSingleton
        ├── CustomerApiSingleton
        ├── AdminApiSingleton
        ├── ApiSystemSingleton
        ├── SystemSingleton
        └── ExternalApiSingleton
```

**Files**
- Root base: `apps/web/src/providers/base/UniversalSingleton.ts`
- API engine: `apps/web/src/providers/base/FlexibleApiSingleton.ts`
- Domain bases: `apps/web/src/providers/base/{Public,Authenticated,Tenant,Customer,Admin,Api,System,External}ApiSingleton.ts`
- Organization override: `apps/web/src/providers/base/OrganizationApiSingleton.ts`

### 1.1 Domain bases at a glance

| Domain base | `defaultRequestType` | `defaultRequestTarget` | `defaultContext` / `Isolation` | Default TTL | Credentials | Special behaviour |
|---|---|---|---|---|---|---|
| `PublicApiSingleton` | `PUBLIC` | `API` | `PUBLIC` / `PUBLIC` | 15 min | `false` (no auth cookies) | Slug→ID resolver, `resolveIdentifier()` |
| `AuthenticatedApiSingleton` | `AUTHENTICATED` | `API` | `USER` / `USER` | 5 min | `true` (Auth0 cookies) | `clearAuthCache()`, health-check |
| `TenantApiSingleton` | `TENANT` | `API` | `TENANT` / `TENANT` | 10 min | `true` | **Cache contract** (`getServiceCachePatterns`, `invalidateServiceCaches`), `X-Tenant-ID` header, cross-service invalidation |
| `CustomerApiSingleton` | `CUSTOMER` | `API` | `CUSTOMER` / `CUSTOMER` | 10 min | JWT via `localStorage` | `customer_identity_cache` in `localStorage`, `X-Customer-ID` header |
| `AdminApiSingleton` | `ADMIN` | `API` | `ADMIN` / `ADMIN` | 5 min | `true` | Audit-ID generation, `X-Admin-Roles`, `X-Audit-ID` headers |
| `ApiSystemSingleton` | `SYSTEM` | `API` | `SYSTEM` / `SYSTEM` | 10 min | `true` | `makeSystemRequestWithDefaults`, `makeTrustedSystemRequest`, `makeSystemToAdminRequest` |
| `SystemSingleton` | `SYSTEM` | `WEB` | `SYSTEM` / `SYSTEM` | 15 min | `true` | `makeWebRequest` (port 3000), `makeApiRequest` (port 4000) |
| `ExternalApiSingleton` | `EXTERNAL` | `EXTERNAL` | n/a | 15 min | `false` | `batchExternalRequest`, `healthCheck`, timeout/abort support |
| `OrganizationApiSingleton` | `TENANT` | `API` | inherited | 10 min | `true` | Authorization-group validation, platform-role hierarchy, `makeOrganizationValidatedRequest` |

### 1.2 How to deploy a frontend singleton service

**Step 1 — Choose the domain base**
Pick the base whose `defaultRequestType` matches the primary audience of the endpoint you will call.  If you need organization-scoped validation, use `OrganizationApiSingleton` (it extends `TenantApiSingleton`).

**Step 2 — Implement the singleton pattern**
Every concrete service **must**:
1. Declare a `private static instance`.
2. Make the constructor `private`.
3. Provide `public static getInstance()`.
4. Call `super('unique-singleton-key', { ttl: … })`.

**Step 3 — Override defaults only when necessary**
You can override `protected defaultContext`, `protected defaultIsolation`, and `protected cacheTTL` if the service calls endpoints that belong to a different context (e.g. a storefront service that reads product data may set `defaultContext = AppContext.PRODUCT`).

**Step 4 — Implement the cache contract (Tenant & Organization only)**
`TenantApiSingleton` and `OrganizationApiSingleton` force you to implement:
```ts
public abstract getServiceCachePatterns(): string[];
public abstract invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void>;
```

**Step 5 — Use `makeDefaultRequest` for every API call**
`makeDefaultRequest<T>(url, options?, cacheKey?, ttl?, requestOptions?)` automatically:
- Selects the correct request type from `defaultRequestType`.
- Adds the correct auth headers (Auth0 cookies, JWT, tenant-id, etc.).
- Generates a context-aware cache key if you pass `{ context, isolation }` in `requestOptions`.
- Handles 204, blob/text/stream responses, and structured error parsing.

**Example — Storefront service (Public domain)**
```@apps/web/src/services/StorefrontSingletonService.ts:88-105
class StorefrontSingletonService extends PublicApiSingleton {
  protected defaultContext = AppContext.STORE;
  protected defaultIsolation = CacheIsolation.STORE;
  private static instance: StorefrontSingletonService;

  private constructor() {
    super('storefront-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): StorefrontSingletonService {
    if (!StorefrontSingletonService.instance) {
      StorefrontSingletonService.instance = new StorefrontSingletonService();
    }
    return StorefrontSingletonService.instance;
  }

  async getStorefrontCategories(tenantId: string) {
    const result = await this.makeDefaultRequest<…>(
      `/api/storefront/${tenantId}/categories`,
      {},
      `storefront-categories-${tenantId}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation }
    );
    return result.data ?? { categories: [], uncategorizedCount: 0 };
  }
}
```

**Example — Tenant directory service (Tenant domain)**
```@apps/web/src/services/TenantDirectorySingletonService.ts:58-78
class TenantDirectorySingletonService extends TenantApiSingleton {
  public getServiceCachePatterns(): string[] { return ['tenant-slug-*', 'directory-listing-*']; }
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`tenant-slug-${tenantId}`);
      this.invalidateCache(`directory-listing-${tenantId}`);
    }
  }
  private static instance: TenantDirectorySingletonService;
  private constructor() {
    super('tenant-directory-singleton', { ttl: 10 * 60 * 1000 });
  }
  public static getInstance() { … }
}
```

### 1.3 Response unwrapping contract — the #1 pitfall

**The bug that triggered this section:** Tenant dashboard displayed "Unknown dashboard" instead of the real tenant name. Root cause: double-wrapping of API responses.

#### How the wrapping works

1. **Backend `handleSuccess`** (in `BaseController`) sends:
   ```json
   { "success": true, "data": <actualObject> }
   ```

2. **`makeDefaultRequest`** on the frontend parses the HTTP response body as JSON and wraps it again:
   ```ts
   return { success: true, data: <parsed JSON body> }
   // i.e. { success: true, data: { success: true, data: <actualObject> } }
   ```

3. **Your service method** returns `result.data` — which is `{ success: true, data: <actualObject> }`, **not** `<actualObject>`.

#### The correct unwrapping pattern

When the backend endpoint uses `handleSuccess` (which wraps in `{ success: true, data: ... }`), your service must unwrap **two levels**:

```ts
// CORRECT — handles both wrapped and unwrapped responses
const result = await this.makeDefaultRequest<any>('/api/tenants/${tenantId}', ...);
if (!result.success) throw new Error(...);

const responseData = result.data;
return responseData?.data || responseData;
//                     ^^^^^^^^^^^^^^^   ^^^^^^^^^^^^
//                     unwrap inner      fallback if API doesn't wrap
```

The `responseData?.data || responseData` pattern is backward-compatible: if the API ever stops wrapping (e.g., a raw Prisma object returned directly), it still works.

#### The WRONG pattern (causes the bug)

```ts
// WRONG — returns { success: true, data: <actualObject> } instead of <actualObject>
return result.data;
```

Callers that access `result.data.name` get `undefined` because `result.data` is the wrapper, not the tenant object. The name is at `result.data.data.name`.

#### How to tell if an endpoint wraps

| Backend pattern | Response shape | Unwrapping needed |
|---|---|---|
| `this.handleSuccess(res, obj)` | `{ success: true, data: obj }` | Yes — `result.data.data` |
| `res.json(obj)` (raw) | `obj` directly | No — `result.data` is `obj` |
| `res.json({ success: true, data: obj })` (manual) | `{ success: true, data: obj }` | Yes — `result.data.data` |

**Rule of thumb:** If the backend controller extends `BaseController` and calls `handleSuccess`, you need double-unwrap. If it calls `res.json()` directly with the raw object, single-unwrap (`result.data`) is correct.

#### Incident report: "Unknown dashboard" (2025-07)

**Symptom:** `TenantDashboardV2.tsx` displayed "Unknown dashboard" despite the API returning the correct tenant name.

**Data flow:**
```
API endpoint GET /api/tenants/:id
  → tenantController.getTenant → handleSuccess(res, tenant)
  → HTTP body: { success: true, data: { id, name, ... } }

Frontend makeDefaultRequest
  → returns { success: true, data: { success: true, data: { id, name, ... } } }

TenantInfoService.getTenantDataWithCacheBusting
  → return result.data  ← BUG: returns the wrapper, not the tenant

useTenantComplete hook
  → rawProfile = tenantData.tenant = { success: true, data: { id, name, ... } }
  → rawProfile.name = undefined  ← name is at rawProfile.data.name
  → fallback: 'Unknown'
```

**Fix:** Changed `return result.data` to `const responseData = result.data; return responseData?.data || responseData;` in both `getTenantInfo` and `getTenantDataWithCacheBusting`.

**Affected callers:** Every component accessing `.name`, `.slug`, `.metadata`, `.subdomain` on the return value of `getTenantInfo` / `getTenantDataWithCacheBusting` — including `useTenantComplete`, `ChangeLocationStatusModal`, `useAccessControl`, `useAppNavigation`, `TenantScopeHeader`, `OrgTeamOverview`, and several settings pages.

**Key lesson:** When tracing "data is undefined" bugs, check whether the service method unwraps the API's `{ success: true, data: ... }` envelope. The `makeDefaultRequest` return value has **two** levels of wrapping when the backend uses `handleSuccess`.

---

## 2. Backend (API) Hierarchy

```
UniversalSingleton        (apps/api/src/lib/UniversalSingleton.ts)
├── BasePermissionService (extends UniversalSingleton)
├── TenantSingletonService
├── InventorySingletonService
├── SlugSingletonService
├── … (other *SingletonService classes)

BaseService               (apps/api/src/services/BaseService.ts)
├── CrmTicketService
├── AnalyticsService
├── … (other stateless data services)

PermissionEnhancedBaseService  (apps/api/src/services/permissions/PermissionEnhancedBaseService.ts)
└── (mix-in or direct extend for capability-gated services)

BaseDiscoveryService      (apps/api/src/services/BaseDiscoveryService.ts)
```

### 2.1 Server-side `UniversalSingleton`

Located at `apps/api/src/lib/UniversalSingleton.ts`.  Provides:
- In-memory + persistent cache (`getFromCache`, `setCache`, `clearCache`).
- Metrics (`cacheHits`, `cacheMisses`, `cacheHitRate`, `apiCalls`, `errors`).
- Auth context (`setAuthContext`, `hasRole`, `hasPermission`).
- Encryption helpers (`encrypt`, `decrypt`).
- Private cache for sensitive data.
- Request helpers (`makeAuthenticatedRequest`, `makePublicRequest`, `makeAdminRequest`, `makeBypassRequest`, `makeCachedRequest`).
- Retry with exponential backoff.
- Tenant auto-ID generation (`generateTenantAutoId`).

**Concrete API singletons** (e.g. `TenantSingletonService`, `InventorySingletonService`) extend this class directly and implement `static getInstance()`.

### 2.2 `BaseService`

Located at `apps/api/src/services/BaseService.ts`.  A lightweight non-singleton base for stateless Prisma-backed services.  Provides:
- `protected prisma = prisma`
- `protected logger = logger`
- `handleError()`, `logOperation()`, `validateRequired()`, `executeQuery()`, `paginate()`

Use this when you do **not** need caching or metrics, only CRUD + query helpers.

### 2.3 `PermissionEnhancedBaseService`

Located at `apps/api/src/services/permissions/PermissionEnhancedBaseService.ts`.  A mixin-style base that wraps `PermissionServiceFactory`.  Provides:
- `requireFeature(tenantId, feature)` / `checkFeature(tenantId, feature)`
- `requireLimit(tenantId, limitType, required)` / `checkLimit(tenantId, limitType, required)`
- `requireAccess(tenantId, resource, action)`
- `requireAdminFeature(userId, feature)`, `requirePlatformAdmin(userId)`, `requireTenantManagement(userId, tenantId)`
- Convenience: `canAddProducts`, `canAddLocations`, `canAddUsers`, `getLimitStatuses`, `getFeatures`, `invalidatePermissionCache`

**Usage pattern:** extend `BaseService` **and** `PermissionEnhancedBaseService` (or extend `PermissionEnhancedBaseService` directly if you do not need `BaseService` helpers).  Pass `serviceName` to the constructor.

### 2.4 `BasePermissionService`

Located at `apps/api/src/services/permissions/BasePermissionService.ts`.  Extends `UniversalSingleton` and adds:
- Abstract methods: `hasFeature`, `getLimit`, `canAccess`, `getFeaturePermission`, `getLimitPermission`
- Override-first logic (`applyOverrideLogic`): `override > tier > default`
- Redis-backed caching with tenant-isolated keys (`perm:{tenantId}:{type}:{key}`)
- Batch get/set, tenant cache invalidation

This is the base for **permission context implementations** (`TenantPermissionContext`, `AdminPermissionContext`, `PublicPermissionContext`), not for business services.

### 2.5 How to deploy a backend singleton service

**Step 1 — Decide if you need caching/metrics**
- **Yes** → extend `UniversalSingleton` directly.
- **No, just Prisma + logger** → extend `BaseService`.
- **Yes + capability gates** → extend `UniversalSingleton` and compose `PermissionEnhancedBaseService`, or extend `PermissionEnhancedBaseService` directly.

**Step 2 — Implement the singleton pattern**
Same rule as frontend: `private static instance`, `private constructor`, `public static getInstance()`.

**Step 3 — Pass a singleton key and cache options to `super()`**
```ts
constructor() {
  super('my-service', {
    defaultTTL: 300,        // seconds
    maxCacheSize: 1000,
    enableMetrics: true,
    enableLogging: true,
    authenticationLevel: 'authenticated'
  });
}
```

**Step 4 — Cache read/write pattern**
```ts
async getSomething(id: string) {
  const key = `something:${id}`;
  const cached = await this.getFromCache<…>(key);
  if (cached) { this.metrics.cacheHits++; return cached; }

  const data = await basePrisma.something.findUnique({ where: { id } });
  await this.setCache(key, data, { ttl: 300 });
  this.metrics.cacheMisses++;
  return data;
}
```

**Example — API singleton (Tenant domain)**
```@apps/api/src/services/TenantSingletonService.ts:80-90
class TenantSingletonService extends UniversalSingleton {
  static instance: any;
  getInstance(): TenantSingletonService { … }
  constructor() {
    super('TenantSingletonService', {
      enableCache: true, defaultTTL: 300, maxCacheSize: 1000,
      enableMetrics: true, enableLogging: true
    });
  }
  async getTenantInfo(tenantId: string) { … }
}
```

**Example — Stateless CRUD service**
```@apps/api/src/services/CrmTicketService.ts:1-18
import { BaseService } from './BaseService';
export class CrmTicketService extends BaseService {
  private static instance: CrmTicketService;
  private constructor() { super(); }
  static getInstance(): CrmTicketService { … }
  async listByTenant(tenantId: string, filters = {}) { … }
}
```

---

## 3. Cross-cutting rules

1. **Never instantiate a singleton with `new` outside its own class.**  Always consume it via `MyService.getInstance()`.
2. **Never call `fetch` directly.**  On the web, use `makeDefaultRequest` (or the typed helpers `makePublicRequest`, `makeTenantRequest`, etc.).  On the API, use `makeAuthenticatedRequest` / `makePublicRequest` from `UniversalSingleton`.
3. **Cache invalidation is the service’s responsibility.**  After a mutation (POST/PUT/PATCH/DELETE), call `this.invalidateCache(key)` or implement `invalidateServiceCaches` for tenant-scoped services.
4. **Context/isolation are not optional for tenant services.**  The `TenantApiSingleton` cache contract exists so the platform can evict caches automatically when data changes.
5. **SSR safety:**  Frontend singletons must guard `localStorage` / `window` access with `typeof window !== 'undefined'`.  The base classes already do this for auth headers, but service-specific localStorage reads need manual guards.
6. **Backend route mounting for public endpoints:**  Public tenant-scoped routes must be mounted at `/api/public/tenants/:tenantId/*` using a `mergeParams` router — **never** at `/api/tenants/:tenantId/*`.  The `/api/tenants` path has blanket `authenticateToken` middleware (from `trialSetupRoutes`, `tenantNotificationsRoutes`, etc.) that intercepts ALL routes under `/api/tenants/*`, even public ones.  See `troubleshooting-public-page-api-leaks.md` Pattern 4 and `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1 for details.

7. **URL prefix determines auth scope.**  A `PublicApiSingleton` service MUST call `/api/public/...` endpoints.  A `TenantApiSingleton` service MUST call `/api/tenants/...` endpoints.  The URL prefix is the authoritative indicator of auth scope — see `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1.

8. **Dual-scope pattern.**  When a route serves both public and private consumers (e.g., `effective-capabilities`), create two endpoints: a public summary at `/api/public/tenants/:tenantId/*` (no auth, `detail=full` ignored) and a private full-detail endpoint at `/api/tenants/:tenantId/*` (auth required, `?detail=full` returns raw gates).  Two approaches:
    - **Two-service pattern** (default for new capabilities): The `PublicApiSingleton` service calls the public endpoint; a separate `TenantApiSingleton` service calls the private endpoint.
    - **Single-service dual-scope pattern** (when one service already serves both audiences, e.g., `UnifiedCapabilityService`): Extend `TenantApiSingleton` (authenticated by default) and accept an optional `{ isPublic?: boolean; ssrAuth?: SsrAuth }` options parameter on each method. When `isPublic: true`, call `makePublicRequest` → `/api/public/tenants/...`. When not set (default), call `makeDefaultRequest` with `RequestType.AUTHENTICATED` → `/api/tenants/...`. When `ssrAuth` is provided, pass explicit Auth0 headers for SSR. Use separate cache keys (`-public` / `-auth` suffix) to prevent cross-scope cache contamination. Public callers pass `{ isPublic: true }`; private callers omit the option. See `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-2 for the dual-scope pattern.

### 3.1 Backend route pattern for public tenant-scoped endpoints

When a frontend service extends `PublicApiSingleton` and calls a tenant-scoped endpoint, the backend route **must** be mounted at `/api/public/tenants/:tenantId/*`:

```ts
// route-file.ts
const publicTenantRouter = express.Router({ mergeParams: true });

publicTenantRouter.get('/my-endpoint', async (req: express.Request<{ tenantId: string }>, res) => {
  const { tenantId } = req.params;
  // ... handler
});

export { publicTenantRouter };
export default router; // main router for platform-level + admin routes

// index.ts
import myRoutes, { publicTenantRouter as myPublicRouter } from './routes/route-file';
app.use('/api', myRoutes);                        // platform-level + admin routes
app.use('/api/public/tenants/:tenantId', myPublicRouter); // public tenant-scoped route
```

**Existing examples**: `faq-public.ts` at `/api/public/tenants/:tenantId`, `active-featured.ts` at `/api/public/tenants/:tenantId`, `storefront-policies` at `/api/public/storefront-policies/:tenantId`, `bot` public routes at `/api/public/bot/*`.

---

## 4. Quick reference — which base for which use-case?

| Use-case | Web base | API base |
|---|---|---|
| Public-facing storefront data | `PublicApiSingleton` | `BaseService` or `UniversalSingleton` |
| User-specific authenticated pages | `AuthenticatedApiSingleton` | `BaseService` |
| Tenant admin dashboard | `TenantApiSingleton` | `BaseService` / `UniversalSingleton` |
| Multi-tenant org operations | `OrganizationApiSingleton` | `BaseService` |
| Admin platform panel | `AdminApiSingleton` | `BaseService` |
| Background / cron / system jobs | `ApiSystemSingleton` | `UniversalSingleton` |
| Third-party API wrapper (Google, weather, etc.) | `ExternalApiSingleton` | N/A |
| Capability-gated feature | `TenantApiSingleton` + client-side tier check | `PermissionEnhancedBaseService` |
| Dual-scope (public summary + private full) | `PublicApiSingleton` + `TenantApiSingleton` (two services) OR `TenantApiSingleton` with `isPublic` option (single service, e.g., `UnifiedCapabilityService`) | `BaseService` / `UniversalSingleton` |
