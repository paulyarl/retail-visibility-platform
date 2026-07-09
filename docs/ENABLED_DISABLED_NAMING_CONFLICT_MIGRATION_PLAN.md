# Ambiguous `_enabled` / `_disabled` Feature-Key Migration Plan

## 1. Problem Statement

Within the capability system, the suffix pair `_enabled` / `_disabled` is used for two different roles:

- **Type gate keys** — the master on/off switch for an entire capability type.
- **Group control keys** — a positive/negative gate that enables or disables a *sub-group* of features inside a capability type.

When a single capability type contains more than one `_enabled` / `_disabled` pair, the naming is semantically overloaded and makes type-gate-precedence logic impossible to implement safely.

This plan follows the agreed migration rule:

1. Identify all `_enabled` / `_disabled` feature keys within all capability types.
2. Count complete `_enabled` / `_disabled` pairs per capability type.
3. If a capability type contains **more than one pair**, the pair with the **shortest base name** is the type gate.
4. Every longer pair is a **group pair** and is migrated to `_on` / `_off`.
5. Migrate the group pairs in the **backend**.
6. Migrate the group pairs in the **frontend**.

---

## 2. Audit Findings (from `capability_features_list` / `features_list`)

The following table lists every capability type that contains `_enabled` or `_disabled` feature keys, and the complete `_enabled` / `_disabled` pairs discovered in the database.  A "complete pair" means both the `*_enabled` and matching `*_disabled` feature keys exist for the same base name.

### 2.1 Pair Count Per Capability Type

| Capability Type | Type-Gate Pair (shortest) | Other `_enabled`/`_disabled` Pairs | Pair Count |
|---|---|---|---|
| `barcode_scan_options` | `barcode_enabled` / `barcode_disabled` | — | 1 |
| `commerce_types` | `commerce_enabled` / `commerce_disabled` | — | 1 |
| `crm_options` | `crm_enabled` / `crm_disabled` | — | 1 |
| `directory_entry` | `directory_entry_enabled` / `directory_entry_disabled` | — | 1 |
| `directory_promotion` | `directory_promotion_enabled` / `directory_promotion_disabled` | — | 1 |
| `faq_options` | `faq_enabled` / `faq_disabled` | — | 1 |
| `featured_options` | `featured_enabled` / `featured_disabled` | — | 1 |
| `fulfillment_options` | `fulfillment_enabled` / `fulfillment_disabled` | — | 1 |
| `integration_options` | `integration_enabled` / `integration_disabled` | — | 1 |
| `organization_options` | `org_enabled` / `org_disabled` | — | 1 |
| `payment_gateway_options` | `payment_gateway_enabled` / `payment_gateway_disabled` | — | 1 |
| `product_options` | `product_options_enabled` / `product_options_disabled` | `product_options_creation_*`, `product_options_layout_*`, `product_options_sections_*` | **4** |
| `product_types` | `product_types_enabled` / `product_types_disabled` | — | 1 |
| `quickstart_options` | `quickstart_enabled` / `quickstart_disabled` | — | 1 |
| `social_commerce_options` | `social_commerce_enabled` / `social_commerce_disabled` | — | 1 |
| `storefront_options` | `storefront_opt_enabled` / `storefront_opt_disabled` | — | 1 |
| `storefront_types` | `storefront_enabled` / `storefront_disabled` | — | 1 |

**Result:** `product_options` is the only capability type that currently contains more than one complete `_enabled` / `_disabled` pair.  It is the primary target for the strict migration rule.

### 2.2 Primary Migration Targets — `product_options` Group Pairs

The shortest pair is the type gate.  All longer pairs are group pairs and must migrate to `_on` / `_off`.

| Current Group Pair | New Group Pair | Role |
|---|---|---|
| `product_options_creation_enabled` / `product_options_creation_disabled` | `product_options_creation_on` / `product_options_creation_off` | Product-creation feature group |
| `product_options_layout_enabled` / `product_options_layout_disabled` | `product_options_layout_on` / `product_options_layout_off` | Product layout feature group |
| `product_options_sections_enabled` / `product_options_sections_disabled` | `product_options_sections_on` / `product_options_sections_off` | Product sections feature group |

### 2.3 Required Migration — Single `_enabled` Group Keys

A number of capability types contain **single** `*_enabled` group-control keys (no matching `*_disabled` in the database).  Although they do not form complete `_enabled` / `_disabled` pairs, they still use the `_enabled` suffix for group controls and therefore conflict with the type-gate convention.  To solidify the rule that **group control switches use `_on` / `_off`**, all single `_enabled` group-control keys must migrate to `_on` (and `_off` must be introduced only where the resolver or business logic explicitly needs a negative gate; otherwise `_on` alone is sufficient).

| Capability Type | Current Group `_enabled` Key | New Group `_on` Key | Notes |
|---|---|---|---|
| `chatbot_options` | `chatbot_dynamic_enabled` | `chatbot_dynamic_on` | |
| `chatbot_options` | `chatbot_kb_enabled` | `chatbot_kb_on` | |
| `chatbot_options` | `chatbot_skills_enabled` | `chatbot_skills_on` | |
| `chatbot_options` | `chatbot_static_enabled` | `chatbot_static_on` | |
| `chatbot_options` | `chatbot_widget_enabled` | `chatbot_widget_on` | |
| `crm_options` | `crm_inquiry_directory_enabled` | `crm_inquiry_directory_on` | |
| `crm_options` | `crm_inquiry_product_enabled` | `crm_inquiry_product_on` | |
| `crm_options` | `crm_inquiry_storefront_enabled` | `crm_inquiry_storefront_on` | |
| `directory_entry` | `directory_entry_contact_enabled` | `directory_entry_contact_on` | |
| `directory_entry` | `directory_entry_gallery_enabled` | `directory_entry_gallery_on` | |
| `directory_entry` | `directory_entry_hours_enabled` | `directory_entry_hours_on` | |
| `directory_entry` | `directory_entry_layout_enabled` | `directory_entry_layout_on` | |
| `directory_entry` | `directory_entry_map_enabled` | `directory_entry_map_on` | |
| `directory_entry` | `directory_entry_qr_enabled` | `directory_entry_qr_on` | |
| `directory_entry` | `directory_entry_seo_enabled` | `directory_entry_seo_on` | |
| `directory_entry` | `directory_entry_social_enabled` | `directory_entry_social_on` | |
| `faq_options` | `faq_display_enabled` | `faq_display_on` | |
| `faq_options` | `faq_kb_enabled` | `faq_kb_on` | |
| `faq_options` | `faq_management_enabled` | `faq_management_on` | |
| `faq_options` | `faq_preview_enabled` | `faq_preview_on` | |
| `faq_options` | `faq_product_enabled` | `faq_product_on` | |
| `faq_options` | `faq_storefront_enabled` | `faq_storefront_on` | |
| `faq_options` | `faq_templates_enabled` | `faq_templates_on` | |
| `featured_options` | `featured_platform_enabled` | `featured_platform_on` | Add `_off` only if platform group needs negative gate |
| `featured_options` | `featured_tenant_enabled` | `featured_tenant_on` | Add `_off` only if tenant group needs negative gate |
| `integration_options` | `integration_google_enabled` | `integration_google_on` | |
| `integration_options` | `integration_pos_enabled` | `integration_pos_on` | |
| `quickstart_options` | `quickstart_ai_enabled` | `quickstart_ai_on` | |
| `quickstart_options` | `quickstart_category_enabled` | `quickstart_category_on` | |
| `quickstart_options` | `quickstart_product_enabled` | `quickstart_product_on` | |
| `social_commerce_options` | `social_commerce_meta_enabled` | `social_commerce_meta_on` | |
| `social_commerce_options` | `social_commerce_tiktok_enabled` | `social_commerce_tiktok_on` | |
| `storefront_options` | `storefront_opt_advanced_enabled` | `storefront_opt_advanced_on` | |
| `storefront_options` | `storefront_opt_category_enabled` | `storefront_opt_category_on` | |
| `storefront_options` | `storefront_opt_gallery_enabled` | `storefront_opt_gallery_on` | |
| `storefront_options` | `storefront_opt_hours_enabled` | `storefront_opt_hours_on` | |
| `storefront_options` | `storefront_opt_info_enabled` | `storefront_opt_info_on` | |
| `storefront_options` | `storefront_opt_qr_enabled` | `storefront_opt_qr_on` | |
| `storefront_options` | `storefront_opt_recommend_enabled` | `storefront_opt_recommend_on` | |

**Rule:** A single `_enabled` group-control key is treated as a group **on** switch and migrated to `*_on` even when no `*_off` counterpart exists today.

---

## 3. Phased Migration Plan

### Phase 0 — Pre-Migration Audit & Tooling

0.1. **Confirm the inventory.**
  - Re-run the audit query against `capability_type_list`, `capability_features_list`, and `features_list` immediately before migration to verify that no new `_enabled` / `_disabled` pairs have been introduced.
  - Produce the exact list of `feature_id` values and `feature_key` values to migrate.

0.2. **Identify every table and code file that stores or references the target keys.**
  - `features_list`
  - `capability_features_list`
  - `tier_features_list`
  - `tenant_features_list` / `tenant_purchased_features_list` / `feature_purchase_history` (if used)
  - `mv_tenant_effective_capabilities` definition
  - `capability_resolutions` JSON / settings columns that embed merchant settings by key
  - Backend resolvers in `apps/api/src/services/resolvers/`
  - Backend type definitions in `apps/api/src/services/resolvers/types.ts`
  - Utility SQL in `apps/api/src/utils/tier-capability-sql.ts`
  - Frontend state interfaces in `apps/web/src/services/CapabilityResolutionService.ts`
  - Frontend mapper in `apps/web/src/services/UnifiedCapabilityService.ts`
  - Settings pages / forms that set merchant preferences by key
  - BSaaS feature store code and catalog code in `apps/web/src/app/(platform)/settings/feature-store/`
  - Include both the product-options `_enabled` / `_disabled` group pairs and the single `_enabled` group keys listed in §2.3.

0.3. **Freeze the affected capability seeds and tier seeds** until the migration is deployed to all environments.

0.4. **Create feature-key migration scripts** (`database/migrations/XXX_migrate_product_options_group_gates_to_on_off.sql` and `database/migrations/XXX_migrate_single_enabled_group_keys_to_on.sql`) that are idempotent and reversible, covering both the product-options `_enabled` / `_disabled` group pairs and the single `_enabled` group keys in §2.3.

### Phase 1 — Database Feature-Key Migration (Product Options)

1.1. **Insert new group-gate feature keys into `features_list`.**
  - `product_options_creation_on`
  - `product_options_creation_off`
  - `product_options_layout_on`
  - `product_options_layout_off`
  - `product_options_sections_on`
  - `product_options_sections_off`

1.2. **Map new keys to `capability_features_list`.**
  - Add `product_options` capability type rows for the six new keys, copying metadata from the old `_enabled` / `_disabled` rows.
  - Mark the old `_enabled` / `_disabled` group-gate rows as `is_active = false` (do not delete until Phase 9).

1.3. **Migrate `tier_features_list` references.**
  - For every tier that currently has `product_options_creation_enabled` / `product_options_creation_disabled`, insert corresponding rows for `_on` / `_off` with the same `is_enabled` value.
  - Repeat for `layout` and `sections`.

1.4. **Migrate `tenant_features_list` and purchased-feature records.**
  - If any tenancies have been granted the old group-gate keys via `tenant_features_list` or purchase records, add the corresponding new `_on` / `_off` keys.

1.5. **Update merchant-preference schemas.**
  - If `merchant_settings` or `capability_resolutions` JSON stores `product_options_*_enabled` / `product_options_*_disabled` keys, add the `_on` / `_off` keys and copy the old values during migration.

### Phase 2 — Backend Resolver Migration (Product Options)

2.1. **Update `ProductOptionsResolver.ts`.**
  - Replace group-gate reads from `product_options_creation_enabled` / `product_options_creation_disabled` with `product_options_creation_on` / `product_options_creation_off`.
  - Replace group-gate reads from `product_options_layout_enabled` / `product_options_layout_disabled` with `product_options_layout_on` / `product_options_layout_off`.
  - Replace group-gate reads from `product_options_sections_enabled` / `product_options_sections_disabled` with `product_options_sections_on` / `product_options_sections_off`.
  - Keep the type-gate (`product_options_enabled` / `product_options_disabled`) unchanged.
  - Implement a **temporary fallback** for 1–2 releases: if the new `_on` / `_off` keys are absent, read the old `_enabled` / `_disabled` keys and log a deprecation warning.

2.2. **Update `apps/api/src/services/resolvers/types.ts`.**
  - Rename effective fields whose names derive from group pairs (e.g., `creationEnabled`/`creationDisabled` semantics remain, but underlying data uses `_on` / `_off`).
  - Add new feature-key fields to `EffectiveProductOptions` / `ProductOptionsMerchantSettings` interfaces.

2.3. **Update `apps/api/src/utils/tier-capability-sql.ts`.**
  - Replace hard-coded `product_options_creation_enabled`, `product_options_creation_disabled`, etc. with the `_on` / `_off` variants.

2.4. **Update `mv_tenant_effective_capabilities` materialized view.**
  - If the view selects or pivots the old group-gate columns, update the SQL to use `_on` / `_off`.
  - Refresh all dependent views and triggers.

2.5. **Run `pnpm checkapi` to validate TypeScript.**

### Phase 3 — Frontend State & Service Migration (Product Options)

3.1. **Update `apps/web/src/services/CapabilityResolutionService.ts`.**
  - Update `ProductOptionsState` fields that derive from group gates to reflect `_on` / `_off` naming where applicable.
  - Do not change `enabled` boolean fields in the resolved state; only rename feature-key-derived properties if they expose the raw feature key.

3.2. **Update `apps/web/src/services/UnifiedCapabilityService.ts`.**
  - Update `BackendEffectiveProductOptions` if it returns raw feature-key booleans.
  - Update mapping functions (`mapProductOptions`) to read the new snake_case keys from the backend response.

3.3. **Update settings pages / forms.**
  - Any merchant-preference form that writes `product_options_*_enabled` or `product_options_*_disabled` for group gates must write the `_on` / `_off` keys instead.
  - Provide temporary dual-write fallback to old keys during the transition.

3.4. **Run `pnpm checkweb` to validate TypeScript.**

### Phase 4 — Capability Constraint & Rule Updates

4.1. **Update `capability-data-flow-rules.md`.**
  - Update **R15** to state:
    - Capability type gates use `_enabled` / `_disabled`.
    - Feature group gates use `_on` / `_off`.
  - Update examples and any rule text that shows `_enabled` / `_disabled` for group gates.

4.2. **Update capability constraint definitions.**
  - If any constraint in `capability_features_list` or constraint code references the old `_enabled` / `_disabled` group keys or old single `_enabled` group keys, repoint them to `_on` / `_off` or `_on`.

4.3. **Update BSaaS feature catalog / feature-store logic.**
  - If `product_options_creation_enabled` etc. appear as purchasable feature keys, update catalog definitions and purchase validation to use `_on` / `_off`.

### Phase 5 — Canonicalize Single `_enabled` Group Keys (Required)

This phase applies the `_on` convention to all single `_enabled` group controls identified in §2.3.  It is **required** to enforce the canonical rule that group controls use `_on` / `_off` while type gates use `_enabled` / `_disabled`.

5.1. **For every capability type, migrate each single `_enabled` group-control key to `*_on`.**
  - Insert the new `_on` key into `features_list` and `capability_features_list` for the correct capability type, copying metadata from the existing `_enabled` row.
  - Migrate `tier_features_list` and `tenant_features_list` values to the new `_on` key.
  - Mark the old `_enabled` group-control key as `is_active = false` in `features_list` once all code references have been updated.
  - Create a matching `_off` key only if the resolver or business logic explicitly needs a negative group gate; otherwise a single `_on` group switch is sufficient.

5.2. **Update all affected resolvers to read `*_on` group keys.**
  - Add `|| !!features.<group>_on` (or replace `*_enabled`) in each resolver's group-gate logic.
  - Keep a temporary `*_enabled` fallback for 1–2 releases and log a deprecation warning.
  - Resolvers to update:
    - `ChatbotOptionsResolver.ts`
    - `DirectoryEntryOptionsResolver.ts`
    - `FaqOptionsResolver.ts`
    - `StorefrontOptionsResolver.ts`
    - `QuickstartOptionsResolver.ts`
    - `SocialCommerceOptionsResolver.ts`
    - `CrmOptionsResolver.ts` (for `crm_inquiry_*_enabled`)
    - `IntegrationOptionsResolver.ts` (for `integration_*_enabled`)
    - `FeaturedOptionsResolver.ts` (for `featured_tenant_enabled`, `featured_platform_enabled`)

5.3. **Update `apps/api/src/services/resolvers/types.ts` and frontend state interfaces.**

5.4. **Update database feature keys, tier seeds, merchant settings, and materialized-view SQL** for all renamed keys.

### Phase 6 — Testing & Verification

6.1. **Database migration dry-run.**
  - Run the migration SQL against a staging copy of production.
  - Verify that:
    - Each new `_on` / `_off` key is present.
    - Each tier retains the same effective state as before.
    - The materialized view regenerates without errors.

6.2. **Backend unit tests.**
  - Test `ProductOptionsResolver.ts` with all combinations of the new `_on` / `_off` keys.
  - Add tests for each resolver affected by Phase 5 (`ChatbotOptionsResolver.ts`, `DirectoryEntryOptionsResolver.ts`, `FaqOptionsResolver.ts`, `StorefrontOptionsResolver.ts`, `QuickstartOptionsResolver.ts`, `SocialCommerceOptionsResolver.ts`, `CrmOptionsResolver.ts`, `IntegrationOptionsResolver.ts`, `FeaturedOptionsResolver.ts`) to verify `*_on` keys resolve correctly.
  - Add regression tests asserting that old `_enabled` / `_disabled` group keys are still honored during the fallback window.

6.3. **Frontend type checks.**
  - `pnpm checkapi`
  - `pnpm checkweb`

6.4. **End-to-end verification.**
  - For at least one tier with `product_options_creation_on` / `product_options_creation_off`, verify the storefront product page reflects the correct creation layout.
  - For one tenant with merchant preferences, verify toggles still persist and resolve correctly.

### Phase 7 — Cleanup & Finalization

7.1. **Dual-key fallback removal.**
  - After all production environments have deployed the new `_on` / `_off` keys and the old keys are no longer referenced, remove the temporary fallback reads in resolvers and frontend services.

7.2. **Deactivate old feature keys in `features_list`.**
  - Set `is_active = false` for `product_options_creation_enabled`, `product_options_creation_disabled`, `product_options_layout_enabled`, `product_options_layout_disabled`, `product_options_sections_enabled`, `product_options_sections_disabled`.
  - Set `is_active = false` for all migrated single `_enabled` group keys in §2.3 (e.g., `chatbot_static_enabled`, `faq_storefront_enabled`, `storefront_opt_hours_enabled`, etc.).
  - Do not delete rows if they are tied to historical tier assignments or purchase records.

7.3. **Drop deprecated columns / SQL references.**
  - Remove references from active code and materialized view definitions.

7.4. **Run final verification.**
  - `pnpm checkapi`
  - `pnpm checkweb`
  - `pnpm test` or targeted test suites.

### Phase 8 — Skill Document & Runbook Updates (Final Step)

After the migration is verified, update the relevant skill documents so future work does not reintroduce the `_enabled` / `_disabled` group-gate ambiguity.

8.1. **Update `capability-data-flow-rules.md`.**
  - Finalize **R15** (Feature Key Naming Convention) to explicitly state:
    - Capability type gates use `_enabled` / `_disabled`.
    - Feature group controls use `_on` / `_off`.
  - Add a short example and a cross-reference to this migration plan.

8.2. **Update `start-of-phase-sprint-checklist.md`.**
  - In the capability-system planning section, add a check:
    - "Verify new `_enabled` / `_disabled` feature keys do not create an ambiguous pair with an existing type gate. Group controls must use `_on` / `_off`."
  - Reference this migration plan until the migration is fully deployed.

8.3. **Update `end-of-phase-sprint-checklist.md`.**
  - In the capability-system verification section, add a check:
    - "If new capability feature keys were added, confirm none of them are new `_enabled` / `_disabled` group gates. Group controls must use `_on` / `_off`."

8.4. **Archive this migration plan.**
  - Once the migration is complete and old feature keys are deactivated, move this plan to `docs/archive/` or mark it as completed in the file header.

---

## 4. Files & Components Requiring Changes

### 4.1 Backend

- `apps/api/src/services/resolvers/ProductOptionsResolver.ts`
- `apps/api/src/services/resolvers/types.ts`
- `apps/api/src/utils/tier-capability-sql.ts`
- `apps/api/src/services/StorefrontOptionsService.ts` (if it resolves product options)
- `database/migrations/XXX_migrate_product_options_group_gates_to_on_off.sql`
- `database/migrations/XXX_mv_tenant_effective_capabilities_group_keys_update.sql` (if MV selects old group gates)
- `.devin/skills/capability-data-flow-rules.md` (R15 update)

### 4.2 Frontend

- `apps/web/src/services/CapabilityResolutionService.ts`
- `apps/web/src/services/UnifiedCapabilityService.ts`
- Any settings page that mutates merchant preference keys for product-options group gates
- BSaaS feature store UI (`apps/web/src/app/(platform)/settings/feature-store/page.tsx`) if group keys are listed

---

## 5. Rollback Plan

1. **Before each phase**, snapshot the relevant tables (`features_list`, `capability_features_list`, `tier_features_list`, `tenant_features_list`, `merchant_settings`, MV definitions).
2. **Migration SQL must be reversible:** each insert of a new `_on` / `_off` or `_on` key must record the source old key and tenant/tier it came from.
3. **Code fallback windows** keep the old key reads active until Phase 7.
4. If a deployment fails:
  - Revert resolver and frontend code to the commit before the migration.
  - Re-activate the old `_enabled` / `_disabled` feature keys (`is_active = true`).
  - Deactivate the new `_on` / `_off` feature keys (`is_active = false`).
  - Refresh the materialized view.

---

## 6. Deliverables

- [ ] Database migration script for `product_options` group pairs.
- [ ] Updated `ProductOptionsResolver.ts` with `_on` / `_off` reads and `_enabled` / `_disabled` fallback.
- [ ] Updated `apps/api/src/services/resolvers/types.ts`.
- [ ] Updated `apps/api/src/utils/tier-capability-sql.ts`.
- [ ] Updated materialized view SQL (if applicable).
- [ ] Updated `CapabilityResolutionService.ts` and `UnifiedCapabilityService.ts`.
- [ ] Updated capability-data-flow-rules.md (R15 naming convention).
- [ ] Regression test plan and passing `checkapi` / `checkweb`.
- [ ] Phase 5 migration script for all single `_enabled` group keys (required).
