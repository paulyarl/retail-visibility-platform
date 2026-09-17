# Outreach Problems & Solutions — Operator Guide

## Overview

Every triage briefing, per-issue repair briefing, and business audit now ends with **1–3 problem → solution pairs** — ready-made outreach ammunition you can say to the prospect verbatim. No more synthesizing the pitch yourself out of `pain_points` and `risks`: each entry hands you a problem framed as a business consequence, two spoken lines to raise it, the fix, and the evidence behind it.

The pairs are **playbook-aligned** — they only cover the kinds of problems the confirmed playbook actually fixes. A NAP Drift briefing gives you NAP pairs even when the audit data contains a more painful off-issue signal; the off-issue pain lives in `risks`/`pitch` where it always did. One well-grounded pair beats three thin ones — a single-issue audit legitimately returns just one entry.

---

## 1. Where the pairs show up

One card component renders the same shape in all three places:

| Surface | Where | Section |
|---|---|---|
| **Triage briefing** | RepairTrackPanel — the "AI Triage Briefing" card | Under Pitch Angle / Risks |
| **Per-issue briefings** | RepairBriefingCard — campaign Overview tab | Under Risks |
| **Business audits** | BusinessAnalysisAuditCard | "Outreach Ammunition" section, after Recommended Tier |

Briefings and audits generated before this rollout may have no section — the card simply doesn't render. Re-run the triage/audit to get one.

---

## 2. Reading an entry

Each card is one problem, consequence-first:

- **Headline** — the problem as the prospect experiences it ("customers asking Siri for your category get sent to a competitor"), never a technical label ("NAP inconsistency").
- **Regular** — the plain professional line. Default choice for email or a first call with an owner who's already receptive.
- **Hook** (accent border) — the same fact delivered as a pattern-interrupt: a curiosity gap, a "try being your own customer" moment, a specific number. Use it when you need attention — cold call, subject line, follow-up. It's always 100% true to the evidence; no clickbait.
- **The fix** — a high-level summary of what gets done, not a named package. The analyst doesn't see your catalog — **you map the fix to the actual offer**.
- **Evidence** (collapsed) — the raw audit observation behind the problem: platform + observed fact. Expand before a call if you expect pushback.
- **Usage chip** — how the analyst intends you to deploy the pair: cold-call opener, email hook, objection response.

---

## 3. Using the lines

### Copy

Every spoken line has a **Copy** button — one click, verbatim, no re-typing. Paste into your dialer notes, email draft, or the pitch construction workspace.

### Use as opener

Each Regular and Hook line also has **Use as opener** — it seeds an opener variant in the Openers workspace with:

- `opener_text` = the line you clicked
- `primary_angle` = the entry's problem (consequence-first framing is exactly the angle)
- `source_briefing` = `triage` / `issue_audit` / `business_audit` — provenance of where the line came from

Quality-gate warnings (if any) show inline next to the button. The campaign-level "Create Opener from Hook" on the pitch block still works unchanged — it remains the default opener; the per-problem lines are *additional* material.

### Don't repeat yourself

The point of per-problem lines is **coverage across touches**. The campaign opener raises the conversation once; the entry lines give you fresh material for the call → email → follow-up sequence without saying the same sentence three times. Mix Regular and Hook per touch — Regular for a warm follow-up, Hook when you still haven't earned attention.

---

## 4. Reading guidance

- **Rank = severity.** Entries arrive ordered most-painful first. If you only get one shot, lead with entry #1.
- **Stay on the confirmed issue.** The pairs are bound to `issue_type_confirmed` (triage) or the template's issue (NAP drift / unclaimed / platform gap). If the prospect pivots to a different pain, that's a different playbook — check `risks` and `pitch.pain_points` before improvising.
- **Check Evidence before quoting numbers.** The Hook lines are true to the evidence, but you're the one saying them — expand the Evidence block and be ready to name the platform where the fact was observed.
- **Claim-and-fix framing.** The pairs assume the develop-value-first motion: the platform seeds the prospect's directory presence first, then invites the owner to claim it. Problems land as "we surfaced this on your listing"; solutions as "claim your profile and we fix it" — never "buy an audit."
- **The fix is a summary, not a product.** Translate it into your package at pitch time — the analyst deliberately stays blind to the catalog.

---

## 5. Importing external output — what changed

If you paste AI output into the external import flow:

- **`profile_repair_triage` and `profile_repair_audit` outputs now REQUIRE `outreach_problems`** — at least one well-formed entry. Output generated before this change **will fail import**; add the field manually or regenerate.
- **Empty arrays reject** — `"outreach_problems": []` is invalid. Either provide a real entry or omit the field entirely (omission only valid for `business_analysis`).
- **`business_analysis` outputs may omit the field** — it's optional there because the schema is shared with non-audit templates. But if present, it must contain at least one valid entry.

---

## 6. Quick reference

| Situation | Do this |
|---|---|
| Need a cold-call line fast | Entry #1 → Hook → Copy (or Use as opener) |
| Warm follow-up email | Entry #1 or #2 → Regular → Copy |
| Prospect pushes back | Expand Evidence → cite platform + observed fact |
| Same prospect, third touch | Use a *different* entry's line — don't re-use the opener |
| Off-issue pain comes up | Check `risks` / `pitch.pain_points` — pairs stay on-playbook by design |
| Import rejects old output | Add `outreach_problems` (≥1 entry) or regenerate — required field |
| No section on a card | Pre-rollout briefing — re-run the triage/audit |
