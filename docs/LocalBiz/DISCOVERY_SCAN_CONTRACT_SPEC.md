# Discovery Scan Contract — Design Spec

**Document Version:** 1.3
**Date:** 2026-09-22
**Status:** Decisions locked — in implementation
**1.3 changes:** Locks the open questions (§10): `candidate_key` =
slug(business_name + city) + `candidate_key_aliases`; **all invariants are
report-mode in v1** — violations are stamped into `audit_data
.scan_contract_violations[]`, imports always succeed, and the import gate
*overwrites* `completeness_claim` with the derived value on mismatch;
`reconciliation` members arrive as an **import-time input** and are diffed by
the gate (not model-authored); `queries_issued` is omitted (a self-reported
count is asserted, not derived); ledgers stay per-focus with parity reported
on the audit card; `blocked_reason` is model-authored (INV-8 + stamping is the
laundering check); legacy audits render a synthesized `unverified` claim on
read. Corrects the §9 implementation map: directive text lives in
`seed-intelligence-fragments.ts` + `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX` +
`buildGeographyGridDirective` (the seeded discovery templates are thin
composition markers), and INV-3/4/7 run at the import boundary — not in the
Zod validator, which never sees the grid.
**1.2 changes:** Applies the contract to **both** discovery focuses. Adds §1.3
(focus applicability, cross-focus contamination, focus-pair parity), scopes the
green-light gates per focus, and adds Q8 (one ledger or two).
**1.1 changes:** Added §5.0 operating-posture directive (diligence over speed) —
prompt-injectable text, the framing-vs-contract failure table, runtime
implications for model/effort selection, and INV-8 as the checkable bridge
between posture and contract.
**1.0 scope:** Adopts the bronze scan's explicit vector pattern
(`vector_execution_log`) for the emerging/competitive discovery scan, extends it
to geography granularity (per-ZIP / per-corridor / per-dataset sweep ledger), and
adds eight machine-checkable invariants so a discovery run's coverage claim is
*derived* rather than asserted. Adds an explicit operating-posture directive
(§5.0) framing the scan as diligence work rather than a fast pass. Motivated by a
live Kansas City miss (§1.1).
**Companion docs:** `BRONZE_STANDARD_SPEC.md` (§8 vector log, §4.1 coverage
vocabulary), `CATEGORY_MARKET_ENRICHMENT_SPEC.md` (geography grid),
`INTELLIGENCE_DISCOVERY_METRO_SCOPE_SPEC.md` (metro ring)

---

## 1. Problem

### 1.1 The failure that motivated this spec

An emerging-focus discovery audit for `african grocery store` / Kansas City, MO
returned 25 candidates, of which 1 carried a bronze reason attribution and 0
carried a suggested reason. The operator then supplied two category members the
scan had not captured:

| Business | Address | Reviews | Platform category |
|---|---|---|---|
| African Market Universal Tropical Market | 5814 N Oak Trafficway, Gladstone, MO 64118 | 4.8 / 30 | `Grocery store` (generic) |
| Universal African Market LLC | 7519 N Oak Trafficway, Gladstone, MO 64118 | 4.5 / 45 | `African goods store` (gold-standard label) |

Both are mainstream-visible Google listings with live hours, service attributes,
ownership flags, geocodable addresses, and review depth. Neither is a hidden
business. Both sat in ZIP 64118 — a ZIP the geography grid **already** carried
and explicitly flagged as a shared Kansas City / Gladstone sweep unit.

The discovery profile's own directive was unambiguous: *"Execute a ZIP ×
generic-label matrix per platform for every geography_grid ZIP… record each ZIP
as executed or executed-empty."* Its own coverage self-test certified the class
these businesses belong to (generic-looking name with no category token) as
"covered." Nothing executed it. The run reported `executed: true, returned: 0`
at the **vector** level while sweeping no units at the **unit** level.

Three distinct failure classes were tangled together, and they need different
fixes:

| Class | What failed | Fix |
|---|---|---|
| **Execution** (dominant) | Mandated per-ZIP enumeration never ran; vector-level `executed: true` stood in for unit-level coverage | §3 ledger + §4 INV-3 |
| **Substrate** | Label-independent sweep set covers KCMO + Kansas records; the Missouri-side suburb class (Gladstone, North Kansas City, Liberty, Parkville, Independence, Lee's Summit, Blue Springs, Raytown, Grandview, Belton, Raymore, Grain Valley) licenses and inspects its own food establishments | §6 |
| **Contract** | The output schema has no field that can carry a per-unit result, so "executed-empty" degrades from a requirement into an assertion | §3 + §4 |

### 1.2 Why this blocks multi-market deployment

This discovery design — **both** focuses — is intended to deploy to other markets.
The trust question for each new market is: **can an operator tell what a run
actually covered without re-running it?**

Today the answer is no. A delivered discovery artifact asserts coverage the run
did not perform, and there is nowhere in the contract to record what was skipped.
The bronze standard gets this right — it logs vectors it did **not** execute as
admitted blind spots (`BRONZE_STANDARD_SPEC.md` §8) — and the discovery path has
no equivalent. That asymmetry is the defect this spec closes. See §1.3 for why the
defect is focus-independent.

### 1.3 Applies to both discovery focuses

This contract is focus-independent. It governs **coverage** — which places were
swept and how that is proven — and coverage is a property of the market, not of the
focus. Emerging and competitive discovery enumerate the same geography grid, open
the same sweep units, and must answer the same trust question. Both templates carry
the contract:

| Template | Focus | Contract applies |
|---|---|---|
| `mpt-seed-intel-discovery-emerging-001` | emerging | yes — §3 ledger, §4 INV-1…INV-8, §5.0 posture |
| `mpt-seed-intel-discovery-competitive-001` | competitive | yes — same |

What is identical across focuses:

- the `scan_contract` block shape (§3) and its four sub-objects
- the eight invariants (§4), including the "executed means queried" floor (INV-8)
- the geography grid as the enumeration unit, and the per-ZIP ledger row
- the derived `completeness_claim` ladder (§3.1) and the green-light gates (§7.1)
- the operating posture directive (§5.0)

What legitimately differs, and is therefore focus-scoped *inside* the contract:

| | Emerging | Competitive |
|---|---|---|
| Mechanism set | community/referral, vertical sources, attribute sweeps, token-free enumeration | mainstream platform-first sweeps, review-depth sampling, benchmark qualification |
| `unexecuted_vector_list` (INV-6) contents | emerging vectors not run | competitive vectors not run |
| Qualification bar | category fit + an evidence-backed emerging condition | category fit + established mainstream visibility |
| What a miss costs | a thin-footprint business is never reached | a market leader is never benchmarked, so the benchmark bar is wrong |

#### 1.3.1 Why a defect in either focus contaminates the other

The competitive scan's output is the **benchmark reference** the emerging prospects
are measured against (the gold-standard block injected into the emerging run). If
the competitive scan under-enumerates — sweeps three leaders out of eight, all in
the obvious ZIPs — the emerging run then compares real thin-footprint businesses
against a bar set by an incomplete leaderboard. The emerging artifact inherits the
competitive artifact's coverage hole without recording it.

The reverse also holds: the emerging run's `suggested_reasons` and operator
reconciliation feed the category profile that shapes the next competitive sweep.

This is the argument for the same contract on both: a coverage claim is only as
trustworthy as the weakest ledger in the pair.

#### 1.3.2 Focus-pair parity

Because both focuses enumerate the same grid, their ledgers are comparable. A ZIP
swept by one focus and not the other is a divergence worth surfacing:

- Same grid ⇒ the `unit_id` space is shared (`zip:64118` means the same unit in
  both payloads).
- A `zip_label_matrix` row present in one ledger and `not_executed` in the other is
  either a deliberate scope decision (name it) or a gap (fix it).
- Parity is **reported, not enforced** in v1 — see §10 Q8. Enforcing it would
  require both runs to complete before either imports, which is a scheduling
  question, not a contract question.

A cheap version that needs no scheduling: the audit card renders the focus pair's
coverage side by side, so an operator reviewing an emerging result sees the
competitive ledger it depends on.

---

## 2. Relationship to the bronze vector pattern

Adopt, do not fork. Bronze's log is:

```ts
// apps/api/src/validators/bronze-standard-scan.schema.ts:213
vector_execution_log: z.array(z.object({
  vector: z.string().min(1),
  executed: z.boolean(),
  returned: z.number().int().nullable().optional(),
}).passthrough()).optional(),
```

What discovery needs beyond it:

| | Bronze `vector_execution_log` | Discovery `sweep_ledger` |
|---|---|---|
| Row granularity | one row per **vector** | one row per **sweep unit** (ZIP, corridor, dataset-geography) |
| Required? | `.optional()` | required by refinement (INV-3/INV-4) |
| Absence semantics | `executed: false` is an admitted blind spot | `status: "not_executed"` is an admitted blind spot **plus** a cap on the completeness claim |
| Provenance closure | none | every candidate must appear in ≥1 row (INV-1) |
| Derived claim | none | `completeness_claim` computed from the ledger (INV-5) |

Rationale for unit granularity: bronze's failure mode is a *reason* never hunted.
Discovery's failure mode is a *place* never swept. A vector-level log cannot
distinguish "swept 64118 and found nothing" from "never opened 64118."

---

## 3. The `scan_contract` block

New top-level field on the `intelligence_discovery` payload. `intelligenceDiscoverySchema`
is `.passthrough()` (`apps/api/src/validators/intelligence-discovery.schema.ts:161`),
so this can land as a passthrough field first and be promoted to an explicit
optional field in the same PR.

```json
"scan_contract": {
  "contract_version": "discovery-scan-contract-v1",
  "sweep_ledger": [
    {
      "unit_id": "zip:64118",
      "unit_type": "zip_label_matrix",
      "unit": "64118 (Kansas City, MO + Gladstone, MO)",
      "platforms_swept": ["google", "yelp", "facebook"],
      "labels_swept": ["Grocery store", "Supermarket", "International grocery", "Market", "African goods store"],
      "status": "executed_with_findings",
      "findings_count": 2,
      "candidate_keys": ["african-market-universal-tropical-market--gladstone-mo", "universal-african-market--gladstone-mo"],
      "executed_at": "2026-09-22"
    },
    {
      "unit_id": "zip:64131",
      "unit_type": "zip_label_matrix",
      "unit": "64131 (Kansas City, MO)",
      "platforms_swept": ["google"],
      "labels_swept": ["Grocery store", "International grocery"],
      "status": "executed_empty",
      "findings_count": 0,
      "candidate_keys": [],
      "executed_at": "2026-09-22"
    },
    {
      "unit_id": "dataset:usda-snap-64118",
      "unit_type": "dataset_geography",
      "unit": "USDA FNS SNAP Retailer Locator — ZIP 64118",
      "status": "not_executed",
      "findings_count": null,
      "candidate_keys": [],
      "blocked_reason": "dataset download not performed in this run"
    }
  ],
  "coverage_attestation": {
    "units_total": 143,
    "units_executed": 96,
    "units_executed_empty": 61,
    "units_not_executed": 47,
    "units_blocked": 0,
    "vectors_total": 24,
    "vectors_executed": 19,
    "vectors_not_executed": 5,
    "coverage_ratio": 0.671,
    "completeness_claim": "verified_partial",
    "uncovered_municipalities": ["Gladstone, MO", "Liberty, MO", "Parkville, MO"],
    "unexecuted_vector_list": [
      { "vector": "Street View sweep", "reason": "not executed — no imagery review performed" },
      { "vector": "attribute-filter sweep (ownership/service)", "reason": "not implemented in mechanism set" }
    ],
    "attestation_basis": "Per-unit ledger; completeness_claim is derived, not asserted."
  },
  "municipality_coverage": [
    {
      "municipality": "Gladstone, MO",
      "shared_zip": "64118",
      "platform_zip_rows": ["zip:64118"],
      "label_independent_datasets": [],
      "status": "platform_only"
    }
  ],
  "reconciliation": {
    "operator_supplied_members": ["African Market Universal Tropical Market", "Universal African Market LLC"],
    "matched_to_candidates": [],
    "added_this_pass": ["african-market-universal-tropical-market--gladstone-mo", "universal-african-market--gladstone-mo"],
    "unmatched": [],
    "excluded_with_reason": []
  }
}
```

### 3.1 Field semantics

**`sweep_ledger[].unit_type`** — one of:

| `unit_type` | Enumerated by | Rollup |
|---|---|---|
| `zip_label_matrix` | ZIP, then label × platform inside it | one row per `geography_grid.zips` entry (INV-3) |
| `corridor` | arterial corridor from `geography_grid.corridors` | one row per corridor swept |
| `dataset_geography` | label-independent dataset restricted to a ZIP/address set | one row per dataset × ZIP |

`labels_swept` / `platforms_swept` keep the ledger at ~143 rows rather than
128 ZIPs × 6 labels × 5 platforms = 3,840. The matrix is recorded, not expanded.

**`sweep_ledger[].status`** — four-state, mirroring bronze's honesty rule:

| Status | Meaning |
|---|---|
| `executed_with_findings` | swept; ≥1 candidate |
| `executed_empty` | swept; 0 candidates — **must be reported, never silently skipped** |
| `not_executed` | admitted blind spot; requires `blocked_reason` when blocked |
| `blocked` | attempted and failed (rate limit, access wall, dataset unavailable) |

**`coverage_attestation.completeness_claim`** — derived ladder, not a free-text
opinion:

| Claim | Condition |
|---|---|
| `verified_full` | `units_not_executed == 0` ∧ `vectors_not_executed == 0` ∧ `uncovered_municipalities == []` |
| `verified_partial` | ≥1 unit executed, and at least one of the above is non-zero |
| `unverified` | `units_executed == 0` |

**`municipality_coverage`** — one row per `geography_grid.adjacent_municipalities`
entry (INV-4). `status: "platform_only"` is the honest label for Gladstone today:
reachable through platform ZIP sweeps, absent from the label-independent sweep
set.

**`candidate_key` (v1.3)** — run-local key = `slug(business_name)--slug(city)`
(e.g. `universal-african-market--gladstone-mo`). The slugger lowercases, drops
legal suffixes (`llc`, `inc`, `ltd`, `co`, `corp`, `company`), strips
punctuation, and hyphen-joins. A candidate may emit `candidate_key_aliases`
(alternate names — the Tawakal/Al-Hallal/Darsalaam one-address case); INV-1 and
INV-7 match on the primary key **or** any alias. Matching is canonicalized on
both sides so separator/casing drift can't produce false misses.

**`reconciliation` (v1.3)** — operator-supplied members arrive as an
**import-time input** (the import modal), not a prompt variable: the import
gate injects them and computes the diff against the candidate set itself —
a member resolves to a `candidate_key` (primary or alias, normalized-tolerant
matching) or lands in `unmatched`. Model-emitted `reconciliation` blocks are
merged, never blindly overwritten. This is the mechanism that would have caught
§1.1 automatically — at import, where the miss is still actionable.

---

## 4. Validator invariants

**Enforcement model (v1.3): report-mode.** Invariants do not reject imports in
v1. They are evaluated by a pure collector —
`collectDiscoveryContractViolations(payload, { expectedZips,
expectedMunicipalities })` in the schema file — invoked from
`MarketingPromptService.importExternalResult` after `safeParse` succeeds
(same seam as `applyRenderControlCoverageGate`). Violations are stamped into
`audit_data.scan_contract_violations[]`; the import always succeeds. This
differs from earlier drafts of this section, which put the invariants in
`superRefine` — a Zod issue blocks `safeParse`, which would reject the import,
and the validator is stateless: it never sees `geography_grid.zips`, so
INV-3/INV-4 cannot live there at all. The Zod schema validates **shape**;
the collector derives **violations**.

**Derived, not asserted — mechanically (v1.3).** When the payload's
`completeness_claim` disagrees with the claim derived from the ledger, the
gate *overwrites* `completeness_claim` with the derived value (in addition to
stamping the INV-5 violation). On a clean run this is a no-op.

- `intelligenceDiscoverySchemaWithRefinements` —
  `apps/api/src/validators/intelligence-discovery.schema.ts` (the existing
  `superRefine`). Unchanged: candidate-validity rules stay hard failures.
- `collectDiscoveryContractViolations` — same file. INV-1 … INV-8 land here.
  INV-3/INV-4 additionally take `expectedZips` / `expectedMunicipalities`
  (the authoritative grid: `mkt_geography_grids` cache > campaign
  `intelligence_zip_codes`).
- `normalizeIntelligenceDiscoveryPayload` — same file. Degraded-mode
  normalization: when `scan_contract` is absent entirely, synthesize a minimal
  block with `completeness_claim: "unverified"` rather than rejecting the
  payload. This follows the existing precedent in that normalizer (reference-style
  `qualifying_businesses`, missing `qualifying_businesses`).

| ID | Invariant | Failure mode it closes |
|---|---|---|
| ID | Invariant | Failure mode it closes |
|---|---|---|
| **INV-1** | Every `discovered_businesses[].business_name` (normalized to a run-local `candidate_key`; `candidate_key_aliases` count as the same key) appears in ≥1 `sweep_ledger[].candidate_keys` | "Where did this business come from?" — provenance closure |
| **INV-2** | `executed_with_findings` ⇒ `findings_count ≥ 1` ∧ ≥1 `candidate_key`; `executed_empty` ⇒ `findings_count == 0` ∧ `candidate_keys == []`; `blocked` ⇒ non-empty `blocked_reason` | Ledger rows that assert findings they don't name |
| **INV-3** | Every expected ZIP (cached grid / campaign zips) appears in exactly one `unit_type: "zip_label_matrix"` row with `unit_id: "zip:<zip>"` | The §1.1 failure — a mandated sweep unit never opened. **Report-mode in v1** (stamped violation, import succeeds) |
| **INV-4** | Every expected municipality appears in `municipality_coverage`; `status: "uncovered"` must also appear in `coverage_attestation.uncovered_municipalities` | Silent municipality holes (Gladstone) |
| **INV-5** | `completeness_claim` must equal the derived claim (`verified_full` ⇒ `units_not_executed == 0` ∧ `vectors_not_executed == 0` ∧ `uncovered_municipalities == []`); on mismatch the gate **overwrites** the stored claim with the derived value | Over-claimed coverage |
| **INV-6** | `unexecuted_vector_list.length ≥ vectors_not_executed` (every unexecuted vector named with a `reason`) | Bronze's NOT-executed behaviour, made mandatory (currently absent from discovery) |
| **INV-7** | Every operator-supplied member (import-time input) resolves to a `candidate_key`/alias **or** lands in `unmatched` / `excluded_with_reason` — computed by the gate, not authored by the model | Operator ground truth silently dropped |
| **INV-8** | A `zip_label_matrix` or `corridor` row may carry `executed_with_findings` / `executed_empty` only when `platforms_swept` and `labels_swept` are non-empty. (`dataset_geography` retrieval can't be machine-verified in v1 — no field proves it; documented limitation) | "Executed" asserted for a unit that was never queried — the fast-pass shortcut §5.0 names |

**INV-7 is the load-bearing one.** In §1.1 the operator pasted two businesses and
the run had already closed. Under this contract the import gate diffs those
members against the ledger — which forces the missing 64118 row into view as an
INV-3 violation, and lands the members in `unmatched` as an INV-7 violation.
Both travel with the artifact instead of rejecting it (v1.3 report-mode).

### 4.1 Relationship to the existing refinements

The existing `superRefine` block enforces candidate-level rules (ownership
exclusions, `identity_confidence: "low" ⇒ business_seek_priority: "hold"`,
`category_fit: "insufficient"` handling) and stays a hard validation gate.
INV-1 … INV-8 are additive and complementary: existing rules govern
**candidate validity** (hard fail — a malformed candidate is worthless), the
new rules govern **coverage completeness** (report-mode — a partially covered
run still yields usable candidates).

---

## 5. Directive changes (operating posture + mechanism set)

### 5.0 Operating posture — diligence over speed

**This operation is enumeration work, not a search task.** The failure in §1.1 was
not a wrong query; it was a fast pass standing in for a sweep. A handful of
well-chosen searches reported `executed: true` at the vector level while 128 ZIP
sweep units were never opened. Speed is the specific hazard here: the cheaper a
pass looks, the more completely it hides what it skipped.

The directive below is injected into both discovery templates *ahead of* the
mechanism set, so the posture is set before the patterns are read.

```
=== OPERATING POSTURE — DILIGENCE OVER SPEED ===
This is an enumeration task with a fixed floor and variable depth. The floor is
not optional and it is not a formality: every sweep unit named in the geography
grid must be opened and classified, and a unit you did not open is a blind spot
you must report.

Do not treat a fast pass as coverage. A scan that issues a handful of well-chosen
queries and then reports its vector log as complete has not swept the market — it
has swept the queries. The failure this contract exists to prevent is a run that
reports "executed" for work it did not perform.

Work the floor first, then deepen where the evidence points:

1. Enumerate before you interpret. Open every unit before reasoning about which
   units matter. Judgement about relevance comes after enumeration, never instead
   of it.
2. One query is not a sweep. A unit is swept when its labels and platforms have
   been queried and the results classified — not when one search came back empty.
3. Absence of results is a finding, not a reason to move on. Record
   `executed_empty` with the labels and platforms you actually issued.
4. Prefer a second angle over a faster answer. When a unit returns nothing under
   the obvious label, try the neighbouring labels, the token-free enumeration,
   and the attribute filters before marking it empty.
5. Never launder a skip as "blocked." `blocked` means attempted and failed, with
   the failure named. A unit you chose not to open is `not_executed`, and it caps
   your completeness claim.
6. Take the time the enumeration costs. This operation is sized for careful work.
   A rushed pass is a re-run, and a re-run costs more than the careful pass would
   have.
=== END OPERATING POSTURE ===
```

#### 5.0.1 Why the framing alone is not enough

A posture directive is an exhortation, and exhortations decay — the §1.1 run had a
directive telling it to sweep every ZIP, and it reported coverage anyway. The
framing explains *why* the work matters; the contract in §3–§4 is what makes a
shortcut detectable. Both are needed, and they fail differently:

| Framing only | Contract only |
|---|---|
| Good intentions, no proof. A run can comply in spirit and still report coverage it did not achieve. | Mechanical compliance. A model touches every unit shallowly — one query per ZIP, empty arrays, `executed_empty` everywhere — and passes every invariant while finding nothing. |

INV-8 (§4) is the bridge: it makes "executed" mean *queried*, not merely *visited*.

#### 5.0.2 Runtime implications — thinking mode, not flash mode

"Thinking mode over flash mode" has concrete operational meaning for this scan:

- **Reasoning-capable model, higher effort setting.** The task requires holding a
  143-unit ledger, classifying ambiguous hits, and resisting the pull to close
  early. Shallow/fast configurations are the failure mode here, not a cheaper
  route to the same result.
- **Do not fan the grid across shallow parallel calls.** 128 ZIPs dispatched as
  128 independent single-shot calls produce 128 superficial answers and no
  cross-unit reasoning. Batch the grid into sequential passes instead.
- **Two-pass structure.** Pass 1 is the enumeration floor — open every unit, write
  the ledger, classify obvious hits. Pass 2 is deepening: revisit units that
  returned partial or ambiguous evidence, and run the token-free and attribute
  sweeps where the first pass came back thin.
- **Allow the run to be long.** The directive sizes this operation for careful
  work. Latency is the cost of the floor; a fast result is a suspect result.
- **Competitive is the more deceptive case.** The top three leaders surface in the
  first few queries, so a shallow competitive pass looks successful and its ledger
  looks plausible. The miss is the mid-tier benchmark that the emerging set will
  later be measured against (§1.3.1). Emerging at least fails visibly — it returns
  thin candidate sets; competitive fails invisibly.

#### 5.0.3 Diligence made checkable

Posture becomes contract through INV-8: a ledger row may carry
`executed_with_findings` or `executed_empty` only when `platforms_swept` and
`labels_swept` are non-empty for that unit. Empty arrays mean the unit was never
queried, so the row must read `not_executed` — which caps `completeness_claim`
(INV-5). The cheapest shortcut available to a fast pass is thereby also the most
visible one.

### 5.1 Mechanism-set changes

Prompt text lives in `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX`
(`intelligence-discovery.schema.ts:367`) and in the seeded templates
`mpt-seed-intel-discovery-emerging-001` / `mpt-seed-intel-discovery-competitive-001`
(`apps/api/src/scripts/seed-intelligence-discovery-templates.ts:31,49`). Both must
change together; re-run the seed for `local` and `prd` per the seed discipline in
`AGENTS.md`.

1. **Token-free platform enumeration (new mandatory vector).** Per ZIP, enumerate
   *all* pins under the swallow labels regardless of business name — no category
   token, no endonym required. This is the platform analogue of the existing
   geography-keyed dataset sweep and is the exact net that catches coverage-self-test
   class (6). Cost: one query per ZIP × label.
2. **Attribute-filter sweep (new vector, geography-keyed).** Platform-native
   ownership/service attribute filters (e.g. "Identifies as Black-owned",
   "women-owned", service options) as a named sweep with `sweep_key: geography`.
   Name-independent and category-independent; high yield for diaspora-owned
   categories. Both §1.1 businesses carried the Black-owned flag.
3. **Split `generic_label_set` into `hide_labels` and `reveal_labels` per
   platform.** "African goods store" is currently both a swallow label and the
   gold-standard correct label, so a sweeper cannot tell whether a hit is a
   prospect or a benchmark. Hide-labels drive enumeration; reveal-labels drive
   qualification.
4. **`coverage_self_test` becomes a run-time assertion.** Each class must cite the
   `unit_id`(s) actually executed and the result. A class that names a mechanism
   but cites no unit is `uncovered`. Today the self-test certifies mechanism
   *presence* and therefore passes on every run where the mechanism was designed
   but skipped.
5. **Reconciliation is import-side (v1.3).** Operator-supplied members are an
   import-modal input, injected and diffed by the gate — no prompt change, no
   model-authored reconciliation to trust. The prompt still documents the
   `reconciliation` block shape for members the operator pasted into the
   external run itself; the gate merges rather than overwrites those.

---

## 6. Substrate changes

1. **Add the Missouri-side suburban datasets** — City of Gladstone business
   licensing, Clay County food-establishment records, and equivalents for the
   remaining adjacent municipalities — or accept `uncovered` and let INV-4/INV-5
   cap the claim. Either is acceptable; silence is not.
2. **Adopt the authoring invariant:** every municipality in
   `adjacent_municipalities` maps to ≥1 label-independent dataset or is explicitly
   flagged `uncovered`. This is checkable at profile-authoring time, before any
   scan runs. Gladstone maps to none today.
3. **Grid ↔ dataset consistency check.** The geography grid and the
   label-independent sweep set are authored separately and drifted: the grid named
   the N Oak / Gladstone corridor as a node while the dataset set covered only
   KCMO and Kansas. Add a validation that every corridor in
   `geography_grid.corridors` resolves to at least one ZIP sweep unit.

---

## 7. Trust model for multi-market deployment

A market run earns a green light when three properties hold:

1. **Claims are derived, not asserted.** `completeness_claim` is computed from the
   ledger (INV-5). A run that skipped 47 of 143 units cannot report full coverage.
2. **Gaps are named, not silent.** Unexecuted vectors and uncovered municipalities
   are enumerated with reasons (INV-4, INV-6) — the property bronze already has and
   discovery lacks.
3. **Ground truth reconciles.** Operator-supplied members must match the ledger
   (INV-7), so a market run that missed real businesses fails loudly instead of
   shipping a confident-looking artifact.

### 7.1 Green-light criteria (per market)

| Gate | Requirement |
|---|---|
| G1 — Grid completeness | `units_not_executed == 0` for `zip_label_matrix` rows (INV-3) |
| G2 — Municipality coverage | `uncovered_municipalities == []` **or** each uncovered municipality carries a documented reason (INV-4) |
| G3 — Vector honesty | Every unexecuted vector listed with a reason (INV-6) |
| G4 — Reconciliation | Zero unmatched operator-supplied members (INV-7) |
| G5 — Claim | `completeness_claim ∈ {verified_full, verified_partial}` with the cap enforced (INV-5) |

A market that fails G1–G4 may still ship, but only as `verified_partial`, and the
failure list travels with the artifact. In v1 all gates are **report-mode**
(v1.3): violations stamp into `scan_contract_violations[]` and the stored
`completeness_claim` is corrected to the derived value — imports are never
rejected on coverage grounds.

INV-8 raises the bar on G1: a unit counts toward `units_executed` only when it was
actually queried, so a shallow pass cannot satisfy G1 by visiting units.

The gates apply **per focus**, and a market is not green-lit until both ledgers
pass. A `verified_full` emerging ledger sitting beside a `verified_partial`
competitive one is not a green light — the emerging benchmark bar is set by the
weaker run (§1.3.1).

---

## 8. What this does NOT close

Stated explicitly so it is not mistaken for solved:

- **Grid derivation completeness.** INV-3 … INV-5 prove coverage of the *declared*
  grid, not that the grid is complete for the market. A market with a whole
  corridor missing from `geography_grid` still passes. This is a data-derivation
  problem (corridor discovery from address evidence), not a contract problem.
- **Token-keyed search patterns.** The mechanism set still keys name-token,
  product long-tail, and community-referral searches on vocabulary. §5.1 adds a
  token-free platform sweep as a *floor*, but the search patterns themselves remain
  token-shaped and can under-return without violating any invariant.
- **Source-set bias (emerging-scoped).** Community directories used as primary
  emerging-discovery sources carry geographic bias — the AMCKC list supplied a
  Gladstone storefront at 6420 N Oak but neither of the two §1.1 businesses. The
  geographic sweep is the corrective, not a fix to the source. Competitive focus
  leads with mainstream platforms and is less exposed to this particular bias, but
  not to the grid-derivation limitation above.
- **Focus-pair parity is unenforced.** §1.3.2 surfaces divergence between the
  emerging and competitive ledgers; nothing yet requires them to agree. A market can
  ship a `verified_full` emerging ledger beside a `verified_partial` competitive one,
  and the emerging benchmark bar is then set by the weaker run (§1.3.1).

---

## 9. Implementation map

| Change | File | Anchor |
|---|---|---|
| `scan_contract` schema field + `candidate_key_aliases` | `apps/api/src/validators/intelligence-discovery.schema.ts` | `intelligenceDiscoverySchema`, `discoveredBusinessSchema` |
| `deriveCandidateKey` / key-set matching + `collectDiscoveryContractViolations` (INV-1…8) | same file | new exports |
| Degraded-mode synthesis | same file | `normalizeIntelligenceDiscoveryPayload` |
| Import gate — grid fetch, INV-3/4, INV-7 reconciliation, `scan_contract_violations` stamp, `completeness_claim` overwrite | `apps/api/src/services/MarketingPromptService.ts` | `importExternalResult` post-parse seam (same as `applyRenderControlCoverageGate`) |
| `operator_supplied_members` import input | import modal (web) + `importExternalResult` input | — |
| Directive changes — output contract (§3) | `intelligence-discovery.schema.ts` | `INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX` |
| Directive changes — posture (§5.0) | `apps/api/src/services/intelligence/PromptComposerService.ts` | `composeIntelligencePrompt` assembly (one site covers both focuses — the seeded `mpt-seed-intel-discovery-*` templates are thin `{{#compose_intelligence}}` markers, NOT the mechanism text) |
| Directive changes — mechanism set (§5.1) | `apps/api/src/scripts/seed-intelligence-fragments.ts` | focus fragments (`GEOGRAPHY GRID EXECUTION`, competitive integration) |
| `unit_id` convention in grid directive | `apps/api/src/services/intelligence/geography-grid.ts` | `buildGeographyGridDirective` |
| Substrate additions (§6) | profile-establishment authoring path | `intelligence-profile.schema.ts` + establishment template seed |
| UI surfacing of the attestation + violations + focus parity | `apps/web/src/components/marketing-ops/IntelligenceDiscoveryAuditCard.tsx` | — |

Precedent to follow: `apps/api/src/validators/bronze-standard-scan.schema.ts:213`
(`vector_execution_log`) and its prompt-suffix documentation at :228; the
import-path gate pattern from `applyRenderControlCoverageGate`.

### 9.1 Rollout (v1.3)

1. Schema shape + slugger + `collectDiscoveryContractViolations` (INV-1/2/5/6/8
   payload-internal; INV-3/4 grid-parameterized) + degraded-mode synthesis.
2. Import gate: grid fetch, INV-3/4/7, reconciliation diff, violations stamp,
   claim overwrite. `operator_supplied_members` input on the import path.
3. Directives: §5.0 posture (composer), §5.1 mechanism set (fragments seed),
   `scan_contract` output docs (prompt suffix), `unit_id` convention (grid
   directive). Re-seed `local` + `prd`.
4. Audit card: attestation, violations, municipality coverage, reconciliation,
   focus-pair parity, synthesized `unverified` for legacy audits.
5. Substrate authoring invariant (§6) in the establishment path.

---

## 10. Open questions

Resolved in v1.3:

1. ~~**`candidate_key` derivation.**~~ **Locked:** `slug(business_name)--slug(city)`
   + `candidate_key_aliases` for name variants (Tawakal/Al-Hallal/Darsalaam).
   Matching canonicalizes both sides. See §3.1.
3. ~~**Who writes `blocked_reason`.**~~ **Locked:** model-authored. INV-8's
   non-empty `platforms_swept`/`labels_swept` requirement plus warn-mode stamping
   makes laundered skips visible on the audit card; no operator field in v1.
4. ~~**Retrofit.**~~ **Locked:** `completeness_claim: "unverified"` synthesized on
   import (normalizer) and on read (audit card). No backfill, no re-scan required.
6. ~~**Per-unit evidence floor / `queries_issued`.**~~ **Locked:** field omitted.
   A self-reported query count is asserted, not derived — the least verifiable
   field the row could carry, and the exact pattern this contract exists to
   remove. The row stays: `unit_id, unit_type, unit, platforms_swept,
   labels_swept, status, findings_count, candidate_keys, executed_at,
   blocked_reason`.
7. ~~**Effort budget per market.**~~ **Locked:** ledger discipline only; no
   wall-clock or tool-call floor in v1.
8. ~~**One ledger or two.**~~ **Locked:** separate ledgers per focus; parity is
   reported side-by-side on the audit card (§1.3.2), never enforced. Keeps the
   two runs independently schedulable.

Still open:

2. **Ledger size ceiling.** 143 rows for this market; a large metro grid could push
   the payload materially. Is a per-ZIP rollup always sufficient, or do some
   markets need per-label rows?
5. **Grid-derivation completeness (§8).** Out of scope here — needs its own spec
   for deriving corridors from address evidence rather than from hand-authored
   grids.
