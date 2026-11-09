import type { Metadata } from 'next';
import TenantsClient from '@/components/tenants/TenantsClient';

export const metadata: Metadata = {
  title: 'Tenants',
  // Auth-gated workspace switcher — Google only ever sees the login wall.
  robots: { index: false, follow: false },
};

export default function TenantsPage() {
  return <TenantsClient />;
}
