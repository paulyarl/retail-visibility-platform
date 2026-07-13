import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontQrSettingsClient from './StorefrontQrSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'QR Codes - Store Settings',
  description: 'Configure QR code display and styling options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontQrSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontQrSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
