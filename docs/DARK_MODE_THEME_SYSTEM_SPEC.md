# Dark Mode & Theme System — Spec / Future Sprint

**Status:** Proposed — not scheduled
**Date:** 2026-09-18
**Area:** `apps/web` (app-wide), with read-only checks against `apps/api` (PDF/email rendering)
**Origin:** Operator report — "Resolve verification → Call outcome dropdown: the selected option is invisible"

---

## 1. Summary

A single invisible row in a native `<select>` popup turned out to be the visible tip of a
**theme-system mismatch that spans the whole web app**. The app has three theme mechanisms, two of
them dead; the live one writes a theme signal that none of the 18k+ `dark:` utilities in the
codebase can see. Separately, it *does* switch the browser's `color-scheme`, which is why native
form controls go dark while the rest of the UI stays light.

This is **not** a styling bug that can be patched in place. Any real fix touches ~620 files, two
third-party theming systems (Mantine in 299 files, BlockNote), server-rendered output (PDF, email),
and public customer surfaces.

**The edge-case inventory (§8) is itself the finding.** It is a debt ledger, not a to-do list, and
the sprint's primary goal is **reduction**: retire duplicate mechanisms, centralise per-usage risk
into shared components, and **bind** the systems worth keeping. Mantine stays — its colour-scheme
axis gets wired to one signal rather than removed (R3). Targets in §9.

**A narrow mitigation is already shipped** (§3) that removes the reported symptom without
committing to either direction. It does not fix the underlying mismatch.

---

## 2. Root cause (verified)

`ClientRootLayout.tsx:32` mounts `<ThemeProvider>` **with no props**:

```tsx
<QueryClientWrapper>
  <ThemeProvider>          {/* ← no props */}
    <PlatformThemeProvider>
```

`components/ThemeProvider.tsx:127-137` forwards those props straight into next-themes:

```tsx
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>   {/* ← defaults apply */}
```

next-themes v0.4.6 defaults (read from `node_modules/next-themes/dist/index.mjs`):

| Prop | Default | Consequence here |
|---|---|---|
| `attribute` | **`"data-theme"`** | Writes `data-theme="dark"` on `<html>` — **not** `class="dark"` |
| `defaultTheme` | `"system"` | Follows `prefers-color-scheme` |
| `enableSystem` | `true` | `"system"` is resolvable |
| `enableColorScheme` | **`true`** | Sets `color-scheme` on `<html>` from the resolved theme |
| `storageKey` | `"theme"` | Collides with a legacy hook (§4) |

Meanwhile `globals.css:6` declares the dark variant as **class**-based:

```css
@custom-variant dark (&:is(.dark *));
```

### The two halves never meet

- `data-theme="dark"` is set on `<html>`; **no element ever gets `class="dark"`**.
- Therefore `dark:` utilities (18,463 occurrences across 620 files) **never activate**.
- Therefore the `.dark …` rules in `globals.css` (lines 328-329, 372+, 430+) **never match**.
- But `enableColorScheme: true` **does** set `color-scheme: dark` on `<html>`.

So in OS-dark the app renders **light**, while the browser renders **native chrome dark** — and
that is the reported bug (§3).

---

## 3. The reported symptom, and the mitigation already shipped

**Symptom.** Firefox → dark. `Resolve verification` → `Call outcome`. The popup's selected row is
invisible.

**Mechanism.**
1. next-themes sets `color-scheme: dark` on `<html>` (it is *not* next-themes' `attribute` that
   leaks — it is `enableColorScheme`).
2. The UA therefore draws the `<select>` popup with its **dark** palette.
3. The option text is forced **dark** by a global rule — `globals.css:209`
   `select { color: var(--neutral-900) !important }` — and nothing lightens it, because the
   `.dark .text-gray-900` rule that would have (line 329) never matches.
4. Dark text on a dark popup → the row vanishes.

**Mitigation shipped** (`globals.css:246-272`, commit `5a72c374`):

```css
select option            { background-color: #ffffff; color: var(--neutral-900); }
.dark select option      { background-color: #262626; color: rgb(249 250 251); }

select                   { color-scheme: light; }
.dark select             { color-scheme: dark; }
```

The operative rule is **`select { color-scheme: light }`** — it overrides the inherited
`color-scheme: dark` for selects only, so the popup renders light and matches the (light) app.
Confirmed against light + dark Firefox screenshots: popup light and legible in both.

**Phase 0 decision (made):** the two `.dark select …` rules are currently **inert** (nothing
carries the `dark` class). They are **kept**, with an explicit comment in `globals.css` stating
they are forward-looking, so no future reader mistakes them for evidence that dark mode works.
They mirror the many other inert `.dark …` rules already in that file — deleting only these two
would have been inconsistent, and they are what a future dark mode would need.

**Not covered by the mitigation:** every other UA-drawn surface — see §8.

---

## 4. Theme architecture inventory

Three mechanisms, one live:

| # | Mechanism | Location | Storage key | Live? | Notes |
|---|---|---|---|---|---|
| 1 | **next-themes** | `components/ThemeProvider.tsx:127` ← `ClientRootLayout.tsx:32` | `theme` | **YES** | Defaults only. `attribute="data-theme"`, `enableColorScheme=true` |
| 2 | `ThemeContext` | `contexts/ThemeContext.tsx` | `rvp-theme` | No | **Not imported anywhere.** Adds/removes `.dark`; listens to `matchMedia` when `theme === 'system'` |
| 3 | `useTheme` hook | `hooks/useTheme.ts` | `theme` | No | **Not imported anywhere.** Adds/removes `.dark`; no `matchMedia` listener; toggles on mount only |

Supporting cast:

- `components/ui/ThemeToggle.tsx` — uses next-themes' `useTheme`, **never rendered**. There is
  currently **no UI to change the theme**; the app is effectively locked to `"system"`.
- **Mantine 9.6.1 — a second design + theming system, in 299 files** (311 `@mantine/core`
  imports; 303 files importing any `@mantine/*`). Two nested `MantineProvider`s
  (`contexts/PlatformThemeProvider.tsx:108`, `components/ThemeProvider.tsx:130`), neither passing
  any theming prop.
  **Its colour scheme is light by *default*, not by design.** Mantine's own defaults are
  `colorSchemeManager = localStorageColorSchemeManager()` and `defaultColorScheme = "light"`
  (`esm/core/MantineProvider/MantineProvider.mjs`), and nothing in the app calls `setColorScheme`,
  uses `useMantineColorScheme`, or writes the manager's `mantine-color-scheme-value` key. So
  Mantine and Tailwind agree today (both light) — but only because nobody has asked Mantine for
  anything. The moment a `setColorScheme` call, a Mantine colour-scheme toggle, or a written
  storage value appears, **299 files flip to dark while the Tailwind UI stays light**, silently.
  This is a latent landmine, not an active defect.
  The pinning API exists in this version: `forceColorScheme`, `defaultColorScheme`,
  `cssVariablesResolver`.
- `globals.css:2` imports `@mantine/core/styles.css`, so Mantine's `--mantine-color-*` variables
  and the Tailwind tokens share **one cascade** — binding Mantine is a single-point change, not a
  299-file sweep.
- `app/layout.tsx:133` — `<html className="… bg-white text-neutral-900" suppressHydrationWarning>`.
  Hardcoded light at the root, plus the next-themes hydration-script marker.

### Why this matters

`enableColorScheme` (live) makes UA chrome follow the OS. next-themes' `attribute` (live) does not
reach the class-based dark variant, so the Tailwind UI cannot go dark at all. Mantine is light by
default and agrees with Tailwind only by accident. `ThemeContext`/`useTheme` (dead) are the only
things that would have written the class. The result: **UA chrome is the only OS-reactive surface**,
and it reacts in the opposite direction from everything else.

---

## 5. Debt ledger (measured 2026-09-18)

Counts are static-scan over `apps/web/src` (`*.ts`/`*.tsx`) plus `globals.css`. They exist to make
reduction measurable — each row is a target in §9.

| Surface / mechanism | Files | Occurrences | Theme debt |
|---|---:|---:|---|
| `dark:` Tailwind utilities | 620 | 18,463 | **Inert.** Written blind, never rendered |
| Native `<select>` | 187 | 430 | UA popup — the reported bug class |
| Native `<option>` | 205 | 1,327 | Inherits colour; 1,327 chances to regress |
| `input[type="date"]` | 31 | 42 | UA date picker |
| `input[type=time\|datetime-local\|month\|week]` | 6 | 9 | UA picker |
| `input[type="checkbox"]` | 90 | 186 | UA control internals |
| **`@mantine/core` imports** | **299** | 311 | **Second theming system — light by default, unbound** |
| any `@mantine/*` import | 303 | 355 | As above |
| `@blocknote/*` | 1 | 3 | Third-party editor; inherits Mantine's scheme |
| `qrcode` / `qr-code-styling` | 1 | 1 | Baked-colour images; scan contrast |
| `leaflet` / `react-leaflet` static imports | 0 | 0 | **Not detected — verify; likely dynamic import** |
| Theme mechanisms | — | 3 (1 live) | Duplicate sources of truth |
| `MantineProvider` instances | — | 2 | Duplicate providers |
| Theme storage keys in play | — | 3 (`theme` next-themes · `rvp-theme` dead · `mantine-color-scheme-value` Mantine) | Collision risk (D4) |
| `!important` declarations in `globals.css` | — | 9 (was 11) | Fight Tailwind; colour rules remain (D6) |
| Undefined `var()` refs in `globals.css` | — | 0 (was 1) | D3 — **fixed** |
| OS-reactive `@media (prefers-color-scheme)` blocks in `globals.css` | — | 0 (was 2) | D2 class — **fixed** |

**Read this as:** ~250 files carry per-usage theme risk that could be per-component risk; 299 files
carry a second theming system that is one call away from diverging from the first; 18,463 utilities
carry zero information because they cannot render.

---

## 6. Live defects to fix

| # | Defect | Evidence | Severity |
|---|---|---|---|
| D1 | `attribute="data-theme"` vs `@custom-variant dark (&:is(.dark *))` — dark variants unreachable | §2 | **Critical** |
| D2 | `enableColorScheme` makes UA chrome follow the OS while the app stays light | §3 | **High** |
| D3 | ~~`var(--indigo-700)` used but defined nowhere~~ — it is a **typo**: the file defines `--color-indigo-700` ("Indigo for secondary actions"), not `--indigo-700`. An undefined `var()` with no fallback made the declaration invalid at computed-value time, so `color` silently became `inherit` for all inputs/selects/textareas whenever the OS was dark | `globals.css` (was line 237) | **Resolved** |
| D4 | `storageKey` collision: `hooks/useTheme.ts:18` writes `localStorage['theme']`, next-themes' own key. If that hook is ever mounted it will pin the theme and fight next-themes | `hooks/useTheme.ts:18` vs §2 | Medium (latent) |
| D5 | Three theme mechanisms, two `MantineProvider`s, one unused toggle — no single source of truth | §4 | Medium |
| D6 | `!important` colour rules in `globals.css` that fight Tailwind (`:209`, `:223`, `:237`, `:328-329`) | §3, §4 | Medium |
| D7 | Mantine's colour scheme is light by **default**, bound to no signal — one `setColorScheme` call, Mantine toggle, or `mantine-color-scheme-value` write flips 299 files to dark while Tailwind stays light | §4 | Medium (latent, wide) |
| D8 | No theme toggle is reachable, so `"system"` can never be overridden by a user | §4 | Low/Product |
| D9 | An `@media (prefers-color-scheme: dark)` block darkened `--border` (`:root`) whenever the OS was dark, while its own comment claimed "force light mode only". Consumed by `border-border/*` utilities — same OS-leak class as D2 | `globals.css` (was lines 161-166) | **Resolved** |

---

## 7. Decision required before any code

Pick a direction in Phase 0. Both are defensible; the cost profile differs sharply.

**Direction A — Make dark mode real.**
Set `attribute="class"` (and reconcile `value`/`enableColorScheme`), then sweep ~620 files to
verify contrast. Unlocks 18,463 existing `dark:` utilities — but every one of them has been
**unrendered since it was written**, so they are unvalidated by definition. Expect a long tail of
low-contrast panels, invisible icons, and white-background images.

**Direction B — Declare light-only, remove the ambiguity.**
Pin `color-scheme: light` at the root, make next-themes and Mantine explicitly light (Mantine via
`forceColorScheme="light"`), and delete the dead `dark:`/`.dark` code (or quarantine it). Far
smaller blast radius, and it makes the app's actual behaviour match its declared behaviour. Cost:
18k utilities to strip (or leave, with the decision documented), and no dark mode.

> Recommendation: **B for this sprint**, because the app is light in practice and the mitigation
> already assumes light. Choose **A** only if dark mode is a committed product goal — in which case
> scope it as its own multi-sprint effort and do the inventory in §8 first.

---

## 8. Edge-case inventory

Every surface below needs an explicit decision + verification, per direction. This is the ledger
that §9 exists to shrink.

**UA-drawn chrome** (follows the OS regardless of app theme — the D2 class):
- `<select>` popups — mitigated for selects only
- `input[type=date|time|datetime-local|month|week]` pickers — e.g. both date fields in
  `components/marketing-ops/LogContactModal.tsx`
- checkbox / radio internals, range sliders, `<progress>`, `<meter>`, file-input buttons
- **scrollbars** (app-wide)
- autofill styling, native validation bubbles

**Third-party theming (independent signals):**
- Mantine (299 files): `Drawer`, `Menu`, `Select`, `Pagination`, `Notifications`, `ModalsProvider`
- BlockNote / `@blocknote/mantine` editor
- Leaflet map tiles + popups — **static import scan found none; confirm how maps are loaded**

**Content, not chrome:**
- Images, logos, partner badges with baked white backgrounds
- Charts / canvas / SVG surfaces — **inventory required**
- Generated QR codes and seed report **PDF** (`GET …/report-pdf`) — server-rendered; must remain
  theme-independent
- Transactional **email** HTML — must never follow a client theme
- Public customer surfaces (`/directory`, `/place`, `/g`, `/preview`) — may warrant a different
  policy from admin; decide explicitly rather than inheriting

**Framework/hydration:**
- next-themes' inline script + `suppressHydrationWarning` — FOUC and hydration-mismatch surface
- `disableTransitionOnChange` is unset → flash-of-transition on any toggle
- Root `bg-white text-neutral-900` on `<html>` (`layout.tsx:133`) fights any dark theme

---

## 9. Reduction goals & deprecation plan

**Principle:** convert *per-usage* risk into *per-component* risk, and collapse duplicate sources
of truth to one. Every row below is a measurable target, not a sentiment.

### 9.1 Measurable targets

| Metric | Now | Target | How |
|---|---:|---:|---|
| Theme mechanisms | 3 | **1** | Deprecate `ThemeContext`, `hooks/useTheme.ts`, unused `ThemeToggle` |
| `MantineProvider` instances | 2 | **1** | Collapse; wire `colorScheme` to the one signal |
| Theme storage keys written | 3 | **1** | Eliminate `rvp-theme` and `mantine-color-scheme-value`; keep one (D4) |
| Undefined `var()` refs | 1 | **0** | Fix or delete `globals.css:237` (D3) |
| `!important` colour rules | 4 | **0** | Replace with scoped utilities (D6) |
| Native `<select>` call sites outside a shared wrapper | 430 | **0** | One `<Select>` wrapper owns UA policy |
| Native `<option>` sites outside the wrapper | 1,327 | **0** | Follows from the above |
| Native date/time inputs outside a shared wrapper | 51 | **0** | One `<DateInput>` wrapper |
| Native `<input type="checkbox">` outside a shared wrapper | 186 | **0** | One `<Checkbox>` wrapper |
| `dark:` utilities | 18,463 | **0** (B) / **validated** (A) | Codemod + purge, or sweep |
| Mantine colour scheme bound to the app signal | no (light by default) | **yes** | `forceColorScheme` + `cssVariablesResolver` (R2) |
| `@mantine/*` call sites | 355 | **awareness metric** | Tracked so a competing design language doesn't become the default — *not* a target to drive to zero (R3) |

### 9.2 Ranked deprecations (debt removed ÷ effort)

**R1 — Collapse the theme mechanisms 3 → 1.** *Effort: S.* Delete `contexts/ThemeContext.tsx` and
`hooks/useTheme.ts` (both unimported), delete or repurpose `components/ui/ThemeToggle.tsx`, make
the surviving provider explicit about `attribute`/`storageKey`/`enableColorScheme`. Removes D4, D5
and the last place that could write a competing theme key. **Do this first — it's nearly free and
it removes the ability to re-introduce the bug.**

**R2 — Collapse to one `MantineProvider`, and bind its colour scheme to the app signal.**
*Effort: S-M.* Highest leverage per line changed in the entire list: one provider prop covers 299
files. Concretely, in Mantine 9.6.1:

- `forceColorScheme={resolvedTheme}` — Mantine follows the app instead of holding its own opinion.
  `forceColorScheme` also disables Mantine's colour-scheme manager, which is what we want: no third
  storage key, and no independent toggle that could drift.
- `cssVariablesResolver` — map Mantine's `--mantine-color-*` onto the same values as the Tailwind
  tokens, so the two systems share **one palette** rather than two that happen to look alike.
- Drop the second provider (`PlatformThemeProvider` or the one inside `ThemeProvider`) so there is
  exactly one place where theming is decided.

**R3 — Keep Mantine; integrate it rather than deprecate it.** *Decision: reversed from the first
draft of this spec.* Mantine earns its place — component variants, `Menu`, `Drawer`,
`Notifications`, `ModalsProvider` are real UI value, and `@blocknote/mantine` (the rich-text editor)
inherits Mantine's colour scheme, so binding Mantine binds the editor for free. Deprecating it would
be a rewrite with **no theme payoff**: the debt was never "Mantine exists", it was "Mantine's axis
was never bound".

The honest residual cost of keeping it: two token systems and two component philosophies to satisfy
on every future theme change, across 299 files. That is a **recurring tax, not a defect** — the
mitigation is R2 (one palette, one signal) plus the §11 guards, not removal.

**R4 — One shared form-control layer.** *Effort: M (codemod for simple cases + manual for the
rest).* A single `<Select>`, `<DateInput>`, `<Checkbox>` wrapper owns the `color-scheme`/UA-chrome
policy. This is where §8 actually shrinks: 430 + 1,327 + 51 + 186 per-usage risks become ~3
components to verify. Pairs directly with the mitigation already shipped.

**R5 — Delete the `!important` colour rules and the undefined var.** *Effort: S.* D3 + D6, and it
hands colour back to Tailwind so future work isn't fighting a global override.

**R6 — Purge or validate the 18,463 `dark:` utilities.** *Effort: M (scripted purge) / XL
(validation).* Direction B makes this a codemod; Direction A makes it the bulk of the sprint.

**R7 — One theme policy for public vs admin.** *Effort: S (decision) + M (apply).* Reduces the
policy surface from "two products" to one, and stops public surfaces silently inheriting admin
decisions.

**R8 — Long-tail surfaces.** BlockNote (1 file), QR (1 file), maps (verify). *Effort: S each.*
Decide per-surface; low count, so handle last.

### 9.3 Deprecation criteria

A surface or mechanism may be deleted only when all four hold:

1. No imports anywhere in `apps/web/src` (verified by scan, not by eye).
2. No writes to any theme storage key or the `class`/`data-theme` attribute.
3. The static guards in §11 pass.
4. Its §8 row carries recorded evidence (screenshot or test).

**Guardrail:** new native form controls and new `dark:` utilities should be blocked by lint once
R4/R6 land, so the debt cannot grow back faster than it is retired.

---

## 10. Phased plan

**Phase 0 — Decide & freeze (no UI change)**
- Choose Direction A or B (§7); record it in this doc.
- Decide the fate of the inert `.dark select …` rules and of the 18k `dark:` utilities.
- Add the §11 guards, and a baseline snapshot of the §5 ledger.

**Phase 1 — One theme system (R1, R2, R5, D3)**
- Make the mounted provider explicit: `attribute`, `defaultTheme`, `storageKey`, `enableColorScheme`.
- Delete/quarantine `contexts/ThemeContext.tsx` + `hooks/useTheme.ts`; remove the key collision.
- Collapse to a single `MantineProvider`; bind it with `forceColorScheme` + `cssVariablesResolver`.
- Fix `--indigo-700`; retire the `!important` colour rules.
- Direction B: pin `color-scheme: light` at the root and make Mantine light explicitly.

**Phase 2 — Stop the UA-chrome leak (R4 part 1)**
- Apply the `color-scheme` policy uniformly (root-level for B, per-surface for A).

**Phase 3 — Form-control consolidation (R4)**
- Introduce the shared `<Select>` / `<DateInput>` / `<Checkbox>` wrappers; migrate by area.
- This is the phase that moves the §5 counts.

**Phase 4 — Surface sweep + purge (R6, R7)**
- Walk §8 area by area (admin → marketing-ops → public directory → customer portal), with a written
  acceptance note per area. Public surfaces last.
- Direction B: strip/quarantine dead `dark:` and `.dark` code.
- Direction A: validate every `dark:` utility written blind.
- Verify PDF + email output is byte-identical before/after.

**Phase 5 — Hardening & lock-in**
- FOUC + toggle-transition polish; contrast/a11y audit; visual regression coverage.
- Enable the R6 guardrail lint so the retired patterns can't return.

**R3 is a decision, not a workstream:** Mantine stays. The work is R2's binding plus the awareness
metric in §9.1.

---

## 11. Verification & regression guards

- **Static guard:** fail when a theme signal is written without matching the declared variant
  strategy (e.g. a `data-theme` write while the variant is `class`-based). This is the check that
  would have caught D1 on day one.
- **Forbidden-pattern lint:** `var(--…)` referenced but never defined (D3); `!important` colour
  declarations in `globals.css` (D6); new native form controls outside the R4 wrappers.
- **Storage-key test:** assert exactly one theme storage key is written anywhere in `apps/web/src`.
- **Ledger snapshot:** re-run the §5 scan in CI and fail on regression of any §9.1 metric.
- **Surface matrix:** for each §8 row, record direction, status, and evidence. The sprint is not
  done until every row has one.
- **Server-output check:** snapshot the seed report PDF and a transactional email; assert no diff.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Direction A reveals hundreds of low-contrast defects | Timebox the sweep; ship per-area; keep the light path untouched as the default |
| Public/customer surfaces regress | Sweep them last, behind an explicit per-surface decision |
| PDF/email accidentally inherit a client theme | Server-render check in §11 |
| Third-party libs (Mantine/BlockNote/Leaflet) disagree with the chosen signal | Wire them in Phase 1, before any sweep |
| The 18k `dark:` utilities are treated as "already done" | Phase 0 explicitly records that they are unvalidated |
| Debt regrows via new native controls / new `dark:` usage | R6 guardrail lint (§9.3) |
| A Mantine colour-scheme toggle or `setColorScheme` call lands later and silently flips 299 files to dark while Tailwind stays light | R2 binds Mantine via `forceColorScheme`, which disables its colour-scheme manager; §11 storage-key test |
| Keeping Mantine means two token systems to satisfy on every theme change | Accepted recurring cost; R2's `cssVariablesResolver` yields one palette, and the §11 ledger snapshot catches drift |

**Rollback:** every phase is revertible independently. The shipped mitigation (§3) is
self-contained and can stay regardless of direction.

---

## 13. Non-goals

- Redesigning any surface's look in either theme.
- Adding user-facing theme customisation (accent colours, per-tenant themes).
- **Deprecating Mantine.** It is a valued component library and it stays; the goal is to *bind* it
  to the single theme signal (R2), not to remove it.
- Touching `apps/api` rendering beyond the verification checks in §11.

---

## 14. Verification log

Established by reading code, not by rendering:

- next-themes v0.4.6 defaults read from `node_modules/next-themes/dist/index.mjs`.
- `<ThemeProvider>` mounted prop-less at `ClientRootLayout.tsx:32`.
- `@custom-variant dark (&:is(.dark *))` at `globals.css:6`.
- `ThemeContext` / `useTheme` imported nowhere; `ThemeToggle` never rendered (repo-wide grep).
- `--indigo-700` was the **only** undefined `var()` reference in `globals.css` (scan: 42 distinct
  refs, 161 defined vars) — now **0**, see the closing-session note below.
- Mantine 9.6.1 defaults read from `esm/core/MantineProvider/MantineProvider.mjs`:
  `colorSchemeManager = localStorageColorSchemeManager()`, `defaultColorScheme = "light"`.
- No `setColorScheme` / `useMantineColorScheme` / `colorScheme=` usage anywhere in `apps/web/src`,
  and nothing writes `mantine-color-scheme-value`.
- `globals.css:2` imports `@mantine/core/styles.css` — both token systems share one cascade.
- §5 counts produced by a static scan over `apps/web/src` (`*.ts`/`*.tsx`) + `globals.css`.

**Still needs browser verification (do not treat as settled):**
- Whether Mantine components visibly go dark in OS-dark today. **Expected: no** — Mantine defaults
  to `"light"` and nothing sets it. Worth confirming, because the opposite result would mean
  something *is* writing its colour scheme.
- Exact Firefox popup behaviour with `color-scheme` set on the control vs inherited from the root.
- Whether any surface currently *depends* on the UA dark palette for legibility.
- How Leaflet is loaded (no static imports found).

### Closing-session follow-up (shipped alongside this doc)

Two OS-reactive blocks were removed from `globals.css`, both of which were labelled as inactive but
were live:

- **D3 fixed.** The form-control block keying `color` to `prefers-color-scheme` was **deleted, not
  repointed** at `--color-indigo-700` — the premise (letting the OS preference colour form controls
  in a class-based light app) is the same bug being fixed, so preserving the behaviour would have
  preserved the defect.
- **D9 fixed.** The block that darkened `--border` in OS-dark was deleted.
- `globals.css` now has **0** undefined `var()` refs, **0** `prefers-color-scheme` blocks, and
  **9** `!important` declarations (down from 11). Brace balance verified 0 after both removals.
- The inert `.dark select …` rules were **kept and annotated** — see the Phase 0 decision in §3.

**Not done, deliberately:** the `!important` colour rules at the top of the form-input section
(`globals.css:209`, `:223`) were left in place. They are the reason the popup text was dark in the
first place, but they are also load-bearing for legibility across the app, so removing them is a
D6/R5 sprint item with a surface sweep — not a closing-session change.
