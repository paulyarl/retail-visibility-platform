import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontMapsSettingsClient from './StorefrontMapsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Storefront Maps - Store Settings',
  description: 'Configure storefront map and location display options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontMapsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontMapsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
