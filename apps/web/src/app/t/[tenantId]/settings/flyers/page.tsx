import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FlyerSettingsClient from './FlyerSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Specials Flyer - Store Settings',
  description: 'Create and manage your time-boxed specials flyers',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FlyerSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FlyerSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
