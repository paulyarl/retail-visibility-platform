# Triage & Repair Outreach Problems — Sprint Plan

> Companion to `TRIAGE_REPAIR_OUTREACH_PROBLEMS_SPEC.md`. Adds the `outreach_problems` contract (1–3 problem → solution pairs) to the seven (eight — see Decision D1) triage/repair/audit prompts, enforces it in the output validators, surfaces it on three operator cards, and widens the opener-from-briefing hand-off.
>
> **Verification:** codebase audit performed 2026-09-16 against `staging` @ `61da6c5f`. Every spec file/line reference was confirmed (see "Verification findings" at the bottom — including two corrections to spec wording).

---

## Decisions to settle before coding

| # | Question | Recommendation |
|---|---|---|
| D1 | Fold `mpt-seed-seek-001` ("Seek: Business Audit", 1,865 chars, `business_analysis`, ends with `Format as structured JSON.`) into scope as an **8th template** via a new `transformSeedBusinessAudit`? | **Yes** — spec §4.4.1's recommended path. A business audit that silently skips the contract leaves the operator UX inconsistent. If excluded, record it in spec §1.2. |
| D2 | The seed task loop writes `variables: FULL_BUSINESS_VARIABLES` (7 vars) on every transformed template. `mpt-seed-seek-001` only declares/uses 3 (`business_name`, `city`, `category`). | Add a per-task `variables` field — pass `FULL_BUSINESS_VARIABLES` for the V1/V2 transforms, `undefined` (no write) for `mpt-seed-seek-001`. Extra declared vars are informational-only, but keeping the declaration honest avoids confusing the prompts UI. |

---

## Phase 0 — Pre-flight drift resolution (spec §4.4)

| # | Task | Files |
|---|---|---|
| 0.1 | **Dump live bodies before any full-body-replace seed.** Export the current `body` of all 8 templates (`mpt-profile-repair-triage-default`, the 3 `mpt-profile-repair-*-seek` issue templates, `mpt-j9bbem3l`, `mpt-6oeuiizo`, `mpt-je6m7ru6` (local only), `mpt-seed-seek-001`) to a scratch file under `docs/api-response/` or a git-ignored path — the triage + issue-briefing seeds discard manual UI edits on marker bump. | — (script or SQL select) |
| 0.2 | **Anchor verification.** Grep each live body for every anchor the transforms use: `### 5. Track Recommendation` / `### 5. Severity + Issue Type` / the closing "The output JSON shape is appended…" line (repair prompts); `Omit the field entirely when no category context was provided.` (Market Intel directive tail — the insertion anchor for all 3 audit transforms); `Format as structured JSON.` (`mpt-seed-seek-001`). Any `insertAfter` throws on a missing anchor — catch it before the seed run, not during. | live DB bodies |
| 0.3 | **Verify review-response template per env.** "Seek: Business Review Response V1" is absent from the prd dump (confirmed — the dump lists 31 templates, none named review-response). Check local before relying on it; the optional-Zod decision (§3.3) stands either way since `mpt-seed-seek-001` alone makes a required field unsafe on the shared schema. | `set-business-analysis-schema.ts`, local DB |

## Phase 1 — Output validators + prompt suffixes (`apps/api`)

| # | Task | Files | Notes |
|---|---|---|---|
| 1.1 | Add `outreach_problems` to `profileRepairTriageSchema` — inside the `profile_repair_triage` object, sibling of `pitch`/`risks`: `z.array(z.object({ problem, regular, hook, solution, evidence, outreach_use: z.string() })).min(1)`. **No `.max()`** — the ≤3 cap is prompt-level. | `apps/api/src/validators/profile-repair-output.schema.ts` | ⚠️ The inner object is **not** `.passthrough()` — an undeclared field would be silently stripped from `validated.data`, so this declaration is load-bearing for persistence (spec §3.4), not just validation. |
| 1.2 | Add the `outreach_problems` shape to `PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX` JSON block. | same file | Code-side; no seed re-run (§3.5). |
| 1.3 | Same field + `.min(1)` (required) in `profileRepairAuditSchema`; add shape to `PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX`. | same file | Inner object is `.passthrough()` today — the field would survive undeclared, but `.min(1)` makes "missing" a hard reject per spec intent ("zero problems is a failed run"). |
| 1.4 | Add `outreach_problems` as **optional** to `businessAnalysisSchema`: `z.array(z.object({...}).passthrough()).min(1).optional()`. Add shape to `BUSINESS_ANALYSIS_PROMPT_SUFFIX` with the **conditional** note from §3.3 ("populate … when the prompt body contains an Operator Outreach Problems & Solutions directive; omit entirely otherwise — do not emit an empty array"). | `apps/api/src/validators/business-analysis.schema.ts` | Shared schema — required `.min(1)` would break the review-response template and any other non-directive `business_analysis` render. ⚠️ **The suffix never renders for `business_analysis`** — `LEGACY_NO_SUFFIX_SCHEMAS` (`MarketingExecutionService.ts:638–643`) suppresses it to keep legacy audit renders byte-identical. The suffix edit is registry documentation only; the operative contract for audit prompts is the embedded body directive (Phase 3.3/3.4). Do NOT remove `business_analysis` from the legacy set to "fix" this — it changes every rendered audit prompt. |
| 1.5 | **Test fixtures (required, not optional).** Every well-formed fixture gains a non-empty `outreach_problems`. New boundary tests — triage + audit: missing → reject; `[]` → reject; 1 → pass; 3 → pass; **4 → pass** (cap is prompt-level). `businessAnalysisSchema`: absent → pass; present → shape-validated; `[]` → reject. | `apps/api/src/validators/__tests__/profile-repair-output.schema.test.ts`, `business-analysis-schema-sprint1.test.ts` | `pnpm checkapi` is tsc-only and will NOT catch broken fixtures — run vitest. |

## Phase 2 — Gold-standard injection fix (`MarketingExecutionService.resolvePrompt`, spec §4.5)

| # | Task | Files | Notes |
|---|---|---|---|
| 2.1 | In the `promptRole === 'signal_triage'` branch (~line 1268): keep the empty-`audit_signals` early return (1270–1276) unchanged. Replace the `!profile` early return (1279–1284) with a gold-standard fallback: when signals exist but `profileService.resolve` is null, still call `resolveGoldStandard(category, triagePlatform, businessCity, businessState, ctx)`; on hit, append `serializeGoldStandard(gs, 'benchmark')` + `buildMarketContextBlock`, log, and return with `intelligence_mode: 'profile'` / `profile_id: goldStandard.id` — mirroring the `goldStandardOnly` path at ~1348. On miss, return the base render as today. | `apps/api/src/services/MarketingExecutionService.ts` | Makes all 4 repair prompts gold-standard aware whenever a benchmark exists for the category — the §2.2 "when a Gold Standard block is present" clause then means "none exists for the category," which is itself briefing-worthy (`data_quality.limitations`). |

## Phase 3 — Seed scripts (`apps/api/src/scripts`)

| # | Task | Files | Notes |
|---|---|---|---|
| 3.1 | `seed-profile-repair-triage-briefing.ts`: add `### 6. Operator Outreach Problems & Solutions` to `NEW_BODY` after `### 5. Track Recommendation`, before the closing "The output JSON shape…" line — shared §2.2 text with playbook-alignment bound to `issue_type_confirmed`. Bump `BRIEFING_MARKER` to a versioned value (e.g. append `<!-- triage-briefing-v2: outreach-problems -->`). | `seed-profile-repair-triage-briefing.ts` | Full-body replace — Phase 0.1 dump is the safety net. |
| 3.2 | `seed-profile-repair-issue-briefings.ts`: append `### 6.` to each of the 3 `TEMPLATES[].body` consts after `### 5. Severity + Issue Type`; alignment bound per `issueType` (NAP pairs / claim-state pairs / coverage-gap pairs). Bump `BRIEFING_MARKER`. | `seed-profile-repair-issue-briefings.ts` | Same full-body-replace caveat. |
| 3.3 | `seed-business-audit-v2-templates.ts`: new `OUTREACH_PROBLEMS_DIRECTIVE` const (audit-context variant per §4.3 — inputs are `gap_analysis`/`detected_signals`/`website`/`platforms`; solutions may draw on `recommended_services` as a hint, not a lookup; deliverability-in-kind alignment). In **each** of `transformCategoryIntegrated`, `transformSignalAligned`, `transformBusinessAuditV1`: `removeSection(out, '### Operator Outreach Problems')` first, then `insertAfter` anchored on `Omit the field entirely when no category context was provided.` — **after all `removeSection` calls** (AGENTS.md: the directive has a heading; headingless bindings must not be swallowed on re-run). Bump `SEED_VERSION_MARKER` (e.g. `<!-- seed-version: business-audit-v2-2026-09-16-outreach-problems-1 -->`). | `seed-business-audit-v2-templates.ts` | Anchor confirmed present in the `MARKET_INTEL_OUTPUT_DIRECTIVE` const and seeded into all 3 bodies by the previous version. One `insertAfter` per template — never bundle (80-char fingerprint rule). |
| 3.4 | (D1) New `transformSeedBusinessAudit` for `mpt-seed-seek-001`: `removeSection` self-heal → `insertAfter`/`insertBefore` the directive anchored on `Format as structured JSON.` → append `SEED_VERSION_MARKER`. Add a 4th task entry; per D2, skip the `FULL_BUSINESS_VARIABLES` write for this template (or accept the widened declaration — minor). | `seed-business-audit-v2-templates.ts` | Anchor verified in the prd dump body. Its `output_schema.name` is already `business_analysis` — the column fix in the task loop is a no-op. |

## Phase 4 — Operator surfaces (`apps/web`)

One shared component serves all three surfaces (§5.1 — same shape everywhere).

| # | Task | Files | Notes |
|---|---|---|---|
| 4.1 | New `OutreachProblemsSection` component — card anatomy per §5.2: headline (`problem`), **Regular** + **Hook** labeled lines (hook = accent border), per-line copy button, "The fix" (`solution`), collapsible `evidence`, `outreach_use` chip, and a per-line "Use as opener" action (wired in Phase 5). Read-only this sprint — copy→paste into pitch construction is the contract (§8). | `apps/web/src/components/marketing-ops/OutreachProblemsSection.tsx` (new) | Match existing card styling (Tailwind + lucide, cf. `RepairBriefingCard`). |
| 4.2 | `TriageRecommendation` — add `outreach_problems?: OutreachProblem[]` (new exported type). Render the section in `RepairTrackPanel` under the pitch/risks blocks. | `apps/web/src/services/MarketingOpsService.ts`, `RepairTrackPanel.tsx` | Persisted briefing rehydrates via `campaign.repair_triage_briefing` — no fetch change. |
| 4.3 | `RepairBriefingCard` — extend `RepairAuditOutput` + `parseBriefing` to read `outreach_problems`, tolerating absence on pre-change executions; render the shared section. | `RepairBriefingCard.tsx` | `parseBriefing` already returns the raw `profile_repair_audit` object — the field rides through once typed. |
| 4.4 | `BusinessAnalysisAuditCard` — new "Outreach ammunition" section reading `audit_data.outreach_problems`; add the per-line "Use as opener" affordance (none exists on this card today). | `BusinessAnalysisAuditCard.tsx` | Mounted at `CampaignDetailClient.tsx:1801`; `audit` prop already carries `audit_data`. |

## Phase 5 — Opener hand-off (spec §5.3)

| # | Task | Files | Notes |
|---|---|---|---|
| 5.1 | Widen `source_briefing` to `z.enum(['triage', 'issue_audit', 'business_audit'])` in `openerFromBriefingSchema`; widen the `sourceBriefing` param union in `OutreachOpenerService.createFromBriefing` (~line 637); widen `MarketingOpsService.createOpenerFromBriefing`'s input union (line 3570). `OpenerSource` itself (`'ai' \| 'external' \| 'ai_briefing'`) is unchanged — `source_briefing` is provenance in `extracted_fields`, not the opener source. | `apps/api/src/routes/marketing-ops.ts:3666`, `apps/api/src/services/OutreachOpenerService.ts`, `apps/web/src/services/MarketingOpsService.ts` | Zod enum only — no `chk_` constraint, no migration (§6). |
| 5.2 | Per-line "Use as opener" wiring: `opener_text` = the clicked `regular`/`hook` line; `primary_angle` = the entry's `problem` text; `execution_id` = the audit/briefing execution id where available; `source_briefing`: `'triage'` / `'issue_audit'` / `'business_audit'` per card. Update `OutreachOpenerService.test.ts` fixtures if they cover the union. | cards from Phase 4 + `apps/api/src/services/__tests__/OutreachOpenerService.test.ts` | The campaign-level opener stays the default — per-problem lines are fresh material across touches. |

## Phase 6 — Verification & rollout

1. `pnpm checkapi` **and** `pnpm checkweb` (web types change: `TriageRecommendation`, `RepairAuditOutput`, `createOpenerFromBriefing` input).
2. Run the api vitest suite — fixtures must pass under the new `.min(1)`.
3. Re-run all three seeds from `apps/api`, **both** configs:
   ```powershell
   doppler run --config local -- npx tsx src/scripts/seed-profile-repair-triage-briefing.ts
   doppler run --config local -- npx tsx src/scripts/seed-profile-repair-issue-briefings.ts
   doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts
   # repeat each with --config prd
   ```
4. Staleness check: each template's `updated_at` > the seed files' last git commit.
5. Render check per template (8 if D1 folds in `mpt-seed-seek-001`; V1 `mpt-je6m7ru6` local-only): body contains `### Operator Outreach Problems & Solutions — REQUIRED`; rendered JSON shape includes `outreach_problems`. **Gold-standard check:** render a repair prompt for a category with a gold standard but NO CI profile — the `GOLD STANDARD BENCHMARK` block must appear (proves Phase 2).
6. Validation check: import with no `outreach_problems` (or `[]`) → rejected for `profile_repair_triage`/`profile_repair_audit`; 1–3 entries → pass. `business_analysis`: absent → pass; `[]` → reject.
7. **Ship validator + seeds together.** Once `.min(1)` lands, the external-import path rejects output missing the field (returns `passed: false`, marks the execution `failed` — see correction below); in-flight stale clipboard output becomes unimportable. Warn operators to regenerate or hand-add the field.

---

## Verification findings (2026-09-16, staging @ `61da6c5f`)

Spec claims confirmed:
- All 7 template IDs + `mpt-seed-seek-001` (8th `business_analysis` template, 1,865 chars, no bindings/marker, ends `Format as structured JSON.`) present in `docs/api-response/seek-prompt-templates.md`; `mpt-je6m7ru6` absent (prd dump) as §4.4.3 states.
- `profileRepairTriageSchema`/`profileRepairAuditSchema` + both suffixes: `apps/api/src/validators/profile-repair-output.schema.ts`. `businessAnalysisSchema` + suffix: `business-analysis.schema.ts:632,699`, registered in `market-analysis.schema.ts:271`.
- `signal_triage` branch confirmed: empty-signals early return at 1270–1276, `!profile` early return at 1279–1284 **before** `resolveGoldStandard` at 1300; `goldStandardOnly` fallback at 1348 in the `category_audit` path.
- `openerFromBriefingSchema` enum at `marketing-ops.ts:3666`; `createFromBriefing` union at `OutreachOpenerService.ts:637`; web union at `MarketingOpsService.ts:3570`.
- Persistence via spread confirmed at `ProfileRepairPromptService.ts:365` and `:803` — a declared schema field persists with no service change.
- Seed mechanics confirmed: both repair seeds are full-body-replace on marker absence; `seed-business-audit-v2-templates.ts` has `removeSection`/`insertAfter`/`fingerprint` helpers and the `MARKET_INTEL_OUTPUT_DIRECTIVE` anchor line.
- Frontend mount points: `RepairTrackPanel` + `RepairBriefingCard` at `CampaignDetailClient.tsx:1297,1302`; `BusinessAnalysisAuditCard` at `:1801`. `RepairAuditOutput`/`parseBriefing` in `RepairBriefingCard.tsx:13–51` tolerate a missing field already.
- Test file `profile-repair-output.schema.test.ts` exists — its well-formed fixtures will fail the moment `.min(1)` lands.

**Corrections to spec wording:**
1. **§7.7:** `importExternalResult` does not *throw* on schema failure — it marks the execution `failed` and returns `{ passed: false, errors }` (`ProfileRepairPromptService.ts:759–769`). Same operator-facing outcome (the import is rejected); the "throws" framing is inaccurate.
2. **§3.4 (implicit):** the `profile_repair_triage` inner object is NOT `.passthrough()`, so declaring `outreach_problems` in the schema is required for it to survive validation — without it, Zod strips the field from `validated.data` and the spread-persist drops it. `profile_repair_audit`'s inner object IS `.passthrough()`, so it would persist either way. The spec's plan is correct; this just makes the triage-schema edit load-bearing rather than optional.
3. **§3.5 / §3.3:** `BUSINESS_ANALYSIS_PROMPT_SUFFIX` is never appended at render time — `business_analysis` sits in `LEGACY_NO_SUFFIX_SCHEMAS` (`MarketingExecutionService.ts:638–643`), which preserves byte-identical legacy audit renders. The suffix edit lands in the registry but reaches no rendered prompt; the audit templates' operative contract is the embedded body schema + the new `OUTREACH_PROBLEMS_DIRECTIVE`. The repair suffixes (`PROFILE_REPAIR_*_PROMPT_SUFFIX`) DO append — those bodies deliberately carry no embedded schema ("the output JSON shape is appended after the category intelligence block"). Keep the suffix edit for contract hygiene, but do not rely on it for the audit prompts, and do not remove `business_analysis` from the legacy set.

**Injection matrix (verified in `resolvePrompt`):**

| Role | Templates | CI profile block | GS `benchmark` block | Market context | Discovery leads |
|---|---|---|---|---|---|
| `signal_triage` | 4 repair templates | only when CI resolves; header `SUPPLEMENTARY — REPAIR SIGNALS ARE PRIMARY` | **only when CI resolves** (the §4.5 gap — Phase 2 fixes) | only when CI resolves | never |
| `category_audit` | 4 audit templates | when CI resolves | unconditional (incl. `goldStandardOnly` fallback when CI is absent) | always attempted | always attempted |
| `fulfill_target` | citation package (out of scope) | never | `target` serialization only | never | never |

Gates upstream of both seek roles: `campaignScope==='business'`, `promptType==='seek'`, non-empty `campaign.category`; `signal_triage` additionally requires non-empty `audit_signals` (empty → base render, distractor suppression).

## Out of scope (per spec §8)

- Inline editing/regeneration of entries on the cards — copy→paste into the openers workspace is the contract.
- Structured pitch-construction workspace slots.
- Collapsing `pitch.pain_points` into `outreach_problems`.
- Extending the field to fulfill/discovery/enrichment templates.
