# Bronze Reason Catalog — Authoring

## Purpose

`mkt_bronze_reason_catalog` is the DB-authoritative catalog of discovery blind spots for the Bronze Standard system (spec: `docs/LocalBiz/BRONZE_STANDARD_SPEC.md` §3). Each reason names WHY a category-qualified, operating business is invisible to mainstream discovery — mis-categorized platform label, endonym-only name, trade-manifest-only trace, unclaimed profile, etc. Bronze scan campaigns consume the catalog as their hunt list; bronze profiles embed a revision-stamped snapshot of it.

Use this skill when asked to add, edit, deprecate, or reason about catalog entries — e.g. "the Indianapolis sweep surfaced a new blind spot, add it to the catalog."

## Invariants (never violate)

1. **`reason_key` is immutable** — lowercase snake_case, 2–80 chars, starts with a letter (`/^[a-z][a-z0-9_]{1,79}$/`). It is the join key between catalog rows, profile `reason_coverage` entries, `vector_execution_log`, and downstream prompts. Never rename a key — deprecate + author a new one instead.
2. **The catalog is additive** — never `DELETE`. Retire via deprecation (`deprecated_in_revision` + `deprecated_reason` + optional `superseded_by` pointing at the canonical key — §3.5.6 duplicate handling).
3. **Every write bumps `mkt_bronze_catalog_meta.catalog_revision`** in the same transaction and stamps `introduced_in_revision` / `revised_in_revision` / `deprecated_in_revision`. Going around the service with raw SQL and skipping the revision bump breaks staleness detection — profiles snapshot `catalog_revision` and uncovered-reason detection depends on it.
4. **Scope values are normalized on write** (§3.5.1) — pass raw values; the service normalizes. For raw SQL, you must pre-normalize: category keys use spaces not underscores (`'african grocery store'`, not `'african_grocery_store'`), city title-cased, state 2-letter code, platform lowercase.
5. **`scope_city` and `scope_state` are set together or not at all** (§3.6.1).
6. **Platform vocabulary is the gold vocabulary**: `google | yelp | facebook | bbb | apple_maps | bing`. `'all'` normalizes to `NULL` (platform-agnostic). The spec §3.5.1 says `website` — that is a spec typo; use `bbb`.

## Scope semantics (§3.6)

`NULL` scope column = wildcard. Four levels plus an independent platform axis:

| scope_category_key | scope_city + scope_state | Level |
|---|---|---|
| NULL | NULL | Universal — applies to every category, every market |
| set | NULL | Category — applies to that category everywhere |
| NULL | set | Location — applies to one market, any category |
| set | set | Category + location — narrowest |

`scope_platform` is independent: a platform-bound reason (mechanics that only exist on one platform) carries it; platform-agnostic reasons leave it NULL.

**Default to universal.** Location scope is a deliberate exception (spec §11.1) — scope a reason to a city only when the blind spot is genuinely market-specific. Scope *promotion* (widening a scoped reason to universal) is an SOP judgement call, never automated: it's a one-row `UPDATE` nulling the scope columns, which bumps the revision.

## Ways to add a reason

### 1. Admin route (preferred for ad-hoc authoring)

`POST /api/admin/marketing-ops/bronze-reasons` — validated by `bronzeReasonCreateSchema`, normalized + revision-bumped by the service, audited with `actorType: 'user'`. Live immediately — no review gate (internal operator workflow, §11.1).

```json
{
  "reason_key": "delivery_app_only",
  "label": "Exists only inside delivery apps",
  "definition": "The business has no independent web or platform presence; its only discovery surface is a listing inside a delivery app (DoorDash, Uber Eats).",
  "signals": [
    "business appears on delivery-app listings but not on Google/Yelp/Facebook",
    "no independent domain or storefront page exists"
  ],
  "expected_vectors": ["delivery-app listing sweep"],
  "priority": 2,
  "scope_category_key": "african grocery store"
}
```

Response `201` → `{ data: <reason row> }`. `409` on duplicate key; `400`/`422` on validation failure.

Related routes (all under `/api/admin/marketing-ops`):

- `GET /bronze-reasons?categoryKey=&city=&state=&platform=&includeDeprecated=` — list
- `GET /bronze-reasons/uncovered?categoryKey=&profileId=|catalogRevision=` — §3.5.3 staleness query
- `PUT /bronze-reasons/:reasonKey` — edit content/scope (stamps `revised_in_revision`)
- `POST /bronze-reasons/:reasonKey/deprecate` — `{ "deprecated_reason": "...", "superseded_by": "canonical_key" }`
- `POST /bronze-reasons/:reasonKey/test-scan` — `mode: 'render'` returns a single-reason probe prompt for an external agent; `mode: 'validate'` + `rawOutput` validates pasted output against `bronze_standard_scan`. Neither mode writes profiles.

### 2. Service (in-process code — scripts, other services)

```ts
import { BronzeReasonCatalogService } from './intelligence/BronzeReasonCatalogService';

await BronzeReasonCatalogService.getInstance().createReason('delivery_app_only', {
  label: 'Exists only inside delivery apps',
  definition: '...',
  signals: ['...'],
  expected_vectors: ['delivery-app listing sweep'],
  priority: 2,
  scope_category_key: 'african grocery store',
}, ctx);
```

`ctx` is `RequestCtx` from `apps/api/src/context.ts`. `createReason` runs `findUnique` for the 409 check, then INSERT + revision bump + `introduced_in_revision` stamp + `audit()` in one transaction.

### 3. Raw SQL (migrations / seeds only)

Only when the service path isn't available (a numbered migration seeding rows). Must do both statements in one transaction:

```sql
INSERT INTO mkt_bronze_reason_catalog
  (reason_key, label, definition, signals, expected_vectors, priority,
   scope_category_key, scope_city, scope_state, scope_platform,
   provenance, introduced_in_revision)
VALUES (..., 'derived', <next revision>);

UPDATE mkt_bronze_catalog_meta
SET catalog_revision = catalog_revision + 1, updated_at = now()
WHERE id = 'catalog';
```

Pre-normalize all scope literals (spaces not underscores in `scope_category_key`). Follow migration `291_bronze_reason_catalog.sql` for the idempotent `SELECT ... WHERE NOT EXISTS` pattern.

## Field reference

| Column | Required | Notes |
|---|---|---|
| `reason_key` | yes | snake_case, immutable |
| `label` | yes | Human-readable short name |
| `definition` | yes | What the blind spot is + why it hides businesses. Seed rows cite a real observed instance ("Indianapolis instance: ...") — keep that convention |
| `signals` | `[]` | Searchable signal vocabulary an agent can pattern-match (§3.1) |
| `expected_vectors` | `[]` | The discovery vectors that should surface it — the stage-2 scan executes these |
| `priority` | `3` | 1–5, orders slot-filling effort |
| `scope_*` | NULL | Wildcards; see scope table above |
| `provenance` | `'operator_authored'` | `'derived'` = post-hoc from a sweep, `'operator_authored'` = field experience |

## Side effects to be aware of

- **Profiles go stale on every write.** A new reason is `never_covered` for every profile stamped at an older revision — `uncoveredReasons` (§3.5.3) reports it and `serializeBronzeStandard` emits a catalog-drift block into downstream prompts. That's intended detection, not an error — the next stage-1/2 scan re-covers.
- **Editing a reason marks profiles stale too** (`revised_since_authored`), not just additions.
- **Deprecated reasons are excluded** from `applicableReasons` automatically — slots already referencing them in profiles remain interpretable because the key is preserved forever.

## Verification

```powershell
# Unit tests — mock Prisma, cover create/update/deprecate/normalize/revision
cd apps/api && npx vitest run src/services/__tests__/BronzeReasonCatalogService.test.ts
```

Live check after adding:

```sql
SELECT catalog_revision FROM mkt_bronze_catalog_meta WHERE id = 'catalog';
SELECT * FROM mkt_bronze_reason_catalog WHERE reason_key = '<new_key>';
```

Operator UI: `/settings/admin/marketing-ops/bronze-catalog` lists, authors, and deprecates reasons.

## Don'ts

- Don't add a reason that is a *business attribute* ("small", "new") — reasons are *discovery mechanics* (why the business can't be found), not descriptors.
- Don't infer `reason_key` from audit output or auto-create reasons from scan results — the catalog is curated, not scan-produced (§11.1). Scan findings go to the operator, who authors.
- Don't emit `not_applicable_reasons` entries into `reason_coverage` — scope-mismatched reasons are keys only.
- Don't use `'website'` as a platform — the vocabulary is `bbb`.
