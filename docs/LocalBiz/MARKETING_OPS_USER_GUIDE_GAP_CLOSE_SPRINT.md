# Sprint: Marketing Ops User Guide Gap Closure

**Status:** Draft — Ready for Review  
**Source of truth:** `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`  
**Goal:** Add the important coverage that exists in the specs and implementation but is currently missing from the user guide.

---

## 1. Why This Sprint

The existing user guide accurately covers the pages listed in the original request (`prompts`, `campaigns`, `campaigns/new`, `scorecards`, `deliverable-templates`, `branding`) and the recently added prompt execution modes. However, several major workflows from `local_marketing_ops_sprint_plan_v3.md` and the live frontend implementation are not documented. This sprint closes those gaps so the guide becomes a complete reference for the module.

---

## 2. Scope

### In Scope

Add user-guide coverage for:

- **Filter Review Inbox** — quality-filter workflow, statuses, and actions.
- **Campaign Detail page** — tabs, stage pipeline, demo/link tenant, deliverables.
- **Stage transitions and rules** — irreversible moves, notes, and the 7-day auto-advance from `shown` to `lost`.
- **Prompt versioning and execution metadata** — template versions, execution history, and cost/usage tracking.
- **Deliverable public preview / QR conversion flow** — watermarked public preview pages and QR-driven conversions.
- **Campaign Audits and Files tabs** — how audit records and files are attached to a campaign.

### Out of Scope

- New feature development for Marketing Ops.
- Changes to the backend, frontend, or database.
- Full UI/UX audit of pages already covered in detail.

---

## 3. Timeline

**Sprint Duration:** 1 week  
**Effort estimate:** 13 points

---

## 4. Tasks

| # | Task | Owner | Points | Notes |
|---|------|-------|--------|-------|
| 1 | Add **Filter Review** section (`/settings/admin/marketing-ops/filter-review`) | Docs / Technical Writer | 3 | Cover pending/fixed/approved status, failed checks, suggested fix, human override, batch actions; source from `FilterReviewClient.tsx` and sprint plan §6.4. |
| 2 | Add **Campaign Detail** section (`/settings/admin/marketing-ops/campaigns/[id]`) | Docs / Technical Writer | 3 | Cover Overview, Audits, Files, Deliverables, Stage History tabs; stage pipeline; Edit/Delete; Demo Storefront and Link Tenant buttons; source from `CampaignDetailClient.tsx`. |
| 3 | Add **Stage Transitions & Rules** guidance | Docs / Technical Writer | 2 | Document valid/irreversible transitions, required notes, and `shown → lost` auto-advance; source from `MarketingCampaignService.ts` `VALID_TRANSITIONS` and sprint plan §3. |
| 4 | Add **Prompt Versioning & Execution Metadata** note | Docs / Technical Writer | 2 | Document template version display and execution fields (`tokens_used`, `cost_cents`, `pass_rate`, `flagged_count`, `ai_provider`, `ai_model`); source from `MarketingOpsService.ts` and `PromptLibraryClient.tsx`. |
| 5 | Add **Deliverable Public Preview / QR Flow** note | Docs / Technical Writer | 2 | Document the watermarked public preview page, QR deliverable scan, and conversion tracking; source from `tenant_prospecting_channel_sprint_plan.md` and `CampaignDetailClient.tsx`. |
| 6 | Cross-reference all new sections to source docs and components | Docs / Technical Writer | 1 | Add component and doc links to the References section. |

---

## 5. Acceptance Criteria

- [ ] Each in-scope topic has a dedicated, accurate section in `MARKETING_OPS_USER_GUIDE.md`.
- [ ] Every new section is written from the user's point of view (step-by-step actions, not implementation details).
- [ ] Screenshots are not required, but UI labels and button names match the live implementation.
- [ ] All new sections include source citations (sprint plan, component, or service file).
- [ ] The guide still `checkweb` clean (no code changed, but ensure no broken markdown).
- [ ] Stakeholder review is complete and approved.

---

## 6. Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| `Filter Review` or `Campaign Detail` UI changes in flight | Re-read the component files immediately before writing each section. |
| Overlapping with other docs (e.g., skill docs) | Keep the user guide focused on UI/UX actions only. |
| Large scope creep | Stop after the six listed tasks; open a follow-up sprint for further polish. |

---

## 7. References

- `docs/LocalBiz/MARKETING_OPS_USER_GUIDE.md`
- `docs/LocalBiz/local_marketing_ops_sprint_plan_v3.md`
- `docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/filter-review/FilterReviewClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`
- `apps/web/src/services/MarketingOpsService.ts`
- `apps/web/src/components/marketing-ops/StageBadge.tsx`
