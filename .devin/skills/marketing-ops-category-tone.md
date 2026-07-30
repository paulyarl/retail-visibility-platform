---
description: How to add and use category-tone, retainer, and attributes fields in Marketing Ops
---

# Marketing Ops — Category, Tone, Retainer, and Attributes

Use this skill when extending Marketing Ops entities (campaigns, prompt templates, executions) with niche/voice metadata.

## Data Model

- `mkt_category_tone_presets_list` — maps a category to its default tone.
- `mkt_campaigns_list` — has `tone` (string), `retainer` (`Fast` | `Medium` | `Slow`), and `attributes` (JSONB string array).
- `mkt_prompt_templates_list` — has `tone` (string), scoping the template by `category` + `tone`.

## UI Conventions

- **Tone** is a single-select `SuggestiveSelect` everywhere: campaign form, campaign list filter, prompt modal, and prompt filter. Use `distinctValues()` on existing records to populate options.
- **Retainer** is a single-select dropdown with the three fixed values: `Fast`, `Medium`, `Slow`. It is a campaign-only, filter-only field.
- **Attributes** are a checkbox list in the campaign form. Available attributes are:
  - `Fast Retainers`
  - `High Ticket`
  - `Upscale`
  - `Friendly`
  - `Professional`
- The campaign list can filter by an attribute; it must contain that attribute.

## Backend Conventions

- Use the ID generator for new entities (`generateCategoryTonePresetId` for presets).
- `MarketingCategoryToneService` handles preset CRUD.
- On campaign creation, auto-fill `tone` from `mkt_category_tone_presets_list` if not provided.
- `retainer` is intentionally **not** injected into prompt variables.
- `MarketingExecutionService.renderTemplate` injects `tone` and `attributes` (joined to a string) into `allVars`.

## Key Files

- `apps/web/src/services/MarketingOpsService.ts` — frontend types and filters.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx` — tone/retainer/attributes form fields.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignListClient.tsx` — tone/retainer/attribute filters and display.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx` — tone field and filter for templates.
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx` — pre-fills `{{tone}}` and `{{attributes}}` from the selected campaign.
- `apps/api/src/services/MarketingCampaignService.ts`, `MarketingPromptService.ts`, `MarketingExecutionService.ts`, `MarketingCategoryToneService.ts` — backend logic.
- `apps/api/src/routes/marketing-ops.ts` — API schemas and endpoints.
- `database/migrations/132_marketing_ops_category_tone.sql` — schema and seed data.

## Common Pitfalls

- Do not add `retainer` to prompt variables; it is a filter-only field.
- The `attributes` DB column is JSONB, but the Prisma model returns/accepts `string[]` in the frontend; keep arrays in the service layer.
- `PromptTemplate` `is_default` is now scoped by `(prompt_type, category, tone)`; update `clearDefaultForType` accordingly.
- The `SuggestiveSelect` pattern expects a `value` prop of `string` and an `onChange(value: string)`. Do not try to pass `null` or objects.
