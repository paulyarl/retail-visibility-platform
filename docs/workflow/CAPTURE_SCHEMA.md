# Capture Schema — Prospect Outreach

One record per **contact attempt** (a visit or a call), joined to the prospect by `seed_id`.

The point of this schema is that a staged rollout produces *data*, not impressions. Fields marked
**GATE** decide whether the rollout advances or holds. Everything else is a **learning field** that
informs the script. See `TEST_COVERAGE_WORKFLOW.md` for the gate ladder these fields feed.

Gate fields are deliberately mechanical, not conversion-based — at wave sizes of three, a conversion
rate is statistically meaningless, but a broken QR code is unambiguous.

---

## Stage 0 — Pre-flight (before any contact)

| Field | Type / values | Purpose |
| --- | --- | --- |
| `seed_id` | string | join key across all stages |
| `business_name` | string | |
| `city` / `corridor` | string | cluster batching (e.g. `W Washington`, `Lafayette Rd`) |
| `store_format` | enum | grocery / grocery_plus_prepared_foods / bakery / butcher / other |
| `category_verified` | bool | assortment-verified category fit, not label-derived |
| `wave` | enum | `ghost` / `1` / `2` / `block` / `remote_pilot` |
| `reserved` | bool | held back from contact until its wave |
| `seed_label_ok` | bool | **GATE** — shelf label correct, not a generic "Convenience store" |
| `seed_nap_ok` | bool | **GATE** — storefront address + store line, not the registration pair |
| `seed_cta_live` | bool | **GATE** — claim CTA present and reachable |
| `seed_url` | url | |
| `claim_token_issued` | bool | |
| `claim_token_expires_at` | ISO datetime | failure-path testing input |

## Stage 1 — Contact

| Field | Type / values | Purpose |
| --- | --- | --- |
| `channel` | enum | `walk_in` / `phone` |
| `prior_touch` | bool | has this prospect been contacted before (e.g. a verification call) |
| `prior_touch_date` / `prior_touch_channel` | date / enum | sequencing — a spent channel reads as a repeat |
| `booked` | bool | was step 1 (the booking contact) completed |
| `contact_at` | ISO datetime | hour-of-day effect on outcome |
| `conditions` | enum | `quiet` / `moderate` / `rush` |
| `owner_present` | bool | |
| `dwell_min` | int | |

## Stage 2 — Reveal

| Field | Type / values | Purpose |
| --- | --- | --- |
| `hook` | enum | `wrong_category` / `split_phone` / `no_website` / `other` |
| `reveal_landed` | bool | **GATE** |
| `seconds_to_reveal` | int | **GATE** — target < 120 |
| `reaction` | enum | `engaged` / `neutral` / `defensive` / `dismissive` |
| `objection_code` | enum | `price` / `busy` / `trust` / `language` / `none` / `other` |
| `objection_text` | string | verbatim — the raw material for script revision |

## Stage 3 — Channel viability (the remote-critical block)

Without these fields the remote variant cannot be planned, only hoped for.

| Field | Type / values | Purpose |
| --- | --- | --- |
| `textable_number` | bool | can the line receive SMS (a verified voice line is not proof) |
| `email_captured` | bool | fallback path |
| `probe_sent` | bool | test message sent mid-contact |
| `probe_confirmed` | bool | **GATE** — owner replied, e.g. "got it" |
| `preferred_channel` | enum | `sms` / `whatsapp` / `email` / `none` |
| `second_line_seen` | bool | mobile / WhatsApp line observed on signage or card |

## Stage 4 — Claim

| Field | Type / values | Purpose |
| --- | --- | --- |
| `qr_scanned` | bool | |
| `claim_page_reached` | bool | |
| `claim_completed` | bool | |
| `claim_unassisted` | bool | **GATE** — completed with no operator rescue |
| `rescue_required` | bool | **GATE** (inverse of the above) |
| `minutes_to_claim` | int | |
| `stall_point` | enum | `qr` / `page_load` / `token_delivery` / `form` / `none` |

## Stage 5 — Evidence harvest (walk-in only, unrecoverable remotely)

| Field | Type / values | Purpose |
| --- | --- | --- |
| `signage_name` | string | closes the canonical-name / trading-name question |
| `signage_matches_listing` | bool | |
| `posted_hours_seen` | bool | |
| `posted_hours_match` | bool | against the listing's published hours |
| `counter_services` | array | `halal_meat` / `prepared_food` / `remittance` / `none` — invisible to label-driven discovery |
| `shelf_photos_taken` | int | seed content |
| `notes_visible_assortment` | string | product tokens observed on the shelf |

## Stage 6 — Live photo capture (walk-in only; optional, mood- and moment-gated)

The seed's most visible value move. Capture is optional and never blocks a rung.

**Consent here is a conversation, not a record.** The operator asks, shows the shots on the phone, and
publishes only what the owner picks — and `SeedPhotoCapturePanel` enforces that with a required
approval checkbox per shot. None of it is persisted: `directory_photos` has no consent column, and that
is deliberate.

The reasoning, recorded so it is not re-litigated: a seed's entire pre-conversion existence already
stands on public information — name, address, phone, hours, an audit-written narrative, and
**Google-sourced storefront photos of the same premises** — published under a "listed from public
information" disclaimer, with a free claim invitation standing as the remedy. An operator-taken
storefront photo therefore adds almost no incremental exposure, and once the owner converts they own
the listing and can edit or delete anything from the tenant gallery they already have. What would be a
rights failure is publishing a shot the owner has not seen; that is prevented in the UI rather than
evidenced after the fact.

The residual exposure, named rather than hidden: the **unconverted** case (photos stay up if the seed is
never claimed, so the window is bounded only by the claim happening), and `people_in_frame` — which is
not a public-data question at all, since a customer or employee in shot is personal information the
platform's own rules prohibit collecting.

| Field | Type / values | Purpose |
| --- | --- | --- |
| `moment_ok` | bool | not a delivery day, mid-rush or queue — gate on mood **and** moment |
| `photo_consent_requested` | bool | asked explicitly and specifically, not vaguely |
| `photo_consent_granted` | bool | UI-enforced — nothing captured without a clear yes; not persisted |
| `photo_consent_scope` | enum | `signage_only` / `signage_storefront` / `signage_storefront_shelf` / `none` |
| `photos_taken` | int | |
| `people_in_frame` | bool | the one hard rule — customers and staff are off-limits; must be false to publish |
| `photos_shown_to_owner` | bool | UI-enforced — shown on the phone before any publish; not persisted |
| `photos_approved_count` | int | UI-enforced — only these are published; not persisted |
| `photos_published_count` | int | |
| `owner_declined` | bool | capture declined; record it and never push |
| `fallback_offered` | enum | `none` / `owner_sends_later` / `signage_only` |

## Stage 7 — Disposition

| Field | Type / values |
| --- | --- |
| `disposition` | `claimed` / `pending` / `follow_up` / `declined` / `no_contact` |
| `follow_up_date` | date |
| `notes` | string |

---

## Rolling defect log (not per contact)

Captured once per defect, not per visit — a defect found in the ghost run must be traceable through
to the fix and the regression run.

| Field | Type / values |
| --- | --- |
| `defect_id` | string |
| `surface` | enum — `S1_seed_page` / `S2_claim_flow` / `S3_qr_card` / `S4_token_message` / `S5_token_destination` / `S6_tooling` / `S7_script` / `S8_photo_capture` |
| `severity` | `non_negotiable` / `recommended` |
| `status` | `open` / `fixed` / `wont_fix` |
| `fix_verified` | bool |
| `regression_run` | string — which ghost re-run confirmed it |

---

## Filled example

A wave-1 walk-in on a store in the west-side corridor. Gate outcomes drive the wave decision, not the
conversion outcome.

```json
{
  "seed_id": "seed_arsema_001",
  "business_name": "Arsema G Food Mart LLC",
  "city": "Indianapolis",
  "corridor": "W Washington",
  "store_format": "grocery",
  "category_verified": true,
  "wave": "1",
  "reserved": false,
  "seed_label_ok": true,
  "seed_nap_ok": true,
  "seed_cta_live": true,
  "seed_url": "https://<seed-url>",
  "claim_token_issued": true,
  "claim_token_expires_at": "2026-10-14T00:00:00Z",

  "channel": "walk_in",
  "prior_touch": true,
  "prior_touch_date": "2026-10-01",
  "prior_touch_channel": "phone",
  "booked": true,
  "contact_at": "2026-10-08T14:20:00Z",
  "conditions": "quiet",
  "owner_present": true,
  "dwell_min": 11,

  "hook": "wrong_category",
  "reveal_landed": true,
  "seconds_to_reveal": 75,
  "reaction": "engaged",
  "objection_code": "busy",
  "objection_text": "\"Wednesdays are delivery day, I can't talk long.\"",

  "textable_number": true,
  "email_captured": false,
  "probe_sent": true,
  "probe_confirmed": true,
  "preferred_channel": "sms",

  "qr_scanned": true,
  "claim_page_reached": true,
  "claim_completed": true,
  "claim_unassisted": true,
  "rescue_required": false,
  "minutes_to_claim": 4,
  "stall_point": "none",

  "signage_name": "Arsema Food Mart",
  "signage_matches_listing": true,
  "posted_hours_seen": true,
  "posted_hours_match": true,
  "counter_services": ["none"],
  "shelf_photos_taken": 6,
  "notes_visible_assortment": "teff flour, berbere, shiro, injera, dried beans",

  "moment_ok": true,
  "photo_consent_requested": true,
  "photo_consent_granted": true,
  "photo_consent_scope": "signage_storefront_shelf",
  "photos_taken": 7,
  "people_in_frame": false,
  "photos_shown_to_owner": true,
  "photos_approved_count": 5,
  "photos_published_count": 5,
  "owner_declined": false,
  "fallback_offered": "none",

  "disposition": "claimed",
  "follow_up_date": null,
  "notes": "Owner asked about a website after claiming."
}
```
