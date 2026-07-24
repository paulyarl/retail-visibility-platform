import type { Metadata } from 'next';
import { PinterestLandingPage } from '@/components/marketing/PinterestLandingPage';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com';
const heroImage =
  'https://placehold.co/1200x1800/e60023/ffffff?text=Omnichannel';
const title = 'Omnichannel Retail System | Visible Shelf';
const description =
  'Run one connected retail system across in-store, online, and local pickup. Give shoppers the choice to pay, pick up, or ship without adding work.';

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

export default function OmnichannelPage() {
  return (
    <PinterestLandingPage
      title={title}
      headline="Sell anywhere with one connected omnichannel system"
      subheadline="Let shoppers buy online, pick up in-store, or ship — all from the same product catalog and inventory."
      description={description}
      features={[
        'Single product catalog for all channels',
        'Split-path checkout: deposit or full pay',
        'Inventory stays in sync everywhere',
        'Omnichannel tier for growing retailers',
      ]}
      primaryCtaLabel="Build my omnichannel store"
      primaryCtaHref="/auth/signup?ref=pinterest"
      secondaryCtaLabel="Compare solutions"
      secondaryCtaHref="/compare/clover-vs-shopify?ref=pinterest"
      heroImage={heroImage}
    />
  );
}
