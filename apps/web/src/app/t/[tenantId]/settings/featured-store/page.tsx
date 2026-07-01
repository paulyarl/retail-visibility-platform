import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FeaturedStoreClient from './FeaturedStoreClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Featured Store - Store Settings',
  description: 'Purchase featured placement for your products',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FeaturedStorePage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <FeaturedStoreClient tenantId={tenantId} />
    </TenantGuard>
  );
}
