import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ProductConditionsClient from './ProductConditionsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Product Conditions - Store Settings',
  description: 'Filter and reassign product conditions in bulk',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function ProductConditionsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <ProductConditionsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
