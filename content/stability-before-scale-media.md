# Media Production Directives — "Stability Before Scale"

Companion assets for the post in `stability-before-scale.md`. Feed each block
to your generator of choice (video AI, image AI, or a human editor). Tone:
understated operator confidence — a build log, not an ad. No hype, no stock
imagery of smiling teams. Palette: platform violet/indigo on dark.

---

## Script A — Reel/Short (~35s) — "The retreat that wasn't"

**VO / caption text:**

> "We launched four cities in a week. Then we killed three of them.
> It looked like a retreat — it was the best call we made all year.
> One market small enough to audit showed us every defect four would've hidden:
> dead URLs Google kept crawling, 'resolved' dupes that were still live,
> keeper picks made blind.
> We fixed the machinery, not the metrics.
> Stability before scale. Next market's on deck."

**Visual direction (per ~5s beat):**
1. Map of the US; 4 pins light up (Indy, Fort Wayne, KC, Milwaukee)
2. 3 pins dim/retract, one stays lit — caption "reverted"
3. Magnifier sweep over a list of red error rows → they resolve green
4. A URL slug morphing while a crawler icon loops on the old one
5. Terminal-style line: `quota exceeded` → flashes to `PRO` badge
6. End card: "Stability before scale." + VisibleShelf mark

**Audio:** low ambient pulse, no vocals if using captions; dry VO if voiced.

## Script B — Short variant (~20s) — "The badge that lied"

> "Our dashboard said 'resolved.'
> Nine duplicate groups sat live on the public shelf for a week anyway.
> The verdict recorded the decision — nobody ran the suppression.
> One market made it visible. Four would've buried it."

**Visuals:** single continuous shot — a green "resolved" toggle card,
rows sliding under it glowing red, then a hand cursor flips a second switch
"suppressed" and the red rows fade.

---

## Carousel — 6 slides (image-gen or Figma)

1. **Hook:** "We unlaunched our own growth." — 4 map pins, 3 crossed out
2. **The wall:** quota-gauge graphic pegged at 5 GB / red overflow
3. **What one market saw:** checklist of the four defects (dead URLs, false
   resolved, blind keeper picks, locked revisions)
4. **Why volume hides defects:** noise-field visual — 4 scattered dots vs 1
   spotlighted dot
5. **The fix:** three mechanisms — slug insurance, dedupe suppression,
   thin/heavy keeper signals
6. **Closer:** "Stability before scale." + URL to the piece

## Still image (for GBP photo / link preview / feed)

**Prompt:** "Minimal editorial illustration, dark indigo background: a
lighthouse beam scanning a single glowing city on a map, three dimmed city
dots fading behind it. Flat vector style, violet and cyan accents, no text,
16:9." — alt for square crops on Meta.

## Threads still (optional square variant)

Same prompt, 1:1 crop. Keep the single lit city centered.

---

## Platform mapping

| Surface | Asset |
|---|---|
| Directory listing (place post) | Text post + still image |
| GBP | Text post + still image (16:9) |
| Instagram | Script A as Reel + carousel as second post |
| Facebook | Text post + carousel |
| Threads | Text variant + square still |
