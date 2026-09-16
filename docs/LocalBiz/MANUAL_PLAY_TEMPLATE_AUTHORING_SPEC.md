# Manual Play Template Authoring — "Save as Template" Spec

Status: Draft (2026-09-16)
Owner: Platform team
Surface: platform admin — `Settings → Admin → Marketing Ops → Openers → Manual` tab
Related docs: `docs/LocalBiz/marketing_ops_manual_play_lane_guide.md` (operator + expansion guide)

> **Scope note.** This spec covers two additions to the Manual tab:
>
> - **Part 1 (§1–§8, §10–§12):** a **Save as template** flow so an operator can
>   promote a tuned play doc (field values + script body) into a reusable
>   dropdown template — without a code deploy. The code catalog
>   (`manual-play-templates.ts`) remains the source of truth for
>   platform-shipped templates; operator templates are DB rows merged in at read
>   time.
> - **Part 2 (§9):** a **Construction Variables** panel replicating the Pitch
>   Construction tab's pattern — detected `{{placeholders}}` get inputs whose
>   values substitute into the live preview and persist on the doc.

---

## 1. Summary

Today the Manual tab's template dropdown is a **code-defined catalog**
(`MANUAL_PLAY_TEMPLATES`, currently 1 entry). When an operator tunes a play for a
niche — say, rewrites the WhatsApp upsell for Indian grocery stores — the only way
to reuse it is to copy-paste into a new campaign doc or ship a catalog PR.

This spec adds:

1. A **Save as template** button + capture modal on the Manual tab.
2. A new global table `mkt_manual_play_templates` holding operator-authored
   templates in the exact `ManualPlayTemplate` shape.
3. Read-side merge in `listTemplatesForCampaign` so operator templates appear in
   the same dropdown, badged **custom**, on every campaign.
4. Archive lifecycle (soft delete) so retired plays leave the dropdown but never
   break existing campaign docs.

No changes to promotion, merge resolution, anchor creation, or the detected
archetype. `template_key` remains validated in code — **no CHECK constraints**
(enum-drift rule, migrations 256/264/270).

## 2. Current state (verified)

| Piece | Location | Behavior |
|---|---|---|
| Template catalog | `apps/api/src/services/outreach-openers/manual-play-templates.ts` | `MANUAL_PLAY_TEMPLATES` — pure data, `getManualPlayTemplate(key)` sync lookup |
| Doc persistence | `mkt_campaign_manual_scripts` (schema.prisma ~L7966) | `UNIQUE(campaign_id, template_key)` upsert; `fields` jsonb + `script_body`; `promoted_*` stamps |
| Service | `apps/api/src/services/ManualOutreachScriptService.ts` | `listForCampaign`, `upsert` (validates `template_key` against catalog → 400), `listTemplatesForCampaign` (adds `suggested`/`saved`), read-time merge via `buildMergeContext`/`resolveMerge` |
| Routes | `apps/api/src/routes/marketing-ops.ts` L2417–2479 | `GET /:campaignId/manual-script`, `GET /:campaignId/manual-script-templates`, `PUT /:campaignId/manual-script`. Mounted at `/api/admin/marketing-ops` |
| Frontend panel | `apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/ManualScriptPanel.tsx` | Dropdown → field slots (role badges) → script body + resolved preview → Save play + promote buttons |
| Frontend service | `apps/web/src/services/MarketingOpsService.ts` L538–583, L5326–5375 | `ManualPlayTemplate`/`ManualTemplateListItem`/`ManualScript` types + list/save methods |
| Route ordering | `marketing-ops.ts` L7431 | `router.get('/:id')` is at the **end** of the file — single-segment routes declared earlier are safe |
| Construction Variables (pattern to replicate) | `PitchConstructionPanel.tsx` L432–457, L845–885 | `constructionVars` state; `usedVars` detected via `/\{\{(\w+)\}\}/g` across the archetype's starter sets; collapsible violet `<details>` with one input per var; `resolveVariables` substitutes on starter click — unfilled vars stay literal |
| Manual merge machinery (what Part 2 rides on) | `ManualOutreachScriptService.toView` L264–292 | `fieldCtx = {...mergeContext, ...fields}` — **any** `fields` key resolves `{{key}}` in the body and in other fields; `fields` is free-form `Record<string,string>` jsonb, so extra keys persist + merge for free |

## 3. User flow

1. Operator selects a template, edits field slots + script body (saved or unsaved —
   the capture snapshots **current editor state**, not the last saved doc).
2. Clicks **Save as template** (secondary button in the "Play template" card
   header, `BookmarkPlus` icon).
3. Modal opens, prefilled:
   - **Template name** — `<source label> — custom`
   - **Key** — auto-slugged `op_<slug>` (editable; validated; immutable after create)
   - **Description** — copied from source template, editable
   - **Advanced** (collapsed): `anchor_type` select (`MANUAL_ANCHOR_TYPES`),
     `hook_angle` text, `suggested_when_signal` text — all default to the source
     template's values
   - **Capture summary** — "9 field slots · script body 1,412 chars · captured from
     `<source key>` on campaign `<id>`"
   - **Hygiene warning** (when triggered, §6.4) — campaign-specific literals
     detected in captured values
4. Operator confirms → `POST /api/admin/marketing-ops/manual-script-templates`.
5. On success: inline confirmation in the picker card — "Template saved —
   `<label>` is now in the list for every campaign" with a **Switch to it**
   button. The dropdown option renders as `<label> — custom`.

When the selected template is already operator-authored, the modal's primary
action becomes **Update template** (`PUT /manual-script-templates/:key`) with a
mode toggle back to "save as new". Update is in-scope but separable — it shares
the endpoint + validation path.

## 4. Data model

### Migration `288_mkt_manual_play_templates.sql` (next free number; 286–287 already applied)

```sql
CREATE TABLE mkt_manual_play_templates (
  id                     varchar(40)  PRIMARY KEY,          -- mptpl-{nanoid8}
  key                    varchar(80)  NOT NULL,             -- op_<slug>, immutable
  label                  varchar(255) NOT NULL,
  description            text         NOT NULL DEFAULT '',
  anchor_type            varchar(40)  NOT NULL DEFAULT 'custom',
  hook_angle             varchar(80),
  suggested_when_signal  varchar(80),
  fields                 jsonb        NOT NULL,             -- ManualPlayField[]
  script_body            text         NOT NULL,
  status                 varchar(20)  NOT NULL DEFAULT 'active',  -- active | archived
  created_from_campaign_id varchar(255),
  created_from_template_key varchar(80),
  created_by             varchar(255),
  updated_by             varchar(255),
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_manual_play_template_key UNIQUE (key)
);
CREATE INDEX idx_mkt_manual_play_templates_status ON mkt_manual_play_templates(status);
```

Rules (per AGENTS.md):

- **No CHECK constraints.** `anchor_type`, `status`, and field `role` are
  validated in code (`MANUAL_ANCHOR_TYPES`, `ManualFieldRole`) — same discipline
  as `template_key` on `mkt_campaign_manual_scripts`.
- `fields` is a **snapshot** of `ManualPlayField[]` (key/label/role/placeholder/
  defaultValue) — the full slot schema travels with the template so it never
  depends on the source catalog entry surviving.
- Provenance columns (`created_from_*`) are audit breadcrumbs, not FKs.

Run against `local` + `prd` (`psql $DATABASE_URL -f database/migrations/288_*.sql`
per Doppler config), then `pnpm prisma:generate` / `prisma db pull` so the model
lands in `schema.prisma`.

### ID generator

Add to `apps/api/src/lib/id-generator.ts` (mirrors `generateManualScriptId`):

```ts
/** Format: mptpl-{nanoid} (13 chars) */
export function generateManualPlayTemplateId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `mptpl-${nanoid()}`;
}
```

## 5. Backend

All changes in `ManualOutreachScriptService.ts` (the lane's service — no new
service file) + `marketing-ops.ts` routes.

### 5.1 Template resolution — catalog first, DB fallback

```ts
async resolveTemplate(key: string): Promise<(ManualPlayTemplate & { source: 'catalog' | 'operator'; status?: string }) | null>
```

1. `getManualPlayTemplate(key)` (sync code catalog) → `{...t, source: 'catalog'}`.
2. Else `SELECT * FROM mkt_manual_play_templates WHERE key = $1` → row →
   `ManualPlayTemplate` shape + `source: 'operator'`, `status` carried through.
3. `null` → callers throw `ValidationError` with the valid-key list (existing
   `upsert` error shape, extended to include active operator keys).

`upsert` swaps `getManualPlayTemplate` → `await resolveTemplate`, plus one rule:
**creating a new doc under an `archived` operator key → 400**; updating an
existing doc under an archived key is allowed (docs outlive their template).

### 5.2 `listTemplatesForCampaign` — merged list

```ts
const [savedRows, operatorRows] = await Promise.all([...]);
// savedRows: template_key set for this campaign (unchanged)
// operatorRows: SELECT * FROM mkt_manual_play_templates
//   WHERE status = 'active' OR key = ANY(savedKeys)   -- archived stays reachable for existing docs
```

Return `catalog items (catalog order) ++ operator items (label ASC)`, each
annotated `{ suggested, saved, source }`. `suggested` works identically for
operator templates (`suggestedWhenSignal` vs detected signals).

`ManualTemplateListItem` gains `source: 'catalog' | 'operator'` and
`status?: 'active' | 'archived'` — frontend type mirrors this.

### 5.3 Create / update / archive

```ts
async createTemplate(input: ManualPlayTemplateInput, ctx?): Promise<ManualTemplateView>
async updateTemplate(key: string, input: Partial<ManualPlayTemplateInput>, ctx?): Promise<ManualTemplateView>
async archiveTemplate(key: string, ctx?): Promise<ManualTemplateView>   // status → 'archived'
```

Validation (zod at the route, service double-checks):

| Field | Rule |
|---|---|
| `key` | Optional; server-slugged from label when omitted. `^op_[a-z0-9][a-z0-9_]{1,76}$`. 409 `conflict` (`ConflictError`) on collision with a code-catalog key **or** an existing row. Immutable on update. |
| `label` | 1–255, required |
| `description` | ≤ 2000, required (dropdown subtext) |
| `fields` | Array, 1–40 items; each `{key: ^[a-z][a-z0-9_]{0,39}$, label ≤120, role ∈ ManualFieldRole, placeholder ≤500, defaultValue ≤20000}`. The composer may append `role: 'note'` slots for free construction vars not in the source schema (§9.6) — no special-casing needed here |
| `script_body` | 1–50000 |
| `anchor_type` | ∈ `MANUAL_ANCHOR_TYPES` (default `'custom'`) |
| `hook_angle`, `suggested_when_signal` | ≤ 80, optional — `suggested_when_signal` is **free-form** (only fires when it matches a detected signal; no hard validation against the registry since the taxonomy grows) |
| `status` (update only) | ∈ `active | archived` |

`updateTemplate`/`archiveTemplate` on a code-catalog key → 400 `validation_error`
("catalog templates are code-managed").

Audit each mutation via `audit()` — `entity_type: 'other'`, payload
`{ id, manual_template_key, manual_template_action: 'created'|'updated'|'archived', created_from_campaign_id? }`
— mirroring `logAudit` in the same file.

### 5.4 Routes (`marketing-ops.ts`, declare **before** `router.get('/:id')` at L7431)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manual-script-templates` | All operator templates (incl. archived) — manage list + modal key-availability check |
| `POST` | `/manual-script-templates` | Create. Body: §5.3 fields + `created_from_campaign_id`, `created_from_template_key` |
| `PUT` | `/manual-script-templates/:key` | Update label/description/fields/script_body/advanced/status |
| `DELETE` | `/manual-script-templates/:key` | Soft archive (sets `status='archived'`); returns the updated row. No hard delete in v1 (docs reference keys; archive keeps them resolvable) |

The existing `GET /:campaignId/manual-script-templates` is unchanged in shape —
its payload just grows `source`/`status` and includes operator rows.

## 6. Frontend

### 6.1 `ManualScriptPanel.tsx`

- **Button:** `Save as template` — ghost/secondary button in the "Play template"
  card header row (right-aligned next to the `<h2>`), `BookmarkPlus` icon,
  `disabled={!template}`. Placement keeps it adjacent to the thing it snapshots
  and out of the promote row's pipeline semantics.
- **Modal** (`SaveAsTemplateModal.tsx`, same folder): fields per §3. Live key
  slugging (`op_` + slug of label, editable with prefix locked); key availability
  checked on debounce against `GET /manual-script-templates` (prefetched list is
  fine — catalog is small). Submit disabled until label + key valid.
- **On success:** add the returned template to `templates` state with
  `source: 'operator'`; show the confirmation line + **Switch to it** (calls
  `handleSelect(newKey)` — loads the fresh doc defaults, which are exactly what
  was just captured). Current doc stays under its original `template_key` —
  unchanged semantics.
- **Dropdown:** option suffix ` — custom` for `source === 'operator'`,
  ` — custom (archived)` for archived-with-doc. Description block under the
  picker shows a small `Custom` chip beside the suggested badge.
- **Update path:** when `template.source === 'operator'`, modal opens in "Update
  `<label>`" mode (PUT) with a "save as new instead" toggle.

### 6.2 `MarketingOpsService.ts`

- Types: `ManualTemplateListItem` + `source`, `status`; new
  `ManualPlayTemplateInput` (create/update body) and `ManualPlayTemplateRow`
  (management view: id, key, status, timestamps, provenance).
- Methods (same `makeDefaultRequest` + `result.data?.data ?? result.data`
  unwrap pattern, `ttl: 0`):
  - `listOperatorManualTemplates()` → `GET /manual-script-templates`
  - `createManualTemplate(input)` → `POST /manual-script-templates`
  - `updateManualTemplate(key, input)` → `PUT /manual-script-templates/:key`
  - `archiveManualTemplate(key)` → `DELETE /manual-script-templates/:key`

### 6.3 UX guardrails (per skill-frontend-ux-guardrails)

- Modal is the only new surface: fit 390px-wide viewports, label/key/description
  stacked, advanced section collapsed by default, visible focus rings, Esc closes,
  submit shows spinner + disables (no double-create).
- The button must not hide behind hover — always visible next to the picker
  heading; at 320px the header row wraps the button below the title.
- Error states: 409 shows "that key is taken" inline under the key field; other
  failures use the existing amber `promoteError`-style banner inside the modal.

### 6.4 Campaign-literal hygiene lint (client-side, advisory)

Captured field values + script body are operator-tuned for one business — the
#1 way a "template" ships with `Patel Brothers` baked in. On modal open, scan
captured strings for: campaign `business_name`, `city`, and a literal
`/directory/claim/` URL. Each hit renders a warning line — "`<name>` looks
campaign-specific — replace with `{{business}}` / `{{city}}` / `{{claim_url}}`?"
Advisory only (never blocks): the operator may legitimately want a niche literal.

## 7. Semantics & edge cases

| Case | Behavior |
|---|---|
| Unsaved edits when capturing | Captured (modal says "includes unsaved edits"); the campaign doc itself is untouched — still dirty until Save play |
| Captured field values | **Raw** values (with `{{…}}` placeholders intact) → `defaultValue`s. Never `resolved_fields` — resolved text would bake in business/city |
| Slot schema | Copied from source template's `fields` defs with `defaultValue` replaced by current values; key/label/role/placeholder preserved so promote buttons + role badges work identically |
| Doc under a key that later gets archived | Still loads/saves (`resolveTemplate` ignores status); new docs under archived keys → 400; dropdown hides it unless `saved` |
| Key reuse after archive | Still reserved (unique index on all rows). `PUT status='active'` un-archives — the recovery path |
| Operator template promoted to pipeline | Identical to catalog flow — `anchorType`/`hookAngle` travel on the merged list item |
| Deleting a code-catalog template later | Unrelated — operator templates are independent rows |

## 8. Alternatives considered

| Option | Rejected because |
|---|---|
| Keep catalog code-only; operators PR new plays | The whole point — deploy friction for copy tweaks |
| Sentinel `campaign_id` (e.g. `__global__`) rows in `mkt_campaign_manual_scripts` | Conflates docs with templates; `fields` there are flat values, not slot schemas; breaks the `UNIQUE(campaign_id, template_key)` mental model |
| Reuse a generic prompt-template table (`mkt_prompt_templates`) | Different shape (body-only prompts); manual plays need typed slot schemas + anchor metadata |
| Full slot-schema editing UI (add/remove/rename slots) | v2 — v1 snapshots the source template's schema, which covers the actual ask |

## 9. Part 2 — Construction Variables panel on the Manual tab

Replicates the Pitch Construction tab's **Construction Variables** pattern
(`PitchConstructionPanel.tsx`) into the Manual lane, adapted to the Manual tab's
server-side merge model.

### 9.1 Why it fits almost for free

The Manual merge path (`toView`, L264–292) builds
`fieldCtx = { ...mergeContext, ...fields }` and resolves `{{key}}` against it —
`fields` is free-form `Record<string,string>` jsonb, so **any extra key stored
in `fields` already resolves `{{key}}` in the script body and inside other field
values**. A "construction variable" is just a `fields` key that isn't in the
template's declared slot schema — it persists per campaign, merges at read, and
needs zero new persistence machinery.

The only real backend gap: the panel needs the global merge context client-side
so it can (a) classify vars and (b) live-resolve the preview without a save.

### 9.2 Backend — expose the merge context

New endpoint in the manual-scripts block (two-segment, safe from `GET /:id`):

```
GET /:campaignId/manual-script-merge-context
  → ManualOutreachScriptService.mergeContextForCampaign(campaignId, ctx)
  → { success, data: { business?, address?, category?, city?,
       operator_name?, sender_name?, salutation?, claim_url? } }
```

Thin wrapper over the existing `buildMergeContext` (null-valued keys omitted,
same as today). Values are the same ones already shown in `resolved_body` — no
new exposure class. Frontend: `getManualScriptMergeContext(campaignId)` on
`MarketingOpsService`, fetched alongside templates + docs in `fetchAll`.

### 9.3 Variable classification (data-driven — no duplicated key list)

`useMemo` scans current `scriptBody` + all field values for `{{(\w+)}}` and
classifies each var:

| Class | Test | Rendered as |
|---|---|---|
| **auto** | key ∈ `merge_context` | Read-only chip `{{business}} → Patel Brothers`; if absent from context → muted "not resolvable for this campaign — stays literal" |
| **slot** | key ∈ `template.fields[].key` | Chip `{{observed_gap}} ← slot "Observed gap"`; click focuses the slot input (add `id={`manual-field-${key}`}` to slot wrappers) |
| **free** | everything else | Text input → `fields[key]` |

**Guardrail:** free-var inputs never render for `auto` or `slot` keys. `fields`
wins over `mergeContext` in `fieldCtx` ordering — letting an operator type into
a `{{business}}` input would silently shadow the campaign value at read. The
panel must not create that footgun. (A stale `fields` key that later collides
with a new global merge key is the one residual case — §9.6.)

### 9.4 Panel UI (`ManualScriptPanel.tsx`)

- Placement: collapsible `<details>` styled exactly like the Pitch Construction
  one (violet border/wash, count badge, `group-open:hidden` hint), rendered
  **above the "Script body + resolved preview" card** — adjacent to where the
  vars resolve.
- Title: `Construction Variables`; badge counts **free** vars; hint text:
  "Values save with the doc and merge at read — same as field slots."
- Free-var grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, same input
  styling as Pitch Construction; `onChange` → `setFields(p => ({...p, [k]: v}))`
  + `setDirty(true)`.
- **Empty input = delete the key** (`delete fields[key]`), not `''` —
  `resolveMerge` maps `''` to an empty substitution; removing the key keeps the
  placeholder visible, matching the "unfilled stays literal" contract.
- Panel renders whenever a template is selected (auto/slot chips are useful
  even with zero free vars — operators see at a glance what `{{claim_url}}`
  etc. will become). Collapsed by default; auto-opens when ≥1 free var exists.
- Slot chips get `focus:` rings; panel fits 390px without horizontal scroll.

### 9.5 Live preview (replaces "save to refresh merges")

```ts
const resolveClientMerge = (text: string) =>
  text.replace(/\{\{(\w+)\}\}/g, (m, k) => mergeCtx[k] ?? fields[k] ?? m);
// fields win over mergeCtx — mirrors server fieldCtx ordering
previewBody = resolveClientMerge(scriptBody);            // always live
```

- Preview updates as the operator types — the "— save to refresh merges" hint
  is removed. Server `resolved_body` remains authoritative for **promotion**
  (`canPromote` still requires a saved, clean doc) and is what
  `fieldValue()`/`resolved_fields` consume — unchanged.
- Before `merge_context` arrives (async), globals stay literal — same contract.

### 9.6 Interaction with Save-as-template + edge cases

- **Capture:** free-var keys live in `fields` but aren't in the source
  template's slot schema. On save-as-template, the frontend appends each extra
  `fields` key as a new slot
  `{ key, label: <humanized key>, role: 'note', placeholder: '', defaultValue: <value> }`
  so the variable survives as a first-class editable slot on the new template
  (validated by the §5.3 `fields` rules — no backend special-casing).
- **Composability:** catalog/operator templates can now deliberately ship
  `{{free_vars}}` in `scriptBody` for per-campaign data (e.g.
  `{{competitor_name}}`) — the panel surfaces them for filling.
- **Nested placeholders:** a free-var *value* containing `{{business}}`
  resolves at read (fields resolve through `fieldCtx`) — allowed, consistent
  with slot behavior.
- **Stale-key collision:** if a `fields` key later collides with a newly added
  global merge key, the field value shadows the global at read. The panel
  detects this (`fields` key ∉ slots but ∈ merge_context) and shows a small
  "overrides campaign value — clear?" affordance that deletes the key.
- **Template switch:** `loadDoc` already repopulates `fields` from the doc —
  free-var values persist per doc untouched; detection recomputes from the new
  template's body + values.


## 10. Testing

Backend (`apps/api/src/services/__tests__/ManualPlayTemplateAuthoring.test.ts`,
mock pattern from `CallScriptService.test.ts`):

- `resolveTemplate`: catalog hit, operator hit, archived hit, miss → null
- `createTemplate`: valid create, key collision vs catalog + vs row → 409,
  invalid key/role/anchor_type → 400, auto-slug from label
- `upsert` doc: new doc under archived key → 400; existing doc under archived
  key saves
- `listTemplatesForCampaign`: merge order, `source`/`saved`/`suggested` flags,
  archived hidden unless saved
- `archiveTemplate` → status flip; catalog key → 400
- Part 2: `mergeContextForCampaign` returns the expected global keys;
  free-var round trip — save a doc with an extra `fields` key → `resolved_body`
  resolves `{{key}}`; empty/missing key → placeholder stays literal;
  `fields`-key-shadows-global precedence pinned (fields win — see §9.6)

Frontend: `pnpm checkweb`; manual verify — create → appears in dropdown badged
custom on a *different* campaign → save doc under it → promote opener → archive
→ disappears on fresh campaign, stays on the one with a doc. Part 2 manual
verify — panel detects vars, auto chips show resolved values, free-var input →
live preview substitutes without saving → survives Save play + reload.

Verify: `pnpm checkapi`, `pnpm checkweb`, focused vitest run.

## 11. Rollout checklist

1. `288_mkt_manual_play_templates.sql` → `local` + `prd` via `psql $DATABASE_URL -f …`
2. `prisma db pull` + `pnpm prisma:generate` (model → `schema.prisma`)
3. Service + routes + id-generator + panel + modal + service methods
   (Part 1) + merge-context endpoint + variables panel (Part 2)
4. `pnpm checkapi && pnpm checkweb` + tests
5. Update `marketing_ops_manual_play_lane_guide.md` — Part 2 "Expansion guide"
   gains a "operator-authored templates" paragraph pointing at the new flow;
   `MANUAL_PLAY_TEMPLATES` remains the platform-catalog path. The operator
   guide's placeholder list gains a line about free variables + the
   Construction Variables panel.

## 12. Out of scope (v1)

- From-scratch template authoring (no source template) / slot-schema editor
- Hard delete (archive-only; reconsider if catalog noise becomes a problem)
- Per-team or per-operator template scoping — templates are global
- Signal-picker dropdown for `suggested_when_signal` (free-form text; registry
  validation is soft by design)
- Template versioning/history (updated_at + audit trail only)
- Cross-doc or cross-campaign construction variables (vars are per-doc, same
  as field slots); renaming a `{{var}}` across a template
- Promotion-path changes — promotion still requires a saved, clean doc and
  uses the server-resolved text
