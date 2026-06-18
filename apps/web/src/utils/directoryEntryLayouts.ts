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

export interface LayoutSlide {
  src: string;
  alt: string;
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

/**
 * Return the candidate preview slide URLs for a layout.
 * The component will try to load each one and only show slides that exist.
 * Supports two drop-in conventions:
 *   - Series: {base}-1.png, {base}-2.png, ..., {base}-5.png
 *   - Fallback: {base}.png (used if none of the numbered files exist)
 */
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
