import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import WholesaleDashboardClient from './WholesaleDashboardClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Wholesale & Suppliers - Store Settings',
  description: 'Manage wholesale supplier matches and affiliate earnings',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function WholesaleDashboardPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <WholesaleDashboardClient tenantId={tenantId} />
    </TenantGuard>
  );
}
