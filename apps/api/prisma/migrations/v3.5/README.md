# v3.5 Migrations — Audit, Policy Versioning, Tier Automation

## Overview

This migration pack adds enterprise-grade features to the v3.4.1 schema:

- **Audit Logging** - Full change tracking with request ID propagation
- **Policy Versioning** - Temporal billing policy with history and point-in-time queries
- **Tier Automation** - Real-time SKU counters with NOTIFY/LISTEN
- **Observability** - Quality metrics and monitoring views

## Prerequisites

- ✅ v3.4.1 migrations applied
- ✅ PostgreSQL 12+ with `btree_gist` extension support
- ✅ Database connection with superuser privileges (for extensions)

## Migration Files

| File | Description | Dependencies |
|---|---|---|
| `001_audit_log_enhancements.sql` | Audit log table + FK + fallback trigger | None |
| `002_policy_versioning.sql` | History table + temporal columns + overlap prevention | 001 |
| `003_effective_policy_view_v2.sql` | Point-in-time policy resolution | 002 |
| `004_tier_automation_enhancements.sql` | Real-time counters + NOTIFY + materialized cache | 003 |
| `005_observability_helpers.sql` | Monitoring views for SLA tracking | 001-004 |

## Running Migrations

### Windows (PowerShell)

```powershell
cd apps/api/prisma/migrations/v3.5
$env:PGPASSWORD = "your-password"
.\migrate_v35.ps1
```

### Manual (psql)

```powershell
$env:PGPASSWORD = "your-password"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h metro.proxy.rlwy.net -p 40244 -U postgres -d railway -f 001_audit_log_enhancements.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h metro.proxy.rlwy.net -p 40244 -U postgres -d railway -f 002_policy_versioning.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h metro.proxy.rlwy.net -p 40244 -U postgres -d railway -f 003_effective_policy_view_v2.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h metro.proxy.rlwy.net -p 40244 -U postgres -d railway -f 004_tier_automation_enhancements.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h metro.proxy.rlwy.net -p 40244 -U postgres -d railway -f 005_observability_helpers.sql
```

## What Gets Created

### Tables
- `audit_log` - Change tracking (if not exists from v3.4.1)
- `sku_billing_policy_history` - Temporal policy versions

### Views
- `v_effective_sku_billing_policy` - Current policy resolver (enhanced)
- `tenant_sku_counters` - Real-time SKU counts (enhanced)
- `tenant_sku_counters_cache` - Materialized for dashboards
- `audit_log_quality` - Audit coverage metrics
- `policy_change_summary` - Policy version history
- `tenant_tier_status` - Tier limit monitoring
- `swis_feed_quality_report` - Feed quality (enhanced)

### Functions
- `audit_inventory_fallback()` - Defense-in-depth audit trigger
- `archive_policy_change()` - Auto-archive policy changes
- `notify_counter_change()` - Real-time counter updates
- `get_policy_at_time()` - Point-in-time policy lookup
- `refresh_counter_cache()` - Materialized view refresh
- `check_index_bloat()` - Performance monitoring

### Triggers
- `trg_inventory_audit` - Fallback audit logging
- `trg_policy_archive` - Policy history tracking
- `trg_counter_notify` - Real-time counter notifications

### Extensions
- `btree_gist` - For temporal overlap prevention

## Post-Migration Steps

### 1. Update Prisma Schema

Add to `apps/api/prisma/schema.prisma`:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  occurredAt  DateTime @default(now())
  actorType   String
  actorId     String
  tenantId    String
  entityType  String
  entityId    String
  action      String
  requestId   String?
  ip          String?
  userAgent   String?
  diff        Json
  metadata    Json     @default("{}")
  piiScrubbed Boolean  @default(true)

  @@index([tenantId, occurredAt])
  @@index([entityType, entityId])
  @@index([actorType, actorId])
  @@index([requestId])
  @@map("audit_log")
}

model SkuBillingPolicyHistory {
  id                  String    @id @default(cuid())
  scope               String    @default("global")
  effectiveFrom       DateTime
  effectiveTo         DateTime?
  countActivePrivate  Boolean
  countPreorder       Boolean
  countZeroPrice      Boolean
  requireImage        Boolean
  requireCurrency     Boolean
  notes               String?
  updatedBy           String
  createdAt           DateTime  @default(now())

  @@index([scope, effectiveFrom])
  @@map("sku_billing_policy_history")
}
```

### 2. Generate Prisma Client

```bash
cd apps/api
npx prisma generate
```

### 3. Implement API Middleware

Add audit logging middleware to all write endpoints:

```typescript
// middleware/audit.ts
export async function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (req.method !== 'GET') {
      // Log to audit_log table
      prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: req.user.id,
          tenantId: req.user.tenantId,
          entityType: req.params.entity,
          entityId: req.params.id,
          action: req.method === 'POST' ? 'create' : 'update',
          requestId: req.id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          diff: { /* compute diff */ },
          metadata: { route: req.path }
        }
      });
    }
    return originalJson(data);
  };
  next();
}
```

### 4. Set Up Real-Time Listeners

```typescript
// services/counterListener.ts
import { Client } from 'pg';

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

client.query('LISTEN tenant_counter_update');
client.on('notification', (msg) => {
  const { tenantId } = JSON.parse(msg.payload);
  // Invalidate cache, push to WebSocket, etc.
  io.to(tenantId).emit('counter_update', { tenantId });
});
```

### 5. Enable Feature Flags

```env
FF_AUDIT_LOG=true
FF_POLICY_HISTORY=true
FF_TIER_AUTOMATION=true
```

## Monitoring

### Check Audit Coverage

```sql
SELECT * FROM audit_log_quality WHERE hour > now() - interval '24 hours';
```

### Check Policy History

```sql
SELECT * FROM policy_change_summary;
```

### Check Tenant Tier Status

```sql
SELECT * FROM tenant_tier_status WHERE status IN ('at_limit', 'warning');
```

### Check Index Health

```sql
SELECT * FROM check_index_bloat() WHERE bloat_pct > 20;
```

## Rollback

⚠️ **Warning:** Rollback will drop audit history and policy versions.

```sql
-- Drop in reverse order
DROP TRIGGER IF EXISTS trg_counter_notify ON "InventoryItem";
DROP TRIGGER IF EXISTS trg_policy_archive ON sku_billing_policy;
DROP TRIGGER IF EXISTS trg_inventory_audit ON "InventoryItem";

DROP FUNCTION IF EXISTS check_index_bloat();
DROP FUNCTION IF EXISTS refresh_counter_cache();
DROP FUNCTION IF EXISTS get_policy_at_time();
DROP FUNCTION IF EXISTS notify_counter_change();
DROP FUNCTION IF EXISTS archive_policy_change();
DROP FUNCTION IF EXISTS audit_inventory_fallback();

DROP MATERIALIZED VIEW IF EXISTS tenant_sku_counters_cache;
DROP VIEW IF EXISTS swis_feed_quality_report;
DROP VIEW IF EXISTS tenant_tier_status;
DROP VIEW IF EXISTS policy_change_summary;
DROP VIEW IF EXISTS audit_log_quality;
DROP VIEW IF EXISTS tenant_sku_counters;
DROP VIEW IF EXISTS v_effective_sku_billing_policy;

DROP TABLE IF EXISTS sku_billing_policy_history;
-- Note: Keep audit_log if you want to preserve history
-- DROP TABLE IF EXISTS audit_log;
```

## Performance Notes

- **Materialized View Refresh:** Run `SELECT refresh_counter_cache()` every 5 minutes via cron
- **Audit Log Retention:** Consider partitioning by month and archiving old data
- **NOTIFY/LISTEN:** Scales to ~10k notifications/sec; use Redis pub/sub for higher volume
- **Index Bloat:** Monitor with `check_index_bloat()` and reindex if >25%

## Support

For issues or questions:
- Check logs: `SELECT * FROM audit_log WHERE occurred_at > now() - interval '1 hour'`
- Review policy: `SELECT * FROM v_effective_sku_billing_policy`
- Monitor counters: `SELECT * FROM tenant_sku_counters_cache`
