import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FunnelListClient from './FunnelListClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Sales Funnels - Store Settings',
  description: 'Manage your sales funnels, order bumps, upsells, and one-time offers',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FunnelsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FunnelListClient tenantId={tenantId} />
    </TenantGuard>
  );
}
