import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import IntegrationOptionsSettingsClient from './IntegrationOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Integration Options - Store Settings',
  description: 'Configure which integrations are available for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function IntegrationOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <IntegrationOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
