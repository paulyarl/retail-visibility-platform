import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CouponOptionsSettingsClient from './CouponOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Coupon Options - Store Settings',
  description: 'Manage coupon capability preferences and spotlight settings',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function CouponOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <CouponOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
