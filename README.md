# Retail Visibility Platform (Monorepo)

[![CI](https://github.com/paulyarl/retail-visibility-platform/actions/workflows/ci.yml/badge.svg?branch=spec-sync)](https://github.com/paulyarl/retail-visibility-platform/actions/workflows/ci.yml)

Monorepo with Next.js (web) and Express (API) plus Prisma + SQLite and Supabase schema.

## Apps

- `apps/web` – Next.js App Router, TypeScript, Tailwind
- `apps/api` – Express + TypeScript + Prisma (SQLite)
- `packages/shared` – Shared types

## Quickstart

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/health

## Environment

Root `.env` (server-only):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
API_PORT=4000
```

`apps/web/.env.local` (browser-safe):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`apps/api/.env`:

```
API_PORT=4000
DATABASE_URL="file:./prisma/dev.db"
```

## Database (API / Prisma)

```bash
# inside apps/api
pnpm prisma migrate dev
pnpm db:seed
```

## API Endpoints

- `GET /health`
- `GET /tenants`
- `GET /items?tenantId=demo-tenant`

## Web Routes

- `/tenants` – lists tenants via Next.js API proxy
- `/api/tenants` – proxies to API `/tenants`
- `/api/items` – proxies to API `/items`

## Supabase

SQL migrations live in `supabase/migrations/`:
- `0001_init.sql` – base schema
- `0002_sync_with_prisma.sql` – idempotent alignment for existing DBs

Row Level Security (RLS) example policies added using JWT `tenant_id` claim. Apply in the Supabase SQL editor.

## Dev/Test Feature Flag Overrides

These localStorage flags are useful for development and e2e tests:

- `ff_app_shell_nav = 'on'`
  - Forces the new App Shell header + Tenant Switcher to render, regardless of server flags.
- `ff_tenant_urls = 'on'`
  - Forces tenant-scoped navigation links (e.g., `/t/{tenantId}/items`, `/t/{tenantId}/dashboard`).

Usage in the browser console:

```js
localStorage.ff_app_shell_nav = 'on';
localStorage.ff_tenant_urls = 'on';
```

## Scripts

- `pnpm dev` – run web and api concurrently
- `pnpm --filter @rvp/api dev` – run API only
- `pnpm --filter apps/web dev` – run Web only
- `pnpm -r build` – build all

## TR-010: Business Profile (Tenant)

Implements Business Profile storage, API, and UI CRUD.

- Database
  - Prisma model: `TenantBusinessProfile` (table `tenant_business_profile`)
  - One-to-one with `Tenant` via `tenantId`
  - Fields include NAP data, optional website/contact, hours/social/seo, coordinates, and map settings (`displayMap`, `mapPrivacyMode`)

- API (apps/api)
  - `POST /tenant/profile` – upsert full profile for a tenant; syncs `Tenant.name` to `business_name`
  - `GET /tenant/profile?tenant_id=...` – returns normalized profile, falling back to `Tenant.metadata` and `Tenant.name`
  - `PATCH /tenant/profile` – partial update (upsert if missing); syncs `Tenant.name` when provided
  - `PUT /tenants/:id` – now supports updating `region`, `language`, `currency`, and `name` (auth: tenant access)

- Web (apps/web)
  - Next.js API proxy: `/api/tenant/profile` forwards Authorization to backend
  - Settings > Tenant page loads profile, supports editing via `BusinessProfileCard` + `EditBusinessProfileModal`
  - Map settings wired via `MapCardSettings` (`display_map`, `map_privacy_mode`)
  - Onboarding wizard posts Business Profile with bearer token

- Validation
  - Server: Zod schema enforces E.164 phone (`+` required) and `https://` website
  - Client: zod schema aligned; optional fields allow empty string/null; robust error handling in modal

- Tests
  - API unit tests (Vitest + Supertest): validation, POST/GET/PATCH flows, Tenant.name sync
  - Web E2E (Playwright): login, navigate to Settings, edit Business Profile and save (waits for PATCH)

- Backfill
  - Script: `apps/api/scripts/backfill-tenant-profile.ts` migrates legacy `Tenant.metadata` into `TenantBusinessProfile` (idempotent)

### How to run locally

1) Start API and Web
```
pnpm dev:local
```
2) Seed dev data (API)
```
pnpm -C apps/api db:seed:local
```
3) API unit tests
```
pnpm -C apps/api test
```
4) Web E2E tests (ensure web:3000 and api:4000 running)
```
pnpm -C apps/web test:e2e
```
5) Backfill legacy metadata (optional)
```
doppler run --config local -- pnpm -C apps/api exec tsx scripts/backfill-tenant-profile.ts
```

## Notes

- Keep Service Role key server-side only (never commit, never expose to browser).
- If Next.js shows a workspace root warning, it’s due to a global `package-lock.json` (harmless).
