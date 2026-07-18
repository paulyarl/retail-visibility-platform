# QR Settings UX Reorganization — Sprint Plan

## Problem

The Tenant QR settings page (`/t/[tenantId]/settings/storefront-qr`) has poor option ordering and no collapsible organization. Settings are crammed into 3 flat cards with no progressive disclosure:

**Current card structure (top to bottom):**
1. **Card "QR Code Display"**: Gate toggle → Resolution → Display Surfaces → Analytics → Logo + Logo Shape
2. **Card "QR Code Style"**: Classic vs Styled radio selection
3. **Card "QR Styling Options"**: Dot Style → Corner Style → Corner Dot Style → Custom Colors → Gradients

**Issues:**
- Style selection (Classic/Styled) appears *after* display options instead of before — backwards from consumer mental model
- Styling options (Dot, Corner, Colors, Gradient) are disconnected from the Style selection that gates them
- Logo and Logo Shape are buried at the bottom of the Display card, separated from styling context
- Resolution and Display Surfaces are between the gate and the style — too high in the hierarchy
- Analytics is mid-card instead of at the end
- No progressive disclosure — all options visible at once, overwhelming for merchants who only want classic QR codes
- No visual hierarchy distinguishing "decision" sections from "configuration" sections

## Desired Structure (Top to Bottom)

```
┌─────────────────────────────────────┐
│  Gate Switch (standalone card)      │  ← Always visible, master toggle
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Style (Classic or Styled)        │  ← Accordion, open by default
│    [Classic]  [Styled]              │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Styling Options                  │  ← Accordion, only when Styled active
│    Dot Style | Corner Style |       │
│    Corner Dot | Custom Colors |     │
│    Gradient                        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Logo                             │  ← Accordion
│    Toggle + Logo Shape              │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Resolution                       │  ← Accordion
│    512px | 1024px | 2048px          │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Display Surfaces                 │  ← Accordion
│    Product QR | Store QR | Dir QR   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Analytics                        │  ← Accordion
│    Toggle + Dashboard link          │
└─────────────────────────────────────┘
```

## Design Decisions

### Accordion Component
- **Component**: Use existing Radix-based `Accordion` at `@/components/ui/Accordion` (already in codebase)
- **Mode**: `type="multiple"` — users can open several sections simultaneously (not single-open)
- **Default open**: Style section open by default (primary decision point). All others closed.
- **Styling Options section**: Conditionally rendered only when `qr_styled_enabled` is true AND `tierStyledEnabled` is true. Hidden entirely for classic-only tiers.
- **Chevron indicator**: Radix AccordionTrigger already renders a ChevronDown that rotates 180° on open

### Gate Switch
- Stays as a standalone Card (not in accordion) — always visible, always at top
- When gate is OFF: accordion card is hidden entirely (same as current `isTierEnabled` guard)
- When gate is ON: accordion card appears below

### Section Badge Hints
Each accordion trigger shows a small summary badge on the right (next to chevron) indicating current state:
- **Style**: "Classic" or "Styled" badge
- **Styling Options**: dot style name (e.g., "Rounded")
- **Logo**: "On" or "Off"
- **Resolution**: current resolution (e.g., "1024px")
- **Display Surfaces**: count of enabled surfaces (e.g., "2 of 3")
- **Analytics**: "On" or "Off"

This lets merchants see their current config at a glance without expanding sections.

### Tier-Locked Sections
- Sections with tier-locked features show a Lock icon in the accordion trigger
- Trigger is still clickable to expand, but inner controls are disabled with lock indicators (same as current behavior)
- Styling Options section: completely hidden if `tierStyledEnabled` is false (not just locked)

### Preview Pane
- Right column preview pane (`QrPreviewPane`) stays unchanged — already works with live settings
- Save button stays in right column below preview

### What's NOT Changing
- No backend/API changes
- No schema changes
- No capability/resolver changes
- No new dependencies (Accordion component already exists)
- All tier gating logic, settings keys, save flow, and preview generation remain identical
- `QrPreviewPane.tsx` — unchanged
- `page.tsx` — unchanged

## Sprint Breakdown

### Sprint 1: Accordion Reorganization (Single Sprint)

**Scope**: Reorganize `StorefrontQrSettingsClient.tsx` from 3 flat cards into gate card + accordion sections. Single file change.

**Tasks**:

1. **Add Accordion import** — Import `Accordion, AccordionItem, AccordionTrigger, AccordionContent` from `@/components/ui/Accordion`

2. **Gate switch card** — Extract the master toggle into its own standalone Card (always visible when `isTierEnabled`). Remove Resolution, Display Surfaces, Analytics, and Logo from this card.

3. **Accordion card wrapper** — Wrap all remaining sections in a single `<Card>` containing an `<Accordion type="multiple" defaultValue={["style"]}>`

4. **Section: Style** (AccordionItem value="style") — Move the Classic vs Styled radio selection here. Open by default. Add summary badge showing "Classic" or "Styled".

5. **Section: Styling Options** (AccordionItem value="styling") — Move Dot Style, Corner Style, Corner Dot Style, Custom Colors, and Gradient here. Conditionally render only when `tierStyledEnabled && settings.qr_styled_enabled`. Add summary badge showing current dot style name.

6. **Section: Logo** (AccordionItem value="logo") — Move the Logo toggle and Logo Shape selector here. Add summary badge showing "On" or "Off".

7. **Section: Resolution** (AccordionItem value="resolution") — Move the 512/1024/2048 radio selection here. Add summary badge showing current resolution.

8. **Section: Display Surfaces** (AccordionItem value="surfaces") — Move Product QR / Store QR / Directory QR toggles here. Add summary badge showing enabled count (e.g., "2 of 3").

9. **Section: Analytics** (AccordionItem value="analytics") — Move the QR Analytics toggle and dashboard link here. Add summary badge showing "On" or "Off". Add Lock icon to trigger if `!canUseQrAnalytics`.

10. **Summary badge component** — Create a small inline helper component `SectionBadge` that renders a neutral pill with the current value. Keeps the accordion triggers informative without expanding.

11. **Remove old card structure** — Delete the 3 separate Card components and replace with the new gate card + accordion card.

12. **Verify** — Run `pnpm checkweb` for zero TS errors. Manually verify:
    - Gate toggle works standalone
    - All accordion sections expand/collapse
    - Style section is open by default
    - Styling Options section appears/disappears when switching Classic/Styled
    - All tier gating still works (locked controls disabled, lock icons visible)
    - Preview pane updates live as before
    - Save button works
    - "What's Next" section still appears at bottom

**Files touched**:
- `apps/web/src/app/t/[tenantId]/settings/storefront-qr/StorefrontQrSettingsClient.tsx` (modified — reorganized)

**Files NOT touched**:
- `QrPreviewPane.tsx` — unchanged
- `page.tsx` — unchanged
- No backend files
- No schema/migration files

**Estimated effort**: ~1-2 hours. Single file, ~850 lines. The change is structural reorganization — no new logic, no new data, no new API calls.

---

## Sprint 2: Shared QR Constants & Components Extraction

**Scope**: Extract duplicated QR style constants and `SectionBadge` into shared modules so Sprints 3-5 can reuse them.

**Problem**: `DOT_STYLES`, `CORNER_STYLES`, `CORNER_DOT_STYLES` arrays are copy-pasted across 3 files:
- `StorefrontQrSettingsClient.tsx` (Sprint 1)
- `QRGeneratorClient.tsx` (Sprint 3)
- `PrivateFeatureGrantDialog.tsx` (Sprint 4)

The `SectionBadge` component added in Sprint 1 is inline and not reusable.

**Tasks**:

1. **Create `apps/web/src/lib/qr-style-constants.ts`** — Export `DOT_STYLES`, `CORNER_STYLES`, `CORNER_DOT_STYLES`, `RESOLUTIONS` (and `SIZE_OPTIONS` from QRGeneratorClient). Single source of truth.

2. **Create `apps/web/src/components/qr/SectionBadge.tsx`** — Extract the inline `SectionBadge` from Sprint 1 into a reusable component. Same neutral pill styling.

3. **Update `StorefrontQrSettingsClient.tsx`** — Import from shared modules instead of inline definitions.

4. **Update `QRGeneratorClient.tsx`** — Import from shared modules.

5. **Update `PrivateFeatureGrantDialog.tsx`** — Import from shared modules.

6. **Verify** — `pnpm checkweb` zero TS errors. No visual changes — pure refactor.

**Files touched**:
- `apps/web/src/lib/qr-style-constants.ts` (NEW)
- `apps/web/src/components/qr/SectionBadge.tsx` (NEW)
- `apps/web/src/app/t/[tenantId]/settings/storefront-qr/StorefrontQrSettingsClient.tsx` (import change)
- `apps/web/src/app/(platform)/settings/admin/qr-generator/QRGeneratorClient.tsx` (import change)
- `apps/web/src/admin/components/PrivateFeatureGrantDialog.tsx` (import change)

**Estimated effort**: ~30 min. Mechanical extraction, no logic changes.

---

## Sprint 3: Admin QR Generator Accordion

**Scope**: Reorganize `QRGeneratorClient.tsx` styling controls from a flat wall into accordion sections.

**Current structure** (right column, 586 lines):
- Templates grid (flat)
- "QR Styling" panel containing: Dot Style → Corner Style → Corner Dot Style → Custom Colors toggle + pickers → Gradient toggle + pickers → Logo Overlay input + shape

**Problem**: The styling panel is a single flat `div` with ~200 lines of controls. No progressive disclosure. Users who just want a quick QR code with a template are overwhelmed.

**Desired structure**:
```
┌─────────────────────────────────────┐
│  Target URL input (standalone)      │  ← Always visible
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Live Preview + Size selector       │  ← Always visible
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Templates                        │  ← Accordion, open by default
│    [Template grid]                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Dot Style                        │  ← Accordion
│    [Style grid]                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Corner Style                     │  ← Accordion
│    [Style grid]                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Corner Dot Style                 │  ← Accordion
│    [Style grid]                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Custom Colors                    │  ← Accordion
│    Toggle + color pickers           │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Gradient                         │  ← Accordion
│    Toggle + color pickers + targets │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ▸ Logo                             │  ← Accordion
│    URL input + shape selector       │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Download PNG | Download SVG        │  ← Always visible
└─────────────────────────────────────┘
```

**Tasks**:

1. **Import Accordion + SectionBadge** — From shared modules (Sprint 2).

2. **Wrap styling controls in Accordion** — Replace the flat `div` styling panel with `<Accordion type="multiple" defaultValue={["templates"]}>`.

3. **Section: Templates** (value="templates") — Move template grid here. Open by default. Badge: current template name.

4. **Section: Dot Style** (value="dot") — Badge: current dot style label.

5. **Section: Corner Style** (value="corner") — Badge: current corner style label.

6. **Section: Corner Dot Style** (value="corner-dot") — Badge: current corner dot style label.

7. **Section: Custom Colors** (value="colors") — Badge: "On" or "Off".

8. **Section: Gradient** (value="gradient") — Badge: "On" or "Off".

9. **Section: Logo** (value="logo") — Badge: "Set" or "None".

10. **Keep URL input, preview, and download buttons outside accordion** — These are primary actions, always visible.

11. **Verify** — `pnpm checkweb`. Test that template selection still applies defaults to all styling controls. Test PNG/SVG download still works.

**Files touched**:
- `apps/web/src/app/(platform)/settings/admin/qr-generator/QRGeneratorClient.tsx` (reorganized)

**Estimated effort**: ~1-2 hours. Single file, ~586 lines. Structural reorganization.

---

## Sprint 4: Private Feature Grant Dialog Collapsible Styling

**Scope**: Collapse the styling controls section in `PrivateFeatureGrantDialog.tsx` so the modal isn't overwhelmingly tall.

**Current structure** (658 lines, modal dialog):
- Form fields: Feature selector, Tenant selector, Duration, Max Claims, QR Expiry
- Generate button
- After generation: QR preview, Template selector, **full styling controls panel** (Dot/Corner/CornerDot/Colors/Gradient — ~150 lines flat), Feature info, Grant URL, Grant Token, Expiry

**Problem**: The styling controls section is ~150 lines of flat controls inside an already tall modal. The dialog requires excessive scrolling. The styling controls are secondary to the primary purpose (creating a grant token).

**Desired structure**:
```
┌──────────────────────────────────────────┐
│  Create Grant QR Code                    │
├──────────────────────────────────────────┤
│  [Form fields: Feature, Tenant, etc.]    │  ← Always visible
│  [Generate button]                       │
├──────────────────────────────────────────┤
│  [QR Preview]                            │  ← Always visible after generation
│  [Template selector]                     │  ← Always visible
├──────────────────────────────────────────┤
│  ▸ Advanced Styling (collapsed)          │  ← Accordion, closed by default
│    Dot Style | Corner Style | Corner Dot │
│    Custom Colors | Gradient              │
├──────────────────────────────────────────┤
│  [Feature info, Grant URL, Token, Expiry]│  ← Always visible
├──────────────────────────────────────────┤
│  Download PNG | SVG | Close              │
└──────────────────────────────────────────┘
```

**Tasks**:

1. **Import Accordion + SectionBadge** — From shared modules (Sprint 2).

2. **Wrap styling controls in collapsible** — Wrap the Dot/Corner/CornerDot/Colors/Gradient section in a single `AccordionItem` with value="advanced-styling". Default collapsed.

3. **Trigger label**: "Advanced Styling" with SectionBadge showing dot style name. Chevron indicates expandability.

4. **Keep template selector outside the collapsible** — Templates are the primary styling choice; full customization is secondary.

5. **Keep form fields, preview, URL/token info, and download buttons outside** — These are primary content.

6. **Verify** — `pnpm checkweb`. Test that styling changes still update the QR preview live. Test template application still works.

**Files touched**:
- `apps/web/src/admin/components/PrivateFeatureGrantDialog.tsx` (reorganized)

**Estimated effort**: ~1 hour. Single file, wrapping existing controls in collapsible.

---

## Sprint 5: Promo Code QR Dialog Enhancement (Optional)

**Scope**: Add optional full styling controls to `PromoCodeQRDialog.tsx` behind a collapsible section.

**Current structure** (269 lines, modal dialog):
- QR preview, Template selector (theme presets only), Promo code, Deep link URL, Target info, Discount info, Download buttons

**Problem**: Only template selection is available — no individual styling controls. Less capable than the other QR surfaces. However, this is intentionally simpler since promo QR codes are template-driven.

**Tasks**:

1. **Add collapsible "Customize Styling" section** — Below template selector, collapsed by default. Contains Dot Style, Corner Style, Corner Dot Style, Custom Colors, Gradient (reusing shared constants from Sprint 2).

2. **Wire styling state to QR generation** — Currently `generateQrInstance` only receives `template`. Add individual styling params when customization is expanded.

3. **Badge on trigger**: "Default" when no custom styling applied, "Custom" when any non-default value set.

4. **Verify** — `pnpm checkweb`. Test that template selection still works. Test that custom styling overrides template defaults.

**Files touched**:
- `apps/web/src/admin/components/PromoCodeQRDialog.tsx` (enhanced)

**Estimated effort**: ~1-2 hours. Adding new state + controls + wiring to QR engine.

**Priority**: Lower than Sprints 2-4. This dialog is intentionally simpler. Only do if merchants request more control over promo QR appearance.

---

## Sprint 6: Product QR Code Generator Cleanup (Optional)

**Scope**: Minor UX refinement for `QRCodeGenerator.tsx` (product-level QR component).

**Current structure** (287 lines, inline component):
- Canvas QR preview, Download/Print buttons, Tier info text at bottom

**Problem**: Uses legacy `getQRFeatures()` switch-case instead of the capability system. Tier info is flat text at the bottom. No styled QR support (always `styled: false`).

**Tasks**:

1. **Migrate to capability system** — Replace `getQRFeatures(tierId)` switch-case with `useStorefrontQrCapability(tenantId)` hook. Remove `useTenantTier` dependency.

2. **Add styled QR support** — If tier allows styled QR, pass `styled: true` with the tenant's QR settings (dot type, colors, etc.) to `generateQrDataUrl`.

3. **Collapsible tier info** — Move the "Resolution: 512x512px" and upgrade prompts into a small info popover or collapsible section instead of flat text.

4. **Verify** — `pnpm checkweb`. Test that QR generation still works. Test that tier gating is now driven by capability system.

**Files touched**:
- `apps/web/src/components/items/QRCodeGenerator.tsx` (refactored)

**Estimated effort**: ~2-3 hours. Capability migration + styled QR wiring.

**Priority**: Lowest. This component is used in a specific product context and works adequately. The capability migration is technically valuable but not user-facing UX.

---

## Cross-Sprint Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Accordion animation CSS missing | Low | Radix Accordion uses `data-[state=open]` classes already in component; Tailwind animate classes may need adding |
| Summary badges show stale values | Low | Badges read from state which updates synchronously |
| Styled section flash on toggle | Low | Conditionally render entire AccordionItem, not just content |
| Mobile layout issues | Low | Accordion is inherently mobile-friendly; test grid breakpoints |
| Shared constants break consumers | Low | Sprint 2 is pure extraction — same values, same export names |
| Modal dialog accordion scroll issues (Sprint 4) | Medium | Test `max-h-[90vh] overflow-y-auto` with collapsed vs expanded states |
| Promo QR dialog becomes too complex (Sprint 5) | Low | Keep collapsed by default; template-only is still the primary path |

## Global Acceptance Criteria

- [ ] **Sprint 1**: StorefrontQrSettingsClient accordion reorganized (gate + 7 sections)
- [ ] **Sprint 2**: Shared `qr-style-constants.ts` + `SectionBadge` component extracted
- [ ] **Sprint 3**: QRGeneratorClient styling controls in accordion (7 sections)
- [ ] **Sprint 4**: PrivateFeatureGrantDialog styling controls collapsed by default
- [ ] **Sprint 5** (optional): PromoCodeQRDialog gains optional styling controls
- [ ] **Sprint 6** (optional): QRCodeGenerator migrated to capability system + styled QR
- [ ] Zero TS errors on `pnpm checkweb` across all sprints
- [ ] No backend, schema, or API changes in any sprint
- [ ] All QR previews update live regardless of accordion open/closed state
- [ ] All download/export functionality preserved

## Sprint Priority Order

1. **Sprint 1** (in progress) — StorefrontQrSettingsClient accordion
2. **Sprint 2** — Shared constants extraction (enables Sprints 3-5)
3. **Sprint 3** — Admin QR Generator accordion
4. **Sprint 4** — Private Feature Grant Dialog collapsible
5. **Sprint 5** (optional) — Promo Code QR Dialog enhancement
6. **Sprint 6** (optional) — Product QR Code Generator cleanup
