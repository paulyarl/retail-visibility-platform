import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SocialCommerceSettingsClient from './SocialCommerceSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Social Commerce - Store Settings',
  description: 'Manage TikTok and Instagram shopping integrations',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function SocialCommerceSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <SocialCommerceSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
