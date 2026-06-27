import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ProductTypeSettingsClient from './ProductTypeSettingsClient';

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

  return <ProductTypeSettingsClient tenantId={tenantId} />;
}
