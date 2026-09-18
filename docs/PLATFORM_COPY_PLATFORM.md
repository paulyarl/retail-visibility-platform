# Platform Copy Platform

**Status:** Draft · **Companion to:** `docs/PLATFORM_ROOT_COPY_ALIGNMENT_SPEC.md`
**Purpose:** the one-page foundation every public word is built from. The alignment spec says *what to change*; this says *what we're selling and how we sound* — so the copy can't drift back into a feature list.

> **Rule of this doc:** if a line doesn't help a visitor decide, it doesn't belong on the front.

---

## Why we exist — the pivot

Six months ago this was a storefront bolted onto someone else's distribution: sync products, ride Google. The pivot was a decision about identity — **be a front for another platform, or own the surface.** We chose to own it: our own directory, our own listings, our own free on-ramp.

That decision *is* the brand. The free seed isn't a pricing gimmick; it's the proof we're not reselling someone else's reach — we build the map, then invite businesses onto it. So the copy leads with **our** surface (the directory), and treats Google as one of three options, not the destination.

*Why it matters:* positioning without the origin story is just a claim. The pivot is the most persuasive thing we can say — and it's true. It also explains why the old copy had to change: it was written when Google was the product.

---

## The name — why "VisibleShelf"

Every retailer already understands one thing: **the shelf** — the surface their stock sits on. VisibleShelf takes that native object and adds the word that changes everything: **visible**.

The promise writes itself:

> Make your products visible. Make your products found. While you're at it, make yourself found too. We're here to get you there — not only your products, but yourself too.

Two layers, one brand: **the products on the shelf, and the business behind it.**

*Why it matters:* the name isn't a label, it's the positioning. It hands us a metaphor the customer already owns — so we never have to explain the category. And the two-layer idea (products *and* the business) resolves the products-vs-business tension that the old copy couldn't.

---

## 1. What we sell — one sentence

> For local business owners who are invisible where shoppers actually look, **VisibleShelf gets you found — in our directory, on Google, and on your own storefront — and turns that discovery into sales. Start free: no developer, no agency.**

*Why it matters:* every surface downstream is a variation of this sentence. No page invents its own positioning.

## 2. Who we're talking to — and the door

- **Primary:** the local business owner. The front speaks to them, in their words.
- **Secondary:** the shopper. Served by the directory, not the sales pitch.

So the front has a **door** — two words, self-selected:

> **I'm a store owner**  ·  **I'm shopping local**

*Why it matters:* today's front blends three audiences and lands with none. The door costs one line and doubles relevance.

## 3. The promise, in three beats

| Beat | What we say | Why it's true |
|---|---|---|
| **1. You're already halfway there** | "Your business may already be listed in our directory — claim it free in about two minutes." | Directory seeds from public data; free `directory_presence` gateway |
| **2. Show up where shoppers look** | "Choose your surface: a rich directory listing, Google Search & Shopping, or your own storefront." | Entry Presence triad (`presence` / `discovery` / `storefront`) |
| **3. Turn discovery into sales** | "When you're ready, take deposits, offer pickup or delivery, or sell with full online payment." | Commerce tiers (`commitment` / `ecommerce` / `omnichannel`) |

*Why it matters:* three beats cover the whole product without naming a single feature. The tier ladder is the answer to "how," not the pitch.

## 4. Voice — five rules

Warm, plain-spoken, never dry, never dull. (Full register: alignment spec §4.5.)

1. Hook, then reassure.
2. Concrete over clever.
3. No hype, no superlatives, no exclamation marks.
4. Claim-and-fix, not purchase-push.
5. Never shame the business.

*Why it matters:* it's the same voice as our outreach — so the first impression and the first email sound like one company.

## 5. The front, in one screen

```
[ Your shelf, made visible. ]

Make your products visible.
Make yourself found.

Most local shops are missing from the places shoppers look —
and it's rarely their fault. We start you free: your business
can be listed in our directory from public information, and
claiming it takes about two minutes. From there, show up on
Google and your own storefront — and sell when you're ready.

[ Claim your free listing → ]     [ See how it works ]

✓ {live count} local businesses listed     ✓ Built by retailers, for retailers

How it works  ·  Features  ·  Browse the directory  ·  Pricing
```

*Why it matters:* one headline, one primary action, one proof line, four links. Nothing to overwhelm, everything discoverable. `{live count}` is a live value from platform stats — never a hardcoded "thousands."

### Eyebrow — chosen

> **Your shelf, made visible.** *(locked)*

The name, literal — retail-native and timeless. It explains the brand before the headline makes the promise. Wired into `apps/web/src/components/landing/LandingHero.tsx` above the headline (small, uppercase, wide tracking).

**Alternatives considered** (kept for reference): *"Make your products visible. Make yourself found."* (the two-layer promise) and *"Our map. Your shelf."* (the pivot). If the front should later lead harder on the pivot, promote the third.

**Pairing (shipped):** eyebrow (brand) → headline line 1 **"Make your products visible."** → line 2 ticker, opening on **"Make yourself found."** and rotating outcome lines → subcopy (the free gateway) → CTA **Claim your free listing →** (primary) / **See how it works** → trust strip (live count + "Built by retailers, for retailers") → discoverability row (How it works · Features · Browse the directory · Pricing).

**Motion retained:** the hero's existing typing animation is kept — the copy was retargeted to outcome lines rather than removed, so this stays a copy change, not a redesign.

All of the above is wired in `apps/web/src/components/landing/LandingHero.tsx`; the live count is passed from `apps/web/src/app/(platform)/page.tsx` as `businessCount`.

## 6. What we leave out — on purpose

The value isn't deleted; it's **one click away**. Progressive disclosure:

| Leave off the front | Lives here |
|---|---|
| Full tier ladder & prices | `/features#pricing` |
| Capability matrix (26 families) | `/features` |
| Integrations and jargon (SWIS, BOPIS, SKU) | `/features`, in plain language |
| How seeding and claiming work | `/directory/about` |
| The product itself | `/directory` |

*Why it matters:* the front's job is to earn the next click, not to explain everything. Overwhelming isn't thorough.

## 7. Claims we're allowed to make

Only these, and only with a live source. (Full register: alignment spec §7.)

- Real, live counts from platform stats — never "thousands."
- "Free to start" / "claim it free" — true at the gateway.
- "No developer, no agency" — true.
- "Built by retailers, for retailers" — true; use the founder story.
- Nothing about ROI, certification, or uptime unless sourced.

*Why it matters:* one unprovable number costs more trust than it buys attention.

## 8. The 60-second test

Show the front to someone for a minute, then ask:

> *Who is it for? What does it do? What do I do next? Why is it free?*

If any answer is fuzzy, the copy isn't done.

*Why it matters:* it's a cheap, repeatable bar — and it keeps the front honest.
