import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Google+Visibility';
const title = 'Google Visibility for Local Stores | Visible Shelf';
const description =
  'Get found on Google Search, Maps, and Shopping. Sync your Google Business Profile, product catalog, and local listings in one place.';

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

export default function GoogleVisibilityPage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Get found on Google Search, Maps & Shopping"
      subheadline="Connect your Google Business Profile, product catalog, and local listings so shoppers actually find you."
      description={description}
      features={[
        'Sync GBP categories, hours, and photos',
        'Google Shopping product feed ready',
        'Location-based search optimization',
        'Discovery tier built for local retail',
      ]}
      primaryCtaLabel="Boost my Google presence"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="Explore the directory"
      secondaryCtaHref="/directory?ref=pinterest"
      heroImage={heroImage}
    />
  );
}
