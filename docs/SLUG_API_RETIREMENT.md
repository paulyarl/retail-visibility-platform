# Slug API Retirement — `/api/slugs`

**Status:** in progress (archive + deprecate). Hard delete pending.
**Opened:** 2026-10-10
**Sunset target:** 2026-12-10

This is the retirement register for the unused `/api/slugs` endpoints and the
home for the related slug write-path findings. Read it before changing anything
under `apps/api/src/routes/slug-generation.ts`.

---

## 1. Why

`apps/api/src/routes/slug-generation.ts` exposes 8 endpoints. A consumer audit
(2026-10-10) found that **only `POST /api/slugs/patterns` has a first-party
caller** (`TenantSlugService.getSlugPatterns` ← `SlugPatternSelector`). The rest
are un-consumed and, for the mutating ones, carry **no tenant authorization**
(`authenticateToken` only — no `checkTenantAccess`), so any authenticated user
could rename any tenant's slug by ID.

Rather than tighten routes nobody calls, they are being **retired**. Because a
caller outside this repo (mobile app, partner integration, script) cannot be
ruled out, the removal is staged: archive → document → test → deprecate → delete.

## 2. Endpoint inventory

| Method | Path | Mutates | First-party consumer | Disposition |
|---|---|---|---|---|
| POST | `/api/slugs/patterns` | no | `SlugPatternSelector` | **Keep** (+ rate limit) |
| POST | `/api/slugs/check-availability` | no | none | **Keep** (+ rate limit) |
| GET | `/api/slugs/tenant/:tenantId` | ~~yes~~ → no | `TenantSlugService.getTenantSlug` (no live caller) | **Keep, made read-only**, deprecated |
| POST | `/api/slugs/generate` | no | none | **Retire** |
| POST | `/api/slugs/generate-with-pattern` | no | none | **Retire** |
| POST | `/api/slugs/slugify` | no | none | **Retire** |
| PUT | `/api/slugs/tenant/:tenantId` | yes | none | **Retire** |
| POST | `/api/slugs/tenant/:tenantId/regenerate` | yes | none | **Retire** |
| DELETE | `/api/slugs/tenant/:tenantId/cache` | cache only | none | **Retire** |

## 3. Risks found

1. **No tenant authorization** on any `/api/slugs` route (`authenticateToken`
   only). `PUT /tenant/:id` and `POST /tenant/:id/regenerate` let any
   authenticated user rename any tenant's slug.
2. **`GET /tenant/:id` wrote on read** — it called `getOrCreateSlug()`, creating
   a slug as a side effect of a GET. Now read-only.
3. **Partial uniqueness** — `SlugSingletonService.updateSlug` checked only
   `directory_settings_list.slug`, not `tenants.slug` / `tenants.subdomain`.
4. **No rate limiting** on any slug route.
5. **Enumeration** — `/patterns` returns taken slugs across all tenants.

## 4. What changed (this pass)

- `routes/archive/slug-generation.retired.ts` — frozen copy of the retiring
  handlers (`registerRetiredSlugRoutes`, never called).
- `middleware/deprecation.ts` — `deprecate({ retiredOn, sunsetOn, replacement, doc })`
  sets `Deprecation: true`, `Sunset`, and `Link: <replacement>; rel="successor-version"`,
  and logs one warning per method+path per process.
- The retiring routes in `routes/slug-generation.ts` are decorated with
  `deprecate(...)` and remain **live and functional** through the window.
- `GET /api/slugs/tenant/:id` is now read-only.
- `POST /patterns` and `POST /check-availability` get `searchRateLimit`.

## 5. Replacement paths

| Retired | Use instead |
|---|---|
| `PUT /slug tenant` · `regenerate` · `cache delete` | `PATCH /api/tenant/profile` (tenant-scoped; now behind `checkTenantAccess`) |
| `POST /generate` · `/generate-with-pattern` · `/slugify` | `POST /api/slugs/patterns` |

## 6. Hard-delete procedure (later pass)

1. Confirm no `[Deprecation]` warnings in production logs for the whole window.
2. Delete the retired registrations from `routes/slug-generation.ts`.
3. Delete `routes/archive/slug-generation.retired.ts`.
4. Regenerate `apps/api/src/generated/route-map.json` and `apps/api/openapi.json`.
5. Tests in `routes/__tests__/slug-generation.retirement.test.ts` assert the
   paths return 404 — they must pass before and after the delete.

## 7. Deferred findings (documented, not fixed)

- **`POST /api/tenants` writes `tenants.slug` directly** (`inline-tenant.ts`),
  bypassing `SlugSingletonService` — so creation does not sync
  `directory_settings_list` / `directory_listings_list`, and has no uniqueness
  handling (relies on the DB `@unique`, surfacing a raw 500 on collision).
  Route creation through the platform-standard service.
- **`PUT /api/tenant/:tenantId/profile`** (`tenant-profile.ts`) has no auth
  middleware, and its tenant check is `if (req.user?.tenantIds && !includes)`
  — skipped entirely when `tenantIds` is unset, i.e. effectively unauthenticated.

## 8. Related: subdomain model

Tenant subdomains now mirror the slug (`subdomain IS NULL OR subdomain = slug`)
and are managed through `lib/subdomain.ts`. See `routes/admin-subdomains.ts`
(platform-admin) and `PUT /api/tenants/:id/subdomain` (self-service).
