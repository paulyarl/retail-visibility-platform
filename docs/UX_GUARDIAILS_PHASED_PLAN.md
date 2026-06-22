# Frontend UX Guardrails — Phased Plan

Source skill: `.agents/skills/skill-frontend-ux-guardrails/SKILL.md`

## Goal

Apply the UX guardrails as a quality gate across the platform so that every app surface is responsive, scannable, state-aware, and visually stable.

## Phase 1 — Surface Inventory & Audit

Read-only discovery. Map the product surface, layout primitives, design tokens, and obvious pain points.

- List all top-level routes in `apps/web/src/app` and `apps/web/src/pages` (Next.js app vs legacy pages).
- Identify shared layout primitives: sidebars, headers, modals, tables, cards, filters, drawers, toasts.
- Capture design tokens: Tailwind theme, spacing scale, breakpoints, colors, typography, z-index.
- Find repeated components that likely cause instability: `DataTable`, metric cards, Kanban, filters, chat widgets.
- Document any known hot spots from recent memory (CRM admin, bot merchant/admin, tenant dashboard, navigation, checkout).
- Deliverable: `docs/UX_AUDIT_PHASE1.md` with route table, component heat map, and candidate screens.

## Phase 2 — Task Definition & Clutter Removal

Per screen, define the primary user task and remove/demote UI that does not support it.

- Pick high-impact screens from Phase 1.
- For each screen, state the primary user task and secondary tasks.
- Identify redundant CTAs, duplicated filters, unused tabs, low-value empty states, and hidden actions.
- Deliverable: `docs/UX_AUDIT_PHASE2.md` with primary tasks and a prioritized list of changes per screen.

## Phase 3 — Layout Stability Fixes

Fix overflow, wrapping, spacing, sticky areas, table widths, modal heights, and action placement.

- Test at 320px, 390px, 768px, 1024px, 1440px.
- Eliminate unintended horizontal page overflow.
- Stabilize metric cards, charts, tables, sidebars, toolbars, and status chips.
- Make tables degrade intentionally on small screens.
- Fix modal/drawer safe areas and sticky headers.
- Deliverable: code changes + viewport checklist.

## Phase 4 — State & Copy Validation

Validate every user-visible state touched by the change.

- Loading, empty, error, disabled, success, pending, selected, hover, focus, destructive confirmation.
- Check copy for spelling, accents, encoding, product terms, and casing.
- Ensure error messages are actionable and empty states have a next step.
- Deliverable: per-screen state matrix.

## Phase 5 — Accessibility & Interaction Polish

Keyboard focus, visible focus styles, hover-vs-touch, and safe action placement.

- Verify focus order for forms, menus, dialogs, and table actions.
- Ensure visible focus styles are not clipped or low contrast.
- Do not hide critical actions behind hover only on touch layouts.
- Deliverable: accessibility fixes and notes.

## Phase 6 — Verification & Residual Risk

Run the lightest meaningful verification and report residual risk.

- `pnpm checkweb` or `pnpm tsc` in `apps/web`.
- Build or lint if available.
- Browser screenshots at the tested viewports.
- Report any remaining visual risk and the viewports tested.
- Deliverable: final summary and sign-off.
