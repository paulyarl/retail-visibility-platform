# Digital Product Content Editor — Feasibility Analysis

## 1. Executive Summary

Yes — a content editor that lets merchants mix text, photos and inline videos for digital products is achievable on this platform. The cleanest path is to add a **block-based rich-content editor** into the existing product creation surfaces (`ItemCreationWizard` and `EditItemModal`), store the output as structured JSON in `inventory_items.metadata.content_blocks`, and render it on the public product page via a new `RichContentRenderer` component. Product media (primary image, gallery, product video) and digital delivery assets should remain separate concerns.

**Recommended scope:** build this as a **digital-product-aware rich-content field** first, not as a full page builder. This gives the digital-product experience the user is asking for without rewriting the product gallery, storefront layouts, or checkout flow.

## 2. Current Content Creation Pipeline

### 2.1 Creation / Editing Surfaces

| Surface | File | Current Content Editing |
|---|---|---|
| Item creation wizard — step 4 | `apps/web/src/components/inventory/wizards/steps/ContentStep.tsx` | Plain textareas for `description`, `enhancedDescription`, `features`, `specifications` |
| Item creation wizard — step 5 | `apps/web/src/components/inventory/wizards/steps/MediaStep.tsx` | Separate primary image, gallery image grid, and `videoUrl` (YouTube/Vimeo) field |
| Edit item modal — content tab | `apps/web/src/components/items/edit/TabPanels.tsx` `ContentTab` | Plain textareas only; photos are shown read-only and managed elsewhere |
| Digital product settings | `apps/web/src/components/items/DigitalProductConfig.tsx` | Delivery method, external links, license/access settings, delivery assets |

### 2.2 Data Model

Relevant `inventory_items` columns (`apps/api/prisma/schema.prisma`):

- `description` — short plain-text description.
- `enhanced_description` / `marketing_description` — longer marketing copy.
- `image_url` — primary product image.
- `image_gallery String[]` — gallery URLs.
- `video_url` — single product video (YouTube/Vimeo).
- `metadata Json?` — already used for `features`, `specifications`, `enhancedDescription`, etc.
- `digital_assets Json?` — deliverable files/links for post-purchase access.
- `photo_assets[]` — related `photo_assets` records.

The platform already stores arbitrary JSON in `metadata`, so adding a `content_blocks` structure does **not** require a schema change if `metadata` is used.

### 2.3 Public Rendering

- `ProductDigitalLayout.tsx` drives the digital public page.
- `ProductBottomSections.tsx` renders `ProductDetailTabs.tsx`.
- `ProductDetailTabs.tsx` currently prints `description` and `marketingDescription` as plain text with `whitespace-pre-wrap`.
- `ProductGalleryPanel` and `ProductVideoPlayer` handle product-level images/video separately.

## 3. What Is Being Asked

Most digital-product platforms (Gumroad, Lemon Squeezy, Podia, Shopify digital downloads) let the merchant compose a **single narrative content area** that interleaves:

- formatted text,
- inline photos,
- embedded/inline videos,
- callouts, feature lists, and CTAs.

The platform today splits this into separate textareas and a separate media step. The question is whether the content-creation pages can be replaced (or augmented) with one unified editor.

## 4. Feasibility Assessment

### 4.1 Technical Feasibility — Yes

- The React + Next.js + Tailwind frontend can host any modern block editor.
- Supabase storage already supports image upload (`itemsService.uploadTempPhoto` in `MediaStep.tsx`); videos can be stored as Supabase objects or referenced via YouTube/Vimeo using the existing `ProductVideoPlayer`.
- `inventory_items.metadata` JSON is a natural persistence target.
- Rendering can reuse `ProductVideoPlayer.tsx` for videos and `next/image` for images.
- No backend schema migration is required for an MVP if `metadata.content_blocks` is used.

### 4.2 Concern Boundaries

The editor should be used for **marketing / sales content**, not for:

- **Product gallery** — keep `image_url` + `image_gallery` for thumbnails, SEO, and feeds.
- **Product video** — keep `video_url` for the hero product video.
- **Digital delivery assets** — keep `digital_assets` for post-purchase downloads.

Mixing these concerns would break Google Shopping feeds, social-commerce catalog sync, and the digital download pipeline.

## 5. Implementation Options

### 5.1 Option A — Lightweight WYSIWYG HTML editor (lowest effort)

Replace `description` / `enhancedDescription` textareas with a `TipTap` or `Slate` WYSIWYG, storing sanitized HTML.

- **Pros:** quick to build; familiar UX.
- **Cons:** HTML is harder to transform for different surfaces (feeds, mobile, embeds); security requires server-side sanitization.

### 5.2 Option B — Block-based editor for `enhanced_description` (recommended)

Introduce a block editor that writes a typed JSON array of blocks (`paragraph`, `heading`, `image`, `video_embed`, `feature_list`, `callout`, etc.) into `metadata.content_blocks`.

- **Pros:** portable, safe, easy to render with React components, easy to extend.
- **Cons:** slightly more UI build than a WYSIWYG; requires a serializer.

### 5.3 Option C — Full digital-product page builder (highest effort)

Replace `ProductDigitalLayout` with a drag-and-drop page builder that edits a `content_blocks` field.

- **Pros:** exactly matches platforms like Gumroad.
- **Cons:** 4–6+ weeks; changes public-page data contract, analytics, and SEO surfaces.

## 6. Recommended Architecture

### 6.1 Content Block Schema

```json
{
  "content_format_version": "1",
  "blocks": [
    { "type": "paragraph", "text": "..." },
    { "type": "heading", "level": 2, "text": "What you get" },
    { "type": "image", "src": "https://...supabase.../image.jpg", "alt": "...", "caption": "..." },
    { "type": "video_embed", "url": "https://youtube.com/...", "caption": "..." },
    { "type": "bullet_list", "items": ["...", "..."] },
    { "type": "callout", "style": "info", "text": "..." }
  ]
}
```

Persistence: `inventory_items.metadata.content_blocks`.

### 6.2 Editor Component

A new `RichContentEditor` component wrapping a block editor. It should:

1. Accept an initial `Block[]` array.
2. Expose `onChange(contentBlocks: Block[])`.
3. Provide a toolbar to insert text, headings, images, and video.
4. Use the existing `uploadTempPhoto` flow for image uploads.
5. Validate/parse video URLs via `validateVideoUrl` already in `MediaStep.tsx`.

### 6.3 Rendering

A new `RichContentRenderer` component used inside `ProductDetailTabs.tsx`:

- `paragraph` / `heading` → plain elements.
- `image` → `next/image` or `<img>` with lazy loading.
- `video_embed` → `ProductVideoPlayer` (already supports YouTube/Vimeo; can extend for direct MP4).
- `bullet_list` / `callout` → styled Tailwind components.

### 6.4 Files to Touch

| Layer | Files |
|---|---|
| Editor component | `apps/web/src/components/products/RichContentEditor.tsx` (new) |
| Renderer component | `apps/web/src/components/products/RichContentRenderer.tsx` (new) |
| Wizard | `apps/web/src/components/inventory/wizards/steps/ContentStep.tsx` |
| Modal | `apps/web/src/components/items/edit/TabPanels.tsx` `ContentTab` |
| Public page | `apps/web/src/app/products/[id]/layouts/shared/ProductDetailTabs.tsx` |
| Digital layout | `apps/web/src/app/products/[id]/ProductDigitalLayout.tsx` (if hero block is desired) |
| Backend (optional) | `apps/api/src/routes/inline-items-crud.ts` or `items` update route validation |

## 7. Content Editor Library Options

| Library | Block-based | React 19 status | Bundle | Inline images | Inline video | Notes |
|---|---|---|---|---|---|---|
| **BlockNote** | Yes | Verify before use | Medium | Yes (drag/drop) | Via embed blocks | Modern Notion-like API; easiest block editor start |
| **TipTap** + `@tiptap/react` | ProseMirror blocks | Mature, React 19 likely fine | Medium | Via image extension | Via YouTube/IFrame extensions | Headless — fully custom UI with the existing shadcn/Mantine components |
| **Lexical** | Yes | Meta; React 19 support should be good | Large | Yes | Via video node plugins | Lower-level; more wiring |
| **EditorJS** | Yes | React wrappers exist | Medium | Image tool available | Video tool available | Class-based plugins; slower maintenance cadence |
| **Plate** (Slate) | Yes | React 18 primarily; React 19 TBD | Large | Yes | Via plugins | Heavy but very customizable |

**Recommendation:** shortlist `BlockNote` for speed or `TipTap` for maximum design-system control. Run a 1-day spike with `pnpm add` and `pnpm checkweb` to confirm React 19 compatibility before committing.

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| React 19 editor incompatibilities | Medium | 1-day spike with candidate library before sprint commitment |
| Mixing marketing content with product data | High | Keep `content_blocks` separate from `image_url`, `video_url`, and `digital_assets`; maintain feed/sync fields |
| Large JSON in `metadata` | Low-Medium | Cap block count/size in editor; monitor query payload; consider `content_blocks` column if size grows |
| XSS from user-generated rich content | High | Store JSON (not HTML) and render with controlled React components; sanitize any HTML fallback with `DOMPurify` |
| Backward compatibility for existing products | Medium | Public renderer falls back to `description` / `marketing_description` when `content_blocks` is absent |
| Accessibility | Medium | Ensure keyboard toolbar navigation and alt-text prompts for images |

## 9. Suggested Phasing

### Phase 1 — Spike & Schema
- Install and validate chosen editor with React 19.
- Define `content_blocks` JSON schema and add validation helper.
- No DB migration if using `metadata`.

### Phase 2 — Editor in Content Surfaces
- Build `RichContentEditor` and `RichContentRenderer`.
- Replace `enhancedDescription` textarea in `ContentStep` and `ContentTab` for digital/hybrid products only.
- Add image upload and video-embed insertions.

### Phase 3 — Public Page
- Update `ProductDetailTabs` to render `content_blocks` for digital products.
- Add fallback to `description` / `marketingDescription`.

### Phase 4 — Polish
- Add capability gating if merchant-tier differentiation is desired.
- Add alt-text validation and content quality scoring.

**Estimated effort:** 1.5–2 sprints for the recommended Option B.

## 10. Recommendation

Proceed with **Option B: a block-based rich-content editor** for digital (and optionally hybrid) products, persisted as `metadata.content_blocks`. Use `TipTap` or `BlockNote` after a one-day React 19 compatibility spike. Keep the product gallery, hero video, and digital delivery assets as separate, existing fields to avoid breaking feeds, checkout, and download fulfillment.

---

## Appendix: Key File References

- `apps/web/src/components/inventory/wizards/steps/ContentStep.tsx`
- `apps/web/src/components/inventory/wizards/steps/MediaStep.tsx`
- `apps/web/src/components/items/edit/TabPanels.tsx`
- `apps/web/src/components/items/DigitalProductConfig.tsx`
- `apps/web/src/components/items/edit/useItemFormState.ts`
- `apps/web/src/app/products/[id]/ProductDigitalLayout.tsx`
- `apps/web/src/app/products/[id]/layouts/shared/ProductDetailTabs.tsx`
- `apps/web/src/components/products/sections/ProductBottomSections.tsx`
- `apps/web/src/components/products/ProductVideoPlayer.tsx`
- `apps/api/prisma/schema.prisma` (`inventory_items`)
- `apps/api/src/routes/inline-items-crud.ts`
