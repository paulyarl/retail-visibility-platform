# NIL Youth Sports Platform — Budget Model

**Version:** 1.0 · **Date:** 2026-09-30
**Companion:** `EXECUTION_PLAN.md` (effort model §6), `TEAM_BRIEF.md` (§5.6 summary)
**Audience:** whoever holds the budget — leadership, finance, or the founder

---

## 0. How to read this

This document turns the effort model in `EXECUTION_PLAN.md` §6 into money. It has three parts:

1. **§1–§3 — The model.** What costs what, and the parameters only you can supply.
2. **§4–§6 — The scenarios.** Three delivery shapes, with arithmetic, and an honest analysis of what AI agents actually change.
3. **§7–§11 — Run-rate, risk, guardrails, and what's excluded.**

**Every vendor price in §2 was researched on 2026-09-30 and is dated and sourced.** Prices change; verify before committing. Every *labor* rate is a **parameter you supply** — I have used one clearly-labelled illustrative rate so the arithmetic is visible, and all figures scale linearly if you substitute your own.

> **One number to internalise before reading further:** an AI agent-week costs roughly **$50–100**. A human engineer-week costs roughly **$3,000**. Agents are 30–60× cheaper per unit of *produced* work — and this still only reduces the MVP build cost by **~25%**, because the constraint is not agent spend. It is **human review capacity**, and the safety-critical work that agents must not own. §5 explains why.

---

## 1. Cost Model

Six components. Four are one-time build costs; two are ongoing.

| # | Component | Type | Scale driver | Covered in |
|---|---|---|---|---|
| **1** | **Human engineering labor** | One-time | Engineer-weeks × loaded rate | §3, §4 |
| **2** | **AI agent capacity** | One-time (during build) | Seats × months + metered usage | §3, §4 |
| **3** | **Legal & compliance review** | One-time | External engagement | §3, §4 |
| **4** | **Infrastructure during build** | One-time | Months of build | §4 |
| **5** | **Infrastructure run-rate** | Ongoing | Monthly, post-launch | §7 |
| **6** | **Contingency** | One-time | % of the above | §8 |

**Not modelled here** (deliberately — see §11): revenue, Phase-4 finance infrastructure (escrow, KYC, payouts), post-MVP feature phases, marketing, and headcount beyond the build team.

---

## 2. Researched Reference Prices

Researched **2026-09-30**. Source type is flagged: **[P]** = vendor's own pricing page; **[S]** = third-party summary (treat as indicative, verify before committing).

### 2.1 Development infrastructure (during build)

| Service | Plan | Price | Notes | Src |
|---|---|---|---|---|
| **Supabase** | Pro | **$25/mo** + compute per project (~$10/Micro, offset by $10/mo compute credits) | Includes 100k MAU, 8 GB disk/project, 250 GB egress. Two projects (dev + prod) ≈ $35–45/mo | [P] |
| **Vercel** | Pro | **$20/mo** platform fee, includes 1 seat + $20 usage credit; **+$20/mo per additional seat** | 3-person team ≈ $60/mo | [P] |
| **Railway** | Pro | **$20/mo per workspace**, unlimited seats, includes $20 usage | Usage beyond: RAM $10/GB/mo, CPU $20/vCPU/mo, egress $0.05/GB | [P] |
| **Auth0** | Free → B2C Essentials | **$0** up to 25,000 MAU; Essentials **from $35/mo** (500 MAU) → $350 (5,000) → $700 (10,000) | **B2C** track applies (athletes/guardians/fans are consumers). B2B Essentials is $150/mo+ if institution/sponsor orgs need it | [P] |
| **Doppler** | Team | *Not researched* — parameterise (~$0–30/mo) | Verify | — |
| **Domain + DNS** | — | ~$10–20/yr | Edge-hosted, so DNS is free at the registrar | [P] |

**Build-period infra estimate: ~$150–350/month**, or **~$900–2,500 over a 6-month build.**

> **Cost-avoidance note:** Auth0's free tier covers up to **25,000 MAU**. At MVP scale you may pay **$0** for authentication. Verify against feature needs (custom domain, SSO, and role/org features may force a paid tier).

### 2.2 Production run-rate (post-launch)

| Service | Plan | Price | Src |
|---|---|---|---|
| **Sentry** | Team | **$26/mo** annual, **$29/mo** monthly (Business $80/$89) | [P] |
| **SendGrid** | Essentials → Pro | **from $19.95/mo** (50k emails) → **from $89.95/mo** (100k) | [P] |
| **OpenAI (RAG bot)** | API | *Not researched* — parameterise. Usage-based; scales with bot traffic | — |
| **CSAM / content-safety scanning** | Vendor | **Parameterise — required line item, not optional** | — |
| **Stripe** | Per transaction | Not MVP-relevant — see §11 | — |

**Post-launch run-rate: ~$150–600/month** at MVP scale (**~$1,800–7,200/year**), excluding bot API usage and content-safety scanning.

> **The content-safety line item is the one people forget.** `TECHNICAL_SPEC.md` §12.7 states that CSAM detection is legally mandated for any platform hosting minor imagery, even when media is third-party-hosted (thumbnails and metadata pass through). This is **not** a cost you can defer to Phase 4 — it is part of the P0 media moderation gate in Phase 2. Price it before you commit. Some CDN providers include a CSAM scanning tool at no extra cost; verify current terms rather than assuming.

### 2.3 AI agent capacity — the seat/usage split

| Tool | Seat price | Billing shape | Src |
|---|---|---|---|
| **Devin (Cognition)** | Free $0 · Pro **$20/mo** · Max **$200/mo** · Teams **from $80/mo** ($40/full seat) · Enterprise custom | Included quota, then **on-demand credits at API list prices**. (Legacy public per-ACU self-serve billing is retired; ACUs persist only in Enterprise order forms) | [P] |
| **Cursor** | Hobby $0 · Pro $20 · Pro+ $60 · Ultra $200 · **Teams Standard $40/user/mo**, Premium $120/user/mo | Seat includes a usage allowance, then on-demand at API rates | [P] |
| **Claude Code** | Free · Pro $20 ($17 annual) · Max 5x $100 · Max 20x $200 · **Team standard $25/seat/mo**, premium $125 | Five-hour and weekly usage windows; Enterprise $20/seat + usage at API rates | [P] |

**The budget-critical fact — seat price is a rounding error:**

> Anthropic publishes observed Claude Code costs across enterprise deployments of **~$13 per developer per active day** and **$150–250 per developer per month**, noting the seat fee is only **~8–12% of what you actually pay**. **[S]**

**So: budget for usage, not seats.** A $20 seat can produce a $250/month bill. For planning, use **$200–400 per heavily-used agent seat per month, all-in** — which is **~$50–100 per agent-week**.

### 2.4 Legal & compliance review

**Not researchable generically — this is your single largest unknown.** Review of a minors' platform across COPPA, FERPA, state high-school NIL divergence, and right-to-erasure is not commodity contract review. Parameterise at **$15,000–60,000**, and treat the high end as live until you have a quote.

This is decision **D10** in `EXECUTION_PLAN.md` §1 — the longest lead time in the project, and it hard-gates the Stage 2 schema freeze.

---

## 3. Parameters You Must Supply

Substitute your own values. Every scenario below scales linearly.

| # | Parameter | Symbol | Illustrative value used here | Your value |
|---|---|---|---|---|
| 1 | Fully-loaded engineer cost per week (salary × ~1.3 + overhead ÷ 46 working weeks) | `R` | **$3,000** | ______ |
| 2 | Senior/lead rate (for the safety-core owner) | `Rₛ` | $4,000 | ______ |
| 3 | Number of human engineers | `H` | 2–3 | ______ |
| 4 | Agent seats | `A` | 3 | ______ |
| 5 | Agent all-in cost per seat-month | `Aₘ` | **$300** | ______ |
| 6 | Agent effectiveness multiplier on **verifiable** work | `E` | **2×** (range 1.5–3×) | ______ |
| 7 | Review tax — human hours per unit of agent output | `T` | **25%** | ______ |
| 8 | Legal review | `L` | **$30,000** (range $15–60k) | ______ |
| 9 | Build duration in months | `M` | 7 | ______ |

**Parameter 6 is the one to measure, not guess.** The S0.1 extraction spike (`EXECUTION_PLAN.md` §0) already deletes one commerce vertical and repairs it to a green typecheck. **Have the agent do that work, and record the agent-hours, the human review-hours, and the defects found.** That single measurement replaces parameters 6 and 7 with data — and it is the same 3–5 days the plan already recommends.

---

## 4. Scenarios

### 4.1 The work split (from `EXECUTION_PLAN.md` §6.1, mid estimates)

The 56 ew midpoint divides into work agents can safely produce, and work they must not own.

| Stage | Mid ew | Class | Why |
|---|---|---|---|
| S0 Baseline, spike, CI, hygiene | 2.0 | Human-led | Decisions and measurement |
| S1 Infrastructure | 1.5 | Human-led | Account setup, credentials, auth wiring |
| S2 Schema Foundation | 6.0 | **Mixed** | Schema design is human; migrations, seeds, and table definitions are agent-heavy |
| S3 API Extraction & Core | 9.0 | **Agent-heavy** | Deletion-and-repair loops, 19 ID generators, 11 resolvers — all verifiable by typecheck |
| S4 Safety Substrate | 3.0 | **Human-owned** | Tenant guard, consent engine, moderation gate, test harness |
| S5 Vertical Slice | 3.5 | **Human-owned** | The five P0 invariants |
| S6 Web Extraction & Core | 9.0 | **Agent-heavy** | Same repair loop, verifiable by typecheck |
| S7 Credibility Shell | 2.5 | **Mixed** | UI is agent-heavy; the lead-intake safety path is human |
| S8 Native Pipeline Breadth | 3.5 | **Mixed** | Entity types agent-heavy; the compliance gate is human |
| S9 Unified Service | 16.0 | **Mixed** | Capabilities/dashboards agent-heavy; invitations, CRM, and bot guardrails human |
| **Total** | **56.0** | | |

**Resulting split: ~34 ew agent-suitable, ~22 ew human-owned.**

### 4.2 Scenario A — All-human (3 engineers)

| Line | Calculation | Mid | Range |
|---|---|---|---|
| Engineering labor | 56 ew × $3,000 | **$168,000** | $118,500–$219,000 |
| Agent capacity | — | $0 | $0 |
| Legal review | parameter | $30,000 | $15,000–$60,000 |
| Build infra | ~7 months × ~$250 | $1,750 | $900–$2,500 |
| **Total** | | **$199,750** | **$134,400–$281,500** |

Highest cost, lowest execution risk, no new tooling to learn.

### 4.3 Scenario B — Hybrid (2 humans + 3 agent seats) — **recommended**

The agent takes the 34 ew of verifiable work at 2× effectiveness; humans own the 22 ew safety core **and review the agent's output**.

| Line | Calculation | Mid | Range |
|---|---|---|---|
| Agent-produced work | 34 ew ÷ 2× | 17 ew | 11–23 ew |
| Human review of it | 17 ew × 25% | 4.3 ew | 3–6 ew |
| Human-owned work | — | 22 ew | 22 ew |
| **Total human** | | **43.3 ew** | 36–51 ew |
| Engineering labor | 43.3 ew × $3,000 | **$129,900** | $108,000–$153,000 |
| Agent capacity | 3 seats × 7 mo × $300 | $6,300 | $4,200–$8,400 |
| Legal review | parameter | $30,000 | $15,000–$60,000 |
| Build infra | ~7 months × ~$250 | $1,750 | $900–$2,500 |
| **Total** | | **$167,950** | **$128,100–$223,900** |

**Saving vs Scenario A: ~16% on the total, ~23% on labor.** The saving is smaller than the agent cost advantage suggests — §5 explains why.

### 4.4 Scenario C — Agent-heavy (1 human + 5 agent seats)

| Line | Calculation | Mid | Range |
|---|---|---|---|
| Human-owned work | — | 22 ew | 22 ew |
| Human review of agent output | — | *unbounded — see below* | — |
| Engineering labor | 22 ew × $4,000 (senior, as sole owner) | **$88,000** | $88,000 |
| Agent capacity | 5 seats × 9 mo × $300 | $13,500 | — |
| Legal review | parameter | $30,000 | $15,000–$60,000 |
| Build infra | ~9 months × ~$250 | $2,250 | — |
| **Total (on paper)** | | **$133,750** | — |

**Cheapest on paper, most expensive in expectation. Not recommended.**

One human cannot own 22 ew of safety-critical design *and* adversarially review 34 ew of agent output. The P0 gates specifically require a second pair of eyes — a tenant guard reviewed by its own author is not reviewed. This scenario does not reduce cost; it **moves cost from the build budget into the incident budget**, which is the one line item you cannot bound.

The calendar also stretches rather than compresses, because a single reviewer is a serial resource.

### 4.5 Scenario comparison

| | A — All-human | **B — Hybrid** | C — Agent-heavy |
|---|---|---|---|
| Team | 3 humans | **2 humans + 3 agents** | 1 human + 5 agents |
| Mid total | $199,750 | **$167,950** | $133,750 |
| Range | $134k–282k | **$128k–224k** | not bounded |
| Calendar | 5–8 months | **5–8 months** | 9+ months |
| Independent review of the safety core | ✅ 3 reviewers | **✅ 2 reviewers** | ❌ none |
| **Recommendation** | Viable, highest cost | **Recommended** | **Not for a minors' platform** |

---

## 5. What AI Agents Actually Change

This is the section worth reading twice, because the honest answer is not the intuitive one.

### 5.1 The economics are dramatic per unit of work

| | Cost per week |
|---|---|
| Human engineer | ~$3,000 |
| AI agent (heavily used, all-in) | **~$50–100** |

Agents are **30–60× cheaper** per unit of *produced* work. If agents were 2× effective on the whole project, the build would cost a small fraction of Scenario A.

### 5.2 …and it still only saves ~25%, for three structural reasons

1. **The safety core cannot be delegated.** ~22 ew — the tenant guard, consent engine, visibility firewall, moderation gate, cache-invalidation contract, and the P0 test suite — must be human-designed and human-reviewed. Not because agents can't write the code, but because in a platform handling minors' data, the failure mode is a legal event, and the plan's whole P0 regime assumes an accountable author.
2. **The review tax is real and higher here.** Agent output is cheap to produce and expensive to verify. The plan's own standard (`EXECUTION_PLAN.md` §7.1) requires every negative-path test to be **non-vacuous** — it must fail if the control is removed. Verifying that an agent's safety test genuinely tests the safety property is human work, and it does not compress.
3. **The critical path is decisions and review, not typing.** S2→S3→S4→S5 is a hard chain (`EXECUTION_PLAN.md` §2.1). Agents do not shorten it, because each stage gates on a human decision (D1–D5) or a human review.

### 5.3 Where agents genuinely earn their keep on this project

Ranked by value, based on the stage classification in §4.1:

| Rank | Work | Why it suits agents |
|---|---|---|
| 1 | **S3 / S6 deletion-and-repair** (~18 ew) | Mechanical, bounded, and **verifiable by a green typecheck** — the cheapest possible verification signal |
| 2 | **Repetitive analog work** — 11 resolvers (optimization O2), 7 base singletons, ~44 components, 19 ID generators, seed scripts, nav reseed | One reference implementation, then N near-copies |
| 3 | **Spec reconciliation and documentation** | Exactly what produced `SPEC_AMENDMENTS.md` — high-volume, low-risk, reviewable by diff |
| 4 | **Test scaffolding** | Fast to generate, cheap to check |
| 5 | **Schema migrations and seeds** | Pattern-following; verified by `prisma validate` |

### 5.4 Where agents must not be the owner

| Work | Why |
|---|---|
| **The five P0 invariants** (S5.7) | A defect is a legal event. Requires human design *and* independent human review |
| **The tenant guard** (S4.1) | It is the Phase-2 substitute for database-level isolation (finding F1). Its correctness is the privacy guarantee |
| **The public-surface PII sweep** (S4.6) | The failure mode is *something missing* — and agents are systematically biased toward confirming what they were asked to look for. This needs human adversarial review |
| **Decisions D1–D7** | Architecture and policy. Not delegable |
| **Legal sign-off (D10)** | Not delegable at any price |

### 5.5 The metric to manage

From the Devin pricing analysis, and worth adopting verbatim as the budget KPI:

> **Price agent work by accepted work per hour of human review — not by prompts, sessions, PRs, or runtime.**

A PR count tells you nothing. "We spent 4 human-hours to land 30 ew-equivalent of verified change" tells you everything. Track it per stage; if it degrades, the multiplier `E` in §3 is wrong and the estimate needs revising.

### 5.6 On the sensitivity of this question

Worth stating plainly, because it is a fair thing for a team to wonder about.

This model does **not** propose headcount reduction. Scenario B is the recommended shape, and it keeps **two** human engineers — including a dedicated owner for the safety core. What agents change is *where human attention is spent*: away from mechanical breadth work, toward the safety-critical design, review, and decisions that determine whether the platform is defensible.

Scenario C — the one that does reduce headcount — is explicitly **not recommended**, on technical grounds rather than sentiment: it removes independent review from the child-safety controls, which is the single most expensive risk in the project (§8). Anyone proposing it is either over-estimating what agents can own or under-budgeting review.

---

## 6. Cost by Milestone (Scenario B)

The natural budget checkpoints, since each milestone already has a gate and an evidence artifact.

| Milestone | Cumulative effort | Human-equivalent (~77%) | Cumulative cost | Cumulative time |
|---|---|---|---|---|
| **M0 — Foundations** | 18.5 ew | ~14.2 ew | **~$43,000** | ~2 months |
| **M1 — Investor-ready public site** | 21 ew | ~16.2 ew | **~$49,000** | ~3 months |
| **M2 — Safety core validated ★** | 27.5 ew | ~21.2 ew | **~$64,000** | ~3.5–4 months |
| **M3 — Platform complete** | 40 ew | ~30.8 ew | **~$92,000** | ~5 months |
| **M4 — Full MVP** | 56 ew | ~43.3 ew | **~$130,000** (labor) | 5–8 months |
| Add: agent capacity, infra, legal | — | — | **+$38,000** | — |
| **Program total** | | | **~$168,000** | **5–8 months** |

**M2 is the budget decision point.** It is where the architecture is proven and where `EXECUTION_PLAN.md` §6.5 re-baselines the remaining stages from measured velocity. Approve the budget through M2 with confidence; treat M3–M4 as provisional until then.

---

## 7. Run-Rate After Launch

| Line | Monthly | Notes |
|---|---|---|
| Supabase Pro (+1 extra project) | $35–45 | Compute per project |
| Vercel Pro (3 seats) | $60 | $20 platform + 2 × $20 seats |
| Railway Pro | $20–40 | Scales with API load |
| Auth0 | **$0–350** | Free to 25k MAU; B2C Essentials $35 @500 MAU → $350 @5,000 |
| Sentry Team | $26–29 | Annual vs monthly billing |
| SendGrid Essentials | $20 | 50k emails |
| OpenAI (RAG bot) | *parameterise* | Scales with bot traffic |
| **Content-safety / CSAM scanning** | *parameterise* | **Required, not optional** — see §2.2 |
| Doppler | *parameterise* | ~$0–30 |
| Domain | ~$1–2 | Annual, amortised |
| **Total** | **~$150–600/mo** | **~$1,800–7,200/yr** |

**Post-MVP, Phase 4 adds real cost:** escrow and payment processing, KYC/AML verification per guardian, tax-document (1099) handling, and the non-profit allocation ledger. **None of that is in this budget.** It is scoped in `EXECUTION_PLAN.md` §4 Stage 10 (outline only, no estimate).

### 7.1 The revenue gap — set this expectation explicitly

**The MVP generates no revenue.** Implementation Phase 1–3 delivers a public presence, a controlled profile pipeline, and persona portals. The monetisation model (`TECHNICAL_SPEC.md` §12.10 — transaction fees on settled deals, plus payer-keyed institution/sponsor tiers) is **Phase 4**.

**So the MVP is a pure cost centre.** It is funded by the credibility it creates, not by what it collects. Anyone building a budget model that assumes the MVP pays for itself is modelling Phase 4.

---

## 8. Contingency, and the Cost of Failure

### 8.1 Contingency

| Estimate portion | Confidence | Recommended contingency |
|---|---|---|
| S0, S1, S4, S5, S7 (well-understood) | High/Medium | 10% |
| S2, S3, S6, S9 (Low confidence) | Low | **25%** |
| Legal review | Unknown | **Hold the full $60,000 until quoted** |
| Agent capacity | Usage-metered | Cap it — see §9 |

**Blended recommendation: 15–20% on the mid estimate**, i.e. **~$25,000–35,000** on Scenario B.

### 8.2 The cost of failure

The reason the safety budget is not compressible:

| Failure | Rough cost shape |
|---|---|
| A minor's data reaches a public surface | Legal exposure, mandatory notification, remediation, and reputational loss in a community where **trust is the product**. Not boundable in advance |
| A consent revocation that doesn't fully evict | Same, plus a demonstrable control failure — the plan's own P0 test 3 exists precisely for this |
| An adult-to-minor contact path | The single most damaging possible outcome for this platform |
| Erasure that can't complete because the audit log holds PII | Regulatory exposure, and a data migration to fix (finding F9 / decision D7) |

**Every one of these is cheaper to prevent than to remediate.** The `~$25–35k` of contingency and the `~22 ew` of human-owned safety work are the cheapest insurance in this budget. Trading either for a lower headline number is a false economy — and it is the specific failure mode that Scenario C represents.

---

## 9. Budget Guardrails

Practical controls, so the budget behaves:

| # | Guardrail | Why |
|---|---|---|
| 1 | **Cap agent on-demand spend monthly** per seat, with an alert threshold | Usage is metered at API list prices; a runaway loop is a real bill. All three tools support spend limits |
| 2 | **Track accepted-work-per-review-hour** (§5.5) per stage | The only meaningful agent productivity metric; it validates or refutes parameter `E` |
| 3 | **No agent output merges to a P0 surface without human review** | Non-negotiable. Make it a branch-protection rule, not a convention |
| 4 | **Re-baseline the budget at M2** alongside the effort re-baseline | M3–M4 are provisional until the architecture is proven |
| 5 | **Hold legal contingency unspent until quoted** | The largest single unknown; do not absorb it into other lines |
| 6 | **Use the free tiers deliberately** — Auth0 to 25k MAU, Supabase/Vercel/Railway free tiers during exploration | Meaningful at MVP scale; revisit when limits bind |
| 7 | **Price content-safety scanning before committing to launch** | Required, not optional, and easy to discover late |

---

## 10. Sensitivity — What Moves the Number

| Driver | Effect on Scenario B mid ($168k) |
|---|---|
| **Legal review** at $15k instead of $30k | −$15,000 (**−9%**) |
| **Legal review** at $60k instead of $30k | +$30,000 (**+18%**) — the largest single swing |
| **Agent multiplier `E`** 3× instead of 2× | −$21,000 (**−13%**) |
| **Agent multiplier `E`** 1.5× instead of 2× | +$21,000 (**+13%**) |
| **Review tax `T`** 40% instead of 25% | +$7,500 (**+4%**) |
| **Labor rate** ±20% | ±$26,000 (**±15%**) |
| **Effort** at the low end (39.5 ew) | −$42,000 (**−25%**) |
| **Effort** at the high end (73 ew) | +$42,000 (**+25%**) |

**Ranked by leverage:** (1) effort range, (2) legal review, (3) labor rate, (4) agent multiplier, (5) review tax.

Note the asymmetry worth exploiting: the **agent multiplier and the review tax are the two drivers that move together**. A higher `E` (agents more effective) and a lower `T` (cheaper to verify) compound — which is exactly what optimization O2 (template-first capability) and the CI gates in S0.3 are for. Verifiable-by-construction work is where agents win twice: once in production, once in review.

**The first two are the ones to attack.** Effort is attacked by the S0.1 spike (which measures the repair tax). Legal is attacked by getting a quote early — which is also decision D10, the plan's longest lead-time item.

---

## 11. What Is Not In This Budget

| Excluded | Why | Where it lives |
|---|---|---|
| **Revenue** | MVP is a cost centre (§7.1) | Phase 4, `TECHNICAL_SPEC.md` §12.10 |
| **Payment processing / Stripe fees** | No money moves in the MVP | Phase 4 |
| **Escrow, KYC/AML, payouts, 1099 handling** | Explicitly post-MVP (`EXECUTION_PLAN.md` §4 Stage 10) | Phase 4 — material cost, unestimated |
| **Automated compliance vetting** | Manual verdict in MVP | Phase 4 |
| **Row-level security implementation** | Decision D1 default = Phase 4 (+3–6 ew if elected early) | `EXECUTION_PLAN.md` §1 D1 |
| **Data-erasure automation** | Manual in MVP | Phase 4 |
| **Marketing, brand, content production** | Outside engineering scope | Separate budget |
| **Post-launch support and on-call** | Not modelled | Separate budget |
| **Headcount beyond the build team** | Not modelled | Separate budget |
| **Manual compliance-review staffing** | **A launch decision, not an engineering one** — MVP launch volume is bounded by human review capacity (`TEAM_BRIEF.md` §7) | Separate budget, **needed before launch** |

---

## 12. Summary

| Question | Answer |
|---|---|
| **MVP build cost, recommended (Scenario B)** | **~$168,000** mid · range **$128,000–224,000** |
| Same, all-human (Scenario A) | ~$200,000 mid · range $134,000–282,000 |
| Saving from AI agents | **~16% of total, ~23% of labor** — not an order of magnitude (§5.2) |
| Agent cost per seat-month | **$200–400 all-in** (budget usage, not seats — §2.3) |
| Biggest single line | **Human engineering labor**, ~77% of the total |
| Biggest single unknown | **Legal review**, $15k–60k — get a quote early |
| Post-launch run-rate | **~$150–600/month** |
| Contingency | 15–20%, weighted to the Low-confidence stages |
| When the budget becomes trustworthy | **At M2**, alongside the effort re-baseline |
| The one thing not to compress | **The ~22 ew of human-owned safety work and its independent review** (§8.2) |
| The one measurement to take first | **Agent effectiveness and review cost, during the S0.1 spike** (§3, parameter 6) |

**Bottom line.** The MVP costs roughly **$170k** in the recommended shape, and **~$130k of that is human engineering** — because over a third of the work is safety-critical and cannot be delegated, and because the rest still carries a human review tax. AI agents are genuinely cheap per unit of produced work (~$50–100/agent-week vs ~$3,000/engineer-week) and are worth deploying aggressively on the mechanical breadth work, which is where the plan's uncertainty is concentrated. But they reduce the MVP bill by about a quarter, not by a factor of ten — and the scenarios that promise more do so by removing independent review from child-safety controls, which transfers cost into the one budget you cannot bound.
