# Digital Product Rich Content Editor — Sprint Plan

**Goal:** Deliver a block-based rich content editor for digital (and hybrid) products that is supported by, and aligned with, both current creation pipelines — the `ItemCreationWizard` and the `EditItemModal` — and renders on the public product page.

**Strategic anchor:** This is **Option B** from `DIGITAL_PRODUCT_CONTENT_EDITOR_ANALYSIS.md`. It is intentionally not a full page builder; it upgrades the **content/description experience** while leaving product gallery, hero `video_url`, and digital delivery assets untouched.

---

## 1. Success Criteria

1. Merchants can compose digital-product descriptions with interleaved text, headings, lists, inline photos, embedded/inline videos, buttons, button pills, and icons in both the wizard and the item modal.
2. The same content renders on the public `ProductDetailTabs` and `ProductDigitalLayout` without breaking existing plain-text products.
3. Existing `description`, `enhanced_description`, `image_url`, `image_gallery`, `video_url`, and `digital_assets` continue to work unchanged.
4. `metadata.content_blocks` becomes the single source of truth for rich marketing content on digital/hybrid products.
5. The capability is gated behind a feature so it can be tiered/rolled-out safely.
6. `pnpm checkapi` and `pnpm checkweb` pass at the end of every sprint.

---

## 2. Sprint Overview (4 × 2-week sprints)

| Sprint | Theme | Pipeline Touch | Key Deliverable |
|---|---|---|---|
| **Sprint 1** | Spike, schema & shared primitives | None (foundations) | `RichContentEditor` + `RichContentRenderer` + block schema |
| **Sprint 2** | Item creation wizard integration | `ItemCreationWizard` / `ContentStep` | Wizard step 4 writes `metadata.content_blocks` |
| **Sprint 3** | Edit item modal + public rendering | `EditItemForm` / `ContentTab` + `ProductDetailTabs` | Modal editing + public page rendering |
| **Sprint 4** | Capability gating, QA & polish | Capability system + tests | Tier-gated rollout + E2E coverage |

---

## 3. Cross-Sprint User Stories

- As a merchant creating a digital product, I want a Notion-like editor in the wizard so I can describe my product with text, images and videos in one place.
- As a merchant editing an existing digital product, I want the same rich editor in the item modal so I do not switch contexts.
- As a shopper, I want to see that rich content on the product page in a clean, responsive layout.
- As a platform operator, I want to gate rich content editing by tier/plan so it can be a premium feature.

---

## Sprint 1 — Spike, Schema & Shared Primitives

### Objectives
- Choose a library that works with React 19 + Next.js.
- Define the `content_blocks` JSON schema and validation.
- Build two reusable components: `RichContentEditor` and `RichContentRenderer`.
- Wire image upload to the existing Supabase photo upload flow.

### Tasks

| # | Task | Owner | Acceptance Criteria |
|---|---|---|---|
| 1.1 | **Library spike** — install `BlockNote` and `TipTap` candidates, verify `pnpm checkweb`, React 19 hydration, bundle size | FE Lead | Candidate selected with a one-page trade-off note |
| 1.2 | **Block schema design** — define TypeScript interfaces + Zod schema for `paragraph`, `heading`, `image`, `video_embed`, `bullet_list`, `numbered_list`, `callout`, `button`, `button_pill`, `icon` | BE/FE Pair | Schema documented and tests cover validation/serialization |
| 1.3 | **Create `RichContentEditor.tsx`** — wrap chosen library, expose `value`/`onChange`, insert image/video/list/button/pill/icon toolbar | FE Lead | Renders in Storybook/playground, outputs valid block JSON |
| 1.4 | **Create `RichContentRenderer.tsx`** — map blocks to Tailwind React components, use `next/image`, `ProductVideoPlayer`, and existing `Button`/`Badge`/icon components | FE Lead | Renders all block types, passes a11y checks |
| 1.5 | **Image upload adapter** — integrate existing `itemsService.uploadTempPhoto` or `PhotoSingleton` so editor image blocks upload to Supabase | FE Lead | Image uploads return a public URL and populate the block |
| 1.6 | **Video embed adapter** — parse YouTube/Vimeo URLs with existing `validateVideoUrl` logic from `MediaStep.tsx` | FE Pair | Invalid URLs rejected, valid URLs produce `video_embed` blocks |
| 1.7 | **Custom block extensions** — build `button`, `button_pill`, and `icon` blocks/marks with label, URL, variant, and `lucide-react` icon picker | FE Pair | All custom blocks editable in the editor and render correctly |
| 1.8 | **Unit tests** — editor input/output, renderer block mapping, Zod validation, custom block round-trips | FE/QA | ≥ 80% coverage of new utilities |
| 1.9 | **First smoke test** — exercise all block types (paragraph, heading, list, image, video, button, pill, icon, callout) in a Storybook/playground scenario and verify round-trip save/render | FE/QA | Smoke scenario passes and `pnpm checkweb` is green |
| 1.10 | **Dev spike review** — demo to stakeholders, lock library choice | Team | Decision recorded in ADR comment in doc |

### Definition of Done
- `pnpm checkweb` passes with new components imported in a throwaway test page.
- Library choice and block schema are committed in the repo.
- `RichContentEditor` and `RichContentRenderer` are in `apps/web/src/components/products/`.

---

## Sprint 2 — Item Creation Wizard Integration

### Objectives
- Replace the `enhancedDescription` textarea in `ContentStep` with the rich editor.
- Update `ItemCreationWizard` state and save flow to persist `metadata.content_blocks`.
- Ensure plain-text `description` still exists for short-form / SEO use.

### Tasks

| # | Task | Owner | Acceptance Criteria |
|---|---|---|---|
| 2.1 | **Wizard state update** — add `contentBlocks` to `WizardData.content` in `ItemCreationWizard.tsx` | FE Lead | Type updated, default empty array, passed to `ContentStep` |
| 2.2 | **Swap `ContentStep` UI** — replace `enhancedDescription` textarea with `RichContentEditor`; keep `description` as a short plain-text field | FE Lead | Wizard step 4 shows editor, `description` remains as subtitle/SEO field |
| 2.3 | **Media insert UX** — toolbar buttons for "Add Photo", "Add Video", "Add List", "Add Button", "Add Pill", "Add Icon" | FE Lead | All new block types can be inserted from the toolbar and appear correctly |
| 2.4 | **Save pipeline** — ensure wizard submit serializes `contentBlocks` into `metadata.content_blocks` | FE Lead | New digital products save rich content to DB |
| 2.5 | **Backend validation** — add Zod validation for `metadata.content_blocks` in `inline-items-crud.ts` (or item create route) | BE Lead | API rejects malformed block arrays, accepts valid ones |
| 2.6 | **Wizard review step** — show a read-only preview of rich content on the review step if data exists | FE Pair | Merchants see what they composed before saving |
| 2.7 | **First wizard smoke test** — create a digital product using list, button, pill, and icon blocks and verify the saved `metadata.content_blocks` contains valid blocks; `pnpm checkweb` | QA | Smoke test passes and existing physical product creation still passes E2E regression tests |

### Definition of Done
- A digital product can be created through the wizard with interleaved text, images and videos.
- `metadata.content_blocks` is persisted in `inventory_items.metadata`.
- `description` is still collected and stored separately.

---

## Sprint 3 — Edit Item Modal + Public Rendering

### Objectives
- Add the same editor to `EditItemForm` `ContentTab`.
- Update `useItemFormState` to hydrate and save `content_blocks`.
- Render rich content on the public product page with graceful fallback.

### Tasks

| # | Task | Owner | Acceptance Criteria |
|---|---|---|---|
| 3.1 | **Modal state plumbing** — update `useItemFormState.ts` to read `metadata.content_blocks` on load and write it on save | FE Lead | `EditItemForm` populates and persists content blocks |
| 3.2 | **Swap `ContentTab` UI** — replace `enhancedDescription` textarea with `RichContentEditor` for digital/hybrid products | FE Lead | Same editing experience as wizard |
| 3.3 | **Modal validation** — mirror backend Zod schema in frontend before save | FE Pair | Invalid content cannot be submitted |
| 3.4 | **Public renderer integration** — add `RichContentRenderer` to `ProductDetailTabs.tsx` when `product.metadata.content_blocks` exists | FE Lead | Digital product pages show rich content |
| 3.5 | **Digital layout hero** — optionally show the first image/video block above the fold in `ProductDigitalLayout.tsx` | FE Pair | No regression for products without rich content |
| 3.6 | **Fallback logic** — if no `content_blocks`, render existing `description` / `marketingDescription` exactly as before | FE Lead | 100% backward compatible for existing products |
| 3.7 | **Mobile & responsive** — ensure editor toolbar and rendered blocks work down to 375px | FE/UX | No horizontal scroll, touch-friendly insert buttons |
| 3.8 | **E2E smoke** — create and edit a digital product with rich content containing text, list, image, video, button, pill, and icon blocks; assert public page renders each block correctly | QA | Test passes in CI |

### Definition of Done
- Digital products can be edited in the item modal with the rich editor.
- Public product pages render rich content or fall back to plain text.
- `pnpm checkapi` and `pnpm checkweb` pass.

---

## Sprint 4 — Capability Gating, QA & Polish

### Objectives
- Gate the editor behind a feature key/capability.
- Add quality/accessibility polish and automated coverage.
- Prepare for release.

### Tasks

| # | Task | Owner | Acceptance Criteria |
|---|---|---|---|
| 4.1 | **Feature registration** — add `digital_product_rich_content` to `features_list`, `capability_features_list`, and `tier_features_list` (target Scale/Enterprise first) | BE Lead | Migration committed, Prisma generated, seeded |
| 4.2 | **Capability resolver** — expose `can_use_digital_product_rich_content` in `EffectiveCapabilities` | BE Lead | Frontend can read the gate |
| 4.3 | **Frontend capability hook** — `useDigitalProductRichContentCapability` in `useCapabilityAccess.ts` | FE Lead | Wizard/Modal hide or disable editor when unavailable |
| 4.4 | **Upgrade prompt** — show a "Upgrade to unlock rich content editor" CTA when gated | FE/UX | Prompt links to plan comparison |
| 4.5 | **Alt-text & accessibility** — require `alt` on images, keyboard toolbar nav, focus rings, ARIA labels | FE/UX | Lighthouse a11y ≥ 95 on affected pages |
| 4.6 | **Content quality score** — extend `ContentStep` quality meter to count blocks, images, videos, headings, CTAs, and icons | FE Pair | Quality score reflects rich content presence |
| 4.7 | **Unit + E2E tests** — cover editor save/load, malformed block fallback, capability gating, public rendering | QA/FE | ≥ 80% unit coverage, 3 new E2E tests |
| 4.8 | **Documentation & rollout** — update merchant docs, add feature to capability showcase, release notes | Tech Writer / FE | Feature is documented and discoverable |

### Definition of Done
- Rich content editor is live for eligible tiers/plans.
- Existing products and lower-tier merchants are unaffected.
- CI green (`pnpm checkapi`, `pnpm checkweb`, E2E).
- Release notes ready.

---

## 4. Alignment with Current Pipelines

This plan intentionally touches **both creation surfaces** with the same primitives:

- `ItemCreationWizard` → `ContentStep.tsx` gets `RichContentEditor`.
- `EditItemModal` → `EditItemForm` → `ContentTab` in `TabPanels.tsx` gets the same `RichContentEditor`.
- Both write to the same `metadata.content_blocks` path.
- Both use the same `useItemFormState`/`WizardData` content object shape.
- Public rendering uses the same `RichContentRenderer` in `ProductDetailTabs.tsx` and `ProductDigitalLayout.tsx`.

No changes to `MediaStep.tsx`, `DigitalProductConfig.tsx`, or the digital download flow; those remain the source of truth for product media and deliverables.

---

## 5. Data & Persistence Model

```json
{
  "content_blocks": {
    "version": "1",
    "blocks": [
      { "type": "paragraph", "text": "..." },
      { "type": "heading", "level": 2, "text": "..." },
      { "type": "image", "src": "https://...", "alt": "...", "caption": "..." },
      { "type": "video_embed", "url": "https://youtube.com/...", "caption": "..." },
      { "type": "bullet_list", "items": ["...", "..."] },
      { "type": "numbered_list", "items": ["...", "..."] },
      { "type": "button", "label": "Buy now", "url": "https://...", "variant": "primary" },
      { "type": "button_pill", "label": "On sale", "variant": "success" },
      { "type": "icon", "name": "check", "color": "green" },
      { "type": "callout", "style": "info", "text": "..." }
    ]
  }
}
```

- Stored in `inventory_items.metadata` (JSONB) for the MVP.
- Optional future migration: promote `content_blocks` to a top-level `Json?` column if payload size or indexing becomes a concern.

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| React 19 incompatibility with chosen editor | Medium | High | Sprint 1 spike gates the library choice; have TipTap as fallback |
| Existing `metadata` schema bloat | Low | Medium | Cap block count (e.g., 50) and image count (e.g., 20) in editor |
| Merchants confuse marketing content with deliverable assets | Medium | High | Clear UI labels: "Marketing content" vs "Digital files customers download" |
| Feed/sync breakage if `description` is dropped | Low | High | Keep `description` separate; never remove existing fields |
| Accessibility gaps in custom toolbar | Medium | Medium | Sprint 4 a11y audit and keyboard navigation pass |

---

## 7. Definition of Done for the Whole Initiative

- [ ] `RichContentEditor` and `RichContentRenderer` are reusable, tested components.
- [ ] Wizard `ContentStep` supports rich content for digital/hybrid products.
- [ ] Item modal `ContentTab` supports rich content for digital/hybrid products.
- [ ] Public `ProductDetailTabs` renders `metadata.content_blocks` with plain-text fallback.
- [ ] Capability gating works and is registered in the feature system.
- [ ] `pnpm checkapi`, `pnpm checkweb`, and E2E tests pass.
- [ ] Documentation and release notes are updated.

---

## 8. Key Dependencies

- Supabase photo upload flow remains available (`itemsService.uploadTempPhoto` / `PhotoSingleton`).
- `ProductVideoPlayer` already supports YouTube/Vimeo; direct MP4 support is a Phase 2/3 nice-to-have, not a blocker.
- Capability/feature registration convention is unchanged from recent sprints (Magazine Gallery, Directory Promotion, etc.).
