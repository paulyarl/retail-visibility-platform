# Social Variants — "How a 404 Became a Platform Insurance Policy"

Companion cuts of `content/the-404-insurance-policy.md`, tone-tuned per
platform, plus a content-category taxonomy for ongoing pieces drawn from
platform dev/evolution/operations.

---

## X / Twitter — thread

Tone: terse, numbered, one idea per tweet. Hook earns the scroll.

```
1/ A customer asked why Google still indexed a dead URL while the new page sat unindexed.

What looked like a boring 404 turned into a platform insurance policy. A thread on dead slugs, rename trails, and why your SQL is part of your matching logic 🧵

2/ The setup: a listing was published → Google indexed it → it was removed → republished under a different slug.

Google remembered the old URLs. The platform didn't. Three indexed URLs now served honest 404s while the real listing existed one rename away.

3/ Root cause wasn't a bug. It was two worldviews colliding:

Crawlers treat URLs as identities — durable, worth crawling for years.
Platforms treat slugs as attributes — mutable on every rename, republish, revert.

Every mutation was orphaning identities Google still believed in.

4/ The fix, layer 1 — record the trail:

Every slug rename writes old_slug → tenant_id to a slug_aliases table.
Assigning a slug deletes stale aliases (recycling). Readers verify the target is still live before 308ing.

Deterministic. Covers even full renames to different tokens.

5/ Layer 2 — inference for pre-history drift:

Dead slugs are usually old spellings: bare name, name+geo, legal suffix, name-variant. A matcher explains a dead slug iff EXACTLY ONE live record can explain it.

hits.length === 1 is the entire safety property.

Zero or ambiguous → stays 404. A wrong 308 is worse than an honest 404.

6/ Then production taught us the real lesson. The matcher passed 13 unit tests… and the dead slug still 404'd.

The bug was in the SQL recall layer, not the matcher:

lower(regexp_replace(name, '[^a-z0-9]+','-','g'))

regexp_replace runs BEFORE lower(). [^a-z0-9] eats uppercase letters.
"Jokkymore African Market" → "-okkymore-frican-arket"

Every capitalized name was invisible.

7/ The fix: SQL does NO normalization. Tokens arrive slug-clean; plain ILIKE substring matching has the same recall with zero slugify logic to drift.

Normalization lives in one place — the code that owns slugify().

8/ Principles we kept:

• 404 handler is a product decision — "not found" vs "moved" are different truths
• Deterministic beats inferred — record history at write time
• Ambiguity degrades to doing nothing, never the wrong thing
• permanentRedirect() throws NEXT_REDIRECT — call it OUTSIDE try/catch or catch{} swallows your redirect

9/ Result: every rename, republish, and dedupe now leaves a 308 trail back to the active record. Verified live:

/place/old-slug-a → 308 → canonical
/place/old-slug-b → 308 → canonical

The indexed URL is a promise made to a crawler. The platform's job is honoring promises it forgot it made.

Full case study: [link]
```

---

## LinkedIn — post

Tone: reflective, leadership-adjacent, lesson-forward. Paragraph form, no
hashtag spam (2–3 max).

```
What a dead URL taught us about platform responsibility

A merchant's listing had been published, indexed by Google, removed, then republished under a different URL. The old indexed URLs all served 404s. Straightforward bug report — except it wasn't really a bug.

The platform treats a slug as an attribute: mutable on every rename, republish, or republish cycle. Google treats a URL as an identity: durable and worth recrawling for years. Every mutation was quietly orphaning identities the crawler still trusted. Once we offered self-service slug renames, that drift was guaranteed to scale.

So we built what I'm now calling slug insurance — a two-layer 404 recovery:

1. Deterministic: every rename records old_slug → tenant_id. The platform knew the answer at write time; now it writes it down.
2. Inference: a dead slug is usually an old spelling of a live record — name, name+geo, legal suffix, name variant. If exactly one live record explains it, we 308 to the canonical. Zero or ambiguous? It stays a 404. A wrong redirect is worse than no redirect.

The part that stung: the matching logic was fully unit-tested, 13 green tests — and the first dead slug still failed. The bug was in the SQL recall prefilter that fed it: a regexp ran before lowercasing, so every capitalized business name was silently invisible. Precision was tested; recall wasn't. Only real production data could have caught it.

The takeaway I keep coming back to: a 404 handler is a product decision. "Not found" and "moved" are different truths — and only one of them preserves the trust a search engine placed in your URLs.

#softwareengineering #seo #buildinpublic
```

---

## Reddit (r/programming, r/webdev, r/SEO) — post

Tone: candid, technical, invites scrutiny. No polish; leads with the
interesting mechanism, not the product.

```
Title: Building dead-slug recovery: deterministic rename trail + a one-line safety rule

Context: our platform lets tenants rename their public slugs and republishes directory listings under new slugs. Every rename orphaned the old URL — Google kept recrawling 404s while the live page sat one rename away.

Two-layer fix:

1. slug_aliases table — every slug write path records old_slug → tenant_id at rename time. Assigning a slug deletes its aliases (recycling); reads verify the target is still live before 308ing.

2. Fuzzy matcher for pre-history drift — a dead slug resolves iff exactly one live record explains it (name / name-variant / geo / legal tokens). hits.length === 1 is the whole safety property. Ambiguous → stays 404 by design.

The embarrassing part: matcher had 13 passing unit tests and still failed in prod because the SQL recall prefilter did lower(regexp_replace(name,'[^a-z0-9]+','-','g')) — the replace ran before lower(), so [^a-z0-9] ate every capital letter. "Jokkymore African Market" → "-okkymore-frican-arket". Only lowercase-stored names ever matched. Fix was removing SQL-side normalization entirely — plain ILIKE ANY on raw text, normalization owned solely by the slugify() codepath.

Other gotcha: Next.js permanentRedirect() throws NEXT_REDIRECT — inside a try/catch it's silently swallowed. Compute the target inside, redirect after the block.

Happy to share the matching rules if anyone's solving the same "mutable platform, immortal crawler" problem.
```

---

## Hacker News — submission + first comment

Tone: terse; the title does the work. First comment adds the mechanism,
not marketing.

```
Title options:
  Show HN: Dead-slug recovery – when your platform mutates URLs Google remembers
  A 404 became a platform insurance policy (dead-slug recovery via rename trail + single-candidate inference)

First comment:
  Built this after self-service slug renames made URL drift a routine byproduct rather than an accident. Two layers: slug_aliases records old_slug→tenant_id at rename time (deterministic, covers full renames); a token matcher handles pre-history drift (bare name / name+geo / legal suffix / variants) and only fires when exactly one live record can explain the slug — ambiguity stays 404 since a wrong 308 is worse than none.

  Bug worth sharing: the SQL recall prefilter used lower(regexp_replace(name,'[^a-z0-9]+','-','g')) — the replace ate uppercase letters before lower() ran, so all capitalized names were invisible. Unit tests covered the matcher (precision) but not recall. Removed SQL-side normalization entirely; ILIKE on raw text has same recall, zero drift surface.
```

---

## dev.to / Hashnode — companion cut

The full case study posts as-is; offer a second, shorter angle that
travels better — the bug alone is the most relatable artifact:

```
Title: The bug that only production could find: lower() after regexp_replace

Short form (~800 words): the SQL normalization bug as the hero, matcher
design as supporting context. Audiences that haven't built a slug system
still recognize "two implementations of the same normalization, one
drifted." Ends with the rule: recall is SQL's job, precision is code's —
test them like different species.
```

---

## Facebook / GBP / merchant-facing — plain language

Tone: no jargon. For tenant-facing surfaces (the social posting feature).

```
Good news for your online presence: if your business page's web address ever changes, the old address now automatically forwards to the new one — permanently. Links you've shared, Google results, bookmarks — they all keep working and pass their history to the new address. No action needed on your end.
```

---

## Newsletter / blog blurb — 60 words

```
This week we shipped "slug insurance": dead public URLs now resolve back to their live record instead of 404ing. A recorded rename trail covers full renames; a conservative matcher covers pre-history drift — redirecting only when exactly one live record can explain the old URL. Ambiguous cases stay 404 by design.
```

---

## TikTok / Reels / YouTube Shorts — vertical video

Tone: storytime dev-content. Hook in the first 2 seconds, one idea per
beat, text-overlay carries the plot for muted viewers. ~40–50s.
Visuals: screen recording for code/terminal beats, assets 1–7 from
`visual-prompts.md` as B-roll, face-cam optional for hook/outro.

**Script A — "The 404 that wasn't"**

```
BEAT      OVERLAY                          VO / ACTION
0–3s      "Google remembered a URL         "So Google indexed a page that
          my platform forgot."              my own platform forgot existed."
3–9s      three dead slugs on screen,       "A listing got published, indexed,
          red ✗ each                        deleted, then republished under a
                                          different URL. Three old links —
                                          all 404."
9–16s     "URL = identity to a crawler"    "Here's the thing: to Google, a URL
          vs "slug = attribute to us"       is an identity. To our platform,
                                          it's just an editable field."
16–24s    "Layer 1: write down the         "Fix one: every rename now records
          rename"                           the old slug — deterministic trail.
                                          Layer two: a matcher that revives
                                          old spellings — but ONLY if exactly
                                          one live page explains them."
24–32s    the regexp snippet,             "Then production found the bug unit
          "lower() runs AFTER the          tests couldn't: this line lowercased
          replace — so capitals die"        AFTER stripping non-slug chars —
                                          which silently ate every capital
                                          letter. Capitalized business names
                                          were invisible."
32–40s    "SQL recalls. Code decides."     "Fix: SQL does zero normalization.
                                          It just substring-matches the tokens
                                          the code already cleaned."
40–48s    308 matrix animation             "Now every rename leaves a permanent
                                          redirect to the live page. A 404
                                          handler turned out to be a product
                                          decision — not an error page."
          "full story in comments"
```

**Script B — one bug, one lesson (~30s)**

```
HOOK:     "This line of code silently ate capital letters."
SHOW:     lower(regexp_replace(name,'[^a-z0-9]+','-','g'))
EXPLAIN:  "'Not lowercase, not digit' — that class also matches uppercase.
           The replace ran BEFORE the lower. 'Jokkymore African Market'
           became '-okkymore-frican-arket' and every ILIKE pattern missed."
PUNCHLINE:"The unit tests were all green — they tested the matcher, not
           the SQL that feeds it. Precision was tested. Recall wasn't.
           Fix: SQL does no normalization. Code cleans; SQL recalls."
```

## Instagram — carousel + Reels

Reels = Script A verbatim. Carousel: 7 slides, 1:1 crops of the visual
assets — copy below is the overlay/caption text.

```
SLIDE 1 (hero signpost)      "Google remembered a URL my platform forgot."
SLIDE 2 (worldview split)    "Crawlers treat URLs as identities.
                              Platforms treat slugs as editable fields."
SLIDE 3 (rename trail)       "Layer 1: every rename writes the trail —
                             old_slug → tenant. Bookkeeping, not guessing."
SLIDE 4 (single-gate funnel) "Layer 2: a dead slug redirects only if
                             EXACTLY ONE live page can explain it.
                             Ambiguous = honest 404."
SLIDE 5 (regexp bug)         "Shipped it. First slug still 404'd.
                             The SQL ate every capital letter before
                             lower() ever ran. 13 green tests missed it."
SLIDE 6 (308 matrix)         "Fix: SQL recalls, code decides.
                             Zero normalization in the query."
SLIDE 7 (emblem shield)      "Now every rename leaves a permanent redirect.
                             The indexed URL is a promise to a crawler —
                             keep honoring it."
Caption: storytime version of the LinkedIn post, first line = slide 1 hook.
Hashtags: #softwareengineering #webdev #seo #buildinpublic #programming
```

## Threads — posts

Tone: same voice as X but looser, more conversational, shorter thoughts —
Threads rewards casual over structured. Three standalone options.

```
POST 1
Google indexed a page my platform had already forgotten. Three dead URLs,
one live listing. So we built slug insurance: renames write an
old→new trail, and a matcher revives old spellings only when exactly one
live page can explain them. Wrong 308 is worse than honest 404.

POST 2
Fun bug today: lower(regexp_replace(name,'[^a-z0-9]+','-','g')) — the
replace runs BEFORE the lower, so "not lowercase letter" eats every
capital. "Jokkymore African Market" became "-okkymore-frican-arket" and
the query matched nothing. 13 green tests didn't see it because they
tested the matcher, not the SQL feeding it.

POST 3
small thing that got me: Next's permanentRedirect() throws NEXT_REDIRECT —
inside a try/catch your redirect just… vanishes. compute the target in the
block, call the redirect after it. hours of my life, etc.
```

## YouTube Shorts

Script A verbatim. Title: **"Google remembered a URL my platform forgot"**
Description: one-line summary + link to the full case study.

## Pinterest (optional)

Pin description (links back to the article):

```
How a 404 became a platform insurance policy — dead-slug recovery via a
rename trail + single-candidate inference, and the SQL bug that only
production could find. #webdev #seo #programming
```

---

# Content Category Ideas

A taxonomy for ongoing pieces — each with seed material that already
exists in this codebase's history.

## 1. Incident postmortems (public-friendly)

What broke, what the real cause was, what the fix reveals about the
system. Audience: engineers + technical founders.

- *This piece* — dead-slug insurance
- **The 717K-row error log** — a self-scheduling job loop spammed
  `application_error_log` to 400MB; spawned the dedupe/guard triggers,
  `createMany` over `create` contract, and the whole `db-rescue` utility
- **The tsc OOM that reported "Total errors: 0"** — a build failure that
  masqueraded as a clean build; why `--max-old-space-size` is now in the
  build script

## 2. Patch reports / "we maintain a diff"

Owning a dependency patch responsibly: why it exists, when to drop it,
how it fails loudly on upgrade.

- **`patches/next@16.4.3.patch`** — the `workStore`/`_global-error`
  prerender bug: an ALS context lost across an `await`, a poisoned `.next`
  cache, and the exact rule for regenerating the patch on version bumps

## 3. Cost & quota engineering

Resources nobody budgets for until the invoice.

- **Market pushes are an egress budget line** — ~0.7–2GB per market,
  pipeline *reads* not publish writes; staging-as-workshop / prd-as-
  storefront workflow that fell out of it; the export/import runbook

## 4. SEO mechanics from inside a platform

How a real multi-surface site handles indexation — canonicals, sitemaps,
gates, recovery.

- *This piece* — slug insurance
- **The thin-content publish gate** — seeds must earn indexability
  (`seedPublishable`), one predicate shared by sitemap + robots + publish
- **The canonical ladder** — custom domain → subdomain → path, one
  canonical emitted on all three surfaces

## 5. Data-layer lessons ("SQL is code")

The bugs that live in the seam between query and application.

- *The recall-vs-precision piece* — the capital-eating regexp
- **createMany as a dedupe contract** — when triggers silently drop rows,
  `INSERT…RETURNING` panics; every writer to the log table learned the
  contract the hard way

## 6. Platform evolution notes

How the system's *shape* changed and why — architecture decisions made
public.

- **Two orgs, one workflow** — staging as market workshop, prd as
  storefront; the export → import → promote pipeline for market data
- **The orchestrator** — replacing 15+ ordered `app.use` mounts with an
  explicit router precedence document

## 7. Merchant-facing education

Plain-language value pieces for the businesses the platform serves (GBP /
social posting channel).

- Claim your listing / what verification gets you
- "Your old web address keeps working" — the insurance in merchant terms
  (variant above)

## 8. Build-in-public operations

The unglamorous machinery that keeps a solo/small team platform running.

- **`db-rescue.cjs`** — a diagnostics tool born in a quota incident that
  became the nightly-retention system; runbook culture as a moat
- **`pnpm build` archaeology** — documenting the two failure modes it
  *used* to have so the next person recognizes them instantly

---

*Suggested cadence: one engineering deep-dive per significant incident
(category 1/5), one explainer per shipped mechanism (4/6), one merchant-
facing note per user-visible improvement (7). The repo's AGENTS.md is
already a content backlog — most sections are a published piece waiting
for a narrative.*
