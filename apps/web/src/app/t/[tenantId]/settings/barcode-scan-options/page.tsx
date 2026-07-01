import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BarcodeScanOptionsSettingsClient from './BarcodeScanOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Barcode Scan Options - Store Settings',
  description: 'Configure barcode scanning modes and preferences',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BarcodeScanOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <BarcodeScanOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
