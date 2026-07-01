import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ProductTypeSettingsClient from './ProductTypeSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Product Types - Store Settings',
  description: 'Configure which product types are available for your catalog',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function ProductTypeSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <ProductTypeSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
