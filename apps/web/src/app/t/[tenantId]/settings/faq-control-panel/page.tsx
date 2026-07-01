import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FaqControlPanel from '@/components/faq/FaqControlPanel';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'FAQ Control Panel - Store Settings',
  description: 'Monitor FAQ coverage, health checks, and feedback metrics',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FaqControlPanelPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FaqControlPanel tenantId={tenantId} />
    </TenantGuard>
  );
}
