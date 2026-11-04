# How a 404 Became a Platform Insurance Policy

*A case study in dead-slug recovery, deterministic rename trails, and why
your SQL layer deserves the same paranoia as your matching logic.*

---

## The incident

A directory seed went through an unremarkable lifecycle: published with a
market push, indexed by Google, removed, republished later under a different
slug. Standard platform mutability. What remained:

- **Active:** `/place/jokkymore-african-market-indianapolis-in`
- **Indexed, now dead:**
  `/place/jokkymore-african-market`,
  `/place/jokkymore-african-market-llc-jokkymore-d-chef-food-services`,
  `/tenant/tid-eqi0q83z`

Google remembered the old URLs. The platform didn't — each one served an
honest 404 while a perfectly good listing existed one rename away.

## The worldview collision

This wasn't a bug so much as a philosophical mismatch that had never been
reconciled:

- **Crawlers treat URLs as identities.** Durable, indexable, worth revisiting
  for years. A 404 isn't "page missing" — it's "identity revoked."
- **The platform treats slugs as attributes.** Mutable on every rename,
  republish, market revert, dedupe suppression, or stub-tenant regeneration.

Every mutation was quietly orphaning identities Google still believed in.
And the self-service slug picker tenants were about to get ("select your
preferred slug") was going to industrialize the drift — renaming would go
from operational accident to routine byproduct.

So the question became: should the platform take responsibility for its own
mutability, or push the cost onto the crawler's trust?

## The design: insurance, two layers

A dead slug, it turns out, is three questions in disguise:

1. *Who used to live here?* — known, if you bothered to write it down.
2. *Who could plausibly live here?* — inferable, because the URL still
   describes the business in its tokens.
3. *Should anyone live here?* — the safety question. A wrong 308 is worse
   than an honest 404.

### Layer 1: the recorded trail

For anything renamed *after* the feature exists, inference isn't needed —
the platform knew `old → new` at the moment it happened. A `slug_aliases`
table (`old_slug → tenant_id`, migration 375) is written by both slug write
paths: `updateSlug` for tenant renames, and the seed fields rename that
writes the listing slug directly.

Two invariants keep it honest:

- **Assigning** a slug deletes its alias rows — a live owner supersedes a
  stale alias (slug recycling).
- **Reading** verifies the alias target is still live before redirecting —
  a dead target stays a 404, never a dangling redirect.

Tenant-keyed is the right shape because the slug namespace is *mirrored*
(`tenants.slug`, `directory_settings_list.slug`, `directory_listings_list.slug`
are kept in sync), so a tenant only ever holds one public slug at a time —
the alias records who *owned* the URL, and the live join asks what that
tenant answers to *now*.

### Layer 2: fuzzy inference

For drift that predates the trail — like this incident — a matcher works
backwards from the URL. Dead slugs are almost always old spellings: the bare
business name, name + geo suffix (`…-indianapolis-in`), a legal name
(`…-llc`), or a stitched name variant. Each candidate's vocabulary is its
`business_name` + `name_variants` + city/state + legal-entity tokens; the
dead slug resolves when it equals a name, covers a name plus explainable
residuals, or is a ≥2-token truncation of one.

The whole safety property is one line: `hits.length === 1`. Exactly one
live record may explain the dead slug — zero matches stays 404, and two or
more stays 404. Ambiguity is deliberately un-self-improving: more data can
only ever cause *missed* recoveries, never *wrong* ones.

### The resolver in practice

One endpoint per surface — `?surface=place|directory|tenant` — each
querying its own source table (no materialized views; the live record is
the truth). Alias first (`via: 'alias'`), fuzzy second (`via: 'variant'`).
The response's `candidates` count doubles as a diagnostic: `0` means recall
never found the room; `>0` with `slug: null` means precision rejected it.

On a miss, the page layouts 308 (permanent) to the resolved slug — chosen
over 301/302 because the claim is "moved forever."

## The bug that only production could find

The feature shipped, and the first dead slug… still 404'd. The matcher was
provably correct — thirteen unit tests green — so what failed?

```sql
-- Original prefilter
lower(regexp_replace(business_name, '[^a-z0-9]+', '-', 'g')) LIKE ANY(...)
```

`regexp_replace` runs *before* `lower()`. The class `[^a-z0-9]` treats
uppercase letters as non-slug characters and eats them. `"Jokkymore African
Market"` normalized to `-okkymore-frican-arket` — and no `%token%` pattern
matched. Every capitalized business name was invisible to recall.

The long dead slug *did* redirect — a mid-word lowercase token (`chef`)
survived the mangling inside a name variant and pulled the row into the
candidate set by luck. An accidental live smoke test of the whole pipeline.

**The lesson:** the SQL layer's job was *recall* — get the right row into
the room. Its failure mode is silent: the row simply never arrives, and the
feature looks like "no match" instead of an error. The matcher's job was
*precision* — its failures are loud and testable. The suite covered
precision exhaustively and recall not at all.

**The fix** came from making SQL do *no* normalization at all. Tokens
arrive already slug-clean, so plain `ILIKE ANY` on the raw column has
identical recall with zero slugify logic to drift:

```sql
dll.business_name ILIKE ANY($1::text[])
OR EXISTS (SELECT 1 FROM unnest(dps.name_variants) v
            WHERE v ILIKE ANY($1::text[]))
```

Normalization now lives in exactly one place — the code that owns `slugify`.

## Verification, live

```
/place/jokkymore-african-market
  → 308 → /place/jokkymore-african-market-indianapolis-in
/place/jokkymore-african-market-llc-jokkymore-d-chef-food-services
  → 308 → /place/jokkymore-african-market-indianapolis-in
```

After renaming the canonical slug back to the strongest indexed URL:

```
/place/jokkymore-african-market                 → 200 (restored, no hop)
/place/jokkymore-african-market-indianapolis-in → 308 → canonical
/place/jokkymore-african-market-llc-…           → 308 → canonical
```

The rename restored the indexed URL to a direct 200, and the resolver
caught the URL the rename itself just orphaned — the loop closed.

## What it is now

Slug insurance: one endpoint, a rescue call on the miss path only, one
small table, zero schema dependencies beyond it. Every rename, republish,
market revert, and suppressed duplicate now leaves a 308 trail back to the
active record — and ambiguous cases fail *conservatively*, toward missed
recovery rather than wrong consolidation.

The `/tenant/{id}` surface stays deliberately out of scope: surrogate keys
carry no semantics to match against, and dead tenants are honestly dead.

## Principles worth stealing

- **A 404 handler is a product decision.** "Not found" and "moved" are
  different truths; only one preserves equity.
- **Deterministic beats inferred.** When the platform controls the write,
  record history — inference is for pre-history drift.
- **SQL recalls, code decides.** Push normalization and judgment into the
  layer you can unit-test; keep queries dumb.
- **Ambiguity is a feature of the failure mode.** Design so uncertainty
  degrades toward doing nothing, never toward doing the wrong thing.
- **`candidates` in the response is the tell.** Expose the count that
  distinguishes "nothing found" from "nothing survived the rules."
- **Permanent redirects escape try/catch.** `permanentRedirect()` throws
  `NEXT_REDIRECT` — call it after the block, or `catch {}` swallows your
  redirect silently.

*The indexed URL is a promise you made to a crawler. The platform's job is
to keep honoring promises it forgot it made.*
