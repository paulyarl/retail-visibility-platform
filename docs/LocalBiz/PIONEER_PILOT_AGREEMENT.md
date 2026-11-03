# Pioneer Pilot Agreement — Draft

**Status:** DRAFT v0.1 (2026-11-03) — term sheet, not legal advice. Requires counsel review before signature.
**Companion:** `POS_INGESTION_PARTNER_PATH_SPEC.md` §8 (decided terms), §11 (consent envelope), §12 (validation matrix), §14 (Phase-1 gate).
**Parties:** `[MERCHANT LEGAL NAME]` ("Merchant") and `[PLATFORM LEGAL ENTITY]` ("Platform"), operating as VisibleShelf.

**Purpose in one sentence:** Platform tests and validates a Google product-visibility path — products discoverable before the storefront, on Google Shopping and Google's "see what's in store" (SWIS) surface — using Merchant's real catalog, at no cost to Merchant, with Merchant's own hands on every step that requires their access.

---

## 1. Duration

**Term: 90 days from the signature date**, unless ended earlier under §1.3.

| Window | What happens | Whose move |
| --- | --- | --- |
| Days 0–7 | Access checklist completed; the two pre-build checks resolved (pricebook export available on the Merchant's plan; Google Business Profile ownership confirmed) | Merchant, guided |
| Days 7–14 | First catalog import; Merchant's products live on a storefront Merchant controls | Merchant, guided |
| Days 14–45 | Google console steps: profile manager access, Merchant Center account, business verification, store code, profile↔Merchant Center link | Merchant, guided |
| Days 45–75 | First sync to Google; read-back status reported | Platform |
| Days 75–90 | Validation results and demo capture; end-of-term conversation | Platform |

**1.1** The 90 days is a single fixed term. It does not renew automatically and does not convert to a paid plan on its own.

**1.2** At day 90 either party may propose a commercial agreement. Neither party is obliged to enter one, and no price is set or implied by this agreement.

**1.3** Either party may end this agreement early on 14 days' written notice, for any reason or none. The deletion terms in §4.6 apply on either side's exit.

**1.4** Platform may suspend the pilot immediately if continuing would breach Google's terms or place Merchant's Google accounts at risk. Platform will say why in writing.

---

## 2. Expectations

This section is deliberately blunt. The pilot only produces a valid result if both sides do their part, and the most common failure is a merchant who agrees and then cannot sustain the routine.

### 2.1 What Merchant does

| Obligation | Detail |
| --- | --- |
| Complete the access checklist | Within 7 days of signature (Exhibit B) |
| Perform the Google steps personally | Platform guides; Merchant clicks. Merchant must not hand over Google or NRS logins (§3.3) |
| Connect your inventory | By the mechanism set out in Exhibit B: **file path** — pricebook export and upload, at least 5 business days per week (~5 min); **POS API path** — one authorization, then automatic; **manual path** — initial entry of a starter catalog, then updates as stock changes |
| Keep price and stock data accurate | Merchant is responsible for the truth of what they upload (§8) |
| Attend a weekly check-in | 15 minutes, to log friction and blockers |
| Tell Platform when something breaks | Rather than stopping silently — a lapsed routine is a finding, not a failure |

**Time commitment, stated plainly:** roughly one hour of setup in the first two weeks, then about five minutes per business day. If Merchant cannot sustain that, the pilot should not start — that is a cheaper answer than discovering it in week three.

### 2.2 What Platform does

| Obligation | Detail |
| --- | --- |
| Provision the import and catalog surfaces | Within 2 business days of the first successful upload |
| Provide step-by-step guidance for every Google console step | Written and, where useful, on a call |
| Report read-back status weekly | "N products live on Google · M with issues · last inventory import X days ago" |
| Name a single point of contact | Responds within 1 business day |
| Deliver the validation matrix | Exhibit A, with evidence per row, at end of term |
| Charge nothing during the pilot | §6 |

### 2.3 What is explicitly NOT promised

Merchant should read these before signing. They are the boundaries of the pilot, not caveats buried at the end.

1. **No guarantee Google accepts, renders, ranks, or retains the products.** Google controls its surfaces and can change, reject, or deprecate them at any time without notice to either party.
2. **No traffic, sales, revenue, or ranking outcome is promised.** The pilot tests whether a path works, not what it earns.
3. **No guarantee the pilot converts to a paid engagement**, and no price is set here.
4. **No guarantee of listing duration.** Google expires local inventory data after 14 days unrefreshed; listings drop if the upload routine lapses and automated refresh is switched off.
5. **No exclusivity.** Platform may run the same pilot with other merchants, including in the same category and the same city.
6. **No ownership of the Google assets.** The Merchant Center account and the Business Profile remain Merchant's.

### 2.4 Guided hands

Every step requiring Merchant's access is performed by Merchant. Platform instructs and verifies. If Platform performs those steps, the pilot proves nothing about whether an independent owner can — which is the question under test. Merchant may decline any step; the pilot then records it as unvalidated rather than working around it.

---

## 3. Access and consent

### 3.1 The four grants

| Grant | Mechanism | Merchant revokes by |
| --- | --- | --- |
| NRS merchant portal export | Merchant logs in and downloads; Platform never holds the register login | stopping uploads |
| Google Business Profile | Merchant adds Platform as a **manager** on the profile | removing the manager |
| Google Merchant Center | Merchant-owned account; Platform added as a user | removing the user |
| Catalog data use | Limited licence in §4.5 | written notice; deletion per §4.6 |

### 3.2 Merchant represents that it is authorised to grant all four — that it owns or controls the Business Profile and the Merchant Center account, and is entitled to export and publish the catalog.

### 3.3 No credential custody

Merchant's NRS portal password, Google account password, and any two-factor codes are never shared with Platform and never stored by Platform. Platform will not ask for them. Any request that appears to come from Platform for these credentials should be treated as fraudulent.

---

## 4. Privacy and data

### 4.1 What Platform collects

- Business identity: name, address, phone, hours, category, website
- Catalog: product names, SKUs/PLUs, prices, stock status, department
- Owner contact: name, email, phone — used for access, claim verification codes, and pilot communication
- Operational logs: import timestamps, row counts, errors, Google read-back status

Platform does not collect customer data, payment card data, or shopper identities as part of this pilot.

### 4.2 What becomes public — read this carefully

The pilot publishes information to public surfaces. Merchant should understand exactly which fields:

| Field | Public? | Where |
| --- | --- | --- |
| Business name, address, phone, hours, category | **Yes** | Platform directory listing and Google |
| Product names, prices, availability | **Only for products Merchant selects** | Platform storefront; Google Shopping / SWIS once selected |
| Imported catalog as a whole | No | never published in bulk |
| Owner contact details | **No** | internal only |
| Raw pricebook file | **No** | stored, not published |
| Read-back status, validation evidence | No | internal; aggregate metrics may be shared under §7 |

**Products are not published until Merchant selects them.** Importing a catalog makes items eligible; it does not publish them. This is a per-product switch, and Merchant controls it.

Merchant should assume that any price published to Google is visible to competitors. That is a commercial decision Merchant makes, not one the pilot makes for them.

### 4.3 Where data is stored

Catalog and operational data live in Platform's database. Product data is also transmitted to Google under **Merchant's own Merchant Center account**, so Merchant retains control of that copy independently of Platform.

### 4.4 Retention

Data is retained for the pilot term plus 30 days. Merchant may request earlier deletion at any time.

### 4.5 Ownership and licence

The catalog remains Merchant's property. Merchant grants Platform a limited, non-exclusive licence to store, display on Platform surfaces, and transmit to Google — solely to run this pilot. The licence ends when the agreement ends.

### 4.6 Deletion on exit

On termination, Platform will, within 30 days:

1. Remove Merchant's products from Platform's public surfaces
2. Delete Merchant's catalog and import files from Platform's systems
3. Submit removal of Merchant's products from Google, and delist them from the Merchant Center feed

Platform will confirm completion in writing. Merchant retains the right to keep or delete their own Merchant Center account.

### 4.7 No sale, no unrelated sharing

Platform does not sell Merchant's data and does not share it with third parties, except Google (as the destination Merchant has consented to) and infrastructure providers that host Platform's systems under confidentiality obligations.

---

## 5. Benefits

What Merchant gets, stated as capability rather than outcome.

| Benefit | Detail |
| --- | --- |
| A storefront Merchant controls, live in days | Their real catalog on a Platform storefront — independent of Google's timeline, which is the slow part |
| Products submitted to two Google surfaces | Google Shopping (search by item) and SWIS (search by neighbourhood), subject to Google's acceptance |
| Proof rather than promises | Weekly read-back: how many products are actually live, how many have issues, how fresh the data is |
| No cost | §6 |
| Pioneer standing | Named as one of the first pilot merchants; direct input into what gets built next |
| Portability | Catalog export on request at any time; nothing locked in |
| A clean exit | Full deletion and Google delisting on termination (§4.6) |
| A say in the outcome | The validation matrix is shared with Merchant, including what failed |

**What the benefit is not:** it is not a promise of customers, rankings, or revenue. It is the ability to be found by product instead of only by name — a capability Merchant does not have today.

---

## 6. Fees

**No fee is payable by Merchant during the pilot term.** Platform bears its own costs. No payment method is collected. Nothing in this agreement obliges Merchant to pay anything at any point, including after the term ends.

---

## 7. Publicity

Platform may reference Merchant by **name** and may publish **results metrics** (for example, number of products live on Google).

Platform may **not** publish photographs of the premises, the shelves, or staff, and may **not** quote Merchant directly, without separate written permission for that specific use.

Merchant may withdraw publicity permission at any time in writing; Platform will remove published references within 14 days.

---

## 8. Accuracy and responsibility

- **Merchant owns the truth of the data**: prices, stock levels, product descriptions, and hours. A wrong price or stale stock reaches real customers and comes back as a complaint or a review.
- **Platform owns the integrity of the pipeline**: import handling, mapping, transmission, read-back reporting.
- If Merchant's upload routine lapses, Platform will report it and may stop automated refresh so stale data expires rather than mislead shoppers. Platform will not silently keep publishing data it believes to be stale.

---

## 9. Liability and governing law

**9.1** Neither party excludes liability for fraud, or for anything else that cannot lawfully be excluded.

**9.2** Platform is not liable for Google's decisions, outages, policy changes, or the removal of listings.

**9.3** Each party's total liability under this agreement is limited to direct losses, and Platform's total liability is capped at the greater of USD 1,000 or the fees paid under this agreement — which, per §6, is zero. *(Counsel to confirm this cap is appropriate for a no-fee pilot.)*

**9.4** Neither party is liable for indirect or consequential loss, including lost profit or lost revenue.

**9.5** This agreement is governed by the laws of the State of Indiana. The parties submit to the jurisdiction of the courts of Marion County, Indiana.

**9.6** This document plus its Exhibits is the entire agreement for the pilot. Changes must be in writing and signed by both parties.

---

## 10. Signatures

| | Merchant | Platform |
| --- | --- | --- |
| Legal name | `[MERCHANT LEGAL NAME]` | `[PLATFORM LEGAL ENTITY]` |
| Signed by | | |
| Title | | |
| Date | | |

---

## Exhibit A — Validation matrix (what the pilot tests)

Shared with Merchant at end of term, with evidence per row. A failed row is a result, not a fault.

| # | Assertion | Pass condition |
| --- | --- | --- |
| 1 | Pricebook export available on Merchant's plan | Excel Download present, not gated behind a premium tier |
| 2 | Google Business Profile owned by Merchant | profile visible in Merchant's own account |
| 3 | Export carries on-hand quantity | quantity column with non-zero values |
| 4 | Export carries stable SKU/PLU | ≥90% of rows resolve without name fallback |
| 5 | Price format reconciles | 100 sampled rows match shelf price |
| 6 | Store code matches the Business Profile | local inventory attaches to the right location |
| 7 | Products live on Google | read-back shows N > 0, active status |
| 8 | SWIS renders | a real product displays "in stock near you" |
| 9 | Upload routine holds | ≥5 consecutive business-day imports |
| 10 | Setup friction captured | time-to-complete and every human step logged |

## Exhibit B — Merchant access checklist (file-path variant)

*POS API and manual-path merchants substitute the ingestion steps for their own mechanism; every other item is unchanged.*

- [ ] Pricebook export confirmed on the NRS plan (portal → Pricebook → Excel Download)
- [ ] Business Profile visible in Merchant's own Google account
- [ ] Platform added as a **manager** on the Business Profile
- [ ] Merchant Center account created or confirmed (Merchant-owned)
- [ ] Platform added as a user on the Merchant Center account
- [ ] Business verification completed in Merchant Center
- [ ] Store code created and matched to the Business Profile
- [ ] Business Profile ↔ Merchant Center link confirmed
- [ ] First pricebook export uploaded
- [ ] Products selected for publication (per-product switch, Merchant's choice)

---

*Draft for counsel review. This document records the commercial terms decided in `POS_INGESTION_PARTNER_PATH_SPEC.md` §8 and the consent model in §11. It is not legal advice and should not be signed without professional review.*
