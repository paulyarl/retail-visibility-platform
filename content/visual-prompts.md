# Visual Prompts — "The 404 Insurance Policy" Content Set

AI image-generation prompts for the case study and its social variants.
Style guidance is shared so the set reads as one campaign; per-asset
prompts are paste-ready for Midjourney/DALL·E/SDXL — swap the style block
into your generator's "style" field where supported.

---

## Shared style block (append to any prompt)

```
flat editorial vector illustration, clean geometric shapes, limited
palette of deep indigo #312e81, violet #7c3aed, and off-white #f8f7ff,
single warm accent color #f59e0b, generous negative space, subtle grain
texture, no photorealism, no rendered text or letters, no watermark,
16:9 composition
```

(Renders cannot produce legible text — keep slug/URL text out of the
image; typeset overlays in post instead.)

---

## 1. Hero image — the core metaphor

*Use: article header, OG card base (1200×630), LinkedIn post banner.*

```
A weathered road signpost at a fork: the old arrow plank is faded and
pointing toward a collapsed bridge, while a bright new plank redirects
travelers onto a solid illuminated path ending at a small glowing
storefront. Above the redirect, a translucent shield with a subtle
checkmark pattern hovers protectively over the new path. Distant paper
airplanes (suggesting crawlers) follow the new path instead of falling
into the gap. flat editorial vector illustration, deep indigo and violet
palette, warm amber accent, generous negative space, subtle grain, no
photorealism, no rendered text, 16:9 --ar 16:9
```

## 2. "Two worldviews colliding" — the thesis illustration

*Use: mid-article, under "The worldview collision"; LinkedIn carousel card 1.*

```
Split-scene composition: on the left, a methodical robotic archivist
carefully stamping ledger pages bound with chains of permanence; on the
right, a nimble shopkeeper figure rapidly swapping interchangeable
nameplates on a storefront frame. Between them, old nameplates drift
downward into a void while the archivist looks up, still holding the
ledger open to a stamped entry that no longer exists. flat editorial
vector illustration, deep indigo left half, violet right half, warm
amber accent on the drifting plates, negative space at top for a
headline, no rendered text, 16:9
```

## 3. The rename trail — deterministic layer

*Use: section illustration under "Layer 1: the recorded trail";
X/Twitter thread image for tweet 4.*

```
A clean top-down map: a dotted trail of footprints leads from an old
crossed-out address marker to a glowing new marker, and alongside the
trail a small clerk's desk stamps each step into an open logbook —
"bookkeeping, not guessing." Alternative routes branch off and fade.
flat editorial vector illustration, indigo map field, amber trail
accent, violet markers, isometric feel, no rendered text or letters,
16:9
```

## 4. The single-candidate rule — inference layer

*Use: under "hits.length === 1"; LinkedIn carousel card 2; Reddit post
header image.*

```
A funnel of many faded storefront silhouettes entering at top, filtered
through a single narrow gate marked by a shield; below the gate, exactly
one storefront lights up with a clear amber glow and a single arrow
continues onward. Several darker silhouettes are stopped at the gate
and dissolve into mist — "zero or ambiguous stays closed." flat
editorial vector, indigo/violet palette, amber for the one winner, high
contrast, minimal, no rendered text, 16:9
```

## 5. The capital-eating regexp — the production bug

*Use: under "The bug that only production could find"; dev.to companion
article header.*

```
A magnifying glass hovering over a clean line of code blocks; under the
lens, tall capital-letter-shaped blocks are being silently erased into
dashes by a small mechanical eraser, leaving only lowercase blocks
behind. A tiny observer figure on the side notices the gap the eraser
created. Playful but precise, indigo background, amber eraser accent,
no rendered text or letters — the code is abstract blocks, 16:9
```

## 6. The redirect matrix — verification moment

*Use: under "Verification, live"; X thread image for tweet 9.*

```
Three parallel conveyor lanes, each carrying an old faded address card
into a junction booth; two lanes stamp their card "308" and divert it
smoothly onto a converging rail; the third lane's card passes straight
through on the main line with a green light. The rails merge into a
single brightly lit endpoint. flat editorial vector, industrial-clean
composition, indigo machinery, amber for 308 stamps, violet endpoint,
abstract cards only — no rendered text, 16:9
```

## 7. OG / social card — condensed badge

*Use: Open Graph/Twitter card after typesetting title text in post.*

```
Centered emblem-style composition: a shield formed from two interlocking
arrows — the left arrow faded and cracked (the 404), the right arrow
bright and solid pointing forward (the 308) — hovering above a small
storefront silhouette. Ring of subtle orbiting dots around the shield
suggesting recrawling. flat editorial vector emblem, deep indigo field,
amber right-arrow accent, lots of dark margin around the emblem for
title text overlay in post, square-safe center composition, 16:9
```

## 8. Merchant-facing illustration — Facebook / GBP post

*Use: the plain-language merchant variant; warmer, friendlier register.*

```
A cozy corner-store storefront with a friendly "we moved — same shop"
paper sign taped to the door, and a small dotted arrow curving from the
old address to the new; a happy shopkeeper waves from the doorway and a
delivery person easily follows the arrow. Warmer variant of the
palette: soft indigo evening light, generous warm amber, rounded
friendly shapes, storybook feel, no rendered text or letters, 4:5
```

---

## Format map

| Asset | Primary sizes |
|---|---|
| Hero (1, 2) | OG/Twitter card 1200×630, LinkedIn banner 1200×627 |
| Section art (3–6) | Article inline 1600×900, LinkedIn carousel 1080×1080 crop |
| Card emblem (7) | OG fallback 1200×630, square 1080×1080 |
| Merchant (8) | FB feed 1200×1500, IG 1080×1350 |

## Generation notes

- **No text in-image.** Every prompt excludes rendered text on purpose —
  gen models produce letter-soup. Typeset slugs, status codes, and titles
  as overlays (Figma/Canva/CSS) on the margin space the compositions
  reserve.
- **Palette is brand-adjacent** — indigo/violet matches the `/place`
  surface family; amber is the action accent. For `/directory` (blue)
  variants of the story, swap the accent prompt to `azure #2563eb`.
- **Consistency trick:** reuse the strongest output as a style-reference
  image (`--sref` in Midjourney) for the rest of the set.
- **If Midjourney:** append `--ar 16:9 --style raw --v 6` (or 4:5 for #8).
- **If DALL·E:** keep prompts under ~400 chars each; the style block can
  be trimmed to "flat editorial vector illustration, indigo/violet,
  amber accent, no text."
