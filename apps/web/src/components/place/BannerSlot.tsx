import type { ReactNode } from 'react';

export type BannerVariant = 'tall' | 'square';

/**
 * Banner inventory sizes for the public directory surfaces.
 *
 * The fixed box is the point: the slot reserves its footprint in the layout, so
 * swapping a creative in or out never shifts the page (CLS). An empty slot keeps
 * the same dimensions as a filled one — it just renders the placeholder.
 */
export const BANNER_SIZES: Record<BannerVariant, { width: number; height: number; name: string }> = {
  tall: { width: 300, height: 600, name: 'Tall banner' },
  square: { width: 300, height: 250, name: 'Square banner' },
};

export interface BannerSlotProps {
  variant: BannerVariant;
  /** "Sponsored" for a house creative; "Advertisement" for a served ad. */
  label?: string;
  /** The creative. Absent → the placeholder renders in the same reserved box. */
  children?: ReactNode;
  className?: string;
}

/**
 * BannerSlot — a reserved banner spot (300x600 tall / 300x250 square).
 *
 * Presentation only: the slot owns the size and label, the caller owns the
 * creative. Narrows to its container on small viewports, keeping the height.
 */
export function BannerSlot({
  variant,
  label = 'Sponsored',
  children,
  className = '',
}: BannerSlotProps) {
  const { width, height, name } = BANNER_SIZES[variant];

  return (
    <div
      data-banner-slot={variant}
      className={`flex flex-col ${className}`}
      style={{ width, maxWidth: '100%' }}
    >
      <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <div
        className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white"
        style={{ height, maxWidth: '100%' }}
      >
        {children ?? (
          <span className="px-3 text-center text-xs text-neutral-400">
            {name} — {width}×{height}
          </span>
        )}
      </div>
    </div>
  );
}
