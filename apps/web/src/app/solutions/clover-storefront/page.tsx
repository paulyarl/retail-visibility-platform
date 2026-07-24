import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Clover+POS+Storefront';
const title = 'Clover POS Storefront for Local Retail | Visible Shelf';
const description =
  'Sync your Clover POS to a live online storefront. Real-time inventory, local pickup, delivery, and a checkout that matches your in-store data.';

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

export default function CloverStorefrontPage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Turn your Clover POS into a live online storefront"
      subheadline="Sync inventory, pricing, and catalog automatically — no spreadsheets, no double entry."
      description={description}
      features={[
        'Real-time product sync from Clover',
        'Local pickup, delivery, and shipping options',
        'Unified inventory across online and in-store',
        'Storefront tier built for small retailers',
      ]}
      primaryCtaLabel="Start your free storefront"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="Explore all features"
      secondaryCtaHref="/features?ref=pinterest"
      heroImage={heroImage}
    />
  );
}
