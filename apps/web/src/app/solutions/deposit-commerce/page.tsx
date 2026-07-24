import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Deposit+Commerce';
const title = 'Deposit Commerce & BOPIS for Retailers | Visible Shelf';
const description =
  'Collect deposits online, reserve items, and let customers pay the balance in-store. Reduce no-shows and drive foot traffic.';

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

export default function DepositCommercePage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Take deposits online and sell in-store without the risk"
      subheadline="Reserve products with a partial deposit, then let shoppers complete the purchase when they pick up."
      description={description}
      features={[
        'Partial deposit or pay-in-full flexibility',
        'Built-in BOPIS workflow and pickup scheduling',
        'Inventory holds until balance is collected',
        'Foot-traffic proof and conversion tracking',
      ]}
      primaryCtaLabel="Start taking deposits"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="See how it works"
      secondaryCtaHref="/features?ref=pinterest"
      heroImage={heroImage}
    />
  );
}
