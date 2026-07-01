import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QuickstartOptionsSettingsClient from './QuickstartOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Quickstart Options - Store Settings',
  description: 'Configure quickstart and AI options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function QuickstartOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <QuickstartOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
