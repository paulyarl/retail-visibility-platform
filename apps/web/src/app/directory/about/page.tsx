import { Metadata } from 'next';
import AboutDirectoryClient from './AboutDirectoryClient';

export const metadata: Metadata = {
  title: 'How It Works | Store Directory',
  description: 'Discover how our zero-effort directory automatically connects customers with local merchants through the power of automation.',
};

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AboutDirectoryPage() {
  return <AboutDirectoryClient />;
}
