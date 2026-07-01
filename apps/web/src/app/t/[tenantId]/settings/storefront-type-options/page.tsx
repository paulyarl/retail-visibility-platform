import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontTypeOptionsSettingsClient from './StorefrontTypeOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Storefront Type Options - Store Settings',
  description: 'Configure your storefront type and preferences',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontTypeOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontTypeOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
