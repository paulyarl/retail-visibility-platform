# Operator Hook Samples — African Grocery Stores (Indianapolis)

Source document for the Hook Library sprint. Full five-beat body copy for all 12 hook angles, rendered for one niche (African grocery stores, Indianapolis) as the reference sample the catalog module authors from.

Shape (per spec): diagnostic hook → reassurance → bridge/quantified upside → audit offer → soft CTA.

Ships as 12 angles per the Hook Library spec as written (Option A). `zero_footprint` (13th) and `phone_hook` fields are intentionally out of scope here — those belong to the Cold Call Channel sprint and should be authored against this same shape when that sprint starts.

Sender signature used throughout: `-- Adrien Yarl`. Treat as a placeholder token for the catalog (`{{sender_name}}`) if templates are meant to be sender-agnostic.

---

## 1. gbp_verification

**Label:** Google Business Profile verification & optimization
**Archetypes (V3, cross-ref only):** DIRECTORY_GHOST, SOCIAL_ONLY, MISCATEGORIZED_OR_MISLABELED
**Signals:** DS_CLAIMED_STATUS, DS_MISSING_SERVICE_MENU, DS_OUTDATED_HOURS, DS_PHOTO_DEFICIT

**Subject:** quick question about your Google listing

**Body:**
```
Hey! I was looking up African grocery stores in Indy earlier and noticed your Google listing is probably sitting around a C-minus for completeness — hours, categories, photos, that kind of thing.

Honestly, most local shops are in that range, so nothing to worry about.

But an incomplete listing usually means you're missing out on 20-30% of the "near me" searches that should be finding you first — people who are already looking for exactly what you sell.

I do quick Google Listing Audits that show exactly what's missing and what to fix first. Takes me about a day, and it's yours to keep either way.

Want me to send over what I found?

-- Adrien Yarl
```

## 2. nap_normalization

**Label:** Business-name and NAP normalization
**Archetypes (V3, cross-ref only):** MISCATEGORIZED_OR_MISLABELED, DIRECTORY_GHOST
**Signals:** CP_NAP_NAME_DRIFT, CP_NAP_ADDRESS_DRIFT, CP_NAP_PHONE_DRIFT

**Subject:** your business shows up a little differently everywhere

**Body:**
```
Hey! Quick one — I pulled up your business across a few directories (Google, Yelp, Facebook) and noticed the name and phone number don't quite match everywhere.

Super common, nothing broken.

But it can quietly confuse Google about which listing to trust and rank — which means fewer people finding the right number to actually call you.

I put together a fast NAP Consistency Check that maps out every mismatch and the fix for each. Takes about a day, free to keep.

Want me to send it over?

-- Adrien Yarl
```

## 3. hours_sync

**Label:** Hours synchronization
**Archetypes (V3, cross-ref only):** DIRECTORY_GHOST, SOCIAL_ONLY
**Signals:** DS_OUTDATED_HOURS

**Subject:** are your hours right everywhere?

**Body:**
```
Hey! I noticed your posted hours aren't quite the same across your listings — one place says open, another's a little different.

Most local shops have this somewhere, so don't sweat it.

But it's one of the top reasons customers show up to a locked door — and leave a review about it instead of coming back.

I can run a quick Hours Accuracy Check across your main listings and hand you a simple fix list. Takes about a day, no cost, yours either way.

Want me to send it?

-- Adrien Yarl
```

## 4. website_foundation

**Label:** Website creation or modernization
**Archetypes (V3, cross-ref only):** INVISIBLE_ANCHOR, SOCIAL_ONLY, DIRECTORY_GHOST
**Signals:** WC_MISSING_WEBSITE, WC_BROKEN_WEBSITE, EF_ZERO_INDEXED_PRESENCE

**Subject:** quick question about your website

**Body:**
```
Hey! I went looking for your website earlier and had a hard time finding one — or if it's there, it's not showing up where customers would expect.

Totally normal for a lot of great local shops.

But it means a chunk of people checking you out online just stop looking the moment they can't find one — customers you'd otherwise have walking in the door.

I do simple Website Foundation builds for shops like yours — nothing fancy, just something that shows up, loads fast, and gets people in.

Want me to sketch out what that could look like for you, no obligation?

-- Adrien Yarl
```

## 5. product_category_pages

**Label:** African grocery product-category pages
**Archetypes (V3, cross-ref only):** INVISIBLE_ANCHOR, SINGLE_PLATFORM
**Signals:** WC_MISSING_SERVICE_PAGES, DS_MISSING_SERVICE_MENU

**Subject:** do people know everything you carry?

**Body:**
```
Hey! Love what you've got going — but I noticed there's nowhere online that actually lists what you carry (yams, fufu, imported spices, halal cuts, that kind of thing).

A lot of shops don't have this yet, so you're not behind.

But it means you're leaving an easy win on the table — those exact product searches are how new customers find specialty stores like yours in the first place.

I can put together simple category pages that capture that search traffic.

Want me to show you a sample?

-- Adrien Yarl
```

## 6. review_acquisition

**Label:** Compliant review acquisition
**Archetypes (V3, cross-ref only):** INVISIBLE_ANCHOR, FRESH_START
**Signals:** RA_LOW_REVIEW_VOLUME, RA_REVIEW_DROUGHT

**Subject:** noticed you don't have many reviews up yet

**Body:**
```
Hey! I checked your online reviews and noticed there aren't many up yet.

Usually that just means happy customers haven't been asked — not that they're not out there.

Reviews are honestly one of the fastest ways for a shop like yours to build trust with new customers fast, before they've ever walked in.

I've got a simple, fully compliant system for gently asking satisfied customers to leave one.

Want me to walk you through how it works?

-- Adrien Yarl
```

## 7. testimonial_amplification

**Label:** Trust and testimonial amplification
**Archetypes (V3, cross-ref only):** INVISIBLE_ANCHOR
**Signals:** EF_STRONG_HIDDEN_TRUST, RA_UNADDRESSED_POSITIVE_BACKLOG

**Subject:** you've got fans and nobody knows it

**Body:**
```
Hey! From what I found, people genuinely love your shop — good word of mouth, a few glowing mentions here and there.

Problem is, none of that is showing up where new customers are looking first.

That kind of trust is hard to earn and easy to waste if it's invisible — a little visibility here goes a long way toward turning regulars' good word into new faces in the door.

I put together simple Testimonial Amplification packages that take the praise you're already earning and put it front and center online.

Want me to show you what that'd look like?

-- Adrien Yarl
```

## 8. local_seo

**Label:** Local SEO
**Archetypes (V3, cross-ref only):** DIRECTORY_GHOST, INVISIBLE_ANCHOR
**Signals:** RA_LOW_REVIEW_VOLUME, DS_MISSING_PROFILE

**Subject:** a quick look at how easy you are to find

**Body:**
```
Hey! I did a quick search for "African grocery near me" in your area and your shop wasn't showing up on the first page.

Pretty common for shops that haven't had any SEO work done — nothing to worry about.

But it likely means you're missing a good chunk of nearby customers who are actively looking for exactly what you sell.

I run quick Local SEO Audits that show exactly what's holding you back and what to fix first.

Want me to send mine over?

-- Adrien Yarl
```

## 9. cross_platform_expansion

**Label:** Cross-platform profile expansion
**Archetypes (V3, cross-ref only):** SINGLE_PLATFORM, SOCIAL_ONLY
**Signals:** DS_MISSING_PROFILE, EF_SINGLE_SOURCE_ONLY

**Subject:** you're on Google — but that might be it

**Body:**
```
Hey! Looked you up and found you on one platform, but not much beyond that — Yelp, Facebook, Nextdoor, that sort of thing.

Totally normal starting point.

But each of those is a different door customers walk through to find you — and right now a few of those doors are closed to people who'd otherwise find you there first.

I can map out exactly which platforms would matter most for a shop like yours and get you set up.

Want me to send the list?

-- Adrien Yarl
```

## 10. photo_content_setup

**Label:** Photo and storefront-content setup
**Archetypes (V3, cross-ref only):** DIRECTORY_GHOST, INVISIBLE_ANCHOR
**Signals:** DS_PHOTO_DEFICIT, VP_MISSING_PROJECT_PHOTOS

**Subject:** your listing could use a few more photos

**Body:**
```
Hey! Noticed your online listings are pretty light on photos — maybe none at all.

Really common, but customers lean on photos hard when deciding whether to try a new grocery store, especially a specialty one.

A few good shots of the shelves and storefront can be the difference between a scroll-past and someone deciding you're worth the drive.

I can put together a simple photo/content setup plan — what to shoot, where it goes — that takes almost no time on your end.

Want me to send it over?

-- Adrien Yarl
```

## 11. click_to_call

**Label:** Mobile click-to-call optimization
**Archetypes (V3, cross-ref only):** SINGLE_PLATFORM, DIRECTORY_GHOST
**Signals:** WC_MOBILE_FRICTION, WC_MISSING_CTA

**Subject:** quick test on your listing from my phone

**Body:**
```
Hey! I tried calling your shop straight from your Google listing on my phone, and it wasn't a one-tap call — had to dig for the number.

Small thing, honestly.

But on mobile, that little bit of friction is often the difference between a customer calling right then and just giving up and moving on to the next result.

I can do a quick Click-to-Call Audit across your listings and site to fix that. Takes about a day, yours to keep.

Want me to send it?

-- Adrien Yarl
```

## 12. reputation_monitoring

**Label:** Reputation monitoring
**Archetypes (V3, cross-ref only):** INVISIBLE_ANCHOR, FRESH_START
**Signals:** RA_UNANSWERED_COMPLAINTS, VP_STALE_SOCIAL_ACTIVITY

**Subject:** who's watching your reviews?

**Body:**
```
Hey! Quick question — is anyone keeping an eye on new reviews as they come in across your listings?

A lot of shop owners are heads-down running the business and miss them for weeks at a time.

That's an easy fix, but an unanswered bad review sitting there for a month can quietly cost you customers who never even mention it — they just move on.

I offer a simple Reputation Monitoring setup so you get notified right away and never miss a chance to respond.

Want me to show you how it'd work for your shop?

-- Adrien Yarl
```

---

## Notes for the catalog module

All 12 bodies follow the same five-beat shape consistently: diagnostic hook → reassurance → bridge/quantified upside → offer → soft CTA. The "more customers walking in the door" framing is used as the bridge beat, never as the opening line, per the earlier decision to keep the opener tied to a specific, falsifiable observation rather than a generic universal question.

Signal and archetype mappings above are suggested defaults for ranking/rank-boost logic (HookSuggestionService), not hard constraints — a business can reasonably surface a hook without matching every listed signal/archetype if no better-fitting angle is available.

`testimonial_amplification` is deliberately framed as purely additive (no "you're missing out" language) since it's meant to pair with `EF_STRONG_HIDDEN_TRUST` — a business with real, confirmed goodwill and low visibility should never be told anything is wrong.

These 12 samples are the Indianapolis-African-grocery rendering referenced in the spec. The catalog module applies the templatization pass (swap African grocery store → `{{category}}`, shelves → `{{product_noun}}`, etc.) per spec §13.2's three phrasing categories. This document is the rendered reference output, not the parameterized template source.
