import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FunnelAnalyticsClient from './FunnelAnalyticsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Funnel Analytics - Store Settings',
  description: 'View conversion metrics and revenue for your sales funnel',
};

interface PageProps {
  params: Promise<{ tenantId: string; funnelId: string }>;
}

export default async function FunnelAnalyticsPage({ params }: PageProps) {
  const { tenantId, funnelId } = await params;

  if (!tenantId || !funnelId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FunnelAnalyticsClient tenantId={tenantId} funnelId={funnelId} />
    </TenantGuard>
  );
}
