import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontOptionsSettingsClient from './StorefrontOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Storefront Options - Store Settings',
  description: 'Configure storefront display and behavior options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
