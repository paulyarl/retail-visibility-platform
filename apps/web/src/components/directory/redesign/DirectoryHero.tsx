'use client';

/**
 * DirectoryHero — gradient band with title, subtitle, search bar, and stat chips.
 *
 * Props: { totalStores, totalCategories, openNowCount }
 * Embeds DirectorySearchBar (Task 2).
 * appearance prop changes density/typography for variant skins.
 */

import { Store, Tag, Clock } from 'lucide-react';
import DirectorySearchBar from './DirectorySearchBar';
import type { DirectoryLayoutKey } from './types';

interface DirectoryHeroProps {
  totalStores: number;
  totalCategories: number;
  openNowCount?: number;
  appearance?: DirectoryLayoutKey;
}

export default function DirectoryHero({
  totalStores,
  totalCategories,
  openNowCount,
  appearance = 'discovery',
}: DirectoryHeroProps) {
  const isEditorial = appearance === 'editorial';

  return (
    <section
      className={`relative overflow-hidden ${
        isEditorial ? 'min-h-[420px]' : 'min-h-[280px]'
      } bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white`}
      aria-label="Directory hero"
    >
      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1
            className={`font-bold tracking-tight mb-3 ${
              isEditorial ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
            }`}
          >
            Discover Local Stores
          </h1>
          <p className="text-lg text-white/80 mb-8">
            Find products and services from merchants near you
          </p>

          {/* Unified search bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <DirectorySearchBar appearance={appearance} />
          </div>

          {/* Stat chips */}
          <div
            className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap min-h-[28px]"
            aria-label="Directory stats"
          >
            <StatChip
              icon={<Store className="w-4 h-4" />}
              value={totalStores.toLocaleString()}
              label="stores"
            />
            <StatChip
              icon={<Tag className="w-4 h-4" />}
              value={totalCategories.toLocaleString()}
              label="categories"
            />
            {openNowCount !== undefined && openNowCount > 0 && (
              <StatChip
                icon={<Clock className="w-4 h-4" />}
                value={openNowCount.toLocaleString()}
                label="open now"
                accent
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatChip({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={accent ? 'text-emerald-300' : 'text-white/70'}>
        {icon}
      </span>
      <span className="font-semibold text-white">{value}</span>
      <span className="text-white/70">{label}</span>
    </div>
  );
}
