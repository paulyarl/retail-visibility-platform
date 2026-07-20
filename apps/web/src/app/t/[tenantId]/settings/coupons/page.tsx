import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CouponManagementClient from './CouponManagementClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Coupons - Store Settings',
  description: 'Manage discount coupons and promotions',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function CouponsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <CouponManagementClient tenantId={tenantId} />
    </TenantGuard>
  );
}
