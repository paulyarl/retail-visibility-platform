import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontHoursSettingsClient from './StorefrontHoursSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Business Hours - Store Settings',
  description: 'Configure business hours display options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontHoursSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontHoursSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
