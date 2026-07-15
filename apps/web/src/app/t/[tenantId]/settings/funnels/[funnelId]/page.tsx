import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FunnelBuilderClient from './FunnelBuilderClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Funnel Builder - Store Settings',
  description: 'Edit your sales funnel steps, offers, and branching logic',
};

interface PageProps {
  params: Promise<{ tenantId: string; funnelId: string }>;
}

export default async function FunnelBuilderPage({ params }: PageProps) {
  const { tenantId, funnelId } = await params;

  if (!tenantId || !funnelId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FunnelBuilderClient tenantId={tenantId} funnelId={funnelId} />
    </TenantGuard>
  );
}
