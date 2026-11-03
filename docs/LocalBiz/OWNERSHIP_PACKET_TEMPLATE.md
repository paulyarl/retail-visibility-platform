# Ownership Packet — Leave-Behind Template

**Status:** v0.1 (2026-11-03). Operator-facing field doc. One page, one ladder — **claim → feed → Google** — with three step-2 print variants by mechanism: **File** (NRS pricebook or any CSV export), **POS API** (Clover, Square), and **Manual** (sheet + quick count). All three are cold-door seed invitations; the mechanism only changes the middle step, and the destination is the same. Companion to `POS_INGESTION_PARTNER_PATH_SPEC.md` §15.1 (Tier A artifacts), §17 (ownership access) and §17.11 (follow-up).
**Format:** one page, printed. The name goes at the top in large type — that is what makes it a courier object instead of a message (§17.1).

---

## Rules before printing

1. **Template A only: the listing URL must resolve.** Print nothing until the seed is published and the link loads. A dead QR destroys the entire approach (§15.1).
2. **No pricing, no package names, no jargon.** No "SEO," "GBP," "digital presence," "listing optimization."
3. **Lead with the gift.** The gap appears after the store has already been shown to them, never before.
4. **One ask only** — the export. The agreement is a third-visit conversation (§17.5).
5. **Say when you will return.** The first visit's job is to be remembered, not to close.

---

## Template — print this

One frame, one ladder: **claim → feed → Google**. NRS and Clover are parallel ingestion paths, not different offers — the register only changes the middle step, and the destination is the same for both.

### The page

```
────────────────────────────────────────────────────────────
  FOR  [OWNER NAME],  OWNER OF  [BUSINESS NAME]
  Left on [DATE] by [OPERATOR NAME], [PHONE]
────────────────────────────────────────────────────────────

  Your store is already listed here.

  [ LISTING URL ]

  ┌─────────────┐
  │   [ QR ]    │   Scan to open your page and claim it.
  └─────────────┘   Or go to [SHORT URL] and enter [CODE]

  The page shows your address, your hours, your category
  and your customer reviews — the way a shopper sees you
  before they walk in.

  Claim it and that page becomes yours: your own web
  address to put on Google, Facebook or Yelp — or on a QR
  code at the counter.


  One thing it does not show: what is on your shelves.

  We searched Google Maps from your address for a product
  you carry:

        "[SIGNATURE PRODUCT]"  →  [WHAT GOOGLE RETURNED]

  Not your store. [ONE-LINE READING, e.g. "Three Walmart
  Supercenters."]


  Claiming takes two minutes. It is step one of three.


        1. Claim the page            ~2 min
        2. Connect your inventory    [effort]
        3. See it live               we do the rest


  Step three is the point: someone nearby searching for
  what you carry finds you — not the supermarket.


  No cost for 90 days. You can stop at any time and we
  remove everything, including from Google.


  Everything on this page came from public information.
  Nothing came from inside your business.

  If anything on it is wrong — hours, phone, category —
  claiming it lets you correct it. Only the owner can.

  I will come back [DAY] around [TIME].
  If that is no good, call or text [PHONE].

────────────────────────────────────────────────────────────
```

### Step 2 — two print variants

Drop one into the page. Same ladder, same destination; only the ingestion differs.

**2a — File path (NRS pricebook, or any CSV export)**

```
        2. Connect your inventory    ~2 min, daily

  Log in at nrsplus.com  →  Pricebook  →  Excel Download,
  then send it to us or upload it on the page above. We
  take it from there. About two minutes a day — your
  Google stock reflects your latest upload.
```

**2b — POS API path (Clover, Square)**

```
        2. Connect your inventory    ~5 min, once

  Sign in to Clover, approve the connection, then pick
  which items to show. About five minutes, once. After
  that your stock updates itself — there is no daily
  export to remember.
```

**2c — Manual path (no POS, or a POS with no export)**

```
        2. Connect your inventory    ~20 min to start

  Add the items people actually search for — twenty is
  enough to start, and you can add more whenever you like.
  No export, no connection, nothing to remember.

  Two ways to do it:
    · Download the stock sheet, fill it in, upload it
    · Or search an item on the page and type the count
```

**The stock sheet should arrive pre-filled.** Where the platform has already seen items publicly — a POS storefront page, a menu, a supplier record — the downloadable worksheet carries those names so the merchant is confirming and counting rather than typing from scratch. That is the same evidence tier as the NAP: public observation, owner assertion, then measured verification.

**The count UI is the recurring surface, not the setup surface.** "Search an item, type the count" is the thing that gets used weekly; the worksheet is the thing that gets used once. Design the count path for a phone held in one hand at the shelf — a single list of items with a number field each, batch save, and a visible last-counted date per item.

**A shelf-walk count can be more accurate than a live POS ledger.** Register quantities drift with shrinkage and unrecorded sales; a physical count does not. For "in stock near you," a weekly walk of the aisle may be truer than a live feed — at the cost of cadence. Worth saying plainly, because it inverts the assumption that the manual path is the inferior one.

**Why this variant matters most.** It is the only ingestion path with **no external dependency** — no vendor cooperation, no file ritual, no OAuth grant, no connection to break. It works for a merchant with a cash box and a phone, which means it is the path that makes "vendor-agnostic" literally true rather than aspirational.

**Scope the first catalog to high-intent items, not completeness.** Manual catalogs die at five or twenty items — nobody types four hundred SKUs. Twenty items a shopper would actually search for ("Akabanga", "garri", "Bournvita") is achievable in one sitting and proves the surface; the rest can arrive over weeks. Set that expectation in the packet, because a merchant who believes they must enter everything will enter nothing.

**Its failure mode is the opposite of the other two.** There is no lapsed ritual and no silent connection break — the data is as fresh as the last edit, and the platform knows exactly when that was. The risk is simply that the catalog never gets populated, which is visible immediately rather than in week three.

**Why claim is step one for all three.** A claim-only pitch invites *"I'll do it later"* — the benefit is deferred and vague. A visible step two makes the claim instrumental instead of a chore.

**Assumption for all three variants:** the merchant is an unclaimed seed. Cold door, envelope, claim QR, §17 access and the follow-up sequence all apply. The pioneer grant (spec §14) must be in place before printing — the free tier cannot reach any ingestion path.

### What differs — step 2 only

| Block | 2a — File | 2b — POS API | 2c — Manual |
| --- | --- | --- | --- |
| Ingestion | CSV export + upload | OAuth connect + sync | manual entry |
| Effort | ~2 min, every business day | ~5 min, once | ~20 min to start, then incremental |
| Freshness line | "reflects your latest upload" | "updates itself from your register" | "as current as your last edit" |
| Failure mode | the routine lapses → data goes stale | the connection breaks → **silently** stops syncing | the catalog never gets populated |
| Merchant gives up | a file | an access grant | time, once |
| External dependency | the POS export | the POS vendor's OAuth | **none** |
| Members | NRS pricebook, any CSV export | Clover, Square *(NRS API later)* | sheet, quick count |

**The API path is the stronger pitch and the weaker control.** No daily ritual is the single best thing you can say to a seven-day grocery owner — it removes the compliance risk that makes the file path fragile. But a broken connection fails silently, where a missed upload at least leaves a timestamp. So the API pilot needs the connection-health check, not just the staleness cutoff (§13), and the read-back must report last-sync age the same way.

**Before printing an API-path packet, run the connector kill test:** the merchant's POS account must hold **item-level inventory with quantities**, not payments only. A merchant who runs the register for card processing and keys prices at the till has no catalog to sync, and the packet is a promise you cannot keep. Run it per member — Clover and Square differ in inventory depth.

### POS API access — what the merchant actually does

**Yes, they log in to Clover — once, to approve.** It is an OAuth grant (`/oauth/authorize` → `/oauth/token`), not a dashboard workflow. After approval the platform reads inventory through `api.clover.com` with the stored token, and the merchant never opens the dashboard for this again.

**Three pre-flight checks before printing a Clover packet:**

| Check | Why |
| --- | --- |
| Merchant is the account **owner/admin** | staff accounts cannot approve third-party apps — the same gatekeeper problem as the counter |
| The platform's Clover app is **installable on that account** | needs a published App Market listing or a privately installed app; without one the OAuth flow cannot start at all |
| `CLOVER_ENVIRONMENT` is set to `production` | it defaults to `sandbox`, and a sandbox token reads no real inventory |

**Request read-only for the pilot.** The current scope set includes `inventory_w` — write access. SWIS only needs to read. Writing to a merchant's live inventory during a validation pilot is unnecessary risk, and it is a materially harder yes: *"let us read your stock"* is a different conversation from *"let us change it."* Scope down to `merchant_r` + `inventory_r` before the first merchant sees the approval screen.

---

## Optional block — when the website is broken or hijacked

Insert after the product gap, never before the gift:

```
  Also: the website listed on your Google profile is
  [not loading / showing a different business's page].
  That sends customers somewhere you did not choose.
  Worth fixing whether or not we work together.
```

---

## QR specification — encode the claim URL, not the listing

The QR carries `/directory/claim/[TOKEN]`, minted from the seed at `POST /presence-seeds/:id/invite`. One scan opens the listing summary **and** starts the claim in the same breath, which is what makes the packet a conversion instrument rather than a notice.

**The side benefit is attribution.** A scanned claim QR is a tracked interaction — the only way a piece of paper reports whether it was ever opened, and by whom.

| Constraint | Consequence for the packet |
| --- | --- |
| Tokens are single-use | a fumbled scan consumes it. Keep the token string recoverable (`GET /presence-seeds/:id` returns the raw token) and reprint rather than re-mint blindly |
| Unbound token → operator approval + claimant email verification | expect a **claim request**, not an instant claim, whenever the seed has no `owner_email`. That is still a warm signal — file it and follow up |
| Bound token → OTP to the bound email | only worth binding if the owner actually reads that inbox. Confirm the address before you rely on it |
| Phone-only bound token → operator approval | the SMS path is manual by policy, so a phone-bound QR does not shortcut anything |
| 90-day default TTL | a packet in a drawer dies in three months. Reprint on the follow-up visit, or extend the TTL for printed distribution |
| A printed QR is a bearer credential | anyone who photographs it can attempt a claim. Expect junk requests and do not treat every one as the owner |

**Always print the token (or a short code) as text beside the QR.** Scanning is not reliable on a cracked phone in poor light, and the fallback costs one line.

**Do not put the token on the outside of an envelope** — see below.

---

**A note on accuracy.** The platform cannot make a public record correct — it has no authority over it. What it can do is carry the best available public evidence *with provenance attached*, so the owner has both the field to fix and the receipt for where it came from. A wrong-but-faithful seed is not a defect; it is the second reason to claim. The tiers are public evidence → owner assertion → measured verification, and the honest job is to show which tier a field is at, not to pretend it is right.

**Design consequence:** never quietly "correct" a seeded field to something the sources don't support. If the sources disagree, the seed carries the most authoritative one and the disagreement is visible to the owner, who is the only party who can settle it.

---

## Envelope

The envelope is a **social device, not a security control.** It exists so the staff member carries a document rather than relaying a message (§17.9). Everything the owner needs — QR, short URL, code, the whole packet — sits inside it.

| Face | Content |
| --- | --- |
| **Outside** | owner's name · business name · one line: *"Your store's page — from [OPERATOR]"* · no QR, no token, no code |
| **Inside** | the full packet: claim QR, short URL, fallback code, listing URL, product test, the ask |

**Why the outside still needs a description.** A completely blank envelope reads as junk mail and gets binned. One line tells the counter it is legitimate and worth carrying back, without disclosing the token to anyone who handles it.

**Be honest about what the seal buys.** It keeps the token from casual view while the envelope is in transit — that is all. It is not a security boundary: anyone who opens it has the credential. The actual mitigations are the single-use token, the 90-day TTL, operator approval on unbound claims, and revocation (§ QR specification). Do not treat the envelope as protection.

---


## Worked example — Jokkymore African Market

```
────────────────────────────────────────────────────────────
  FOR  Kola,  OWNER OF  JOKKYMORE AFRICAN MARKET
  Left on 2026-11-05 by [OPERATOR], [PHONE]
────────────────────────────────────────────────────────────

  Your store is already listed here.

  [PLATFORM DOMAIN]/place/jokkymore-african-market

  ┌─────────────┐
  │   [ QR ]    │   Scan to open your page and claim it.
  └─────────────┘   Or go to [SHORT URL] and enter [CODE]

  The page shows 1041 N Girls School Rd, your 8 AM–9 PM
  hours, your category and your 54 reviews at 4.9 stars —
  the way a shopper sees you before they walk in.

  Claim it and that page becomes yours: your own web
  address to put on Google, Facebook or Yelp — or on a QR
  code at the counter.


  One thing it does not show: what is on your shelves.

  We searched Google Maps from your address for a product
  you carry:

        "Akabanga chili oil"  →  three Walmart Supercenters
                                 (Lafayette Rd, Avon, Plainfield)

  Not your store. Walmart.


  Claiming takes two minutes. It is step one of three.


        1. Claim the page            ~2 min
        2. Connect your inventory    ~2 min, daily
        3. See it live               we do the rest


  Step three is the point: Akabanga shows on your page
  within the hour, then on Google — so someone nearby
  searching for it finds your store, not Walmart.


  Log in at nrsplus.com  →  Pricebook  →  Excel Download,
  then send it to us or upload it on the page above. About
  two minutes a day — your Google stock reflects your
  latest upload.


  No cost for 90 days. You can stop at any time and we
  remove everything, including from Google.


  Everything on this page came from public information.
  Nothing came from inside your business.

  If anything on it is wrong — hours, phone, category —
  claiming it lets you correct it. Only the owner can.

  I will come back Thursday around 8 AM.
  If that is no good, call or text [PHONE].

────────────────────────────────────────────────────────────
```

---

## Follow-up — after the packet is left

**Rule: each touch escalates the channel's intimacy, never the volume.** Every touch carries information the previous one didn't, and no channel is used twice. Repeating the same message on a new channel is how a prospect becomes a nuisance.

| # | When | Channel | What it references | Constraint |
| --- | --- | --- | --- | --- |
| 1 | Day 0 | in person — packet at the counter | the gift: "your store is already listed" | ask for nothing |
| 2 | +3 days | **SMS to the mobile on record** (customs record, directory, or ground-truth backfill) | the packet, by name and date | **one message only.** A personal mobile is the most intrusive channel — never send a second |
| 3 | +7 days | **phone**, 07:30 or 20:15 | "I left a page last week" — ask for the owner by name | do not pitch staff; ask for a time, not a decision |
| 4 | +10 days | **email** from the record | the claim link + one specific finding | subject is their business name, never "partnership" or "opportunity" |
| 5 | +14 days | in person, right hour | a **fresh packet** (new token — the first may be expired or consumed) | same approach, second visit |
| 6 | +21 days | **community intermediary** | a named referral | only if 2–5 produced no signal |

**Sample copy**

- **SMS (2):** *"[Name], I left a page for you at [Store] on [day] about your store showing up on Google. One page, no cost. — [Operator], [phone]"*
- **Phone (3):** *"Is [Name] usually in around this time? I left a page for him last week — it's about the store's Google listing. When's a better time?"*
- **Email (4):** subject `[Business name] — your page and one thing it doesn't show`. First line: the product-search result, verbatim. Then the claim link. Nothing else.

**The warm branch — this is what the claim QR buys.** If a claim request is filed or a claim initiated, **stop the sequence** and respond within 24 hours. A scheduled cold touch landing on someone who just claimed the listing reads as automated indifference. The operator approval queue is your notification.

**Social signals.** One DM is legitimate only where the account posted within the last 90 days — a dormant page is a dead channel and a wasted touch. Where a social profile is doing the work of a website (e.g. a listing whose "website" is an Instagram URL), the observation *is* the opener: *"your Instagram is doing the job a website would — but it doesn't show up when someone searches for what you carry."* Verify the account is active before saying it.

**Stop rules.** Never more than one SMS. Never call twice in a week. After six touches with no signal, park the prospect for 90 days — a burnt owner is not recoverable, and the same storefront will still be there next quarter.

**Log every touch** (`POST /presence-seeds/:id/touches`, `channel: 'call' | 'sms'`). The sequence is a record, not a memory.

---

## Operator notes — not for print

| Item | Note |
| --- | --- |
| **"Kola"** | Named in public reviews as the person who greets customers and advises on yams and preparation. Confirm at the counter whether he is the owner or family before using the title. If unsure, print `FOR THE OWNER — JOKKYMORE AFRICAN MARKET` and ask for Kola by name. |
| **Product choice** | Use a named brand the store actually carries. `Akabanga chili oil` tested to three Walmarts on 2026-11-03; `garri` returned name-matches in Iceland, India and Nigeria; `Bournvita` returned a restaurant in Illinois. Re-run the test the morning of the visit — results drift. |
| **QR target** | Must be the published seed URL. Verify on a phone, not a desktop. |
| **Second copy** | Leave one with the counter *and* ask them to put it where the owner will see it — the register, the office door, the back counter. Do not hand it to a cashier mid-transaction. |
| **What not to add** | No screenshots of the hijacked site, no review-response statistics, no audit score, no competitor names. The comparison image (§15.1) is a conversation tool, not a leave-behind. |
| **Follow-up** | Run the sequence above and log every touch. One thing it does not cover: never ask the staff whether the owner "got it" — it puts them on the spot and they will answer politely rather than truthfully. |
