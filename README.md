# Retail Visibility Platform (Monorepo)

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

## Scripts

- `pnpm dev` – run web and api concurrently
- `pnpm --filter @rvp/api dev` – run API only
- `pnpm --filter apps/web dev` – run Web only
- `pnpm -r build` – build all

## Notes

- Keep Service Role key server-side only (never commit, never expose to browser).
- If Next.js shows a workspace root warning, it’s due to a global `package-lock.json` (harmless).
