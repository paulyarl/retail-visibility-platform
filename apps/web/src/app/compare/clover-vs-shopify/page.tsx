import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Clover+vs+Shopify';
const title = 'Clover vs Shopify for Local Retail | Visible Shelf';
const description =
  'Compare Clover POS + Visible Shelf against Shopify for local retailers. See which setup is simpler, cheaper, and built for in-store first.';

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

export default function CloverVsShopifyPage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Clover vs Shopify: do you need both?"
      subheadline="For local retail, the right setup is Clover POS plus a storefront that syncs with it — not another platform to manage."
      description={description}
      features={[
        'Keep your existing Clover POS and inventory',
        'No double-entry or manual product imports',
        'E-commerce and omnichannel built in',
        'Lower total cost than running two systems',
      ]}
      primaryCtaLabel="Start with Clover + Visible Shelf"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="See all solutions"
      secondaryCtaHref="/solutions/clover-storefront?ref=pinterest"
      heroImage={heroImage}
    >
      <section className="mt-16 pt-10 border-t border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
          Quick comparison
        </h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="py-3 pr-4 font-semibold text-neutral-900 dark:text-white">
                Feature
              </th>
              <th className="py-3 pr-4 font-semibold text-red-600">
                Clover + Visible Shelf
              </th>
              <th className="py-3 font-semibold text-neutral-600 dark:text-neutral-300">
                Shopify alone
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                In-store POS sync
              </td>
              <td className="py-3 pr-4 text-emerald-600 font-medium">Native</td>
              <td className="py-3 text-neutral-500">Requires apps / middleware</td>
            </tr>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                Product catalog management
              </td>
              <td className="py-3 pr-4 text-emerald-600 font-medium">One catalog</td>
              <td className="py-3 text-neutral-500">Separate admin</td>
            </tr>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                Local pickup & deposits
              </td>
              <td className="py-3 pr-4 text-emerald-600 font-medium">Built-in</td>
              <td className="py-3 text-neutral-500">Plugins / extra cost</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">
                Google Business Profile sync
              </td>
              <td className="py-3 pr-4 text-emerald-600 font-medium">Included</td>
              <td className="py-3 text-neutral-500">Not native</td>
            </tr>
          </tbody>
        </table>
      </section>
    </PinterestLandingPage>
  );
}
