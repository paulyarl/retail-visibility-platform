# Marketing Ops — Category / Tone Alignment & Review Response Presets

**Sprint:** `tone-category-alignment`  
**Estimated duration:** 1–1.5 weeks  
**Exit criteria:** zero `checkapi` / `checkweb` TS errors, passing unit/E2E tests, no UX regressions.

## 1. Why now

Marketing Ops already uses `category` to tag campaigns and prompt templates, and the prompt engine injects `{{category}}` at execution time. The missing piece is **tone** — the voice the AI should use for a given niche. Today tone is either hard-coded in the prompt body or ignored entirely. This makes the review-response workflow inconsistent across categories (dental, legal, restaurant, etc.).

This sprint makes the platform **category-tone aware**:

- Every category can declare a default tone (the "preset").
- Campaigns carry a `tone` (auto-filled from the category preset, overridable).
- Prompt templates can be scoped to a `category` + `tone` combination.
- The prompt execution engine injects both `{{category}}` and `{{tone}}` variables.
- Campaigns get additional filterable attributes: `Fast Retainers`, `High Ticket`, `Upscale`, `Friendly`, `Professional`.
- Campaigns get a `retainer` conversion-speed tag (`Fast`, `Medium`, `Slow`) for filtering only; it is not injected into prompts.
- Campaign, Prompt Library, and Deliverable UIs let users filter by `tone`, `retainer`, and attributes alongside `category`.

## 2. Scope

In scope:
- New DB table for category-tone presets.
- `tone` column on `mkt_campaigns_list` and `mkt_prompt_templates_list`.
- `attributes` JSONB column on `mkt_campaigns_list` for the 5 filterable flags.
- `retainer` column on `mkt_campaigns_list` for niche conversion speed (`Fast`, `Medium`, `Slow`).
- Backend service + route updates.
- Frontend UI in `CampaignFormClient`, `CampaignListClient`, `PromptLibraryClient`, `PromptWorkspaceClient`.
- Prompt execution injection of `tone` + attributes.
- Unit + E2E regression coverage.

Out of scope:
- New capability gating (reuses existing `marketing_ops_*` feature keys).
- New navigation links.
- New deliverable templates (existing `review_responses` deliverable type can already consume `{{tone}}`).

## 3. Data model

### 3.1 `mkt_category_tone_presets_list`

```sql
CREATE TABLE IF NOT EXISTS mkt_category_tone_presets_list (
  id VARCHAR(255) PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  tone VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, tone)
);
```

### 3.2 `mkt_campaigns_list` additions

```sql
ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS tone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS retainer VARCHAR(20) CHECK (retainer IN ('Fast', 'Medium', 'Slow')),
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '[]'::jsonb;
```

### 3.3 `mkt_prompt_templates_list` additions

```sql
ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN IF NOT EXISTS tone VARCHAR(50);
```

## 4. Backend changes

### 4.1 ID generator

Add `generateCategoryTonePresetId()` to `apps/api/src/lib/id-generator.ts` (`mctp-{nanoid}`).

### 4.2 New service: `MarketingCategoryToneService.ts`

Singleton extending `BaseService` with:
- `upsertPreset(category, tone, description, createdBy)`
- `getPresetByCategory(category)`
- `listPresets()`
- `deletePreset(id)`

### 4.3 `MarketingCampaignService.ts`

- `CampaignInput` / `CampaignUpdateInput` accept `tone`, `retainer`, and `attributes`.
- `CampaignListFilters` add `tone`, `retainer`, and `attributes` (array of strings).
- `createCampaign` auto-fills `tone` from the category preset if not provided.
- `listCampaigns` filters by `tone`, `retainer`, and `attributes` (overlap query on `attributes` JSONB).

### 4.4 `MarketingPromptService.ts`

- `PromptTemplateInput` accepts `tone`.
- `listTemplates` filters by `tone`.
- `clearDefaultForType` now keys on `(prompt_type, category, tone)` so the default per niche is stable.

### 4.5 `MarketingExecutionService.ts`

`renderTemplate` adds to `allVars`:
```ts
tone: campaign.tone || '',
attributes: (campaign.attributes || []).join(', '),
```
`retainer` is intentionally **not** added to `allVars` — it is a campaign filter-only field.

### 4.6 Routes: `apps/api/src/routes/marketing-ops.ts`

- Campaign create/update schema: `tone`, `retainer` (enum `Fast`/`Medium`/`Slow`), `attributes` (array of `z.string()`).
- Campaign list route: `req.query.tone`, `req.query.retainer`, `req.query.attributes`.
- Prompt template schema: `tone`.
- Prompt template list: `req.query.tone`.
- New `GET/POST/PUT/DELETE` routes under `/category-tone-presets` for preset CRUD.

## 5. Frontend changes

### 5.1 Types: `apps/web/src/services/MarketingOpsService.ts`

- `Campaign` / `CampaignCreateInput` / `CampaignUpdateInput` add `tone?: string`, `retainer?: 'Fast' | 'Medium' | 'Slow'`, and `attributes?: string[]`.
- `PromptTemplate` / `PromptTemplateCreateInput` add `tone?: string`.
- `listCampaigns` filters add `tone?: string`, `retainer?: 'Fast' | 'Medium' | 'Slow'`, and `attributes?: string[]`.
- `listPromptTemplates` filters add `tone?: string`.
- Add `CategoryTonePreset` type and service methods.

### 5.2 Shared vocabulary

Tone is a single-select control: a radio button group or `SuggestiveSelect`/dropdown during campaign initiation, and a `SuggestiveSelect` in the prompt library and prompt workspace. Campaign attributes are a checkbox list (not a dropdown) in the campaign form; they can be shown as multi-select chips or checkbox toggles in filters. `Retainer` is a campaign-only, filter-only single-select (`Fast`, `Medium`, `Slow`) and is not injected into prompts.

Introduce constants in `CampaignFormClient` / `PromptLibraryClient`:
```ts
const CAMPAIGN_ATTRIBUTES = [
  'Fast Retainers',
  'High Ticket',
  'Upscale',
  'Friendly',
  'Professional',
];

const RETAINER_OPTIONS = ['Fast', 'Medium', 'Slow'];

const DEFAULT_TONES = [
  'Professional',
  'Friendly',
  'Upscale',
  'Playful',
  'Empathetic',
  'Direct',
];
```

### 5.3 `CampaignFormClient.tsx`

- Add **Tone** as a radio selection or `SuggestiveSelect` next to **Category**; auto-fill from the category preset when `category` changes.
- Add **Retainer** as a radio selection or dropdown (`Fast`, `Medium`, `Slow`) during campaign initiation; purely for campaign filtering.
- Add **Attributes** as a checkbox list (Fast Retainers, High Ticket, etc.) during campaign initiation.
- Include new fields in create/update payloads.

### 5.4 `CampaignListClient.tsx`

- Add **Tone** `SuggestiveSelect` filter (distinct from loaded campaigns + presets), using the same dropdown pattern as Category.
- Add **Retainer** filter (`Fast` / `Medium` / `Slow`).
- Add **Attributes** multi-select / checkbox filter; campaign must match all selected attributes.
- Add `Tone`, `Retainer`, and `Attributes` columns and pills in table/Kanban views.

### 5.5 `PromptLibraryClient.tsx`

- Add **Tone** `SuggestiveSelect` field to the create/edit modal, matching the Category field behavior.
- Add **Tone** filter dropdown in the library.
- Template card shows `category` · `tone` when set.

### 5.6 `PromptWorkspaceClient.tsx`

- If the selected template has a `tone` or the selected campaign has a `tone`, render a `{{tone}}` variable input pre-filled automatically.
- Inject `tone` and `attributes` into the rendered preview.

### 5.7 Deliverable generation

`MarketingExecutionService` and `MarketingDeliverableService` already receive the campaign object. No UI changes required beyond the prompt engine variables. Add `{{tone}}` usage to default `review_responses` seed template.

## 6. Migration

`database/migrations/130_marketing_ops_category_tone.sql`:
- Creates `mkt_category_tone_presets_list`.
- Adds `tone`, `retainer`, and `attributes` to `mkt_campaigns_list`.
- Adds `tone` to `mkt_prompt_templates_list`.
- Adds `updated_at` triggers.
- Seeds 3–5 starter presets, e.g.:
  - `dental` → `Empathetic`
  - `legal` → `Professional`
  - `restaurant` → `Friendly`
  - `real estate` → `Upscale`
- `npx prisma db pull && npx prisma generate`

## 7. Tests

- `MarketingCampaignService.test.ts`: create with auto tone, list by tone/retainer/attributes.
- `MarketingPromptService.test.ts`: default clearing keyed by `(prompt_type, category, tone)`.
- `MarketingExecutionService.test.ts`: `renderTemplate` substitutes `{{tone}}` and `{{attributes}}`.
- `sprint-e2e-batch.test.ts`: new CUJ for review-response preset selection by category and tone.
- `route-coverage.test.ts`: new routes under `/api/admin/marketing-ops/category-tone-presets`.

## 8. Exit criteria

- [ ] Migration `130_marketing_ops_category_tone.sql` applies cleanly with `IF NOT EXISTS` guards.
- [ ] `npx prisma db pull && npx prisma generate` completes.
- [ ] `pnpm checkapi` passes with zero TS errors.
- [ ] `pnpm checkweb` passes with zero TS errors.
- [ ] Admin can set a default tone for any category.
- [ ] Creating a campaign with a category auto-fills the tone preset; user can override.
- [ ] Campaign attributes (Fast Retainers, High Ticket, Upscale, Friendly, Professional) are selectable and filterable.
- [ ] Retainer (Fast/Medium/Slow) is selectable on the campaign form and filterable in the campaign list; it is never injected into prompts.
- [ ] Prompt templates can be filtered and saved by `category` + `tone`.
- [ ] `{{tone}}` and `{{attributes}}` render in the prompt workspace and AI output.
- [ ] Existing Marketing Ops CUJs still pass.

## 9. Key files

| File | Change |
|------|--------|
| `database/migrations/130_marketing_ops_category_tone.sql` | DB schema + seed presets |
| `apps/api/src/lib/id-generator.ts` | `generateCategoryTonePresetId` |
| `apps/api/src/services/MarketingCategoryToneService.ts` | New singleton |
| `apps/api/src/services/MarketingCampaignService.ts` | Tone/attributes fields + filters |
| `apps/api/src/services/MarketingPromptService.ts` | Tone field + default scoping |
| `apps/api/src/services/MarketingExecutionService.ts` | `{{tone}}` / `{{attributes}}` injection |
| `apps/api/src/routes/marketing-ops.ts` | New schemas + endpoints |
| `apps/web/src/services/MarketingOpsService.ts` | Types + service methods |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` | Tone + attributes fields |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx` | Tone/attributes filters + display |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx` | Tone field + filter |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx` | Pre-fill `{{tone}}` / `{{attributes}}` |

## 10. Estimate

- Backend + migration: 2–3 days
- Frontend UI: 2–3 days
- Tests + polish: 1–2 days
- **Total: 5–8 dev days** (fits in 1 short sprint)
