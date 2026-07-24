'use client';

import React from 'react';
import Link from 'next/link';
import { useUTM } from '@/hooks/useUTM';
import { Check, ArrowRight } from 'lucide-react';

export interface PinterestLandingPageProps {
  /** Page title / OG title */
  title: string;
  /** Hero headline */
  headline: string;
  /** Short subheadline / value prop */
  subheadline: string;
  /** Longer description */
  description: string;
  /** Feature bullets */
  features: string[];
  /** Primary CTA label */
  primaryCtaLabel: string;
  /** Primary CTA href (must include /auth/signup or similar) */
  primaryCtaHref: string;
  /** Secondary CTA label (appears below the fold) */
  secondaryCtaLabel?: string;
  /** Secondary CTA href */
  secondaryCtaHref?: string;
  /** Absolute hero / OG image URL (2:3 preferred for Pinterest) */
  heroImage: string;
  /** Optional additional sections rendered below the hero */
  children?: React.ReactNode;
}

/**
 * Reusable conversion-first landing page for Pinterest campaigns.
 *
 * - Mobile-first, CTA above the fold at 375px.
 * - Appends stored UTM/ref params to every CTA via useUTM.
 * - Renders a 2:3 Pinterest hero image.
 */
export function PinterestLandingPage({
  title,
  headline,
  subheadline,
  description,
  features,
  primaryCtaLabel,
  primaryCtaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  heroImage,
  children,
}: PinterestLandingPageProps) {
  const { withUTM } = useUTM();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-8 lg:gap-12 items-start">
          {/* Text / CTA — first on mobile so CTA is above the fold */}
          <div className="order-2 lg:order-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">
              {headline}
            </h1>
            <p className="mt-4 text-lg sm:text-xl font-medium text-neutral-700 dark:text-neutral-200">
              {subheadline}
            </p>
            <p className="mt-4 text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {description}
            </p>

            <ul className="mt-6 space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-neutral-700 dark:text-neutral-300">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link
                href={withUTM(primaryCtaHref)}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-full bg-red-600 px-8 py-4 text-base font-bold text-white hover:bg-red-700 transition-colors"
              >
                {primaryCtaLabel}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Hero image — 2:3 Pinterest aspect */}
          <div className="order-1 lg:order-2">
            <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-lg bg-neutral-100 dark:bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover"
                width={1200}
                height={1800}
              />
            </div>
          </div>
        </div>

        {children}

        {secondaryCtaLabel && secondaryCtaHref && (
          <div className="mt-16 pt-10 border-t border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-neutral-600 dark:text-neutral-300 mb-4">
              Not ready to start? Explore what else Visible Shelf can do.
            </p>
            <Link
              href={withUTM(secondaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-red-600 px-6 py-3 text-base font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              {secondaryCtaLabel}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
