'use client';

import CachedProductsClient from '@/components/admin/CachedProductsClient';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function CachedProductsPage() {
  return <CachedProductsClient />;
}
