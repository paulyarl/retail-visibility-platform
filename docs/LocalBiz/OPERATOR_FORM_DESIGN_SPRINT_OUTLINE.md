# Operator Form Design Sprint — High-Level Outline

**Status:** Draft outline (pending approval)
**Date:** 2026-08-06
**Parent plan:** `INTAKE_PORTAL_GENERALIZATION_PLAN.md` §7.6
**Prerequisite sprint:** Intake Portal Generalization (migration 173 + registry engine) — **complete**

## Problem

The registry engine is live: `mkt_intake_definitions` drives dynamic form
rendering, Zod validation, write-behind adapters, and niche overrides. But
definitions are seeded by SQL migrations and edited by engineers. Operators
cannot create or modify intake forms without a code change + deploy.

## Sprint Goal

Operators can author, preview, and publish intake definitions through the admin
workspace — no engineer involvement. The sprint covers three surfaces:

1. **Admin CRUD** — list, create, edit, retire, duplicate definitions
2. **Form-schema builder** — drag-and-drop field editor with live preview
3. **Niche-overrides editor** — per-category field add/override UI

## Phases

### Phase 1 — Admin CRUD routes + list/detail page

**Backend:**
- `GET    /api/admin/marketing-ops/intake-definitions` — list all (filter by
  `is_active`, `is_draft`, `driver`, `service_category`)
- `GET    /api/admin/marketing-ops/intake-definitions/:intakeKind` — single
  definition (full JSONB)
- `POST   /api/admin/marketing-ops/intake-definitions` — create (validates
  `form_schema` shape, `submitted_stage` reachable in transition map, adapter
  names whitelisted)
- `PATCH  /api/admin/marketing-ops/intake-definitions/:intakeKind` — update
  (bumps `version`, tracks `updated_by`)
- `POST   /api/admin/marketing-ops/intake-definitions/:intakeKind/duplicate` —
  clone to a new `intake_kind` (draft state)
- `POST   /api/admin/marketing-ops/intake-definitions/:intakeKind/publish` —
  flip `is_draft = false` (goes live)
- `POST   /api/admin/marketing-ops/intake-definitions/:intakeKind/retire` —
  flip `is_active = false` (no new intakes generated; existing submissions
  still resolve)

**Service:** `IntakeDefinitionAdminService` (new, `BaseService` singleton) —
handles save-time validation:
- `submitted_stage` must be reachable from every stage in `trigger_stages`
  via the campaign transition map
- `field_mappings[].adapter` must be in the whitelist
  (`Object.keys(writeBehindAdapters)`)
- `form_schema` well-formed (every field has `key`, `type`, `label`; options
  present for `select`/`radio`/`chips`; `options_source` or static `options`,
  not both)
- `intake_kind` format (kebab-case, ≤40 chars, no spaces)
- On save: `invalidateCache()` on `IntakeDefinitionService` so the new
  definition is picked up immediately

**Frontend:**
- `/settings/admin/marketing-ops/intake-definitions` — list page (table with
  kind, label, driver, status badges, last-updated)
- `/settings/admin/marketing-ops/intake-definitions/[intakeKind]` — detail/edit
  page (tabs: Form Schema, Field Mappings, Owner Copy, Niche Overrides,
  Preview)
- `IntakeDefinitionAdminService` (new, `AdminApiSingleton`) — wraps all CRUD
  routes
- Sidebar entry under Marketing Ops admin section

**Files touched:**
- `apps/api/src/routes/marketing-ops.ts` — new admin route block
- `apps/api/src/services/intake/IntakeDefinitionAdminService.ts` — NEW
- `apps/api/src/validators/intake-definition.schema.ts` — NEW (Zod for
  `form_schema`, `field_mappings`, `owner_copy`, `niche_overrides`)
- `apps/web/src/services/IntakeDefinitionAdminService.ts` — NEW
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intake-definitions/page.tsx` — NEW
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intake-definitions/[intakeKind]/page.tsx` — NEW
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intake-definitions/[intakeKind]/DefinitionEditorClient.tsx` — NEW

### Phase 2 — Form-schema builder UI

**Component:** `FormSchemaBuilder.tsx` — drag-and-drop field list editor

**Field palette** (left sidebar): the 14 field types from
`IntakeFormRenderer` (text, url, email, phone, textarea, select, radio,
multiselect, checkbox, chips, hours_grid, attachments, number, date, object).
Operator drags a type onto the canvas.

**Field editor** (right panel): per-field config form:
- `key` (auto-generated from label, editable, unique-enforced)
- `label`, `help_text`, `required` toggle
- `placeholder` (for text-like fields)
- `options` editor (for select/radio/chips — add/remove/reorder option rows
  with `value` + `label`)
- `options_source` selector (static options vs. dynamic `/options` source —
  if dynamic, a text field for the source key)
- `validation` config (min/max for numbers, min/max length for text, regex
  pattern)
- `custom_validator` dropdown (whitelisted names: `gbp_category_ids_exist`,
  etc.)
- For `object` type: nested field list (recursive `FormSchemaBuilder`)

**Output:** the builder produces a `FormField[]` array that is serialized to
`form_schema` JSONB on save.

**Live preview:** right-side tab renders `IntakeFormRenderer` against the
in-progress `form_schema` — operator sees exactly what the owner will see,
without persisting. Uses a mock `IntakeContext` (fake token, fake campaign).

**Files touched:**
- `apps/web/src/components/intake/FormSchemaBuilder.tsx` — NEW (drag-and-drop
  canvas + field palette + field editor)
- `apps/web/src/components/intake/FieldPalette.tsx` — NEW
- `apps/web/src/components/intake/FieldEditor.tsx` — NEW
- `apps/web/src/components/intake/FormPreview.tsx` — NEW (wraps
  `IntakeFormRenderer` with mock context)

### Phase 3 — Niche-overrides editor

**Component:** `NicheOverridesEditor.tsx` — per-category field add/override UI

**Layout:**
- Category selector (dropdown of GBP categories from `gbp_categories_list`)
- For the selected category, two sections:
  1. **Field overrides** — pick an existing field from the base `form_schema`,
     override `label`, `help_text`, `required`, `validation`, or `options`
  2. **Add fields** — same `FormSchemaBuilder` palette, appended to the base
     schema for this category only
- **Owner copy overrides** — title, subtitle, intro, success_message fields
  that override the base `owner_copy` for this category

**Merge preview:** shows the resolved definition (base + niche override) as
the owner would see it, using `IntakeDefinitionService.mergeNicheOverride`
(client-side mirror) so the operator can verify the merged form before
publishing.

**Output:** `niche_overrides` JSONB keyed by lowercased category name:
```json
{
  "plumber": {
    "add_fields": [...],
    "field_overrides": { "service_area": { "label": "..." } },
    "owner_copy_overrides": { "title": "..." }
  }
}
```

**Files touched:**
- `apps/web/src/components/intake/NicheOverridesEditor.tsx` — NEW
- `apps/web/src/components/intake/NicheOverrideRow.tsx` — NEW
- `apps/web/src/lib/niche-merge.ts` — NEW (client-side mirror of
  `IntakeDefinitionService.mergeNicheOverride` for live preview)

### Phase 4 — Save-time validation + publish flow

**Backend validation** (in `IntakeDefinitionAdminService`):
- `submitted_stage` reachability check: for every stage in `trigger_stages`,
  verify a path exists to `submitted_stage` in the campaign transition map
  (`transitionsFor(service_category || 'review_management')`). Reject if
  unreachable.
- Adapter whitelist: every `field_mappings[].adapter` must be a key in the
  `writeBehindAdapters` module. Reject unknown adapter names.
- `form_schema` well-formedness: Zod schema in
  `intake-definition.schema.ts` validates the structure.
- `intake_kind` immutability after publish (can't rename a published
  definition — duplicate + retire instead).

**Publish flow:**
- Draft → published: `POST /:intakeKind/publish` flips `is_draft = false`.
  The definition goes live immediately (`IntakeDefinitionService` cache
  invalidated).
- Published → retired: `POST /:intakeKind/retire` flips `is_active = false`.
  No new intake links generated for retired kinds. Existing tokens still
  resolve + submit (owners in flight aren't stranded).
- Published → draft (re-edit): `PATCH` with `is_draft = true` creates a new
  draft version while the published version stays live. Publish replaces the
  live version.

**Files touched:**
- `apps/api/src/services/intake/IntakeDefinitionAdminService.ts` — extend
  with validation + publish/retire logic
- `apps/api/src/validators/intake-definition.schema.ts` — full Zod schemas

## What's NOT in This Sprint

- **Downstream agent AI execute path** (§6.3 of parent plan) — the stub
  remains; operator manual import path is the only handoff. AI execute is a
  separate sprint once `GbpSyncService` / `ReviewRequestService` exist.
- **A/B testing of form variants** — future enhancement on top of the
  `version` column.
- **Per-campaign custom definitions** — this sprint is per-kind + per-niche
  only. Per-campaign overrides would require a `campaign_id` column on
  `mkt_intake_definitions` and a resolution chain (campaign → niche → base).
  Out of scope for now.

## Schema Readiness

Migration 173 already added the columns this sprint needs:
- `created_by` / `updated_by` — track admin author
- `is_draft` — draft/published state
- `version` — iteration without touching intake rows
- `is_active` — retire without delete

**No new migration needed.** The sprint is pure application-layer code
(routes + services + frontend).

## Risks

1. **Drag-and-drop UX complexity** — the form-schema builder is the hardest
   frontend component. Consider using `@dnd-kit/sortable` (already a
   dependency if Mantine's `Dropzone` is used) or `react-beautiful-dnd`.
   Fallback: a simpler up/down reorder + "add field" button approach.
2. **Niche override merge correctness** — the client-side merge mirror must
   exactly match `IntakeDefinitionService.mergeNicheOverride`. A mismatch
   means the preview lies. Extract the merge logic to a shared pure function
   imported by both.
3. **Cache invalidation race** — publishing a definition invalidates the
   `IntakeDefinitionService` cache, but in-flight requests may already have
   the old definition. The 60-second TTL + explicit invalidation is
   sufficient; no distributed cache concern (single-instance API).

## Estimation

| Phase | Rough scope |
|-------|-------------|
| Phase 1 — Admin CRUD + list/detail | 1 session |
| Phase 2 — Form-schema builder UI | 1-2 sessions (drag-and-drop is the long pole) |
| Phase 3 — Niche-overrides editor | 1 session |
| Phase 4 — Validation + publish flow | 0.5 session (mostly backend, UI is buttons) |

Total: ~3-4 sessions. The form-schema builder (Phase 2) is the critical path.
