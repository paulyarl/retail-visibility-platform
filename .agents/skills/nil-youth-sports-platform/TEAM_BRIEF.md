# NIL Youth Sports Platform — Team Brief

**MVP path, effort, and what to expect**

**Version:** 1.0 · **Date:** 2026-09-30
**Audience:** the whole team — engineering, product, compliance/legal, leadership, and investors
**Purpose:** set expectations for the MVP build. Plain language. No jargon without a definition (glossary in §11).

---

## 0. How to read this

Different people need different sections. Find yours:

| If you are… | Read |
|---|---|
| Leadership or an investor | §1 (60 seconds), §4 (what you get, when), §5 (how long), §7 (what's *not* included) |
| Product or design | §2 (what we're building), §4, §6 (what "done" means), §7 |
| Engineering | Everything, then `EXECUTION_PLAN.md` §4 for the task-level detail |
| Compliance or legal | §3, §6 (the five safety promises), §9 (what we need from you) — **and please read §9 first** |
| New to the project | §1, §2, §11 (glossary) |

---

## 1. The 60-second version

**What we're building.** A digital platform for youth sports where student-athletes can have a public profile, schools can manage rosters, sponsors can offer Name/Image/Likeness deals, and fans can follow teams — all built so that a child's information is controlled by their parent and cannot leak into public view without explicit permission.

**Where it comes from.** We are not starting from scratch. We're taking our existing platform (which already handles accounts, permissions, payments, customer support tools, and a chatbot) and adapting it — removing the retail-shopping parts and adding the youth-sports parts. This saves us a lot of work, but it is not free, because the two businesses are shaped differently.

**How long.** **5 to 8 months** for the full MVP with a team of three. The first meaningful milestone — a public website that captures leads — lands at roughly **3 months**.

**How much.** **~$170,000 to stand up the MVP** — range **$128,000–224,000**. About **$130,000** of that is human engineering; the rest is AI agent capacity, infrastructure, legal review, and contingency. After launch, running it costs **~$150–600/month**. See §5.6 for the summary and `BUDGET.md` for the full model.

**The honest caveat.** That range is a *planning estimate*, not a promise. Two parts of the work are genuinely hard to predict, and they're the parts that dominate the schedule. We'll replace the estimate with a measured one at roughly the 3.5-month mark, once the core design is proven. See §5.

**The biggest risk.** Not technical — **legal**. The design for handling children's data needs review and sign-off, and that review has the longest lead time of anything in the plan. It starts immediately and it can delay the build if it slips. See §9.

**What we need from you.** Legal sign-off, eleven decisions (each already has a recommended answer, so silence won't block us), and approval to spend 3–5 days measuring before we commit to a schedule.

---

## 2. What we're actually building

### 2.1 In one paragraph

A parent creates an account and a profile for their child. The parent decides exactly which parts of that profile are public — the whole profile, just the athletic stats, just the highlight videos, or none of it. Nothing goes public until a parent has given permission *and* a human has reviewed the content *and* our compliance check has cleared it. Schools can manage their rosters. Coaches can build recruiting lists. Sponsors can offer deals. Fans can follow athletes and earn badges. And underneath all of it, one rule holds: **a child's information belongs to their parent, and no adult can reach a child directly.**

### 2.2 What each person can do at MVP

| Who | What they can do when the MVP is done |
|---|---|
| **Parent / guardian** | Create profiles for multiple children; grant or withdraw permission for each part of the profile separately; approve or reject sponsorship offers; see and control every message involving their child |
| **Student-athlete** | Have a profile with highlights, stats, and achievements; see their own deals and followers. (Direct account control transfers to them at 18 — that automation is *after* the MVP) |
| **School / club** | Manage a roster; submit verified achievements; see their athletes' compliance status; run recruiting boards |
| **Coach / scout** | Build recruiting boards and rate prospects privately; request contact — which always goes to the parent, never directly to the child |
| **Sponsor** | Browse approved athletes; make offers; track deal progress and spending against a budget |
| **Fan** | Follow athletes and teams; see a public feed; earn engagement badges |
| **Compliance / admin** | Review every profile and every piece of media before it goes public; clear or block; see a full audit trail |
| **Public visitor** | Browse a roster of **only** approved, permission-granted athlete profiles — with no personal information exposed |

### 2.3 What makes this different from the retail platform we're adapting

| Retail platform | Youth-sports platform |
|---|---|
| The *shop* is the account | The **child** is the account |
| Data is separated by shop | Data is separated **per child** — so one child's records can never mix with another's |
| Anyone can list a product | **Only a parent** can create a child's presence, and only a parent can take it down |
| Content goes live when the shop publishes | Content goes live only when **parent permission + human review + compliance clearance** are all true |
| No special handling for minors | Legal and safety rules for children's data are built into the foundation, not added later |

---

## 3. What changed from the original plan, and why

The original plan had the right architecture. Three of its *execution assumptions* did not survive contact with the actual codebase. Here is what changed, in plain terms. (Full technical detail: `SPEC_AMENDMENTS.md`.)

### Correction 1 — The database safety net we thought we had, we don't

**What the plan assumed.** That our existing platform already had a database-level safety net ("row-level security" — a rule that lives inside the database itself and filters what each account can see, even if the program asks for everything). The plan treated this as already built and carried it over.

**What's actually true.** It doesn't exist. We checked: there are three such rules in the entire history of the project, covering a fraction of the 343 data tables. The one place in the code that looked like it set this up is commented out — switched off.

**What we're doing instead.** Building a different, equivalent guard that catches the same class of mistake — a single checkpoint that rejects any request for a child's data that doesn't say *which child*. It's cheaper, it works today, and it's the right thing for this phase. The database-level version becomes a later hardening step.

**Does it change the cost?** No — it makes it *cheaper* and *more honest*. But it does mean we must stop describing the MVP as having database-enforced isolation. It doesn't. It has a strong guard in the application layer, which we will test.

### Correction 2 — Making each child an "account" has side effects we had to design around

**What the plan assumed.** Make each student-athlete a self-contained account (a "tenant"), so they inherit all the platform's existing privacy machinery for free. This is the right call.

**What's actually true.** In our existing platform, an "account" is shaped like a retail shop — it has a subscription tier, a payment processor slot, a public web address, and a setting that makes it **discoverable in the public directory, switched on by default**.

**The problem:** if we do nothing, a 12-year-old's profile inherits a public listing by default and a subscription tier that makes no sense.

**What we're doing instead.** A separate child-specific profile record, plus explicit rules that athlete accounts are **never** eligible for public directory listing. This is now a blocking decision, not an assumption.

**Does it change the cost?** Modestly, and it prevents a serious safety defect.

### Correction 3 — The original schedule was roughly ten times too short

**What the plan said.** The extraction work (copying the platform, removing the retail parts, renaming things) was estimated at **11–18 working days**. The feature work that follows had no estimate at all.

**What's actually true.** The deletion is quick; the *repair* is the work. Removing 100+ files that other files depend on, across 257,000 lines of code, produces a long tail of breakage that is invisible until you start. And the "11–18 days" covered only a third of the project — the actual MVP features were never estimated.

**What we're doing instead.** A proper bottom-up estimate: **39.5–73 engineer-weeks, most likely around 56**. And a 3–5 day measurement to replace the biggest guess with a real number before we commit.

**Does it change the cost?** Yes — substantially upward. This is the single biggest change in this brief, and it's better to say it now than at month four.

### What did *not* change

- The **architecture** — reusing the platform's patterns is still the right call, and we verified the patterns are real.
- The **four-phase roadmap** — the structure is sound.
- The **safety and legal analysis** — the original plan's gap analysis on children's data, consent, content moderation, and anti-predator controls is genuinely excellent and is adopted as-is. It's the strongest part of the original work.
- The **playbooks** — the 80 internal how-to guides the plan depends on all exist and are reusable.

---

## 4. The path forward — what you get, and when

Five milestones. Times assume a team of three, and are approximate.

| Milestone | What exists | What you can show someone | Effort so far | Time (3 people) |
|---|---|---|---|---|
| **M0 — Foundations** | Clean copy of the platform in its own project, deployed and working; the retail parts removed; the new data structure in place; the API rebuilt. Empty, but solid. | "It builds, it deploys, it's ours, and it's clean." | ~18.5 weeks | **~2 months** |
| **M1 — Investor-ready public site** | The public brand website with a lead-capture form that sorts enquiries by athletes/parents, sponsors, and investors. | **The public site, live, with leads coming in.** | ~21 weeks | **~3 months** |
| **M2 — The safety core ★** | A parent can create a child's profile, control exactly what's public, and have it appear on the public roster — then revoke permission and watch it disappear. Human review and compliance checks are in the path. | **The whole concept, working end to end, for one athlete.** The most important demo in the project. | ~27.5 weeks | **~3.5–4 months** |
| **M3 — Platform complete** | The retail front-end fully removed; media, stats, achievements, school rosters, and the compliance review console in place. | "Every safety rule is enforced and tested." | ~40 weeks | **~5 months** |
| **M4 — Full MVP** | All personas have their own portal; support tools and the chatbot are live; the invitation and onboarding systems work end to end. | **The product.** Every persona's portal, working together. | ~56 weeks | **5–8 months** |

### 4.1 The milestone that matters most

**M2 is the real test.** Everything before it is setup and everything after it is breadth. At M2 we will have proven that the hardest part works: that a child's information can be published under a parent's control and withdrawn instantly, with every safety rule holding.

That's why we're deliberately reordering the work so M2 arrives before the expensive front-end cleanup, rather than after. If something about the design is wrong, we find out at M2 with a working product in hand — not at the end, with a half-disassembled one.

### 4.2 An early win we recommend taking

The public website (M1) doesn't actually depend on any of the hard work. It needs a landing page, a form, and one small piece of plumbing. Because the first phase of this project is explicitly about showing investors that we have a real digital presence, we recommend **pulling the public site forward** to run alongside the safety-core work.

**Effect: the investor-facing site lands at ~3 months instead of ~8.** Same total effort — it's purely a sequencing choice.

---

## 5. How long, honestly

### 5.1 The numbers

| | Effort | Notes |
|---|---|---|
| **Total MVP** | **39.5 – 73 engineer-weeks, most likely ~56** | An engineer-week = one person working one week |
| Backend (data, rules, safety) | ~37.5 weeks (~⅔ of the total) | Bigger than people expect — the data structure and the safety rules dominate |
| Frontend (screens, portals) | ~19 weeks | |

### 5.2 What that means in calendar time

| Team size | Calendar time |
|---|---|
| 1 engineer | 12–17 months |
| 2 engineers | 7–10 months |
| **3 engineers (recommended)** | **5–8 months** |
| 4 engineers | 4.5–7 months — limited benefit; the work doesn't widen much |

**Why more people stop helping.** Part of the work is a strict sequence: you cannot design the data structure and rebuild the API at the same time. Adding a fourth person doesn't break that chain.

### 5.3 Why a range and not a date

Two of the four big workstreams are genuinely hard to predict. They involve removing large amounts of interconnected code and repairing the fallout — the cost depends on how tangled the connections are, which you only learn by doing it. **Those two workstreams are roughly 80% of the total estimate's uncertainty.**

The other two are well understood, because we've done comparable work in this codebase.

**So the plan is explicit about which parts to trust:**

| Milestones | Confidence | Trust the dates? |
|---|---|---|
| M0, M1 | High | Yes — this is well-understood work |
| M2 | Medium | Approximately — the design is sound, execution has unknowns |
| M3, M4 | **Low** | **Not yet.** These depend on the two unpredictable workstreams |

### 5.4 When the estimate becomes trustworthy

**After M2.** By then we will have measured the real cost of the risky work, and we'll reissue the estimate for the remaining milestones from actual data rather than projection.

We are deliberately *not* asking you to commit to M3 and M4 today. Committing to them now would repeat the exact mistake the original plan made.

### 5.5 A note on the original numbers

If you previously heard "two to three weeks to extract the platform," that number was wrong — by roughly an order of magnitude — and it didn't include the feature work at all. It's better to correct that now than to discover it in month two. The corrected figures are in this brief and in `EXECUTION_PLAN.md` §6.

### 5.6 What it costs

**Roughly $170,000 for the MVP** in the recommended shape. Full detail, sources, and the parameter table: `BUDGET.md`.

| Line | Mid estimate |
|---|---|
| Human engineering (2 engineers + review) | **~$130,000** |
| AI agent capacity (3 seats, 7 months, usage included) | ~$6,000 |
| Legal review of the children's-data design | $15,000–60,000 |
| Infrastructure during the build | ~$2,000 |
| Contingency (15–20%, weighted to the unpredictable stages) | ~$25,000–35,000 |
| **Total** | **~$170,000** (range **$128k–224k**) |

**Three ways to staff it:**

| | Team | Cost | Recommendation |
|---|---|---|---|
| **A** | 3 humans | ~$200,000 | Viable; highest cost |
| **B** | **2 humans + AI agents** | **~$168,000** | **Recommended** |
| **C** | 1 human + AI agents | ~$134,000 | **Not recommended** — see below |

**A note on the AI-agent question.** Agents are extremely cheap per unit of work — roughly **$50–100 per agent-week** against **~$3,000 per engineer-week**. That sounds like it should collapse the budget. It reduces it by about a quarter, for three reasons:

1. **A third of the work is safety-critical and cannot be delegated.** The consent engine, the privacy guard, the content-review gate, and the five safety promises in §6 need a human designer *and* a human reviewer. Not because an agent can't write the code, but because in a platform holding children's data, a mistake is a legal event.
2. **Agent output still has to be checked by a human** — and safety checking is the part that cannot be rushed. Our own standard requires every safety test to genuinely fail when the protection is removed. Confirming that is human work.
3. **Agents don't shorten the decision chain.** Part of the plan is strictly sequential, and each step waits on a human decision, not on typing.

Where agents genuinely pay off: removing the old retail code and repairing the fallout (~18 weeks of mechanical work), building the eleven near-identical feature modules, writing migrations and seed data, and reconciling documents — exactly what produced `SPEC_AMENDMENTS.md`. That's also where the plan's uncertainty is concentrated, which makes it the highest-value place to deploy them.

**Scenario C is the one to be careful about.** It's cheapest on paper, but it removes independent review from the child-safety controls — one person cannot both build and independently check the safety layer. That doesn't reduce cost; it **moves cost into the one budget you cannot bound** (§8). This model does not propose reducing headcount: the recommended shape keeps two engineers, including a dedicated owner for the safety core. What changes is *where* human attention goes — away from mechanical work, toward the safety design and review that determine whether the platform is defensible.

**After launch: ~$150–600/month** in infrastructure (database, hosting, authentication, email, error monitoring, and required content-safety scanning).

**Two expectations to set now:**

- **The MVP earns nothing.** It delivers a public presence, a controlled profile pipeline, and the persona portals. The revenue model — transaction fees on deals, plus institution and sponsor tiers — is the *next* phase. Anyone modelling the MVP as self-funding is modelling Phase 4.
- **Compliance-review staffing is a separate, launch-blocking cost.** Because compliance review is manual in the MVP (§7), launch volume is bounded by how many profiles a human can review. That's a staffing decision, not an engineering one, and it needs to be made before launch.

---

## 6. What "MVP done" means

### 6.1 The five promises we will not ship without

These are release-blocking. The MVP does not ship with any of them broken, even if everything else works perfectly.

1. **No child appears publicly without a parent's explicit permission** — and the parent can remove it instantly.
2. **No child under 13 can sign up at all.** A parent must create the account. This is a legal requirement (COPPA).
3. **No adult can message a child directly. Ever.** A parent is always part of the conversation. There is no way to create a private adult-to-child thread — not a setting, not a workaround.
4. **Nothing a child posts goes public until a human has reviewed it.** Videos and photos from outside sources are limited to a list of approved providers.
5. **If a parent withdraws permission, everything disappears from public view immediately** — within a single request, not "after the cache refreshes."

Each of these is backed by an automated test that runs on every change. If someone later breaks one of these rules, the test fails and the change cannot ship.

### 6.2 What else "done" means

- Every persona can log in and use their own portal, seeing only what they're allowed to see.
- The support tool and the chatbot are live, with child-safety rules that block any response containing a child's personal information.
- Invitations and onboarding work end to end — the network-growth loop the concept depends on.
- Every screen handles its empty, loading, and error states properly.
- Nothing from the old retail business remains in the product or the brand.

### 6.3 How we'll know the safety rules actually work

For each of the five promises, we will deliberately *try to break it* and confirm that we can't. A test that passes because it's checking nothing is worse than no test — so every safety test must first prove the system works normally, then prove the bad thing is blocked.

---

## 7. What is NOT in the MVP

Saying this clearly now prevents disappointment later. **None of the following is in the MVP.** Each is planned for a later phase.

| Not in the MVP | What *is* in the MVP instead |
|---|---|
| **Money actually moving.** No escrow, no payouts to families, no bank verification, no tax forms. | Sponsors can make offers and track deal progress and milestones. The plumbing is designed but not connected to real funds. |
| **Automated compliance review.** No rules engine that checks a deal against each state's high-school athletic rules. | A **human** reviews and clears or blocks every profile. The rules data is stored so automation can be added later without rework. |
| **Self-service data deletion.** | Parents can request deletion; our team processes it. The automated cascade comes later. |
| **Database-level isolation** (the "seatbelt inside the database"). | A strong guard in the application layer that catches the same mistakes, and is tested. |
| **Automatic transfer of control at 18.** | Handled manually. The records are structured so it can be automated later. |
| **Advanced abuse detection** — scraping and stalking pattern detection, tuned rate limits. | Basic rate limiting is in place from day one. |
| **Recommendation engines, social-commerce integrations, product catalogs, inventory, shipping** — retail leftovers. | Removed entirely. |

**A word on the compliance point.** Because compliance review is manual in the MVP, **launch volume is bounded by how many profiles a human can review.** If the plan is to onboard thousands of athletes at launch, that's a staffing decision, not an engineering one — and it should be made before launch, not during it.

---

## 8. Risks, in plain language

| Risk | How likely | What we're doing about it |
|---|---|---|
| **The legal review slips.** It's the longest lead time in the project and it gates the data-structure work. | Medium | **Start it now.** It's the single item most likely to delay everything. |
| **Removing the retail code costs more than expected.** The interconnection between parts of the codebase is the big unknown. | High | A 3–5 day measurement *before* committing to a schedule, plus removing code in small batches with a check after each one. |
| **A child's information reaches a public surface through a path we didn't think of** — a saved copy of a query, a sitemap, an email preview, an error report. | Medium | A dedicated sweep that *enumerates* every way information can leave the system, automated as a check that runs on every change. |
| **The chatbot reveals information a parent didn't permit.** | Medium | Safety rules enforced at the point where the chatbot *looks up* information, not just in its instructions. Off by default for any child-scoped conversation. |
| **A parent withdraws permission but some cached copy survives.** | Medium | Withdrawal is a release-blocking test: it must remove the profile and all media from every public surface within a single request. |
| **State athletic rules change mid-build.** | High (inherent) | Rules are stored as data, not written into code. Updating a rule is a data change, not a software release. |
| **We carry across 509 leftover backup files and old duplicated code.** | Certain | A cleanup pass at the very start, before anything else. |
| **Legal asks us to handle deletion differently than the audit log allows.** | Medium | Already identified. The design keeps the audit trail complete without storing any personal information in it — decided at the data-structure stage, because retrofitting it later would be painful. |

---

## 9. What we need from you

### 9.1 The critical one — start now

| Ask | Who | Why it's urgent |
|---|---|---|
| **Legal review of the children's-data design** (parental consent, education records, state athletic rules, deletion rights) | Legal / compliance | **Longest lead time in the project.** It gates the data-structure milestone. Everything after it waits. |

### 9.2 Decisions — each already has a recommended answer

Eleven decisions need an owner. To avoid the project stalling, each has a **recommended default**: if no one decides by the deadline, we proceed with the default and record it. Silence will not block the build.

| Decision | Recommended answer | Needed by |
|---|---|---|
| How do we enforce child-data isolation at this phase? | Application-layer guard now; database-level later | Start |
| How do we model a child's account without retail side effects? | Separate child profile + never publicly listed | Start |
| Which of our three overlapping code foundations is the real one? | Keep the documented one, delete the other two | Start |
| Do we rename the old order/payment records or build fresh? | Build fresh, delete old, reuse the logic | Start |
| Can a child's account ever appear in public directories? | **No. Ever.** | Start |
| Are parent and fan features paid features? | **No** — free forever; they're the trust layer | Before M2 |
| How does deletion coexist with an audit trail? | Audit trail stores references only, never personal data | Start |
| What's our testing standard, and do we add browser testing? | Standard tools; no browser testing for now | Start |
| What are the fee percentages and the family/platform split? | Defer — it's a setting, not architecture | Before M4 |
| **Legal sign-off** | — | **Start (see 9.1)** |
| Is there existing pilot data to migrate? | Assume no — the new database starts empty | Start |

### 9.3 Approval to measure before committing

**3–5 days** to delete one complete section of the retail code, repair it, and measure the real cost. This replaces the single biggest guess in the estimate with a measured number, and typically halves the uncertainty in the overall range. It is the highest-value 3–5 days in the plan.

### 9.4 Resourcing

**Three people for 5–8 months** — one on the backend/data side, one on the front end, one on safety and quality. Two is workable but slower; one is 12–17 months; a fourth adds little.

---

## 10. How to follow progress

The plan has a checkpoint at the end of every stage. Each one has a written piece of evidence attached — a test result, a report, a recording. "Mostly working" does not pass a checkpoint. The ones worth tracking from outside the build:

| Checkpoint | Plain meaning | Roughly when |
|---|---|---|
| Foundations | The clean copy builds, deploys, and is empty but solid | ~2 months |
| Data structure ready | The new data structure exists and the API still works | ~2.5 months |
| API rebuilt | The retail code is gone and the new backend works | ~3 months |
| Safety layer ready | The guard, consent engine, and content review exist **and are tested** | ~3.5 months |
| **★ Architecture validated** | **The whole concept works for one athlete, end to end, with every safety rule proven** | **~4 months** |
| Front end cleaned | The retail front-end is gone; the new one is in place | ~4.5 months |
| Public site live | The brand site is live and capturing leads | ~3 months (pulled forward) |
| Safety rules complete | Every release-blocking safety test passes | ~5 months |
| **MVP complete** | Every persona's portal works together | **5–8 months** |

**The ★ checkpoint is the one to watch.** After it, we reissue the schedule for the remaining work based on what we actually measured.

---

## 11. Glossary

| Term | Plain meaning |
|---|---|
| **NIL** | Name, Image, Likeness — a student-athlete's right to be paid for the use of their name, image, or likeness |
| **COPPA** | A US law protecting children under 13 online. It requires a parent's permission *before* collecting any of their data |
| **FERPA** | A US law protecting student education records — grades, school enrollment, and similar |
| **Tenant** | A self-contained account with its own private data. Think of it as a separate lockbox per customer |
| **Athlete-tenant** | Our design decision to give each student-athlete their own lockbox, so one child's records can never mix with another's |
| **Singleton** | A single shared instance of a piece of software that every part of the app uses. It means rules like "cache this" or "never cache that" are written in one place instead of everywhere |
| **Capability gating** | Feature switches — which account or plan is allowed to use which feature. Like subscription tiers |
| **Row-level security (RLS)** | A safety rule that lives *inside* the database and filters what each account can see, even if the program asks for everything. A seatbelt in the database itself. **We don't have this yet** — see §3, Correction 1 |
| **P0** | Highest priority — an item that must not fail. "P0 tests" are the release-blocking ones |
| **Extraction** | Copying the existing platform into the new project and removing the parts that belong to the old retail business |
| **Engineer-week** | One person working for one week. 56 engineer-weeks with 3 people ≈ 19 weeks if nothing had to be done in order — longer in practice, because some work is strictly sequential |
| **Spike** | A short, time-boxed experiment to measure something before committing to a schedule |
| **Gate / checkpoint** | A point that must be passed before moving on. Requires written evidence |
| **Materialized view** | A pre-built, saved copy of a database query's results, kept for speed. Relevant here because a saved copy is a second place data lives — and therefore a second place it can leak from |
| **RAG bot** | A chatbot that answers by looking things up in a knowledge base rather than generating answers freely. Safer, because it can be restricted to what it's allowed to see |
| **Escrow** | Money held safely by a third party until agreed conditions are met |
| **Consent scope** | Permission granted for one specific thing at a time — e.g. "the public profile may be shown" is separate from "grades may be shown" |
| **Firewall (content)** | The rule that nothing goes public until permission, human review, and compliance clearance are *all* true |

---

## 12. Where the detail lives

| Document | What it's for | Audience |
|---|---|---|
| **`TEAM_BRIEF.md`** (this document) | Expectations, effort, milestones, what's in and out | Everyone |
| `BUDGET.md` | Cost model, researched vendor prices, staffing scenarios, run-rate, guardrails | Leadership, finance |
| `EXECUTION_PLAN.md` | The authoritative build order: stages, tasks, checkpoints, effort, risks | Engineering, product |
| `SPEC_AMENDMENTS.md` | The 35 corrections that reconcile the original specs with reality | Engineering |
| `SPINOFF_MVP_ANALYSIS.md` | The review that found the gaps, with evidence | Engineering, technical leadership |
| `TECHNICAL_SPEC.md` | Architecture, data design, capability design, the safety analysis | Engineering |
| `MIGRATION_DESIGN.md` | What to keep, what to remove, what to rename | Engineering |
| `FRONTEND_SPEC.md` | Screens, components, navigation, states | Design, front end |
| `PROJECT_SEQUENCE.md` | Historical — the original build order, now superseded | Reference only |
| `IMPLEMENTATION_PLAN.md` | Historical — the original task list, now superseded. Its internal how-to guide index is still valuable | Reference only |

---

## 13. The one-paragraph summary

We're adapting our existing platform into a youth-sports platform, reusing the architecture — which we verified is genuinely reusable — but correcting three things the original plan got wrong: a database safety net that doesn't exist (we're building an equivalent), an account model that would have made children publicly discoverable by default (now explicitly prevented), and a schedule that was roughly ten times too short and didn't cover the feature work at all. The corrected estimate is **39.5–73 engineer-weeks, most likely ~56**, which is **5–8 months with three people** and **~$170,000** to stand up the MVP (range $128k–224k; ~$130k of it human engineering). The first investor-facing milestone — a live public site — lands at **~3 months**, and the critical proof that the whole concept works lands at **~4 months**. Two of the four workstreams are genuinely unpredictable, so we will reissue the schedule from measured data after that proof point rather than asking you to commit to the later dates today. The biggest risk is not technical: it's the legal review of the children's-data design, which starts immediately and gates the data work. Five safety promises are release-blocking and will not be compromised for schedule. The MVP itself earns nothing — the revenue model is the following phase — so it is funded by the credibility it creates, not by what it collects.

---

## 14. What we're asking for, in one list

1. **Start the legal review today.** It's the longest lead time and it gates the build.
2. **Approve the 3–5 day measurement** before we commit to a schedule.
3. **Confirm the eleven decisions** — or accept the recommended defaults by the stated dates.
4. **Confirm resourcing:** three people for 5–8 months.
5. **Approve the budget envelope** — ~$170,000 for the MVP in the recommended shape, with the legal-review line held open until quoted (`BUDGET.md`).
6. **Confirm the new database starts empty** — no pilot data to migrate.
7. **Accept that M3 and M4 dates are provisional** until we reissue them after the architecture-validation milestone.
8. **Make a staffing decision for manual compliance review** before launch — launch volume is bounded by human review capacity, not engineering.
