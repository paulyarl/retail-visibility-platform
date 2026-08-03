# Intelligent Playbook Catalog & Triage Engine — Admin Runbook

## Overview

The triage engine automatically matches business campaigns to the best outreach playbook based on detected signals from audit data. This runbook covers daily operations, troubleshooting, and configuration.

## Architecture Summary

```
Business Analysis Audit (AI scan)
  → detected_signals[] (SignalCode union, 24 known codes)
  → Signal Extractor (emits SignalCode[] from audit + campaign fields)
  → Triage Engine (generic DSL evaluator: any/all/none/dual clauses)
  → Playbook Catalog (6 seeded playbooks, ordered by priority_rank)
  → Recommended Playbook (code, archetype, FITD offer, retainer pitch)
  → Operator decision: Accept / Override / Enrich signals
  → Opener generation (archetype-specific prompt → LLM → quality gate)
```

## Admin UI Locations

| Feature | URL | Purpose |
|---------|-----|---------|
| Playbook Catalog | `/settings/admin/marketing-ops/playbooks` | Manage playbooks, rules, signal registry |
| Campaign Triage | Campaign detail page (seek-stage only) | Evaluate, accept, override, enrich signals |
| Signal Display | Audit cards (business + city category) | View AI-detected signals per business |

## Daily Operations

### 1. Reviewing a New Campaign (Seek Stage)

1. Navigate to the campaign detail page.
2. The **Intelligent Triage** card appears above the tabs (only for `seek`-stage campaigns).
3. Click **Evaluate** to run the signal extractor + triage engine.
4. Review:
   - **Recommended playbook** (code, name, category, archetype)
   - **Rule Confidence** (signal match strength, NOT ML probability)
   - **Triggered signals** (color-coded by family)
   - **Rationale** (plain-language explanation)
5. If the AI scan missed signals or flagged false positives:
   - Click **Enrich signals**
   - Use the dropdown picker to add known signals or remove false positives
   - Click **Re-run triage** to re-evaluate with the enriched set
6. If BBB data is needed for PB-04 (crisis):
   - Expand **BBB pre-flight inputs**
   - Enter BBB grade (A–F or NR) and unanswered complaint count
   - Click **Evaluate** — PB-04 will match if grade ≤ C or complaints ≥ 3
7. **Accept** the recommendation or **Override** with a different playbook.

### 2. Accepting vs Overriding

- **Accept**: Re-categorizes the campaign to the playbook's category and applies the FITD fee. The opener generation will use the triage-derived archetype.
- **Override**: Same re-categorization, but with a different playbook. Requires selecting a playbook code from the dropdown. An optional reason can be provided.

### 3. Re-evaluating After Acceptance

After a decision is made, the triage card shows the decided state (green = accepted, amber = overridden). Click **Re-evaluate** to reset the decision and re-run the engine. This clears the operator acceptance and requires a new accept/override.

## Playbook Catalog Management

### Reordering the Cascade

The triage engine evaluates playbooks in `priority_rank` ascending order (lowest number = highest priority). First match wins.

- Use the **up/down arrows** in the playbook table to swap ranks.
- **Critical**: PB-04 (crisis) must stay above PB-05 (dual) and PB-03 (fallback) to ensure crisis cases always win.
- Reordering is the primary "tuning" lever — no code deploy needed.

### Editing Matching Rules (Rule Builder)

1. Click the **edit** (pencil) icon on a playbook row.
2. Scroll to the **Matching Rules (DSL)** section.
3. Use the structured editor:
   - **ANY**: Match if at least ONE signal is present (trigger clause)
   - **ALL**: Match only if ALL signals are present (required clause)
   - **NONE**: Block match if ANY signal is present (guard clause)
   - **DUAL**: Match if ≥1 from groupA AND ≥1 from groupB (cross-family)
4. Adjust the **Confidence** slider (0–100%).
5. Use the **Raw JSON** toggle for advanced editing (round-trips through Zod validation).

### Creating a New Playbook

1. Click **New Playbook** in the playbooks tab.
2. Fill in: code (PB-XX), name, category, archetype (A1–A5), FITD/retainer fees.
3. Set the priority rank (lower = higher priority in the cascade).
4. Configure matching rules using the Rule Builder.
5. Save. The playbook is immediately active and evaluated by the triage engine.

## Signal Registry Management

### Registering a New Signal

1. Go to the **Signals** tab in the playbook catalog page.
2. Click **Register Signal**.
3. Fill in:
   - **Code**: `FAMILY_UPPER_SNAKE` format (e.g. `RA_REVIEW_DROUGHT`)
   - **Family**: 2–3 letter prefix (RA, DS, WC, CP, VP)
   - **Label**: Human-readable description
   - **Detection Source**: `model_emitted` (AI outputs it), `derived` (extractor computes it), `operator_input` (manual)
4. **Warning**: `derived` signals need extractor code in `signal-extractor.ts` to fire automatically. Registering here makes the code available in the Rule Builder, but it won't be auto-detected until the extractor is updated.

### Activating/Deactivating Signals

Click the active indicator (green/gray dot) to toggle. Inactive signals:
- Are NOT emitted by the extractor
- Are NOT available in the Rule Builder signal picker
- Remain referenced by existing playbook rules (but won't match)

## Signal Families

| Code | Family | Examples |
|------|--------|----------|
| RA | Reputation & Administrative | `RA_REVIEW_DROUGHT`, `RA_UNANSWERED_GAP`, `RA_BBB_GRADE_SUPPRESSION` |
| DS | Digital Surface & Profile | `DS_GBP_UNCLAIMED`, `DS_GBP_INACTIVE_POSTS` |
| WC | Website & Conversion | `WC_NO_CTA`, `WC_DEAD_URL`, `WC_URL_MISMATCH` |
| CP | Cross-Platform & NAP | `CP_NAP_DRIFT_NAME`, `CP_NAP_DRIFT_ADDRESS` |
| VP | Content & Visual Proof | `VP_NO_RECENT_PHOTOS`, `VP_LOW_PHOTO_COUNT` |

## Troubleshooting

### "No triage result found"

The campaign has no triage evaluation. Click **Evaluate** in the triage card.

### "No business_analysis audit"

The triage engine requires a `business_analysis` audit on the campaign. Run a seek-stage business analysis first (via the Prompts tab → business_analysis prompt template).

### PB-04 (crisis) never matches

PB-04 depends on BBB data (`bbb_grade` and `unanswered_bbb_complaints`). These are NOT auto-ingested. Operators must manually enter them via the BBB pre-flight inputs in the triage card.

### PB-05 (dual) never matches

PB-05 requires signals from BOTH a repair family (CP/WC) AND a review family (RA). Check that:
1. The audit has NAP inconsistency data (`nap_consistency.overall_status !== 'consistent'`)
2. The campaign has a review drought (`last_review_date` > 180 days ago) OR a significant unanswered gap

### Opener uses wrong archetype

The opener service checks for an accepted triage result first. If the triage is accepted, the opener uses the triage-derived archetype. If not accepted (or no triage exists), it falls back to the deterministic `selectArchetype` function (A2 > A1 > A3 > A4, never A5).

**Fix**: Accept the triage recommendation before generating the opener.

### Signal enrichment doesn't change the recommendation

After enriching signals, click **Re-run triage**. The enrichment modifies the signal set, but the triage result is only updated when the engine re-evaluates.

## Seeded Playbook Cascade (Default)

| Rank | Code | Name | Archetype | Category | Key Rule |
|------|------|------|-----------|----------|----------|
| 1 | PB-04 | Crisis Reputation Recovery | A2 | recovery_management | ANY: BBB crisis signals |
| 2 | PB-01 | Review Response Gap | A1 | review_management | ANY: RA_UNANSWERED_GAP |
| 3 | PB-02 | Negative Review Recovery | A2 | review_management | ANY: RA_NEGATIVE_THEME_CLUSTER |
| 4 | PB-05 | Dual-Signal Footprint Triage | A5 | triage_management | DUAL: repair + review |
| 5 | PB-06 | Listing Inconsistency Repair | A3 | recovery_management | ANY: CP_NAP_DRIFT_* |
| 99 | PB-03 | Review Response Gap (Fallback) | A1 | review_management | ANY: RA_UNANSWERED_GAP (catch-all) |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/:campaignId/triage/evaluate` | Run triage (optional BBB + operator signals) |
| GET | `/:campaignId/triage` | Read stored triage result |
| POST | `/:campaignId/triage/accept` | Accept recommendation |
| POST | `/:campaignId/triage/override` | Override with different playbook |
| GET | `/playbooks` | List all playbooks |
| POST | `/playbooks` | Create playbook |
| PUT | `/playbooks/:id` | Update playbook |
| DELETE | `/playbooks/:id` | Delete playbook |
| PUT | `/playbooks/reorder` | Bulk reorder priority ranks |
| GET | `/signals` | List signal registry |
| POST | `/signals` | Register signal |
| PUT | `/signals/:id` | Update signal |
| DELETE | `/signals/:id` | Delete signal |
