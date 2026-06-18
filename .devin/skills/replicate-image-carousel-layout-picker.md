---
description: How to replicate the directory-style image-carousel layout picker on other pages (storefront options, product options, etc.).
---

# Replicate the Image-Carousel Layout Picker

Use this skill when you need to add a **visual layout picker** to a new settings page, mirroring the behavior already built for the directory entry layout picker.

## Canonical reference

The directory entry implementation is the source of truth.

- **Picker UI:** `apps/web/src/components/directory/DirectorySettingsPanel.tsx` (lines ~330–400)
- **Carousel component:** `apps/web/src/components/directory/LayoutPreviewCarousel.tsx`
- **Metadata + slide helper:** `apps/web/src/utils/directoryEntryLayouts.ts`
- **Image drop folder:** `apps/web/public/images/directory-layouts/`

## What the pattern gives you

- Up to **5 numbered preview slides** per layout plus a single fallback image.
- A swipeable carousel with previous/next arrows, dot indicators, and touch swipe.
- **Graceful fallback**: if no images exist, the card shows an emoji icon instead of a broken image.
- **Zero code changes after setup**: platform owners drop images with exact filenames to update previews.
- Consistent selection card styling, selected badge, plan-gating overlay, and live preview link.

## Step 1 — Decide if the shared carousel is reusable

`LayoutPreviewCarousel` only needs:

- `slides: LayoutSlide[]`
- `icon: string` (emoji fallback)

It already has no dependency on `directory` semantics. You can import it from the directory folder, or move it to a shared location if you prefer (e.g., `apps/web/src/components/shared/LayoutPreviewCarousel.tsx`). If you move it, update the directory import and the type import.

## Step 2 — Create the metadata + slide helper for the target page

Create a new utility file. Use the directory file as a template but rename the constants and adjust the layout keys.

### Example: storefront layouts

File: `apps/web/src/utils/storefrontLayouts.ts`

```ts
export type StorefrontLayoutKey = 'classic' | 'editorial' | 'immersive';

export interface StorefrontLayoutMeta {
  key: StorefrontLayoutKey;
  label: string;
  description: string;
  icon: string;
  image: string;
  imageDark: string;
}

export interface LayoutSlide {
  src: string;
  alt: string;
}

const BASE = '/images/storefront-layouts';
const MAX_SLIDES = 5;

export const STOREFRONT_LAYOUT_META: Record<StorefrontLayoutKey, StorefrontLayoutMeta> = {
  classic: {
    key: 'classic',
    label: 'Classic',
    description: 'Traditional single-column layout.',
    icon: '🏪',
    image: `${BASE}/classic.png`,
    imageDark: `${BASE}/classic-dark.png`,
  },
  editorial: {
    key: 'editorial',
    label: 'Modern Editorial',
    description: 'Storytelling emphasis, hero banner, split-panel product pages.',
    icon: '📰',
    image: `${BASE}/editorial.png`,
    imageDark: `${BASE}/editorial-dark.png`,
  },
  immersive: {
    key: 'immersive',
    label: 'Immersive Commerce',
    description: 'Conversion-optimized, compact purchase flow, sticky cart.',
    icon: '🛒',
    image: `${BASE}/immersive.png`,
    imageDark: `${BASE}/immersive-dark.png`,
  },
};

export const STOREFRONT_LAYOUT_ORDER: StorefrontLayoutKey[] = [
  'classic', 'editorial', 'immersive',
];

export function getStorefrontPreviewSlides(
  layout: StorefrontLayoutKey,
  label?: string,
): LayoutSlide[] {
  const meta = STOREFRONT_LAYOUT_META[layout];
  const series: LayoutSlide[] = Array.from({ length: MAX_SLIDES }, (_, i) => ({
    src: `${BASE}/${layout}-${i + 1}.png`,
    alt: `${label ?? meta.label} layout preview ${i + 1}`,
  }));

  return [
    ...series,
    { src: meta.image, alt: `${label ?? meta.label} layout preview` },
  ];
}
```

### Example: product page layouts

File: `apps/web/src/utils/productLayouts.ts`

```ts
export type ProductLayoutKey = 'classic' | 'editorial' | 'immersive';

export interface ProductLayoutMeta {
  key: ProductLayoutKey;
  label: string;
  description: string;
  icon: string;
  image: string;
  imageDark: string;
}

export interface LayoutSlide {
  src: string;
  alt: string;
}

const BASE = '/images/product-layouts';
const MAX_SLIDES = 5;

export const PRODUCT_LAYOUT_META: Record<ProductLayoutKey, ProductLayoutMeta> = {
  classic: {
    key: 'classic',
    label: 'Classic',
    description: 'Standard product page with image, description, and buy button.',
    icon: '📦',
    image: `${BASE}/classic.png`,
    imageDark: `${BASE}/classic-dark.png`,
  },
  editorial: {
    key: 'editorial',
    label: 'Modern Editorial',
    description: 'Storytelling emphasis with hero banner and split-panel layout.',
    icon: '📰',
    image: `${BASE}/editorial.png`,
    imageDark: `${BASE}/editorial-dark.png`,
  },
  immersive: {
    key: 'immersive',
    label: 'Immersive Commerce',
    description: 'Conversion-optimized with compact purchase flow and sticky cart.',
    icon: '🛒',
    image: `${BASE}/immersive.png`,
    imageDark: `${BASE}/immersive-dark.png`,
  },
};

export const PRODUCT_LAYOUT_ORDER: ProductLayoutKey[] = [
  'classic', 'editorial', 'immersive',
];

export function getProductPreviewSlides(
  layout: ProductLayoutKey,
  label?: string,
): LayoutSlide[] {
  const meta = PRODUCT_LAYOUT_META[layout];
  const series: LayoutSlide[] = Array.from({ length: MAX_SLIDES }, (_, i) => ({
    src: `${BASE}/${layout}-${i + 1}.png`,
    alt: `${label ?? meta.label} layout preview ${i + 1}`,
  }));

  return [
    ...series,
    { src: meta.image, alt: `${label ?? meta.label} layout preview` },
  ];
}
```

## Step 3 — Create the image drop folder

Create the matching `public` folder and add a `.gitkeep` so it is committed empty.

| Target page | Folder |
| --- | --- |
| Storefront layouts | `apps/web/public/images/storefront-layouts/` |
| Product layouts | `apps/web/public/images/product-layouts/` |

### Drop-in filenames (platform owner)

For each layout, drop up to 5 numbered slides plus a single fallback. Only light-mode files are consumed by default; dark variants are reserved for future use.

| Layout | Slide series | Fallback |
| --- | --- | --- |
| `classic` | `classic-1.png` … `classic-5.png` | `classic.png` |
| `editorial` | `editorial-1.png` … `editorial-5.png` | `editorial.png` |
| `immersive` | `immersive-1.png` … `immersive-5.png` | `immersive.png` |

## Step 4 — Replace the existing text-only layout picker

### 4.1 Imports

Add the carousel and metadata helper:

```tsx
import LayoutPreviewCarousel from '@/components/directory/LayoutPreviewCarousel';
import {
  STOREFRONT_LAYOUT_META,
  STOREFRONT_LAYOUT_ORDER,
  getStorefrontPreviewSlides,
  type StorefrontLayoutKey,
} from '@/utils/storefrontLayouts';
```

### 4.2 Card grid

Replace the existing text-only button grid with an image-card grid. Keep the selection state, gating, and save handlers unchanged.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {STOREFRONT_LAYOUT_ORDER.map((layout) => {
    const meta = STOREFRONT_LAYOUT_META[layout];
    const isAllowed = cap?.[`canUseLayout${layout.charAt(0).toUpperCase() + layout.slice(1)}`];
    const isSelected = settings.storefront_layout === layout;

    return (
      <div
        key={layout}
        className={`relative rounded-xl border transition-all ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/40'
            : isAllowed
            ? 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            : 'border-gray-100 dark:border-gray-700 opacity-60'
        }`}
      >
        <button
          type="button"
          disabled={!isAllowed}
          onClick={() => setSettings(s => ({ ...s, storefront_layout: layout }))}
          aria-pressed={isSelected}
          aria-label={`Select ${meta.label} layout`}
          className={`block w-full text-left ${isAllowed ? '' : 'cursor-not-allowed'}`}
        >
          {/* 4:3 preview carousel */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-700">
            <LayoutPreviewCarousel slides={getStorefrontPreviewSlides(layout, meta.label)} icon={meta.icon} />
            {isSelected && (
              <span className="absolute right-2 top-2 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                Selected
              </span>
            )}
          </div>
          <div className="p-3">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {meta.label}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              {meta.description}
            </span>
            {!isAllowed && (
              <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Not included in your plan
              </span>
            )}
          </div>
        </button>

        {/* Optional live preview link */}
        {isAllowed && tenantSlug && (
          <a
            href={`/tenant/${tenantSlug}?layout_preview=${layout}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block border-t border-gray-100 dark:border-gray-700 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Preview in new tab →
          </a>
        )}
      </div>
    );
  })}
</div>
```

> **Important:** keep the existing capability checks (`cap?.canUseLayoutClassic`, `cap?.canUseLayoutEditorial`, etc.) and the existing save handler. This change only affects the visual picker.

## Step 5 — Specific page notes

### Storefront Options page

- **File:** `apps/web/src/app/t/[tenantId]/settings/storefront-options/StorefrontOptionsSettingsClient.tsx`
- **Current layout picker:** "Storefront Layout" card at the bottom of the page (currently text-only classic/editorial/immersive buttons).
- **State field:** `settings.storefront_layout`
- **Capability fields:** `cap?.canUseLayoutClassic`, `cap?.canUseLayoutEditorial`, `cap?.canUseLayoutImmersive`
- **Preview link:** `/tenant/${tenantId}?layout_preview=${layout}` (or any public storefront URL available in the page context).
- **Folder:** `apps/web/public/images/storefront-layouts/`

### Product Options page

- **File:** `apps/web/src/app/t/[tenantId]/settings/product-options/ProductOptionsSettingsClient.tsx`
- **Current layout picker:** "Product Page Layout" card (currently text-only classic/editorial/immersive buttons).
- **State field:** `settings.product_layout`
- **Capability fields:** `canUseLayoutClassic`, `canUseLayoutEditorial`, `canUseLayoutImmersive` (already loaded into local variables from `useProductOptionsCapability`).
- **Preview link:** `/products/${tenantId}?layout_preview=${layout}` or a representative public product page if available.
- **Folder:** `apps/web/public/images/product-layouts/`

## Acceptance criteria

- [ ] The target page's text-only layout picker is replaced by an image-card grid.
- [ ] Each card uses `LayoutPreviewCarousel` with `get*PreviewSlides(layout, meta.label)`.
- [ ] A new public folder exists for the target page's preview images and is committed via `.gitkeep`.
- [ ] Dropping numbered slide files (`{layout}-1.png` … `{layout}-5.png`) or fallback `{layout}.png` into the folder shows them in the carousel with no code changes.
- [ ] Missing images degrade to the emoji icon fallback; no broken image icons.
- [ ] Selected card shows the blue ring and "Selected" badge.
- [ ] Disallowed cards are dimmed, non-clickable, and show the "Not included in your plan" badge.
- [ ] Multiple slides render with arrows, dots, and swipe support.
- [ ] `pnpm checkweb` passes with zero errors.

## Common pitfalls

- **Do not use `layout` as a string from the URL unless it is validated.** Keep using the typed union exported from the metadata file.
- **Do not import the directory-specific metadata** (`directoryEntryLayouts.ts`) into storefront/product pages. Create a dedicated metadata file for each surface so image paths stay isolated.
- **Do not remove the existing save logic.** Only the visual picker changes.
- **Dark-mode slide series** are optional. If you decide to use them later, you need to detect the current theme and pass the dark slide array to the carousel instead of the light one.
