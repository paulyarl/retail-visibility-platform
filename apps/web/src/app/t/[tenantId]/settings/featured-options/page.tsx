import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FeaturedOptionsSettingsClient from './FeaturedOptionsSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Featured Options - Store Settings',
  description: 'Configure which featured product types are available for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FeaturedOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FeaturedOptionsSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
