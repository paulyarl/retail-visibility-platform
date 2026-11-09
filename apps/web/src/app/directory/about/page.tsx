import { Metadata } from 'next';
import { platformOrigin } from '@/lib/storefront-routing';
import AboutDirectoryClient from './AboutDirectoryClient';

export const metadata: Metadata = {
  title: 'How It Works | Store Directory',
  description: 'Discover how our zero-effort directory automatically connects customers with local merchants through the power of automation.',
  alternates: { canonical: `${platformOrigin()}/directory/about` },
};


export default function AboutDirectoryPage() {
  return <AboutDirectoryClient />;
}
