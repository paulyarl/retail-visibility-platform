import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Google+Visibility+Checklist';
const title = 'Google Visibility Checklist for Local Retail | Visible Shelf';
const description =
  'Download the free checklist to diagnose why your store is not showing up on Google and get the exact steps to fix it.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    images: [
      {
        url: heroImage,
        width: 1200,
        height: 1800,
        alt: title,
      },
    ],
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [heroImage],
  },
};

export default function GoogleVisibilityChecklistPage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Why is your store not on Google?"
      subheadline="Download the free Google Visibility Checklist and get the exact steps to show up in Search, Maps, and Shopping."
      description={description}
      features={[
        '15-point GBP + SEO checklist',
        'Common mistakes that hide local stores',
        'Step-by-step fixes you can do today',
        'Free PDF delivered to your inbox',
      ]}
      primaryCtaLabel="Get the free checklist"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="Start a Discovery trial"
      secondaryCtaHref="/auth/signup?ref=pinterest"
      heroImage={heroImage}
    >
      <section className="mt-16 pt-10 border-t border-neutral-200 dark:border-neutral-800">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
          Get the checklist
        </h2>
        <form
          action="/api/lead-capture"
          method="POST"
          className="max-w-md space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Email address
            </label>
            <input
              type="email"
              name="email"
              id="email"
              required
              placeholder="you@yourstore.com"
              className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <input type="hidden" name="guide" value="google-visibility-checklist" />
          <button
            type="submit"
            className="w-full rounded-full bg-red-600 px-6 py-3 text-base font-bold text-white hover:bg-red-700 transition-colors"
          >
            Send me the checklist
          </button>
        </form>
      </section>
    </PinterestLandingPage>
  );
}
