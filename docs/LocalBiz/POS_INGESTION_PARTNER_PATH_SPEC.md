# POS Ingestion & Partner Path Spec — SWIS for Register-Locked Merchants

Status: PROPOSED | Date: 2026-11-03 | Depends on: `GMC_MERCHANT_API_SWIS_SPEC.md` (the downstream SWIS path is built and live)

## 1. Opportunity

NRS (National Retail Solutions) POS merchants hold rich catalog + stock data inside their registers, but NRS provides **no Google local-inventory path** — that data never reaches Google surfaces. The platform's SWIS path (Merchant API + localInventories + checklist) is complete; what's missing is getting POS-locked data *into* `inventory_items`. Two ingestion shapes cover the whole segment:

- **API path** (Clover/Square — exists) — live stock, full automation
- **CSV path** (NRS + every POS with a merchant export — **this spec**) — periodic import, merchant-driven

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

**Why Jokkymore is the ideal NRS pilot:** real storefront + shelves, grocery/specialty-market category = the highest-frequency "in stock near me" query segment, active claimed GBP (54 reviews ⇒ verified profile), independent operator = fast decision.

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

**Out of scope for v1:** scheduled/server-side pulls (manual upload only — the merchant's file cadence IS the freshness model); live stock deltas (NRS API is the partnership outcome, not a v1 assumption); auto-deletion of items missing from a re-upload.

## 10. The bigger claim this validates

Every POS segment that vendors ignore has this same shape — the platform becomes the universal "register data → Google surfaces" pipe, vendor-agnostic by design. Jokkymore → NRS partnership → Clover pilot proves it on both ingestion models. That's the stage-of-validity jump: not one merchant on Google Maps, but the first working proof that the platform democratizes what only the chains had.
