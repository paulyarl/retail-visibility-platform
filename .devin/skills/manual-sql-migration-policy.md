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
- **Verification:** Add commented-out `SELECT` queries at the bottom for manual verification

---

## 5. Enforcement Checklist

Before completing any task that involves database changes:

- [ ] SQL migration file created in `database/migrations/`
- [ ] Migration uses `IF NOT EXISTS` guards
- [ ] No edits were made to `schema.prisma`
- [ ] No `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` was run
- [ ] Agent recommends running `npx prisma db pull && npx prisma generate` after migration is applied
