'use client';

/**
 * AddonsStrip — horizontal-scroll add-on catalog (NRS "Premium Feature
 * Add-Ons" band parity). Renders the à-la-carte solutions list as tall
 * snap-scroll cards (label + tagline) with ‹ › controls so the strip
 * reads as a slider. `hrefFor` wires each card to its workspace settings
 * page when the surface knows a tenant — cards render inert on public
 * surfaces.
 */
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { UpgradeSolution } from '@/services/DirectoryPresenceUpgradeService';

interface AddonsStripProps {
  items: UpgradeSolution[];
  hrefFor?: (key: string) => string | null;
  className?: string;
}

const CARD =
  'snap-start flex w-44 flex-shrink-0 flex-col rounded-xl border border-teal-200 bg-teal-50 p-3 text-left transition-colors';
const ARROW =
  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm hover:bg-teal-50 transition-colors';

export default function AddonsStrip({ items, hrefFor, className = '' }: AddonsStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        aria-label="Scroll add-ons left"
        onClick={() => scrollBy(-1)}
        className={ARROW}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div ref={trackRef} className="flex-1 overflow-x-auto">
        <div className="flex w-max gap-2 snap-x">
          {items.map((s) => {
            const href = hrefFor?.(s.key) ?? null;
            const body = (
              <>
                <span className="text-xs font-semibold text-teal-900">
                  {s.label}
                  {href ? ' →' : ''}
                </span>
                <span className="mt-1 text-[11px] leading-snug text-teal-800/80">{s.tagline}</span>
              </>
            );
            return href ? (
              <a key={s.key} href={href} className={`${CARD} hover:bg-teal-100`}>
                {body}
              </a>
            ) : (
              <span key={s.key} className={CARD}>
                {body}
              </span>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        aria-label="Scroll add-ons right"
        onClick={() => scrollBy(1)}
        className={ARROW}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
