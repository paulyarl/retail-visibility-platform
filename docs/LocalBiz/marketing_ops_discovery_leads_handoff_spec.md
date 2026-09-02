# Discovery Leads Handoff — Spec (GAP-E3 completion + audit prompt block)

**Status:** Implemented (Migration 253 + backend + tests; frontend Phase 2 deferred per §10)
**Origin:** Operator observation during an emerging discovery run (African Grocery Store · Pittsburgh, 2026-09-01). Discovery emitted rich per-business INT_* signals, but when a discovered business was queued and audited, none of that "why we found this business" context reached the audit.
**Closes:** GAP-E3 (partial — handoff + lineage; see §4 for what remains out of scope)
**Depends on:** Intelligence scope sprint (GAP-E2 queue columns, GAP-S1 INT family guardrails, §1B profile-amplified business audit)

---

## 1. Summary

Today the discovery→audit pipeline has a context cliff:

```
Intelligence discovery (emerging/competitive)
  → emits INT_* discovery_signals + discovery_provenance + business_seek_priority
  → persisted on mkt_prospect_queue (GAP-E2 columns)          [exists]
  → operator queues the prospect
  → createCampaignFromQueue → deriveBusinessCampaign
  → child business campaign receives ... nothing              [the cliff]
  → business analysis audit runs with zero discovery context  [the cliff]
  → audit emits RA/DS/WC/CP/VP signals → triage → playbook    [exists]
```

The audit investigates the business cold. It knows *how* to investigate the
category (via the §1B profile amplification — terminology, specialized sources,
evidence rules) but not *why this specific business was flagged* — e.g.
"possibly miscategorized on Google", "found via a Somali community directory",
"absent from mainstream indexes".

This spec closes the cliff with two changes:

1. **Handoff (GAP-E3):** `deriveBusinessCampaign()` carries the queue entry's
   discovery context (signals, provenance, seek priority, category fit,
   intelligence run lineage) onto the child business campaign in dedicated
   columns.
2. **Discovery Leads block:** the business-audit prompt resolution appends a
   prospect-specific "Discovery leads" block — framed as *hypotheses to
   verify*, never as findings — through the same resolution seam the §1B
   profile block already uses.

## 2. Current state (verified in code)

| Component | File | State |
|---|---|---|
| Queue intelligence columns | `apps/api/prisma/schema.prisma` (`model mkt_prospect_queue`, ~L4198) | `discovery_signals`, `discovery_provenance`, `business_seek_priority`, `category_fit`, `identity_confidence`, `location_status`, `intelligence_run_id`, `seek_batch_id` — all populated for `source_kind = 'intelligence_seek'` |
| Queue → campaign handoff | `apps/api/src/services/MarketingProspectQueueService.ts` — `createCampaignFromQueue()` thin path (~L523) | Passes only `detectedSignals` (empty for intelligence entries — INT codes live in `discovery_signals`). No discovery fields propagated. |
| Child campaign creation | `apps/api/src/services/MarketingCampaignService.ts` — `deriveBusinessCampaign()` (~L688) | No discovery input; inherits parent category/city/tone/attributes; seeds a `business_analysis` audit + auto-triage only when `detectedSignals` is non-empty. |
| Campaign storage | `mkt_campaigns_list` | No discovery columns. `attributes` is `Json?` but shaped as `string[]` in practice — must NOT be repurposed. `intelligence_run_id` does not exist on this table. |
| Audit prompt resolution | `apps/api/src/services/MarketingExecutionService.ts` — `resolvePrompt()` (~L262; §1B business-scope path ~L687–905) | `category_audit` role: base render → profile block → gold-standard benchmark → output-schema suffix. No per-prospect context injection. (`renderTemplate()` at ~L1278 is the separate variable-substitution step — not the injection point.) |
| §S1 guardrail | `apps/api/src/services/triage/signal-extractor.ts` (~L159–168) | Filters any `INT_*` code out of triage evaluation. Must remain intact. |
| Discovery output schema | `apps/api/src/validators/intelligence-discovery.schema.ts` | `discovery_signals: string[]` (INT_* only), `discovery_provenance: {source, role, evidence_types, url, accessed_at}[]`, `business_seek_priority: high\|medium\|low\|hold`, `category_fit: verified\|probable\|insufficient`, `identity_confidence: high\|medium\|low` |

## 3. Goals

- G1 — The child business campaign born from an intelligence-discovered
  prospect durably carries the discovery context (signals, provenance,
  priority, fit, run lineage).
- G2 — The business analysis audit prompt includes a prospect-specific
  "Discovery leads" block when context exists, framed as verification leads.
- G3 — The lineage chain `intelligence_run → queue entry → campaign → audit`
  is queryable (GAP-E3's stated intent).
- G4 — Zero change to triage inputs: discovery signals never enter
  `detected_signals`, the signal extractor, or playbook rule evaluation.
- G5 — Legacy callers of `deriveBusinessCampaign` / `createCampaignFromQueue`
  are unaffected (all new inputs optional, all new columns nullable).

## 4. Non-goals

- N1 — Feeding INT_* codes into triage or the playbook catalog (violates
  §S1 / intelligence spec §30; the guardrail stays).
- N2 — Injecting discovery context into `fulfill` prompts or the
  `signal_triage` (profile_repair) prompt role. The profile-repair path
  already suppresses the category block when repair signals are absent
  (the distractor-block fix, `MarketingExecutionService.ts` ~L763) — adding
  prospect-level leads there would reintroduce that failure mode.
- N3 — Injecting context into `deriveBusinessCampaignFromScanBusiness`
  (city_category_audit / scan_unmatched entries have no discovery context).
- N4 — Frontend campaign-detail lineage UI (deferred; see §10).
- N5 — Backfilling discovery context onto campaigns created before this
  feature (nullable columns; old children simply have no leads block).

## 5. Design principle: Leads, not signals

Discovery signals are thin-evidence **hypotheses** formed at scan speed. The
audit is the **verification** layer. The handoff must therefore deliver
context as *prose leads* (prompt text), never as *pipeline signals*:

| If consumed as… | Consequence |
|---|---|
| Signals (into `detected_signals` / audit output) | Confirmation bias — the audit anchors on the discovery conclusion instead of verifying. Contamination — INT codes leak into triage (the §S1 filter exists because leakage was anticipated). Contract violation — §30 mandates discovery codes never mix into audit output. |
| **Leads (prompt context only)** — correct | The audit treats each lead as a hypothesis: verified leads become audit-family signals the audit emits itself; refuted leads are discarded. §S1 stays intact because nothing enters the signal pipeline from the discovery side. |

This mirrors the §1B pattern already in production: the profile block injects
*category-level* "what to look for"; the leads block injects *prospect-level*
"what to check on this one" — same seam, same safety properties.

## 6. Data contract — `DiscoveryContext`

Stored on `mkt_campaigns_list.discovery_context` (JSONB, nullable):

```jsonc
{
  "focus": "emerging",                      // 'emerging' | 'competitive' — focus of the SOURCE run (not the child campaign's own intelligence_focus column)
  "discovered_at": "2026-09-01T12:00:00Z",  // queue entry created_at at handoff time
  "business_seek_priority": "high",         // high | medium | low | hold
  "category_fit": "verified",               // verified | probable | insufficient
  "identity_confidence": "high",            // high | medium | low
  "location_status": "inside_city",         // nullable
  "seek_batch_id": "msb_…",                 // nullable — full lineage: run → batch → queue → campaign
  "discovery_signals": ["INT_HIDDEN_TRUST", "INT_POSSIBLE_CATEGORY_MISALIGNMENT"],
  "discovery_provenance": [
    { "source": "Somali Community Directory", "role": "primary",
      "evidence_types": ["listing", "hours"], "url": "https://…", "accessed_at": "2026-09-01" }
  ]
}
```

Validation: a Zod schema `discoveryContextSchema` (new, in
`apps/api/src/validators/intelligence-discovery.schema.ts` alongside the
existing discovery schema) — all fields optional/nullable, `focus` constrained
to `z.enum(['emerging', 'competitive'])`, `discovery_signals` items
constrained to `/^INT_/`, `discovery_provenance` reusing
`discoveryProvenanceSchema`. **Note:** `discoveryProvenanceSchema` is
currently a file-local const (~L45) — it must be exported as part of this
work.

**Validation boundary (single decision):** validation happens at **handoff
time** (§8.3) — invalid context is logged and dropped, never blocking
campaign creation, so invalid context is never persisted. The render-time
check in §8.4 is cheap defense (try/catch around parse), not a second
validation boundary — it exists only to survive hand-mutated DB rows.

## 7. Migration 253

`database/migrations/253_campaign_discovery_context.sql`:

```sql
-- GAP-E3: discovery context handoff onto business campaigns.
ALTER TABLE mkt_campaigns_list
  ADD COLUMN discovery_context  JSONB,
  ADD COLUMN intelligence_run_id VARCHAR(64);

CREATE INDEX idx_mkt_campaigns_intelligence_run
  ON mkt_campaigns_list (intelligence_run_id)
  WHERE intelligence_run_id IS NOT NULL;
```

Additive only; both columns nullable. Regenerate Prisma Client
(`pnpm prisma:generate`) and extend `model mkt_campaigns_list` with
`discovery_context Json?` and `intelligence_run_id String? @db.VarChar(64)`.

**Existing columns — do not duplicate (verified at schema.prisma ~L3375–3383):**
`mkt_campaigns_list` already carries `intelligence_focus` (default
`'emerging'`), `seek_batch_id`, and `intelligence_platform`. These serve
intelligence-scope campaigns; the child business campaign's
`intelligence_focus` is unused for this flow, but the spec still keeps
`focus` inside `discovery_context` (source-run focus, not campaign focus) to
avoid overloading a column with a second meaning. `seek_batch_id` is already
a real column on both queue and campaign — propagate it into
`discovery_context.seek_batch_id` for lineage rather than adding a column.

**RLS note:** `mkt_campaigns_list` is RLS-flagged in Prisma metadata, but no
migration in this repo manages RLS policies (verified — zero RLS statements
in `database/migrations/`). Postgres RLS is row-scoped: new nullable columns
are automatically covered by whatever table policies exist. No policy work is
required unless column-level grants exist outside the migration system (DB
owner to confirm if applicable).

## 8. Backend changes

### 8.1 `createCampaign` input extension

`MarketingCampaignService.createCampaign()` gains two optional input fields —
`discoveryContext?: DiscoveryContext` and `intelligenceRunId?: string` —
persisted to the new columns in the `mkt_campaigns_list.create` call.
Additive; every existing caller is unaffected.

### 8.2 `deriveBusinessCampaign` extension

`MarketingCampaignService.deriveBusinessCampaign()` (~L688) gains:

```ts
discoveryContext?: DiscoveryContext;
intelligenceRunId?: string;
```

Behavior when provided:

1. Pass both through to `createCampaign` (§8.1).
2. Append a human-readable section to `notes` (so the context is visible in
   the existing campaign UI with zero frontend work):

```
Discovery context (intelligence run <intelligence_run_id>, discovered 2026-09-01):
  Seek priority: high · Category fit: verified · Identity confidence: high
  Signals: Strong Hidden Trust, Possible Category Misalignment
  Sources: Somali Community Directory (primary), Yelp (corroboration)
```

3. The existing `detectedSignals` audit-seed + auto-triage branch is
   unchanged. For intelligence entries `detectedSignals` is empty, so no
   audit is seeded and triage is not auto-triggered — the audit runs first
   (operator-driven), which is the correct order for this flow.

### 8.3 `createCampaignFromQueue` propagation

`MarketingProspectQueueService.createCampaignFromQueue()` thin path (~L523)
builds the discovery context from the queue entry and passes it through:

```ts
const discoveryContext = entry.source_kind === 'intelligence_seek' ? {
  // Focus is not a queue column — resolve it from the run row (PK lookup on
  // mkt_intelligence_runs) so the leads block can name the posture. Optional:
  // if the run row is missing, omit and the block renders without it.
  focus: await this.resolveRunFocus(entry.intelligence_run_id),   // 'emerging' | 'competitive' | undefined
  discovered_at: entry.created_at,
  business_seek_priority: entry.business_seek_priority ?? undefined,
  category_fit: entry.category_fit ?? undefined,
  identity_confidence: entry.identity_confidence ?? undefined,
  location_status: entry.location_status ?? undefined,
  seek_batch_id: entry.seek_batch_id ?? undefined,
  discovery_signals: (entry.discovery_signals as string[]) ?? [],
  discovery_provenance: (entry.discovery_provenance as any[]) ?? [],
} : undefined;
```

Pass `discoveryContext` + `intelligenceRunId: entry.intelligence_run_id ?? undefined`
into `deriveBusinessCampaign`. The manual path (no `source_campaign_id`) and
the scan replay path are untouched (N3).

### 8.4 Discovery Leads block — prompt resolution

`MarketingExecutionService.resolvePrompt()`, `category_audit` role
(~L827–905 — note this is the §1B resolution method, **not**
`renderTemplate()` at ~L1278, which is the variable-substitution step). After
the gold-standard benchmark injection and before `appendPromptSuffix`:

```ts
const leadsBlock = this.renderDiscoveryLeadsBlock(input.campaign);
if (leadsBlock) amplified = amplified + '\n' + leadsBlock;
```

New private method `renderDiscoveryLeadsBlock(campaign)`:

- Returns `''` when `campaign.discovery_context` is absent/empty (block is
  fully additive — campaigns without context render byte-identical to today).
- Wraps the context parse in try/catch as cheap defense (§6 — the primary
  validation boundary is handoff time; this only survives hand-mutated rows).
  Returns `''` on parse failure.
- Renders the block in §8.5 using the **hardcoded label map below** with
  fallback to the raw code.
- Caps rendered provenance at 6 sources (`… +N more`).

**INT label map — hardcoded, decision recorded.** The intelligence sprint's
proposed registry seed (migration 199 in the sprint plan, GAP-S1) was **never
delivered**: no migration or seed script inserts INT_* rows into
`mkt_signal_registry` (verified — zero INT_* matches in
`database/migrations/`; `signal-taxonomy.ts` families are RA/DS/WC/CP/VP/OX
only). There is therefore no registry label source to mirror. Decision: use a
code-local static map — INT_* is a closed, spec-defined 11-code family, a
static map avoids a DB dependency in the prompt-render path, and it sidesteps
the seed re-run discipline (AGENTS.md) for a display-only concern. If the INT
family is ever registered in `mkt_signal_registry`, this map can be retired
in favor of registry lookup.

```ts
const INT_SIGNAL_LABELS: Record<string, string> = {
  INT_LOW_VISIBILITY: 'Low Visibility',
  INT_WEAK_MAINSTREAM_INDEXING: 'Weak Mainstream Indexing',
  INT_SINGLE_SOURCE: 'Single Source Only',
  INT_HIDDEN_TRUST: 'Strong Hidden Trust',
  INT_RECENT_BUSINESS_EVIDENCE: 'Recently Established',
  INT_POSSIBLE_CATEGORY_MISALIGNMENT: 'Possible Category Misalignment',
  INT_VERTICAL_SOURCE_DISCOVERY: 'Vertical Source Discovery',
  INT_MULTISOURCE_IDENTITY: 'Multisource Identity',
  INT_ACTIVE_OPERATIONAL_EVIDENCE: 'Active Operational Evidence',
  INT_CATEGORY_SPECIALIZATION: 'Category Specialization',
  INT_UNDEREXPOSED_CREDENTIAL: 'Underexposed Credential',
};
```

### 8.5 Rendered block (normative text)

```
=== DISCOVERY LEADS (VERIFY — NOT FINDINGS) ===
This business was surfaced by an intelligence discovery scan
({focus? "emerging focus" | "competitive focus" | "focus not recorded"})
on 2026-09-01. The observations below are scan-time HYPOTHESES, not audit
findings. For each lead: independently verify against current evidence.
A lead you confirm becomes an audit signal in your own output contract; a
lead you refute is discarded. Do not copy these codes into detected_signals —
emit only your own audit-family signals (RA/DS/WC/CP/VP). Do not treat an
unconfirmed lead as evidence of activity, inactivity, or quality.

Seek priority at discovery: high · Category fit: verified · Identity confidence: high

Discovery signals (hypotheses):
- INT_HIDDEN_TRUST — Strong Hidden Trust
- INT_POSSIBLE_CATEGORY_MISALIGNMENT — Possible Category Misalignment

Discovery provenance (where the scan found this business):
- Somali Community Directory (primary) — evidence: listing, hours
- Yelp (corroboration) — evidence: reviews

Absence rules: "not found on a platform during discovery" is a discovery
signal, not proof of absence. Re-verify platform absence yourself before
emitting DS_MISSING_PROFILE or similar.
```

The absence-rules paragraph is mandatory — it operationalizes the
prohibited-inference discipline (§31 / GAP-S2) at the point where discovery
absence is most likely to be misread.

### 8.6 Resolution stamp + logging

The `category_audit` return's `resolution` object gains an optional field:

```ts
discovery_leads_injected: boolean   // true only when the block was appended
```

Additive/optional — existing consumers of `resolution` are unaffected. Log
line gains `discoveryLeadsInjected` alongside the existing
`intelligenceMode` field.

## 9. Guardrails (normative)

1. **§S1 preserved.** No INT_* code may enter `detected_signals`, the signal
   extractor's output, or playbook `matching_rules` via this feature. The
   leads block is prompt prose only. `SignalExtractorIntFamily.test.ts` must
   continue to pass unchanged.
2. **Verification framing is mandatory.** The block must always carry the
   "hypotheses, not findings" framing and the absence-rules paragraph.
3. **Staleness.** `discovered_at` is always rendered. Discovery may have run
   days/weeks before the audit; the framing instructs verification of
   *current* state.
4. **Scope exclusions.** The block renders only for business-scope `seek`
   prompts with `promptRole === 'category_audit'`. Never for `fulfill`,
   `signal_triage`, or intelligence-scope prompts.
5. **No triage coupling.** The presence of discovery context must not
   auto-trigger triage and must not alter triage results for a given audit
   signal set (test T4, §11).

## 10. UI (deferred, optional Phase 2)

Campaign detail page: a "Discovered by intelligence" lineage chip (run id →
run detail link) + read-only discovery signal badges, fed by the new columns.
No operator workflow changes. Not required for this spec's backend value;
tracked separately.

## 11. Test plan

| # | File | Cases |
|---|---|---|
| T1 | `apps/api/src/services/__tests__/DeriveBusinessCampaignDiscovery.test.ts` | Handoff with context: child row has `discovery_context` + `intelligence_run_id`; notes contain the "Discovery context" section; no `business_analysis` audit seeded (empty detectedSignals); no auto-triage. |
| T2 | same | Legacy call (no discovery input): child identical to today — null columns, unchanged notes shape; `detectedSignals` audit-seed + auto-triage behavior unchanged. |
| T3 | `apps/api/src/services/__tests__/DiscoveryLeadsBlock.test.ts` | Block renders signals (labeled) + provenance + priority/fit + `discovered_at`; absent (byte-identical render) when context missing; unknown INT code falls back to raw code. **Focus omission:** context without `focus` renders without the focus parenthetical (run row missing case). **Provenance cap boundary:** exactly 6 sources → no suffix; 7 sources → 6 rendered + `+1 more`. |
| T4 | same | Triage invariance: identical audit signal set → identical recommendation with and without discovery context on the campaign. |
| T5 | same | Role gating: no block for `fulfill` / `signal_triage` / intelligence-scope renders even when context exists. |
| T6 | existing `SignalExtractorIntFamily.test.ts` | Unchanged and passing (§S1 regression guard). |
| T7 | `apps/api/src/services/__tests__/DeriveBusinessCampaignDiscovery.test.ts` | **Invalid-context drop at handoff** (the §6 boundary): malformed context (e.g. `focus: 'bogus'`, non-INT signal code) → context dropped + warning logged, campaign still created with null `discovery_context`, no block at render. |

## 12. Compatibility & rollout

- Migration 253 is additive; deploy order: migration → `pnpm prisma:generate`
  → API deploy. No backfill.
- All new inputs optional; all new columns nullable; campaigns without
  context render prompts byte-identical to today (G5).
- `resolution.discovery_leads_injected` is additive; execution-record readers
  ignore unknown keys.
- No prompt template changes — the block is injected at resolution time, so
  template versioning is unaffected (the execution still stamps its template
  version; the leads block is derived from campaign columns, not template
  body).

## 13. File reference

| Component | File |
|---|---|
| Migration | `database/migrations/253_campaign_discovery_context.sql` (new) |
| Schema | `apps/api/prisma/schema.prisma` — `model mkt_campaigns_list` |
| Context validator | `apps/api/src/validators/intelligence-discovery.schema.ts` (extend — new `discoveryContextSchema`; **export** the existing file-local `discoveryProvenanceSchema`) |
| Campaign creation + handoff | `apps/api/src/services/MarketingCampaignService.ts` — `createCampaign()`, `deriveBusinessCampaign()` |
| Queue propagation | `apps/api/src/services/MarketingProspectQueueService.ts` — `createCampaignFromQueue()` + new `resolveRunFocus()` (PK lookup on `mkt_intelligence_runs.focus`) |
| Prompt block | `apps/api/src/services/MarketingExecutionService.ts` — `resolvePrompt()` category_audit path (~L827–905) + `renderDiscoveryLeadsBlock()` (new, with hardcoded `INT_SIGNAL_LABELS` map per §8.4) |
| §S1 guardrail (unchanged) | `apps/api/src/services/triage/signal-extractor.ts` |
| Discovery output schema (source of shapes) | `apps/api/src/validators/intelligence-discovery.schema.ts` |
| Tests | §11 |
| Upstream design | `docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md` — §5.12 (GAP-E3), §3.5 (§S1), GAP-S1/GAP-S2. Note: that plan's migration 199 (INT registry seed) was **never delivered** — hence the hardcoded label map decision in §8.4. |
