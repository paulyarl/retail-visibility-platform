import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontLayoutsSettingsClient from './StorefrontLayoutsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Storefront Layout - Store Settings',
  description: 'Configure storefront layout options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontLayoutsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontLayoutsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
