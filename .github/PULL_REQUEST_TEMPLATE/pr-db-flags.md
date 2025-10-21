# PR #1: DB+Flags — Tenant Metadata & Audit Log (REQ-2025-901, REQ-2025-902)

## 🎯 Objective

Add database scaffolding for global expansion:
- Tenant metadata columns (region, language, currency, data_policy_accepted)
- Audit log table for compliance tracking
- Feature flag infrastructure for dark launch

## 📋 Changes

### Database Migration
**File:** `apps/api/prisma/migrations/20251021120000_add_tenant_global_fields/migration.sql`

- ✅ Added `Tenant.region` (TEXT, default 'us-east-1')
- ✅ Added `Tenant.language` (TEXT, default 'en-US')
- ✅ Added `Tenant.currency` (TEXT, default 'USD')
- ✅ Added `Tenant.data_policy_accepted` (BOOLEAN, default false)
- ✅ Created `audit_log` table with index on `(tenant_id, created_at DESC)`
- ✅ Idempotent: uses `IF NOT EXISTS` guards
- ✅ Down-migration SQL documented in comments

### Backend Scaffolds
**Files:**
- `apps/api/src/config.ts` — Feature flag config layer
- `apps/api/src/context.ts` — Request context middleware (region tagging)
- `apps/api/src/audit.ts` — Async audit helper (flag-guarded, no PII)

**Integration:**
- `apps/api/src/index.ts` — Flag-guarded audit calls on tenant/item create/update

### Environment Variables
**Railway:**
- `FF_GLOBAL_TENANT_META=false` (default OFF)
- `FF_AUDIT_LOG=false` (default OFF)
- `FF_I18N_SCAFFOLD=false` (default OFF)
- `FF_CURRENCY_RATE_STUB=false` (default OFF)

## 🧪 Testing

### Flags OFF (Default)
- ✅ All existing flows unchanged
- ✅ No audit_log writes
- ✅ Tenant CRUD works normally
- ✅ Item CRUD works normally

### Flags ON (Validated in Staging)
- ✅ `FF_AUDIT_LOG=true` → audit_log rows created on tenant/item mutations
- ✅ Audit entries contain: tenant_id, action, entity_type, entity_id, timestamp
- ✅ No PII logged (name/email excluded)

### Migration Safety
- ✅ Applied to staging without downtime
- ✅ Rollback tested: `DROP TABLE audit_log; ALTER TABLE "Tenant" DROP COLUMN ...`
- ✅ No FK constraints → independent rollback

## 📊 Acceptance Gates

- [x] **Gate A (Staging):** All regression tests pass with flags OFF
- [x] **Gate A (Staging):** New hooks validate with flags ON
- [x] **Gate B (Pre-Prod):** Migration revert tested
- [x] **Gate C (Prod):** No behavioral diffs (flags OFF)

## 🚀 Deployment Steps

1. **Apply migration to production:**
   ```bash
   # Railway auto-applies on deploy
   # Or manually: npx prisma migrate deploy
   ```

2. **Verify migration:**
   ```sql
   -- Check columns exist
   SELECT region, language, currency, data_policy_accepted 
   FROM "Tenant" LIMIT 1;
   
   -- Check audit_log table
   SELECT COUNT(*) FROM audit_log;
   ```

3. **Monitor logs:** No errors related to new columns

4. **Optional: Enable flags for internal testing**
   ```bash
   # Railway environment variables
   FF_AUDIT_LOG=true  # Enable audit logging
   ```

## 🔄 Rollback Plan

If issues arise:

1. **Disable flags:**
   ```bash
   FF_GLOBAL_TENANT_META=false
   FF_AUDIT_LOG=false
   ```

2. **Revert migration (if needed):**
   ```sql
   DROP TABLE IF EXISTS audit_log;
   ALTER TABLE "Tenant" DROP COLUMN IF EXISTS region;
   ALTER TABLE "Tenant" DROP COLUMN IF EXISTS language;
   ALTER TABLE "Tenant" DROP COLUMN IF EXISTS currency;
   ALTER TABLE "Tenant" DROP COLUMN IF EXISTS data_policy_accepted;
   ```

## 📝 Related

- **Requirements:** REQ-2025-901 (Tenant Metadata), REQ-2025-902 (Audit Log)
- **Initiative:** RETROFIT-G-MVP-2025-01
- **Commits:** `af6b9bd`, `36bbeba`
- **Follows:** DB+Flags → FE i18n → Observability (3-PR sequence)

## ✅ Checklist

- [x] Migration tested in staging
- [x] Feature flags configured (all OFF)
- [x] Audit helper tested with flag ON
- [x] No PII in audit logs
- [x] Down-migration documented
- [x] Runbook updated
- [x] Zero behavior change with flags OFF
