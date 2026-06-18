# Directory Entry Layout Picker — Image Plumbing Spec

> **Audience:** Junior implementation agents.
> **Goal:** Upgrade the existing **text-only** four-card layout picker in `DirectorySettingsPanel.tsx` into an **image-driven carousel** picker. After this work, the **only** thing the platform owner must do to populate the previews is **drop up to 5 image files per layout (plus a single fallback) with exact filenames into one public folder** — no code edits.
> **Stack (do not change):** Next.js App Router, React, TailwindCSS, Mantine, `next/image`.
> **Scope:** Tenant directory entry layouts only (`classic | editorial | immersive | premium`) per `DIRECTORY_HOME_REDESIGN.md` §9. Do **not** touch the platform directory-home variant.

---

## 0. What already exists (do NOT rebuild)

| File | Role | Status |
| --- | --- | --- |
| `apps/web/src/components/directory/DirectorySettingsPanel.tsx` | Renders the picker (lines ~326–376) | **Text-only buttons** — to be upgraded |
| `apps/web/src/services/CapabilityResolutionService.ts` | `DirectoryEntryLayoutKey = 'classic'|'editorial'|'immersive'|'premium'` | ✅ done |
| `unifiedCapabilityService.getDirectoryEntryOptionsState(tenantId)` | Returns `{ effectiveLayout, allowedLayouts, ... }` | ✅ done |
| `tenantDirectoryManagementService.updateDirectoryEntryOptions(tenantId, { directory_entry_layout })` | Persists selection | ✅ done |

The **gating, state, save, and persistence are already wired.** This spec ONLY adds: (1) a metadata table, (2) image thumbnails, (3) a graceful fallback, (4) a live-preview link.

---

## 1. The "drop images here" contract (the whole point)

### 1.1 Folder (create it)
```
apps/web/public/images/directory-layouts/
```

### 1.2 Exact filenames (platform owner drops these)

For each layout, you can drop **up to 5 numbered slides** plus a single fallback. The carousel auto-detects which files exist.

| Variant | Slide series (1–5) | Single fallback | Optional dark slides | Optional dark fallback |
| --- | --- | --- | --- | --- |
| `classic`   | `classic-1.png` … `classic-5.png`   | `classic.png`   | `classic-1-dark.png` … `classic-5-dark.png`   | `classic-dark.png`   |
| `editorial` | `editorial-1.png` … `editorial-5.png` | `editorial.png` | `editorial-1-dark.png` … `editorial-5-dark.png` | `editorial-dark.png` |
| `immersive` | `immersive-1.png` … `immersive-5.png` | `immersive.png` | `immersive-1-dark.png` … `immersive-5-dark.png` | `immersive-dark.png` |
| `premium`   | `premium-1.png` … `premium-5.png`   | `premium.png`   | `premium-1-dark.png` … `premium-5-dark.png`   | `premium-dark.png`   |

- **Format:** `.png` (or `.webp` — keep the extension consistent; pick ONE).
- **Aspect ratio:** **4:3** for each slide. Recommended `800×600`.
- **Public URL** Next.js serves them at: `/images/directory-layouts/<file>` (no `/public` prefix).
- If no files exist for a layout, the card degrades gracefully to an emoji icon placeholder (§4) — never a broken image.
- The current code uses the **light** slide series; dark variants are optional future work (helper exported in §2).

> **Acceptance for §1:** Adding correctly-named files to this folder makes them appear in the carousel on next page load with **zero code changes.**

---

## 2. Add the metadata constant (single source of truth)

Mirror the storefront pattern (`STOREFRONT_OPT_TYPE_META` in `apps/web/src/utils/storefrontOptions.ts`).

**File:** `apps/web/src/utils/directoryEntryLayouts.ts` (new)

```ts
import type { DirectoryEntryLayoutKey } from '@/services/CapabilityResolutionService';

export interface DirectoryEntryLayoutMeta {
  key: DirectoryEntryLayoutKey;
  label: string;
  description: string;
  /** lucide-style emoji/icon fallback shown when no preview image is present */
  icon: string;
  /** public path to the light-mode preview (served from /public) */
  image: string;
  /** public path to the optional dark-mode preview */
  imageDark: string;
  /** when true, show an upgrade hint instead of selecting if not allowed */
  isPremium: boolean;
}

const BASE = '/images/directory-layouts';

export const DIRECTORY_ENTRY_LAYOUT_META: Record<DirectoryEntryLayoutKey, DirectoryEntryLayoutMeta> = {
  classic: {
    key: 'classic',
    label: 'Classic',
    description: 'Info-dense and scannable. The default — works for any business.',
    icon: '📄',
    image: `${BASE}/classic.png`,
    imageDark: `${BASE}/classic-dark.png`,
    isPremium: false,
  },
  editorial: {
    key: 'editorial',
    label: 'Editorial',
    description: 'Photo-led storytelling with a full-bleed hero and large gallery.',
    icon: '📰',
    image: `${BASE}/editorial.png`,
    imageDark: `${BASE}/editorial-dark.png`,
    isPremium: false,
  },
  immersive: {
    key: 'immersive',
    label: 'Immersive',
    description: 'Visit-planning focus: prominent map, hours, directions, contact.',
    icon: '🗺️',
    image: `${BASE}/immersive.png`,
    imageDark: `${BASE}/immersive-dark.png`,
    isPremium: false,
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    description: 'Flagship: video hero, featured carousel, elevated reviews & theming.',
    icon: '✨',
    image: `${BASE}/premium.png`,
    imageDark: `${BASE}/premium-dark.png`,
    isPremium: true,
  },
};

export const DIRECTORY_ENTRY_LAYOUT_ORDER: DirectoryEntryLayoutKey[] = [
  'classic', 'editorial', 'immersive', 'premium',
];

const MAX_SLIDES = 5;

/** Return candidate preview slide URLs for a layout. The carousel component only shows slides that actually exist. */
export function getLayoutPreviewSlides(
  layout: DirectoryEntryLayoutKey,
  label?: string,
): LayoutSlide[] {
  const meta = DIRECTORY_ENTRY_LAYOUT_META[layout];
  const series: LayoutSlide[] = Array.from({ length: MAX_SLIDES }, (_, i) => ({
    src: `${BASE}/${layout}-${i + 1}.png`,
    alt: `${label ?? meta.label} layout preview ${i + 1}`,
  }));

  return [
    ...series,
    { src: meta.image, alt: `${label ?? meta.label} layout preview` },
  ];
}

/** Same as getLayoutPreviewSlides, but for the optional dark-mode slide series. */
export function getLayoutDarkPreviewSlides(
  layout: DirectoryEntryLayoutKey,
  label?: string,
): LayoutSlide[] {
  const meta = DIRECTORY_ENTRY_LAYOUT_META[layout];
  const series: LayoutSlide[] = Array.from({ length: MAX_SLIDES }, (_, i) => ({
    src: `${BASE}/${layout}-${i + 1}-dark.png`,
    alt: `${label ?? meta.label} dark layout preview ${i + 1}`,
  }));

  return [
    ...series,
    { src: meta.imageDark, alt: `${label ?? meta.label} dark layout preview` },
  ];
}
```

> **Rule:** the picker reads label/description/icon/image **only** from this constant. To re-style or rename a card later, edit this file — nothing else.

---

## 3. Add the carousel component

Because images may not exist yet (or a dark variant may be absent), we **preload the candidate slide URLs** and only render a carousel for the files that actually exist. If no files exist, the card falls back to the emoji icon placeholder.

**File:** `apps/web/src/components/directory/LayoutPreviewCarousel.tsx` (new)

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LayoutSlide } from '@/utils/directoryEntryLayouts';

interface LayoutPreviewCarouselProps {
  slides: LayoutSlide[];
  icon: string;
}

export default function LayoutPreviewCarousel({ slides, icon }: LayoutPreviewCarouselProps) {
  const [validSlides, setValidSlides] = useState<LayoutSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValidSlides([]);
    setCurrent(0);
    setReady(false);

    let active = true;
    const results = Array.from({ length: slides.length }, () => false);
    let remaining = slides.length;

    if (slides.length === 0) {
      setReady(true);
      return;
    }

    slides.forEach((slide, index) => {
      const img = new window.Image();
      img.src = slide.src;
      img.onload = () => {
        if (!active) return;
        results[index] = true;
        remaining -= 1;
        if (remaining === 0) {
          setValidSlides(slides.filter((_, i) => results[i]));
          setReady(true);
        }
      };
      img.onerror = () => {
        if (!active) return;
        remaining -= 1;
        if (remaining === 0) {
          setValidSlides(slides.filter((_, i) => results[i]));
          setReady(true);
        }
      };
    });

    return () => {
      active = false;
    };
  }, [slides]);

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? validSlides.length - 1 : c - 1));
  }, [validSlides.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c === validSlides.length - 1 ? 0 : c + 1));
  }, [validSlides.length]);

  // Swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 40;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) next();
      else prev();
    }
  };

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-700 text-sm text-gray-400">
        Loading preview…
      </div>
    );
  }

  if (validSlides.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-700/40 text-4xl"
        aria-hidden="true"
      >
        {icon}
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {validSlides.map((slide, idx) => {
        const offset = idx - current;
        const isVisible = offset === 0;
        return (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
              isVisible ? 'translate-x-0' : offset > 0 ? 'translate-x-full' : '-translate-x-full'
            }`}
            aria-hidden={!isVisible}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(max-width: 640px) 50vw, 240px"
              className="object-cover"
              priority={idx === 0}
            />
          </div>
        );
      })}

      {validSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous preview slide"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-neutral-900/90 p-1.5 text-neutral-700 dark:text-neutral-100 shadow-sm hover:bg-white dark:hover:bg-neutral-900 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next preview slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-neutral-900/90 p-1.5 text-neutral-700 dark:text-neutral-100 shadow-sm hover:bg-white dark:hover:bg-neutral-900 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {validSlides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrent(idx)}
                aria-label={`Go to preview slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === current ? 'w-4 bg-blue-600' : 'w-1.5 bg-white/70 dark:bg-neutral-400/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- The component preloads every candidate slide and only keeps the ones that succeed.
- Controls are hidden when only one slide exists.
- The parent must still be `relative` with a fixed aspect ratio (handled in §4).

---

## 4. Replace the picker JSX in `DirectorySettingsPanel.tsx`

### 4.1 Add imports (top of file, with the other imports)
```tsx
import LayoutPreviewCarousel from './LayoutPreviewCarousel';
import {
  DIRECTORY_ENTRY_LAYOUT_META,
  DIRECTORY_ENTRY_LAYOUT_ORDER,
  getLayoutPreviewSlides,
} from '@/utils/directoryEntryLayouts';
```

### 4.2 Replace the existing card grid
Find the current block (≈ lines 334–360):

```tsx
            <div className="grid grid-cols-2 gap-3">
              {(['classic', 'editorial', 'immersive', 'premium'] as DirectoryEntryLayoutKey[]).map((layout) => {
                const isAllowed = allowedLayouts.includes(layout);
                const isSelected = directoryEntryLayout === layout;
                const label = layout.charAt(0).toUpperCase() + layout.slice(1);
                return (
                  <button
                    ...
                    <span className="block font-medium text-sm">{label}</span>
                    {!isAllowed && (
                      <span className="block text-xs text-gray-400 mt-1">Upgrade to unlock</span>
                    )}
                  </button>
                );
              })}
            </div>
```

Replace it with the image-card version:

```tsx
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DIRECTORY_ENTRY_LAYOUT_ORDER.map((layout) => {
                const meta = DIRECTORY_ENTRY_LAYOUT_META[layout];
                const isAllowed = allowedLayouts.includes(layout);
                const isSelected = directoryEntryLayout === layout;
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
                      onClick={() => setDirectoryEntryLayout(layout)}
                      aria-pressed={isSelected}
                      aria-label={`Select ${meta.label} layout`}
                      className={`block w-full text-left ${isAllowed ? '' : 'cursor-not-allowed'}`}
                    >
                      {/* 4:3 preview carousel */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-700">
                        <LayoutPreviewCarousel slides={getLayoutPreviewSlides(layout, meta.label)} icon={meta.icon} />
                        {isSelected && (
                          <span className="absolute right-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
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
                            {meta.isPremium ? 'Upgrade for Premium' : 'Not included in your plan'}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Live preview link (only when allowed and we have a slug) */}
                    {isAllowed && listing?.slug && (
                      <a
                        href={`/directory/${listing.slug}?layout_preview=${layout}`}
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

> **Notes for the implementer**
> - `listing.slug` already exists on the `DirectoryListing` type (`useDirectoryListing.ts`). Guard with `listing?.slug` so the link is hidden until the listing has a slug.
> - Keep the existing `directoryEntryLayout` / `allowedLayouts` state and `handleSaveLayout` save button below the grid **unchanged**.
> - Do **not** remove the `DirectoryEntryLayoutKey` import already present.

---

## 5. (Optional) Next.js image config check

`next/image` serving from `/public` needs **no** `remotePatterns` config (local files are always allowed). No `next.config` change is required. Only revisit if previews are ever served from a CDN/remote host (out of scope here).

---

## 6. File checklist (what the junior agent creates/edits)

| Action | Path |
| --- | --- |
| **Create folder** | `apps/web/public/images/directory-layouts/` (add a `.gitkeep` so the empty dir is committed) |
| **Create** | `apps/web/src/utils/directoryEntryLayouts.ts` |
| **Create** | `apps/web/src/components/directory/LayoutPreviewCarousel.tsx` |
| **Edit** | `apps/web/src/components/directory/DirectorySettingsPanel.tsx` (imports + replace card grid §4) |

The platform owner separately drops slides into the new folder:
- `classic-1.png` … `classic-5.png` (optional series) + `classic.png` (fallback)
- `editorial-1.png` … `editorial-5.png` + `editorial.png`
- `immersive-1.png` … `immersive-5.png` + `immersive.png`
- `premium-1.png` … `premium-5.png` + `premium.png`
- Optional dark variants: `*-dark.png` and `*-N-dark.png` (not consumed by default, but reserved).

---

## 7. Acceptance criteria

- [ ] New folder `apps/web/public/images/directory-layouts/` exists (committed via `.gitkeep`).
- [ ] Dropping any of the slide/fallback filenames into that folder makes them appear in the carousel **with no code change**.
- [ ] Multiple numbered slides per layout are rendered as a swipeable carousel with previous/next arrows, dot indicators, and swipe gestures.
- [ ] When all image files for a layout are **absent**, the card shows the emoji-icon placeholder (no broken-image icon); a single missing slide in a series is skipped.
- [ ] The currently selected card shows the **"Selected"** badge + blue ring; clicking another allowed card changes the selection (in-memory) and **Save Layout** persists it via `updateDirectoryEntryOptions`.
- [ ] Cards not in `allowedLayouts` are dimmed, non-clickable, and show the upgrade/"not included" hint (`premium` shows "Upgrade for Premium").
- [ ] Each allowed card shows a **"Preview in new tab →"** link to `/directory/{slug}?layout_preview={variant}` when `listing.slug` is present.
- [ ] Light/dark mode both render correctly; cards are keyboard-focusable with a visible focus ring; images have `alt` text.
- [ ] `checkweb` typecheck passes with **0 errors** (no `any` on the new metadata/types).

---

## 8. Out of scope
- Generating the actual preview images (owner-supplied; see the generator prompts already produced).
- Dark-mode slide selection (helpers are exported but not wired by default).
- Changing capability gating, the save endpoint, or `DirectoryEntryLayoutKey`.
- The platform directory-**home** variant picker (`DIRECTORY_HOME_REDESIGN.md` §2–§8) — different surface, different ownership.
