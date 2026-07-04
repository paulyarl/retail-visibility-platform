import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TenantGuard } from '@/components/tenant/TenantGuard';
import AppStoreClient from './AppStoreClient';

export const metadata: Metadata = {
  title: 'App Store - Store Settings',
  description: 'Browse and purchase plans, features, placements, and promotions',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AppStorePage({ params, searchParams }: PageProps) {
  const { tenantId } = await params;
  const { tab } = await searchParams;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <AppStoreClient tenantId={tenantId} initialTab={tab || 'plans'} />
    </TenantGuard>
  );
}
