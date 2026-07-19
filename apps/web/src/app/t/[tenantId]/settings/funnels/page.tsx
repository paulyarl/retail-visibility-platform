import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FunnelOptionsSettingsClient from './FunnelOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Funnel Options - Store Settings',
  description: 'Manage sales funnel capability and merchant preferences',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FunnelOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FunnelOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
