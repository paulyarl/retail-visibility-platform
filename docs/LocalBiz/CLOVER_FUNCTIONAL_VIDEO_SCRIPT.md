# Functional Review Video — VisibleShelf Clover App

Purpose: App Market submission "functional usage" video + reusable script pattern for
future POS integration videos (Square, NRS, Lightspeed).

Target length: ~3:20 with the optional demo beat (~3:00 without — cutting it
shifts every later timestamp back 20s). Audience framing: a busy merchant (not
a developer), even though reviewers watch it. Tone: warm, plain, unhurried.
No jargon.

Recording conventions:
- 1080p, browser zoom ~110% so UI text reads on review screens
- Unlisted YouTube link in the submission field (clean URL, no tracking params)
- Captions or narration fine; keep each screen ~2s longer than the voice line —
  reviewers pause
- Long holds: the OAuth consent screen (the permission story) and the disconnect
  state (the trust beat)
- Jump-cut real wait times (15-min sync poll) with a caption like
  "15 min later (or Sync Now)"

---

## Shot list & narration

### [0:00–0:15] Title card / App Market page

> "If your store runs on Clover, the things on your shelves are already in the
> system — names, prices, stock counts. The problem is, shoppers searching
> nearby can't see any of it. VisibleShelf fixes that — it takes your Clover
> catalog, adds your photos, and puts it in front of people searching on Google,
> so they see what you carry, what it costs, and that it's on the shelf before
> they ever walk in. Here's how it works — it takes about three minutes."

### [0:15–0:30] Market page → Connect → FREE plan → Confirm

> "From the Clover App Market, click Connect. The app's free to install — no
> Clover charges — and VisibleShelf plans handle the extras later if you want
> them. Confirm, and it opens the setup."

### [0:30–0:55] Launch → signup wizard → Auth0

> "You'll land on a short signup. Name your store, then pick how you want to be
> found — every plan starts with a 14-day free trial. Nearby at twenty-nine a
> month puts your inventory on Google. Storefront at thirty-nine gives you your
> own shop page. Or Storefront+ at fifty-nine for both. The Clover install
> itself is always free — the trial just opens the visibility. That's the only
> typing you'll do."

### [0:55–1:10] Optional: demo test-drive  *(the safety beat)*

> "Not ready to connect yet? Demo mode fills your shelf with twenty-five sample
> products — click around, test the sync, see how conflicts resolve. It's a
> test drive, not a live connection: nothing touches your Clover account, and
> nothing reaches Google. When you do connect for real, the samples clear out
> automatically and your real catalog takes over."

*(Show: Enable Demo Mode → 25 items populate → maybe a quick Simulate-tab
glance. The "clears out automatically" claim is real — connecting a real
account purges demo items and mappings.)*

### [1:10–1:30] Clover OAuth consent  *(long hold — the permission story)*

> "Now Clover asks your permission — and notice what it's asking. Read your
> inventory. Read your business info. That's all. We never touch your register,
> your orders, or your payments — Clover itself enforces that. If it can't read
> it, we can't see it."

### [1:30–1:50] Integrations page — Connected, Sync Now → items land

> "And you're connected. Hit Sync Now, and your Clover items come straight in —
> names, prices, SKUs, and real stock counts from your register."

### [1:50–2:20] Mappings tab + the live-edit beat

> "Here's the part that matters. Change something in Clover — a case of coconut
> milk comes in, or a price goes from $1.99 to $2.19 — and within about fifteen
> minutes, VisibleShelf picks it up automatically. Stock counts, prices, item
> names — your register stays the source of truth for all of it. You never
> update the same thing twice."

*(Cut the wait: caption "15 min later (or Sync Now)", then show the new count
on the Mappings/Products tab.)*

### [2:20–2:40] Add a product that isn't in Clover

> "And not everything you sell lives in the register — a lunch special, a
> service, that one-off item with no barcode. Add it right here, with its own
> photo and price. Clover never sees it and never overwrites it — it's yours —
> and it goes to Google right alongside your register items."

*(Show: add a product directly in VisibleShelf — name, price, a photo. Keep it
visibly distinct from the Clover-synced items so the "two sources, one shelf"
point lands.)*

### [2:40–3:05] Google integrations → Products → Sync All → Synced

> "Then, with one click, everything syncs to your Google Merchant Center —
> Clover items and yours together, with your prices, your stock counts, and
> your photos, not a stock image. The items that pass Google's checks become
> eligible for local inventory, so shoppers nearby see the real shelf: what's
> there, what it costs, and what it looks like. Your catalog, presented the
> way you built it."

### [3:05–3:20] Disconnect → card flips  *(the trust beat)*

> "And if you ever change your mind, uninstall or disconnect — your access token
> is cleared immediately and the sync stops. Your catalog stays yours. That's
> it — your register, on Google, in about three minutes."

---

## Claims discipline (what NOT to say)

- Never claim the item "is live on Google Search" — say "synced to Merchant
  Center / eligible for local inventory." Matches the listing copy.
- Never imply write access: "never touch your register" is accurate because
  Clover enforces read-only scopes — say it that way.
- Platform-only products: say "Clover never sees it and never overwrites it" —
  true because POS sync only manages POS-mapped items. Don't imply Clover
  tracks it, and don't call it "synced to Clover" (it's VisibleShelf→Google).
- Demo mode is a test drive, not a pipeline: demo items are excluded from GMC
  push/selection (`source != 'CLOVER_DEMO'`), and connecting a real account
  auto-purges them. Never show a demo item syncing to Google, and never
  present demo + real as coexisting — the integration is one or the other.
- Don't promise sync latency shorter than reality: "about every 15 minutes"
  (webhook-driven updates can arrive sooner — fine, but don't lead with it).
- Pricing/trial must match the tier contract, never ad-lib numbers:
  trial is 14 days (`TRIAL_DURATION_DAYS`); Nearby $29 (discovery —
  'SWIS' is the legacy pre-rename label), Storefront $39 (presence),
  Storefront+ $59 (storefront — inherits discovery, so "both" is
  literal). Clover install stays free — say that clearly so the FREE
  badge doesn't read as a hidden paywall.

---

## Template — reuse for future POS integrations

Keep the six-beat skeleton; swap the bracketed parts per POS:

1. **Problem frame (15s)** — "your inventory is in [POS], shoppers can't see it"
2. **Install + pricing honesty (15s)** — free install, where platform pricing lives
3. **Signup lane (25s)** — the automatic continuation + trial/pricing read
   (14-day trial, name the trio prices); emphasize "only typing you'll do"
4. **Demo test-drive (15s, optional)** — "zero-risk test drive: nothing touches
   [POS], nothing reaches Google; connecting for real clears the samples" —
   the product-safety case during trial
5. **OAuth consent (20s, long hold)** — read the scopes aloud; name what we *can't* do
6. **Live sync proof (30s)** — edit in POS (price AND stock) → lands in
   VisibleShelf; "register is source of truth" for name/price/qty
7. **Platform-only item (20s)** — add a product the POS doesn't track
   (no barcode, a service, a special) with its own photo; "POS never sees
   it and never overwrites it — it's yours"
8. **Downstream payoff (25s) + trust close (15s)** — GMC push carries
   POS items and platform-only items together: price + qty + photos;
   SWIS/local-inventory eligibility, then disconnect = tokens cleared,
   "your catalog stays yours"

Always include: the permission screen read-aloud, one real register edit landing,
one platform-only product add, and the disconnect state. Never include:
write-scope promises, fake "live on Google" claims, waits left uncut.
