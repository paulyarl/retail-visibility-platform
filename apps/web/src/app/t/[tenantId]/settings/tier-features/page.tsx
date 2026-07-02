import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TenantGuard } from '@/components/tenant/TenantGuard';
import SetTenantId from '@/components/client/SetTenantId';
import TierFeaturesClient from './TierFeaturesClient';

export const metadata: Metadata = {
  title: 'Tier Features - Store Settings',
  description: 'View your current tier features and compare plans',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function TierFeaturesPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <SetTenantId tenantId={tenantId} />
      <TierFeaturesClient tenantId={tenantId} />
    </TenantGuard>
  );
}
