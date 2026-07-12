import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BrandPartnerAdminClient from './BrandPartnerAdminClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Brand Partner Claims - Admin',
  description: 'Review and approve brand partner claims',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BrandPartnerAdminPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <BrandPartnerAdminClient tenantId={tenantId} />
    </TenantGuard>
  );
}
