# POS Ingestion & Partner Path Spec — SWIS for Register-Locked Merchants

Status: PROPOSED | Date: 2026-11-03 | Depends on: `GMC_MERCHANT_API_SWIS_SPEC.md` (the downstream SWIS path is built and live)

Rev v0.4 — §11–§14 specify the engagement motion (consent envelope + guided-hands rule, validation matrix with two pre-build kill tests, freshness automation + the `integration_gmc_local_autorefresh` capability key, Phase-1 gate and artifacts). §15–§16 add the day-1 deliverable/shareable inventory, the approach variants, and the measured product-search test. §17 adds ownership access — the phase before the door. The signable instrument is `docs/LocalBiz/PIONEER_PILOT_AGREEMENT.md`. Implementation stays gated behind the engagement motion.

## 1. Opportunity

NRS (National Retail Solutions) POS merchants hold rich catalog + stock data inside their registers, but NRS provides **no Google local-inventory path** — that data never reaches Google surfaces. The platform's SWIS path (Merchant API + localInventories + checklist) is complete; what's missing is getting POS-locked data *into* `inventory_items`. Three ingestion shapes cover the whole segment:

- **POS API path** (Clover, Square — exists) — the **platform pulls**: live stock, full automation
- **File path** (NRS + every POS with a merchant export — **this spec**) — the **merchant pushes on a schedule**
- **Manual path** (no POS, or a POS with no export) — the **merchant enters on demand** in the platform portal. The only path with **no external dependency**, and therefore the one that makes the vendor-agnostic claim literally true.

**A path is defined by who initiates the data flow, not by the vendor.** Clover and Square are members of one path because they produce the same merchant action and the same failure mode; adding a POS vendor adds an adapter, not a path. A new path appears only when the initiative changes — a marketplace storefront feed or EDI would qualify, another register would not.

**Terminology — one verb, three pipes.** Merchant-facing copy says **connect** for all three shapes ("Connect your inventory"), with the mechanism named underneath. Internal surfaces keep *ingestion* / *import* / `inventory-import` — do not rename technical surfaces for copy reasons. The binding copy contract, including the pre-claim and post-claim trio fixes, is `docs/LocalBiz/CONNECT_LADDER_COPY_SPEC.md`.

The CSV path is not a workaround — it's the wedge. It requires **zero cooperation from the POS vendor**, so the platform can serve merchants on *any* register, then convert vendor partnerships (NRS) from a position of working proof.

**The strategy in one line:** pioneer merchants prove SWIS live → pitch NRS "partner and it's your branded feature, or we keep converting your merchants" → NRS API access upgrades CSV tenants to live sync.

**Priority: this supersedes the seed-claim motion.** The directory/claim-seed pitch is store-first ("claim your profile") and hopes products follow — an abstract lead. This path is **product-led**: the merchant's real inventory is the deliverable from hour one, and the store presence emerges as a consequence.

**Store drives products vs. products drive store.** The products-drive-store direction has multiple surfaces — Google Shopping, SWIS (local "in stock near you"), and the SEO-optimized storefront — where products are both *discoverable and purchasable*. That combination is the best integration surface in the segment: no other setup puts an independent merchant's shelf on discovery surfaces the chains owned.

## 2. Pioneer cohort (sequenced: Clover first, NRS second)

| # | Merchant | POS | Path | Proves |
| --- | --- | --- | --- | --- |
| 1 | Clover merchant TBD | Clover | API | Live real-time inventory → SWIS end-to-end; checklist friction on a real storefront |
| 2 | **Jokkymore African Market** — 1041 N Girls School Rd, Indianapolis (4.9★, 54 reviews, NRS) | NRS | CSV | Register-locked data reaches Google; the NRS pitch demo |

**Why Clover first:** zero build — the whole chain exists (Clover connector → inventory → Merchant API → localInventories), so the pilot is onboarding + Google's console steps, not engineering. The checklist friction it surfaces feeds the NRS-side build.

**Sequencing dependency:** the Clover merchant is still TBD. If none is in hand when the pilot starts, Jokkymore becomes pioneer #1 and the CSV importer moves onto the critical path instead of running in the pilot's dead time (§14). Naming a Clover merchant or accepting the swap is a decision, not a scheduling detail.

**Clover pioneer qualification.** The Clover kill test is not the same as NRS's. What matters is whether the merchant's Clover account holds **item-level inventory with quantities** — not whether they take Clover payments. A merchant who runs Clover for card processing and keys prices at the register has no catalog to sync, and SWIS has nothing to publish.

| Check | Pass | Fail |
| --- | --- | --- |
| Item catalog exists in Clover | items with SKUs/names | payments-only account |
| Quantities tracked | on-hand counts per item | items listed, no stock |
| Retail, not food service | SKU-based inventory | menu-based (restaurant) |
| Independent, single storefront | owner-operated | chain/franchise |

**Where to source them.** Clover pioneers come from the same **seed pipeline** as NRS — an unclaimed seed, invited to claim, where the claim is a **gate rather than the offer**. The destination is the Clover → SWIS proof (`docs/LocalBiz/OWNERSHIP_PACKET_TEMPLATE.md` Template B).

Three routes, in order of yield:

1. **Clover resellers and ISVs** in Indiana — they hold merchant books and want value-adds that make the hardware stickier. One introduction beats twenty doors.
2. **SKU-based retail corridors** — convenience, specialty food, hardware, pet, liquor. Clover skews food service, so filter hard for retail with inventory.
3. **Existing tenants already running Clover** — check the integration table first; the connector is built, so a warm start may already be sitting there.

**The packet is one page for both.** Claim is step one, ingestion is step two, products-on-Google is the destination — NRS and Clover sit at the same level, differing only in how the catalog arrives (`docs/LocalBiz/OWNERSHIP_PACKET_TEMPLATE.md` carries the page plus two step-2 print variants). Clover is the easier yes and the harder control — a broken connection fails silently, so the pilot needs a connection-health check, not only the staleness cutoff in §13.

**Why Jokkymore is the ideal NRS pilot:** real storefront + shelves, grocery/specialty-market category = the highest-frequency "in stock near me" query segment, a strong live listing (4.9★, 54 reviews, correct category, current hours), independent operator = fast decision.

**Claim state is unverified, not assumed.** Review volume is not evidence of profile ownership — a POS vendor can syndicate a listing, and NRS does exactly that. SWIS needs GBP ownership to link Merchant Center and mint the store code, so the claim is a **pilot step confirmed at the door**, not a premise. See §12 kill test 2.

**Parallel track:** build the NRS CSV importer *while* the Clover pilot works through Google's verification steps — the pilot's onboarding has natural dead time (merchant yes → GBP verify → checklist → first sync), so CSV lands in the gap instead of starting cold.

## 3. Architecture

```
merchant EOD export (CSV)
   → POST /api/merchant/inventory-import   (auth + tenant-scoped)
   → column-mapper → upsert inventory_items by SKU
   → existing SWIS path unchanged:
     unified eligibility filter → MerchantProductSync →
     productInputs + localInventories (if swis_listed && ready)
```

**Nothing downstream of `inventory_items` changes.** The CSV importer writes the same table the Square/Clover services write — sync, eligibility, surfaces, checklist all continue to work untouched. That is the entire point of the design: ingestion is a thin adapter; the product is the shared path below it.

## 4. Upload endpoint

`POST /api/merchant/inventory-import` — `authenticateToken` + `checkTenantAccess` (tenant-scoped, writes inventory; follow the `product-surfaces` pattern).

- **Payload:** multipart CSV file or JSON body `{format, rows}` (start with CSV — matches the merchant's native export)
- **Column mapping:** configurable, **not NRS-hardcoded**. v1 ships with a mapping registry: `nrs_pricebook`, `square_csv`, `generic` (sku/name/price/stock). A `format` field selects the map; `generic` accepts a header-name guess pass. Keeping it format-flexible is the "we'll take your data however you can give it" promise — the same endpoint serves every CSV-exporting POS.
- **Upsert rule:** keyed on **SKU** — existing item → update name/price/stock/status; unknown SKU → create item (`product_type: 'physical'`, `visibility: 'public'`, `item_status: 'active'` defaults). Items absent from a re-upload get flagged in the import report, **not** auto-deleted (an export gap is not a removal signal — auto-delete would silently pull items off Google; flag for merchant review instead).
- **Response:** `{created, updated, unchanged, skipped, errors[]}` + the row-level errors. Store `last_import_at` on the tenant's import log for the freshness display.
- **Idempotent** — a re-upload of the same file is a no-op.
- **Rate/size limits:** ≤ 5k rows / 10MB per file, one import per 5 min per tenant.

## 5. Merchant portal surface (web)

An **"Import products & stock"** card on the integrations page (or the products settings area):

- File picker + format selector (NRS pricebook / generic) + "Import" button
- Last-import timestamp + result summary ("412 items updated, 3 errors")
- **Freshness label** — the honest framing: *"Your Google stock reflects your latest upload"* — never pretend live on a daily file
- Later (SOP reinforcement): a gentle "last upload was N days ago" nudge — the ritual only works if it sticks

### 5.1 Manual-path affordances (no POS)

The manual path needs two surfaces, and the first one is nearly free because the importer already exists:

- **Downloadable stock sheet.** A platform-authored CSV with the `generic` column map — download, fill, upload. Same endpoint, same upsert, same report. Where the platform has already observed items publicly (a POS storefront page, a menu, a supplier record), the sheet ships **pre-filled with those names** so the merchant confirms and counts instead of typing.
- **Quick count.** Search or select an item → enter the count → save. This is the recurring surface: designed for a phone held in one hand at the shelf, one list of items with a number field each, batch save, and a visible last-counted date per item.

**Why the count path matters strategically.** Register quantities drift with shrinkage and unrecorded sales; a physical count does not. For an "in stock near you" surface, a weekly shelf walk may be *truer* than a live POS feed — at the cost of cadence. That inverts the usual ranking of the three ingestion paths: the manual path is not the consolation prize, it is the most accurate one when it is actually maintained.

## 6. Merchant SOP — the ritual

The merchant-facing ask, deliberately minimal:

> **End of business day:** log into your VisibleShelf portal → Import → upload today's pricebook export. We take it from there.

Three rules that keep it honest:
1. **The merchant chooses to push** — matches the deny-by-default consent model; no silent pipeline claims.
2. **EOD cadence ⇒ close-of-business stock** — local inventory shows what was on the shelf at close. Google's "in stock" carries that freshness honestly; don't oversell live.
3. **Selection is still the merchant's** — the importer creates items as eligible candidates; `swis_listed` stays per-product opt-in via the ProductsTab checkboxes. Import ≠ auto-publish to Google.

**Merchant how-to: getting the CSV (verified against NRS docs):**
1. Log into the **NRS Merchant Portal** at `nrsplus.com` — portal-only; the register has no export
2. **Pricebook** → **Excel Download** button (top-right) → Excel-friendly CSV, unfiltered for a full export
3. File lands in Downloads → upload to the VisibleShelf import card

Edge cases the mapper must cover:
- **PLU items export without UPC/barcodes** (per NRS's label-printing doc) — key on SKU, fall back to PLU code or name; markets selling by weight/count hit this
- **Price exports in cents** (`=D2/100` in their own formula) — divide by 100
- Some analytics exports sit behind the **"Advanced Data"** premium feature — the pricebook download appears to be base-tier, but confirm on the pilot merchant's plan

## 7. The cascade — import activates the whole commerce stack

The importer isn't a SWIS feeder — it's the **activation loader** for everything downstream. One upload lights three surfaces:

```
CSV import
  → inventory_items populated (real catalog)
    → products page shows real items + stock status   (surface 1)
    → GMC/local feed eligibility                      (surface 2 — SWIS)
    → ecom activation → purchasable                   (surface 3)
      → deposit/payment flow exercised with real products → smoke-testable end to end
```

- **The pilot deliverable is bigger than "your products on Maps"** — it's "your store is live on the two biggest discovery surfaces *and* it can take money." Deposit commerce (`tenant_commerce_settings.deposit_enabled`, `order_items.deposit_*`, `payments` deposit fields) is built but has never been driven by a real merchant catalog — the first genuine deposit transaction with actual items is a milestone the pilot produces naturally.
- **Staged payoff = the onboarding arc.** Catalog/ecom surfaces light on first import; the Google surface lights only when checklist + `swis_listed` selection completes; purchases come last. Don't promise them simultaneously — the honest sequence is *"products live now, Google next, purchases after that."*

## 8. Partner program (the NRS play)

**The pioneer pitch — deliberately different from every other door-knock:**

Not a website pitch, not a broken-profile repair, not a claim-seed pitch — all of those carry "something of yours is broken, let us fix it." This one is pure upside with zero replacement ask:

> "Your Clover already works. We connect it to Google so your shelves show 'in stock near you' on Google Maps. Small investment on your side, upside is new traffic + visibility on the surface only the chains had."

The merchant keeps their hardware, keeps their workflow, spends maybe an hour on the checklist — and the result is *their* products where previously only big-box inventory appeared. No pain to diagnose, no defect to sell against — just a capability they never had.

**Pioneer terms (decided 2026-11-03):**
- **Pilot terms:** free for a fixed term, then negotiate — no preset post-pilot price; conversion conversation at term end
- **Exclusivity:** non-exclusive, any category — no category/metro locks; keeps every option open
- **Publicity:** name + metrics only — the store's name and results numbers are shareable, no photos or direct quotes without separate permission
- **Exit:** full data removal + Google delisting — on termination, their products come off Google and catalog data is deleted (the delete path already exists: `deleteFromMerchant` + item removal)

**Sequencing — proof before permission:**

1. Build the CSV importer + upload card (v1 scope)
2. Onboard Jokkymore via CSV → SWIS live → **screenshot the demo**: their products showing "in stock near you" on Google Maps
3. Approach NRS: *"your merchants are reaching Google through us with or without you — partner and it's your branded feature."* The demo is the pitch, not a deck.
4. NRS API deal (if it lands) → tenants upgrade from CSV cadence to live sync — **the same endpoint becomes the ingestion point**, the file becomes a webhook payload, zero merchant-visible change.

**Why NRS should want it:** their register becomes the source of truth feeding Google — the hardware gets *stickier*, and "your products on Google Maps" becomes their feature to market, not a reason to leave.

**Defection leverage (backdrop, not pitch):** every merchant who moves to Clover/Square *for* SWIS is a churned NRS account — "we'd rather integrate than migrate" is the honest posture, and it's credible because the CSV path works either way.

## 9. Build checklist

| # | Item | Where |
| --- | --- | --- |
| 1 | `POST /api/merchant/inventory-import` — auth, tenant-scoped, multipart+JSON | `apps/api/src/routes/` (new file, registry mount `authLevel: 'tenant'`) |
| 2 | Column-map registry (`nrs_pricebook`, `generic`) + SKU upsert service | `apps/api/src/services/` (mirror the `square/` service shape) |
| 3 | `last_import_at` + import log (result summary per import) | small table or `tenant_*_settings` row |
| 4 | Upload card UI — file picker, format, last-import, freshness label | integrations page or products settings |
| 5 | Tests: mapper edge cases, SKU upsert create/update/no-op, flag-not-delete on absence, auth scoping | `apps/api/src/services/__tests__/` |
| 6 | `integration_gmc_local_autorefresh` capability key + `last_import_at` staleness cutoff in the 6h sync (§13) — fixture edit first, then code | `shared/tier-contract.json` → `apps/api/src/jobs/gmc-scheduled-sync.ts` |

**Out of scope for v1:** scheduled/server-side pulls (manual upload only — the merchant's file cadence IS the freshness model); live stock deltas (NRS API is the partnership outcome, not a v1 assumption); auto-deletion of items missing from a re-upload.

## 10. The bigger claim this validates

Every POS segment that vendors ignore has this same shape — the platform becomes the universal "register data → Google surfaces" pipe, vendor-agnostic by design. Jokkymore → NRS partnership → Clover pilot proves it on both ingestion models. That's the stage-of-validity jump: not one merchant on Google Maps, but the first working proof that the platform democratizes what only the chains had.

---

## 11. Consent & access — the guided-hands rule

**The validity condition.** Every gate in this pilot needs access only the merchant holds: the NRS merchant portal, the Google Business Profile, the Merchant Center account. The platform cannot validate from outside; it can only instruct and verify.

Therefore: **if the platform performs the steps, the pilot proves nothing.** The thing under test is whether an independent owner can complete the flow. Concierge posture (`PIONEER_RECRUITMENT_SPEC.md` §1) is a conversion tool and is explicitly out of bounds for this pilot — it destroys the evidence. Guided hands, not done-for-you.

**Consent envelope — four grants, none of which is a credential:**

| Grant | Mechanism | Revocation |
| --- | --- | --- |
| NRS pricebook export | merchant logs into `nrsplus.com` and downloads; the platform never holds the register login | merchant stops uploading |
| Google Business Profile | merchant adds the platform as a **manager** on the profile | merchant removes manager |
| Google Merchant Center | merchant-owned account; platform added as a user | merchant removes user |
| Data & publicity | name + metrics shareable; no photos or direct quotes without separate permission (§8) | exit path (§8) |

**Hard rule — no credential custody.** NRS portal credentials, the GBP login, and the MC login never leave the merchant. Beyond the ToS exposure, a pilot blocked on credential handover will not survive a security review, and it converts a validation exercise into an agency engagement.

**Consent sheet (the Phase-1 artifact):** the signable form is `docs/LocalBiz/PIONEER_PILOT_AGREEMENT.md` — duration, expectations, access grants, privacy/data handling, benefits, fees, publicity, and the validation matrix as exhibits. This section is the design intent; that document is the instrument. Draft status: requires counsel review before signature.

**Workload statement — said at the door, not in week three:**
- ~1 hour of console steps (GBP manager add, MC account + business verification, store code, GBP↔MC link)
- one pricebook export per business day for the pilot's duration (~5 min/day, three manual steps: portal login → Pricebook → Excel Download → upload)
- the honest framing on freshness: local inventory reflects close-of-business stock, not live stock

If that workload is more than the owner will sustain, the pilot should fail at the door — that is a cheaper failure than week three.

---

## 12. Validation matrix — the pilot's deliverable is a decision

The pilot does not ship "it worked." It ships this matrix with evidence per row. **A failed row is worth more than a passed one** when it changes the scope of the NRS path, because it tells us whether the model generalizes or only worked for one merchant.

| # | Assertion | Pass condition | If it fails |
| --- | --- | --- | --- |
| 1 | Pricebook export available on this merchant's plan | Excel Download present and not gated behind Advanced Data | **Kill test** — CSV wedge does not exist for this merchant |
| 2 | GBP owned by the merchant | profile visible in the owner's own Business Profile list | **Kill test** — pilot opens with a claim; Google's verification clock is on the critical path |
| 3 | Export carries on-hand quantity | quantity/stock column present with non-zero values | SWIS asserts *assortment*, not *availability* — narrow the merchant claim and demo language to "we carry this" |
| 4 | Export carries stable SKU/PLU | ≥90% of rows resolve without name fallback | importer needs a stronger fallback; re-import loses idempotency on those rows |
| 5 | Price format reconciles | 100 sampled rows match shelf price | Shopping eligibility blocked; price accuracy is a Merchant Center suspension risk |
| 6 | `store_code` matches GBP | `localInventories` accepted and read back against the right location | SWIS cannot attribute inventory to the storefront |
| 7 | Products live on Google | read-back shows N > 0 with active status | validation proof absent — demo not claimable |
| 8 | SWIS renders | screenshot of a real SKU showing "in stock near you" | the NRS demo does not exist |
| 9 | SOP holds | ≥5 consecutive daily imports, read from `last_import_at` | freshness claim narrows; ritual needs redesign |
| 10 | Checklist friction captured | time-to-complete + every step that required a human, logged | NRS-side build scope is guesswork |

**Kill tests 1 and 2 run before any build.** Both are merchant-side, both cost a phone call, and either can end the pilot at zero engineering cost. Running them second wastes the most expensive resource in the plan.

**Evidence per row** — screenshot, exported file, read-back payload, or logged step — stored against the seed/campaign record so the NRS conversation can cite it rather than describe it.

---

## 13. Freshness automation and the capability key

**The expiry is a floor, not a wall.** Google local inventory data expires after 14 days unrefreshed; each insert resets the clock and re-push is unconstrained. Any coverage beats the current state of zero.

**Liveness ≠ accuracy.** Automation keeps listings *live*; only a fresh import keeps them *true*. A 6-hour job faithfully re-pushing a two-month-old pricebook produces the worse failure: Google asserting "in stock" for something sold out weeks ago, sending a customer across town. An honest drop beats a confident lie.

**Capability key — `integration_gmc_local_autorefresh`**
- Lives in `capability_modules.integration_options`, alongside `integration_gmc_sync`, `integration_google_merchant_center`, `integration_google_shopping`.
- **Fixture-first**: edit `shared/tier-contract.json` before code; the contract suites (`tier-*`, `mv-shape-lint`) fail on drift, and any file declaring the key must be listed in `surface_files`.
- **Soft gate, not tier gate**: tier grants the capability (`allowed_*`), the owner toggles it (`can_use_*` / `effective_*` — the R33 split). "Willing" is a merchant switch; the platform never opts in on their behalf.

**Staleness cutoff — calibrated to the SOP, not to Google's ceiling.** Auto-refresh while `last_import_at` ≤ 3–4 days; past that, stop re-pushing and let the listings expire deliberately. On a daily SOP, a 14-day cutoff tolerates thirteen days of silent failure — the tripwire has to fire while the process is still recoverable.

**Scheduler:** `jobs/gmc-scheduled-sync.ts` already runs at 6h, inside the window — extend it, do not replace it (`GMC_MERCHANT_API_SWIS_SPEC.md` §1.4).

**Read-back contract:** `"N products live on Google · M with issues · last inventory import X days ago."` Liveness without freshness lets a pilot look successful while serving stale stock — and that failure surfaces as a one-star review, not a dashboard metric.

---

## 14. Phase-1 gate, sequencing, and artifacts

**Gate order — implementation starts at step 4, not before:**

| Step | Action | Owner | Exit |
| --- | --- | --- | --- |
| −1 | **Ownership access** — reach the decision-maker, not the counter (§17) | platform | owner engaged by name; second visit scheduled |
| 0 | Door conversation + consent sheet signed | platform | pioneer agrees to the workload |
| 1 | Kill tests 1 & 2 (§12) | merchant, guided | export confirmed + claim state known |
| 2 | First CSV import → real catalog on the platform storefront | merchant, guided | surface 1 live, result summary captured |
| 3 | Google console steps: GBP manager add → MC account → business verification → store code → GBP↔MC link | merchant, guided | checklist complete |
| 4 | Merchant API migration complete → first SWIS sync | platform | read-back shows N > 0 |
| 5 | Demo capture | platform | "in stock near you" screenshot for a real SKU |

**Why step 2 precedes step 3.** Google's verification and propagation are slow. A pioneer who says yes and sees nothing for two weeks drifts, and the ritual dies before the payoff. The import gives an immediate, visible win — their real shelves on a storefront they control — which sustains them through the Google wait. It is also the answer to "what do I get for agreeing today."

### 14.1 GBP claim + setup — the one-time service

SWIS cannot run without a Google Business Profile the merchant controls: the Merchant Center account links to it, and `localInventories` is keyed by the store code it carries. For an unclaimed seed this is the **largest single obstacle** in the ladder — larger than the catalog, because it is the one step the platform cannot perform alone.

**Three claim states, three different products:**

| State | What it needs | What you sell |
| --- | --- | --- |
| Unclaimed | claim + verification (postcard or video) | **claim + setup** — one-time |
| Claimed by the owner | category, hours, attributes, photos, description | **setup / optimization** — one-time |
| Claimed by a third party | ownership recovery | **not a setup job** — recovery, often impossible. Qualify out early rather than sell into it |

**DFY vs DIY:**

| | DIY (guided) | DFY (managed) |
| --- | --- | --- |
| Who performs | merchant | platform, via manager access |
| Cost to serve | low, scales | high, per-merchant attention |
| Completion risk | high | low |
| Verification | merchant | merchant — **unavoidable** |
| Fits | pilot, scalable onboarding | paid one-time service for non-technical owners |

**Verification is the hard boundary.** Google's identity checks — postcard, video, phone — must be completed by the merchant. No amount of DFY removes them. A service that promises *"we'll claim it for you"* promises something it cannot deliver; what it can deliver is everything **around** the verification: the category, hours, attributes, photos, description, service area, and the Merchant Center link and store code that follow.

**Mechanism: manager access, never credentials.** Google supports adding a manager to a profile. That is the only legitimate DFY path — revocable, auditable, and already bound by the pilot agreement (§3.3).

**The pilot tension, and how to resolve it.** The pilot runs guided hands because performing the steps would validate nothing about whether an owner can. The product should run DFY because that is what a non-technical owner will pay for. Not in conflict if sequenced: **the pilot generates the checklist and friction log that become the DFY SOP.** Validate guided, then productize — the same relationship as the validation matrix producing the vendor pitch.

**Offer it post-discovery, never upfront.** The GBP service is not a door pitch. It is the answer to a blocker the merchant discovers at step 3 themselves: their products are on their page, and Google cannot see them until the profile is verified. The sequence does the qualifying work, and the offer prices against one specific outcome instead of a bundle — which is why it lands on a segment that refuses upfront commitments.

**The free path must stay genuinely viable.** If DIY guidance is not actually workable, the post-discovery offer becomes a toll booth on the only road to Google — the "locked door" failure with a price attached, and the merchant will read it exactly that way. The offer is legitimate only while declining it still leaves a route.

**What the pilot can and cannot measure.** Free for the term, so the pilot proves the blocker is real and the steps work. It cannot prove anyone will pay — willingness to pay is a second-cohort question, and reporting it as validated would be the same error as calling a claim a conversion.

**The gate opens onto a locked door — the pioneer grant is load-bearing.** Claiming a seed lands the merchant on `directory_presence`: free, zero-price, and **without** `integration_clover`, `integration_gmc_sync`, or `integration_google_merchant_center`. It also caps `max_skus` at 5 — which would truncate the very catalog the pilot exists to prove. So the claim alone dead-ends at a paywall in the moment of maximum intent. The cohort must carry an explicit grant, applied **before** the packet is printed:

| Grant | Why |
| --- | --- |
| `integration_clover` (Clover) or `integration_gmc_sync` + `integration_google_merchant_center` (NRS) | without it the connect step does not exist for the tenant |
| `max_skus` lifted | a 5-SKU cap cannot carry a real pricebook |
| `gbp_management` — optional | only if reviews or posts are surfaced on the listing |

This is what `PIONEER_RECRUITMENT_SPEC.md` §1's segmented cohort grants are for. A merchant who claims and hits a paywall is worse off than one never approached: they did the work, and the platform answered with a locked door.

**Mechanism × capability matrix.** Integrations are capability modules (`capability_modules.integration_options`), and the trio is inert without them. Each ingestion mechanism needs a different set of keys:

| Mechanism | Capability keys | Merchant toggle | Connection |
| --- | --- | --- | --- |
| 2a File path | none required — upload is self-serve | none | none |
| 2b POS API path | `integration_clover` / `integration_square`, `integration_pos_on` | integration options | vendor OAuth grant |
| 2c Manual path | **none** | none | none |
| Step 3 (SWIS) | `integration_gmc_sync`, `integration_google_merchant_center` | GMC settings | Merchant Center + GBP link |

**Structural consequence:** 2c is the only ingestion path that needs no integration capability. A claimed tenant can therefore always complete the ladder through manual entry, provided `max_skus` is lifted and the GMC pair is granted. The integration modules decide **which mechanisms light up**, not whether the ladder is walkable — which is the difference between a paywall and a degraded path.

**The three-state trap.** A capability key only becomes *effective* when three states line up: granted by tier (`allowed_*`), toggled by the merchant (`can_use_*`), and connected by credentials. Onboarding that walks only the first shows a button that does nothing; one that walks the first two errors on click. All three, or the merchant meets an inert control and concludes the product is broken.

**Phase-1 artifacts (definition of done for the engagement motion):**
1. Signed pilot agreement — `docs/LocalBiz/PIONEER_PILOT_AGREEMENT.md` (§11)
2. Completed access checklist — kill tests resolved, claim state recorded
3. One successful import with its result summary
4. `last_import_at` set and displayed in the portal

Implementation — Merchant API migration, store code, local feed — begins when those four exist. Until then, the work is engagement, not engineering.

**Anti-drift note:** if the field motion starts performing the merchant's steps "just to keep it moving," the pilot silently converts back into concierge and produces no validation evidence. The consent sheet exists to make that drift visible.

---

## 15. Day-1 deliverable and shareables

**Principle: the approach lands something in the merchant's hand before any commitment.** The door ask is the 2-minute export, not the 90-day agreement. A signature is day 0; day-1 success is the owner seeing the gap themselves.

### 15.1 Tier A — carried in, zero merchant cooperation

Produced before the visit, from the existing seed and audit pipeline:

| Artifact | What it is | Source | Why it works |
| --- | --- | --- | --- |
| Live listing URL | the seeded directory page for their store | seed pipeline + publish | "you're already on it" — proof, not a proposal |
| Shelf card | name, address, hours, category, rating, photo — the shopper-facing view | seed listing | shows the storefront exists and is accurate |
| Shelf report (1 page) | what the listing carries, and the single missing thing: no product visibility | `business_analysis` audit | concrete and self-verifiable |
| The comparison | their NRS storefront beside what a Google product search returns | screenshots | the whole thesis in one image |
| QR card | QR to the listing, sized for counter or window | `directory_entry_qr_on` | a physical object they keep |

**Honesty gate on the listing URL.** "You're already listed" is only sayable when the seed is published and the URL resolves. Publish the seed before the visit or lead with the shelf report instead — the claim is the whole approach and it dies if the link is dead.

**The shelf report is merchant-facing, not the internal audit.** Response rates, unanswered reviews, and deficiency scoring stay out of anything handed over. Those are conversation material, framed as findings, not a document left on a counter. The shareable artifacts are the listing, the QR, and the comparison.

**The leave-behind is its own artifact.** Tier A's pieces are inputs; the printed one-pager the owner receives is `docs/LocalBiz/OWNERSHIP_PACKET_TEMPLATE.md` — addressed to the owner by name, ordered gift → gap → one ask, with no pricing and no audit content.

### 15.2 Tier B — same session, if the merchant engages

Requires their hands on their own portal, and produces the win that carries them through Google's slow weeks:

1. Merchant logs into `nrsplus.com` → Pricebook → Excel Download (~2 minutes)
2. Upload to the import card → result summary: "N items imported"
3. Their real catalog live on a storefront they control — surface 1, no Google dependency

This is the answer to "what do I get today." It should happen in the first visit if at all possible; it converts an abstract pilot into a visible one.

### 15.3 What the merchant can share

| Shareable | Audience | Note |
| --- | --- | --- |
| Listing URL | customers, family, co-owner | the practical artifact — they can text it |
| QR card | in-store shoppers | window or counter; the only physical asset |
| The comparison image | peers, other owners | the referral hook from `PIONEER_RECRUITMENT_SPEC.md` §1.2 |
| Their own catalog page | customers | once Tier B lands |

Not shareable: the validation matrix, the internal audit, read-back internals, and anything carrying a deficiency framing.

---

## 16. Approach variants

One default, four alternates, one excluded. Pick by the prospect's posture, not by operator preference.

| Variant | Best fit | Opener | Hand over | Handles | Risk |
| --- | --- | --- | --- | --- | --- |
| **A. Comparison** *(default)* | merchant already selling through a POS storefront | "You already sell online — that's for people who know you. On Google, the products come first and the store is what they land on." | the comparison image | "we already have a website" | needs a clean side-by-side or it looks like opinion |
| **B. Category gap** | owner who thinks the category is too niche to be searched | "Nobody in Indianapolis shows African grocery inventory on Google. The chains show theirs." | shelf report | "nobody searches for this" | must be true in the market at the time — verify, don't assert |
| **C. Pioneer standing** | owner who likes being first or local-prominent | "We're picking one NRS merchant to prove this works before we take it to NRS." | the agreement + the matrix | "why me" | can read as a beta with no payoff — always pair with Tier B |
| **D. Peer proof** | any, once a reference exists | "A store like yours is already showing up when people search by item." | the live example | "does this actually work" | unavailable until the Clover pilot or a second NRS merchant lands — do not fake it |
| **E. Same-catalog** | owner dismissive of marketing | "This isn't marketing. It's the catalog you already maintain, pointed at a different door." | their own NRS page | "I don't do advertising" | needs the export to land or it stays abstract |
| ~~F. Price-led~~ | — | — | — | — | **Excluded.** Free is a term (§6), never the pitch (`PIONEER_RECRUITMENT_SPEC.md` §1.1) |

**Selection rule.** NRS storefront present → A. Proud-of-being-first → C. Dismissive of marketing → E. Reference available → D (as an upgrade to A, not a replacement). B only with verified market evidence.

**Do not open with:** "your products aren't online" (false — NRS lists them), "we'll build you a website" (they have one), or any traffic number.

**Escalation path within a single visit.** A → the comparison is acknowledged → Tier B export → catalog live → then C (the pilot ask), because by that point the merchant has already seen something work. Never open with C; standing is a closing frame, not an opening one.

### 16.1 The product-search test — variant B's qualifier

Variant B needs no preparation and no argument. It is one search, on the merchant's own phone, for a product that is on their shelf.

**Procedure**
1. Hand the merchant their own phone. Location on. Google Maps, not Search.
2. Search a signature product they actually carry — a named brand, not a commodity ("Akabanga chili oil", "Bournvita", "garri", not "rice").
3. Ask where the results land. Then search the category ("African grocery") on the same phone.
4. Screenshot both, note the date and the coordinates.

**Measured baseline — Indianapolis, 2026-11-03, `@39.7801,-86.2885,12z`:**

| Query | What Google Maps returned | Reading |
| --- | --- | --- |
| `African grocery` | 8 local results. **Jokkymore at #8** (Janjai #1, Saraga #2, Kaura #3, Royal African #4, Safari #5, Dreamcast #6, Rachel #7) | findable by category, mid-pack |
| `Akabanga chili oil` | **three Walmart Supercenters** (Lafayette Rd, Avon, Plainfield) | the chain wins a product it very likely does not stock |
| `Bournvita` | **one place card** — an Indian restaurant in Schaumburg, Illinois | no local grocery surfaced at all |
| `garri` | an African restaurant (Toscana, W Washington St), then name-matches in Reykjavík, Bihar, Florida, Burbank, Port Harcourt and Oyo | Google is matching the *word*, not the shelf |

This is the whole thesis in four searches: **category search finds the store; product search finds Walmart, a plastic surgeon, and a dance studio.** The store is discoverable by what it is and invisible by what it sells.

**The honest limit.** The test proves *supply-side* absence — Google has no product data to match — not that demand exists. Do not let it drift into "people are searching for this and can't find you." The defensible line is: *Google cannot show what nobody has told it.*

**What each outcome means**

- **Lands on a chain** → the gap is widest; the chain is absorbing intent for inventory it may not carry.
- **Lands on another independent** → the shelf is contested and someone else is taking the click; stronger urgency, weaker first-mover framing.
- **Lands on nothing relevant** → nobody in the market has product-level presence; first-mover framing, and the demand question stays open.
- **Lands on the merchant** → they already have local inventory data somewhere (a POS provider feeding Google). Variant B is dead for this prospect; use A.

**Re-run after SWIS goes live.** The same query is the pilot's before/after measurement and the evidence for validation-matrix row 8. A baseline captured at the door, and the same query captured after the same sync, is the only proof that the pilot changed anything a customer can see.

---

## 17. Ownership access — getting past the counter

**The insight is cheap; access is expensive.** Every gate in §11–§16 assumes a willing owner at the door. In this segment the counter is staffed by employees who route inquiries upward, and a verbal message handed to a cashier dies or mutates before it reaches anyone who can decide. Budget for access as a phase, not a moment.

### 17.1 What gets carried to the back

| Delivered | Reaches the owner | Why |
| --- | --- | --- |
| A printed page with the **owner's name** on it | Usually | it is addressed to a person, not a role |
| A delivered asset ("your store is already on this") | Usually | it is a thing that exists, not a claim |
| A question about their register or POS | Often | operationally urgent, and the register is the owner's domain |
| "Someone wants to talk about marketing" | Rarely | no owner decision attached |
| A business card | Sometimes — but it carries **contact**, not a message | gives the owner a way back to you; it cannot carry an argument |
| A brochure or flyer | Almost never | nothing to act on |

**Design consequence:** never leave a pitch. Leave a named page and a working URL. The URL is the argument — it either resolves or it doesn't, and the staff member can see it. The artifact itself is specified in `docs/LocalBiz/OWNERSHIP_PACKET_TEMPLATE.md` (one page, owner's name at the top, gift → gap → one ask), and its QR carries the **claim URL** rather than the listing — so one scan both shows the owner their page and starts the claim, and a scanned packet becomes the only attributable interaction a piece of paper can produce.

### 17.2 Timing

| Window | Why |
| --- | --- |
| 07:00–09:00 | deliveries and receiving — the owner is often on the floor |
| 20:00–21:00 | close and cash-out — owner present by necessity |
| 11:00–17:00 | usually staffed; the worst window for a decision-maker |

Do not assume a quiet weekday. A seven-day operation rotates the owner's off-day, so the "slow day" heuristic fails here.

### 17.3 Direct channels, ranked

1. **The business email on the listing.** For this segment it is frequently a personal Gmail read by the owner — the highest-yield channel and the cheapest to test.
2. **The published phone, asking for the owner by name.** Naming a person converts a vendor call into a call about them.
3. **WhatsApp**, where a number surfaces. Common in West African merchant networks and often answered by the owner directly.
4. **A community intermediary** — the International Marketplace corridor organizations, a church, a supplier or importer who sells to these stores. A referral is worth ten cold visits.
5. **In person, at 07:00 or 20:00.**
6. **Social DMs** — usually staffed, often dead. Last.

### 17.4 Know the name before you knock

Owner names surface in public reviews, directory listings, and registry records. Using the name at the counter is the single highest-leverage move available: it changes "a vendor" into "someone who knows him." Cite the name; never cite the review it came from.

### 17.5 The ask ladder

| Touch | Ask |
| --- | --- |
| 1st | **Nothing.** Leave the named page, say when you will return |
| 2nd | The 2-minute export (Tier B, §15.2) |
| 3rd | The pilot agreement (§14, step 0) |

Asking for a 90-day agreement on the first contact converts a gatekeeper problem into a rejection. The first visit's only job is to be remembered.

### 17.6 Repetition budget

Expect **3–5 touches** before ownership engagement, and log every one. `POST /presence-seeds/:id/touches` already exists with `channel: 'call' | 'sms'` — use it, so the sequence is a record rather than a memory. A single-visit conversion in this segment is the exception, not the target.

### 17.7 Register

Short sentences. No "digital marketing," "SEO," "GBP," "listing optimization." If the operator speaks a community language, use it — it changes the conversation more than any script. The written leave-behind should be readable by someone with limited English and no patience.

### 17.8 The first pioneer unlocks the rest

A referral from a named owner is the only thing that reliably beats a gatekeeper. This is why the first pilot matters more than its own metrics: it produces the sentence *"ask Kola, he's doing it"* — which no leave-behind can buy. Treat pioneer #1 as a sourcing asset for pioneers #2–10.

### 17.9 Field note — the show-and-tell failure (Dreamcast, 2026-11-03)

**What happened:** walked in, showed the manager on duty that the store's Google-listed website resolves to an Indonesian gambling page, was promised an escalation. Follow-up produced nothing.

**Three failures, only one of which was the audience:**

1. **No authority.** Correct diagnosis. A manager on duty cannot grant access, sign an agreement, or spend money.
2. **Wrong message type.** A hijacked domain is a finding *about the person you are speaking to*. It reads as blame, so the rational response is to make it not-their-problem. Staff do not escalate threats to themselves.
3. **No next step.** "I'll escalate it" has no owner, no date, and no artifact — a soft no with better manners.

**Corrections:**

- **Do not demand contact details from staff.** Demanding produces refusal. Ask a question staff can answer without risk: *"when is the owner usually in?"* / *"what's his name?"* Most will tell you.
- **Do not ask staff to relay a message — hand them a sealed, named document.** Relaying makes them complicit; carrying an envelope makes them a courier.
- **Lead with the gift, not the wound.** *"Your store is already listed here"* beats *"your website is hijacked."* The hijack belongs in the letter addressed to the owner, not in the counter conversation.

**Target selection — the category leader is the worst first target.** Most reviews to protect, most staff between you and the decision, least upside from a vendor relationship. Dreamcast (4.9 / 605, hijacked domain) is a later demo or an NRS reference, not pioneer #1. Jokkymore is the right first target: owner-operated, reachable, and the NRS CSV path is the actual pilot.

**What the visit still produced:** a named gatekeeper, a confirmed dead escalation path, and direct observation of layout and foot traffic. That is a routing map — a valid output, not a wasted visit.

### 17.10 When the name is unavailable — public-record routes

Ranked by yield for Indiana independents. All are business records; none require a paid people-search service.

| # | Route | What it yields | Limit |
| --- | --- | --- | --- |
| 1 | **INBiz entity record** (via `indiana-company.com` / OpenCorporates mirrors — scrape-friendly) | entity name, formation date, principal office, **registered agent** | Indiana does not require LLC members/managers to be disclosed; the agent is a proxy, not proof. A service-company agent (CT, CSC, ZenCorp) is a dead end |
| 2 | **Marion County food-establishment licensing** | permit holder / person in charge | county line only |
| 3 | **Indiana ATC license registry** | individual permittee name | only if the store sells alcohol |
| 4 | **USPTO trademark records** | owner of record | only if a mark is registered |
| 5 | **Import / customs records** | importer of record, contact phone and email | sparse for domestic-supplied stores |
| 6 | **Community intermediary** | a warm introduction | opt-in, partial coverage |

**Worked example — Dreamcast.** `DREAMCAST AFRICAN MARKET INC`, Business ID 201806181263663, incorporated 2018-06-18, active; principal office 7125 Georgetown Rd; **registered agent: an individual, not a service**. One search, one name, from a government record.

**Worked example — Jokkymore.** The customs record names `Jokky Moredchef Food Services` as importer of record with a contact phone and email, and shows **four shipments from Jokkymore African Foods Nigeria Ltd (Lagos) via Tangier**. This also independently corroborates the import-supply-chain claim that was only a discovery lead before.

**The ethical line — stated once, held.** Public *business* records are legitimate B2B research. The registered agent's **residential address is not a visit target**. Use the name at the counter; do not drive to the home address. For an immigrant-owned business, an unsolicited home visit reads as a threat, and it converts a prospect into an adversary permanently — a cost no conversion recovers.

**A name is a multiplier, not a prerequisite.** If nothing surfaces, address the letter *"To the owner of [entity name]"* and change the ask to scheduling: *"when is the owner usually in?"* Staff answer scheduling questions far more readily than identity questions.

**Better than a name: a supply-chain fact.** Opening with *"you import from your own operation in Lagos"* proves real work and compliments the owner. It is the exact opposite of the hijack opener, and it is the strongest ownership-attention device in this playbook.

### 17.11 The follow-up sequence

**Rule: each touch escalates the channel's intimacy, never the volume.** Every touch carries information the previous one didn't, and no channel is used twice. Repeating the same message on a new channel is how a prospect becomes a nuisance.

The operating sequence — six touches over 21 days (packet → SMS → phone → email → fresh packet → intermediary), sample copy, the warm branch when the claim QR fires, social-channel gates, and stop rules — lives in `docs/LocalBiz/OWNERSHIP_PACKET_TEMPLATE.md` § Follow-up, next to the artifact the operator is actually carrying. It is not duplicated here.

Two rules from it that belong at the strategy level:

- **The claim QR turns the sequence into an inbound.** If a claim request is filed, stop the scheduled touches and respond within 24 hours. The operator approval queue is the notification.
- **A burnt owner in a tight community is not recoverable.** One SMS maximum, never two calls in a week, park for 90 days after six silent touches.

### 17.12 Unplanned visits — reconnaissance, not delivery

The packet is a planned-visit instrument. An unplanned visit is a different job: gathering the intelligence that makes the planned visit land. **Do not convert one into the other mid-conversation.**

| | Planned visit | Unplanned visit |
| --- | --- | --- |
| Instrument | packet, sealed, named | none |
| Objective | deliver + schedule the return | observe + be remembered |
| Ask | nothing | nothing |
| Success | packet accepted, return agreed | owner identified, rhythm learned |

**What to observe:**

- Who is behind the counter — owner signals: handles money and complaints, others defer to them, age, whether a name badge exists at all
- Whether the owner is reachable at that hour, and who answers the phone
- Foot traffic and dwell time
- **Shelf reality** — are the products a catalog claims actually there? A pricebook can list Abonika and Akabanga while the shelf carries neither, and that gap changes what the pilot can honestly promise
- Signage, posted hours, any existing QR code or listing sticker
- Whether another vendor's card or flyer is already on the counter

**The sixty-second rule.** If the owner appears and you have no packet, the entire conversation is: their name, one specific observation, **hand them the card**, and an exit that preserves the next visit. Nothing else. A half-pitch to an owner you surprised is worse than no pitch — it spends the surprise without buying anything.

**The card.** It is the one artifact that survives a wallet, so it is the unplanned visit's whole delivery:

| Field | Content |
| --- | --- |
| Name + mobile | the operator's, not a company switchboard |
| Website (front) | a **card-specific** short URL — one page explaining the offer, not the general homepage |
| One line | *"Your store's page — [short URL]"* |
| QR (back) | a **find-your-store** entry (`/directory/add-business?ref=card`) that lets them search their own name — **never a claim token**, never the bare homepage |
| Excluded | pricing, tier names, logo soup, taglines |

**Why the QR must resolve to something of theirs.** A card is read in the owner's absence from you, so the scan has to pay off in one screen. Homepage → a stranger reads marketing. Find-your-store → they type their name and see their own listing, hours and reviews. The second one is the only version where the card does the selling without you in the room.

**The `ref=card` parameter is the attribution.** A generic URL plus a ref tag gives you card-level tracking without a token — you trade per-merchant identity for distribution safety, and gain a count of how many cards converted. That is the whole reason the generic entry is worth choosing over a personalized one: a printed batch has no chain of custody, and an untracked card is indistinguishable from a lost one.

**Label the QR.** An unlabelled square on the back of a card does not get scanned. One line above it — *"Scan to see your store's page"* — is the difference between a printed code and a used one.

**Why never a token on a card.** A card is handed around, left on counters, photographed. The tokenized QR belongs to the sealed packet, where it is single-use, tracked, and travels once. Putting a token on a card converts a distribution artifact into a bearer credential with no chain of custody — the § QR specification mitigations stop applying the moment the card leaves your hand.

**The card as proxy when ownership is unreachable.** When you cannot reach the owner, the card inverts the direction of contact: instead of you finding them, it gives them a way to find you. That is its real job, and it fails if the card is not **self-explanatory in your absence** — a card carrying only a name and number asks the owner to act on a conversation they never had. It must reference something of theirs: their store's page, or a QR that shows them their own listing.

**Placement decides survival:**

| Placement | Reaches the owner |
| --- | --- |
| **Mailed to the store address, addressed by name** | **highest** — business mail goes to whoever handles admin, usually the owner or family |
| Handed to a *named* staff member with an explicit ask | best of the counter options; creates a small social obligation |
| Taped to a back-room or office door | medium, where one exists |
| Left loose on the counter | low — cleared, stacked, or binned |

**The postal channel is underused and cheap.** A card or one-pager mailed to the storefront, addressed to the owner by name, bypasses the counter entirely — no gatekeeper, no timing window, one stamp. For a store you cannot get into at the right hour, it is the most reliable route to the owner's hands, and it pairs naturally with the §17.3 email follow-up: mail arrives in the same week the email does.

**Never pitch staff on an unplanned visit.** With no artifact to hand over, the message has nothing to travel on — the §17.9 failure with fewer excuses.

**The customer role is a real access strategy.** Shopping there weekly makes you a known face, and it is the one channel where the owner may open the conversation themselves. It is slow, it works, and it must be genuine: a faked customer in a tight community is a story that travels faster than any referral.
