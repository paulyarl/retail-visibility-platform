import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Storefront+Examples';
const title = 'Storefront Examples Built with Visible Shelf';
const description =
  'See how local retailers use Visible Shelf to build clean, modern storefronts with Clover sync, local pickup, and Google visibility.';

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
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [heroImage],
  },
};

const examples = [
  {
    name: 'Urban Goods Co.',
    type: 'Clover POS storefront',
    image:
      'https://placehold.co/600x900/e60023/ffffff?text=Urban+Goods',
  },
  {
    name: 'The Plant Room',
    type: 'Deposit / BOPIS workflow',
    image:
      'https://placehold.co/600x900/e60023/ffffff?text=Plant+Room',
  },
  {
    name: 'Lakeview Boards',
    type: 'Omnichannel + local delivery',
    image:
      'https://placehold.co/600x900/e60023/ffffff?text=Lakeview+Boards',
  },
  {
    name: 'Main St. Mercantile',
    type: 'Google Visibility focused',
    image:
      'https://placehold.co/600x900/e60023/ffffff?text=Main+St+Mercantile',
  },
  {
    name: 'Craft & Foundry',
    type: 'E-commerce clean checkout',
    image:
      'https://placehold.co/600x900/e60023/ffffff?text=Craft+Foundry',
  },
];

export default function ExamplesPage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="See real storefronts built with Visible Shelf"
      subheadline="Five example stores across retail categories, each built with the same Clover, Google, and omnichannel tools."
      description={description}
      features={[
        'Live product sync from Clover',
        'Mobile-first checkout experiences',
        'Local pickup and delivery flows',
        'Google-ready listings and directories',
      ]}
      primaryCtaLabel="Build my storefront"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="Compare Clover vs Shopify"
      secondaryCtaHref="/compare/clover-vs-shopify?ref=pinterest"
      heroImage={heroImage}
    >
      <section className="mt-16 pt-10 border-t border-neutral-200 dark:border-neutral-800">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
          Example storefronts
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {examples.map((ex) => (
            <div
              key={ex.name}
              className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ex.image}
                alt={ex.name}
                className="w-full aspect-[2/3] object-cover"
                width={600}
                height={900}
              />
              <div className="p-4">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {ex.name}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {ex.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PinterestLandingPage>
  );
}
