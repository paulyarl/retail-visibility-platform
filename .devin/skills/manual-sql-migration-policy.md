---
description: Team policy — all database schema changes must be made via manual SQL migration files, never by editing Prisma schema directly. Prisma is pull-and-generate only, not push-and-migrate.
---

# Manual SQL Migration Policy

This skill enforces the team's database migration workflow. **Never edit `schema.prisma` directly.** All schema changes flow through hand-written SQL migration files, then Prisma is used to introspect and generate types afterward.

---

## 1. Why This Policy Exists

The team manages migrations manually via SQL editor (e.g., Supabase, psql, DBeaver) so that:
- Migrations can be applied **simultaneously to staging and production** without waiting for Prisma migration tooling
- Full control over SQL syntax, indexes, constraints, RLS policies, and triggers
- No dependency on Prisma's migration engine or shadow database

Editing `schema.prisma` without a corresponding SQL migration creates **schema drift** — the Prisma schema declares columns/tables that don't exist in the actual database, causing runtime errors.

---

## 2. The Workflow

### When a database schema change is needed:

1. **Write a SQL migration file** in `database/migrations/` (or `apps/api/prisma/migrations/` for older paths)
   - Use sequential numbering (e.g., `105_<descriptive_name>.sql`)
   - Include `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`, etc.
   - Use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency
   - Add verification queries as comments at the bottom

2. **Apply the migration** to the database via SQL editor (staging first, then production)
   - Team workflow: apply to staging, run `npx prisma db pull && npx prisma generate`
     against staging to confirm a clean generate, then apply the **same query** to
     production. In the Supabase SQL Editor always choose plain **Run**, never
     "Run and Enable RLS" (see the `mkt_*` exception note below).

3. **Run Prisma introspection** to update `schema.prisma` from the live database:
   ```bash
   npx prisma db pull
   ```

4. **Run Prisma generate** to update TypeScript types:
   ```bash
   npx prisma generate
   ```

### What the agent should do:
- **Write SQL migration files** — this is the agent's job
- **Run `npx prisma db pull`** after migrations are applied — safe, read-only introspection
- **Run `npx prisma generate`** — safe, generates types from schema
- **Verify schema alignment** by checking that columns referenced in code exist in migrations

### What the agent must NOT do:
- **Never edit `schema.prisma`** — not to add columns, not to add models, not to fix typos
- **Never run `prisma migrate dev`** — this creates Prisma-managed migrations that conflict with the manual workflow
- **Never run `prisma db push`** — this applies schema changes directly, bypassing the migration file requirement
- **Never run `prisma migrate reset`** — destructive

---

## 3. Common Scenarios

### Adding a new column to an existing table

**Correct:**
```sql
-- In database/migrations/105_add_new_column.sql
ALTER TABLE tenant_storefront_options_settings
  ADD COLUMN IF NOT EXISTS new_column VARCHAR(50) DEFAULT 'default_value';
```
Then: `npx prisma db pull && npx prisma generate`

**Incorrect:**
```
# Editing schema.prisma directly
model tenant_storefront_options_settings {
  ...
  new_column String? @default("default_value") @db.VarChar(50)
}
```

### Creating a new table

**Correct:**
```sql
-- In database/migrations/106_create_new_table.sql
CREATE TABLE IF NOT EXISTS tenant_new_domain_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_new_domain_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_new_domain_tenant ON tenant_new_domain_settings(tenant_id);
ALTER TABLE tenant_new_domain_settings ENABLE ROW LEVEL SECURITY;
```
Then: `npx prisma db pull && npx prisma generate`

### Fixing schema drift (Prisma has columns DB doesn't)

If `schema.prisma` declares columns that don't exist in the database:
1. **Write a migration** to add the missing columns (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`)
2. **Apply it** to the database
3. **Run `npx prisma db pull`** to confirm alignment
4. **Run `npx prisma generate`** to update types

Do NOT remove columns from `schema.prisma` to "fix" drift — fix the database instead.

---

## 4. Migration File Conventions

- **Location:** `database/migrations/` (primary) or `apps/api/prisma/migrations/` (legacy)
- **Naming:** `<number>_<snake_case_description>.sql` (e.g., `104_storefront_qr_capability_split.sql`)
- **Header:** Include title, description, prerequisites, and date
- **Idempotency:** Use `IF NOT EXISTS` / `IF EXISTS` / `ON CONFLICT DO NOTHING` wherever possible
- **RLS:** New tenant-scoped tables must enable RLS and create isolation policies
- **Triggers:** Include `updated_at` triggers for new tables

### DDL-before-data ordering (letter-suffix pattern)

When a migration needs to **both** update a CHECK constraint (DDL) **and** insert
rows that reference the new constraint value (data), split them into two files:

- `<N>a_<description>.sql` — DDL only (constraint updates, column adds)
- `<N>_<description>.sql` — data only (inserts, backfills)

The `a` suffix sorts before the bare number, so the DDL file is applied first.
This avoids the failure where a data INSERT references a CHECK constraint value
that doesn't exist yet (e.g., inserting `step_type = 'internal_link'` before the
constraint has been updated to allow it).

**Worked example (bridge sprint):**
- `185a_mkt_checklist_internal_link_step_type.sql` — updates `chk_checklist_step_type` to allow `'internal_link'`
- `185_mkt_outreach_checklist_bridge_backfill.sql` — backfills `outreach_kind` on existing steps + inserts new `internal_link` steps (depends on 185a)
- `186_mkt_outreach_state_signal_registry.sql` — seeds `OX_*` signal rows (independent, data-only)

Apply in order: **185a → 185 → 186**.

### Marketing Ops (`mkt_*`) namespace exception

The `mkt_*` table family (migrations 141–149+) does **not** enable row level
security, despite the `/// This model contains row level security` comments
that Prisma introspects into `schema.prisma`. Those comments are Supabase
table-default artifacts, not applied policies — confirmed by inspecting the
migration SQL (none run `ENABLE ROW LEVEL SECURITY` on `mkt_*` tables). New
`mkt_*` tables should follow suit: no `ENABLE ROW LEVEL SECURITY` in the
migration. This is intentional — the public pay route and the recovery intake
portal read `mkt_deliverable_preview_tokens` / `mkt_dispute_intake` by token
without auth, which RLS would block. The `tenant_id` column is still included
on `mkt_*` tables for admin filtering and future RLS enablement, but the
policy is not applied today.

The `mkt_*` family also omits explicit `updated_at` trigger functions — they
rely on `DEFAULT NOW()` + app-layer Prisma `@updatedAt`. New `mkt_*` tables
follow the same pattern (no `CREATE TRIGGER` block in the migration).

**Supabase SQL Editor RLS prompt:** when running `mkt_*` migrations, the
editor may show "This query creates tables without enabling Row Level
Security" with a "Run and Enable RLS" button. Always choose plain **Run** —
the wrapper rewrites the query before executing (and can fail with spurious
errors like `relation "a" does not exist`), and RLS is intentionally not
enabled on `mkt_*` tables per the namespace exception above.
- **Verification:** Add commented-out `SELECT` queries at the bottom for manual verification

### Migration 159 — Operator Playbook Checklists (worked example)

`database/migrations/159_mkt_playbook_checklists.sql` adds three `mkt_*` tables
following the namespace conventions above:

- `mkt_playbook_checklist_steps` — ordered step templates per playbook
  (`step_order INT`, `step_type VARCHAR(30)` with CHECK constraint,
  `action_config JSONB DEFAULT '{}'`, `is_required BOOLEAN DEFAULT true`,
  `is_active BOOLEAN DEFAULT true`). Indexed on `(playbook_id, is_active)`
  and `(playbook_id, step_order)` for the builder tab's ordered list query.
- `mkt_campaign_checklist_progress` — per-campaign check-off rows, unique on
  `(campaign_id, step_id)` so `upsert` is the natural write path. Both FKs
  cascade (`ON DELETE CASCADE`) so deleting a campaign or step cleans up
  progress automatically.
- `mkt_playbook_checklist_suggestions` — operator feedback queue. Indexed on
  `(playbook_id, status)` for the admin review queue and `(campaign_id)` for
  the campaign-side list. `step_id` is nullable + `ON UPDATE NO ACTION` so
  supersede/deactivate flows don't orphan suggestions.

No RLS, no triggers — matches the `mkt_*` family policy. CHECK constraints
on `step_type`, `suggestion_kind`, `position`, and `status` enforce the
enum-like columns at the DB layer (Prisma introspects them as comments).

---

## 5. Enforcement Checklist

Before completing any task that involves database changes:

- [ ] SQL migration file created in `database/migrations/`
- [ ] Migration uses `IF NOT EXISTS` guards
- [ ] No edits were made to `schema.prisma`
- [ ] No `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` was run
- [ ] Agent recommends running `npx prisma db pull && npx prisma generate` after migration is applied
