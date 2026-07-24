import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Ecommerce+Checkout';
const title = 'Clean Ecommerce Checkout for Local Retail | Visible Shelf';
const description =
  'A fast, branded checkout for local retailers. Shipping, local delivery, in-store pickup, and digital products — all in one clean experience.';

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

export default function EcommercePage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Clean checkout built for local retail ecommerce"
      subheadline="A mobile-first cart and checkout that supports shipping, local delivery, pickup, and digital products."
      description={description}
      features={[
        'Fast, branded mobile checkout',
        'Shipping, local delivery, and pickup options',
        'Digital product delivery included',
        'E-commerce tier with built-in payments',
      ]}
      primaryCtaLabel="Start selling online"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="See store examples"
      secondaryCtaHref="/examples?ref=pinterest"
      heroImage={heroImage}
    />
  );
}
