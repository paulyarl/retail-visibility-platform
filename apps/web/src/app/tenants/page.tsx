"use client";

import TenantsClient from '@/components/tenants/TenantsClient';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function TenantsPage() {
  return <TenantsClient />;
}
