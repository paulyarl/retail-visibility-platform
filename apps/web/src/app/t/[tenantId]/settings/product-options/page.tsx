import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ProductOptionsSettingsClient from './ProductOptionsSettingsClient';

export const metadata: Metadata = {
  title: 'Product Options - Store Settings',
  description: 'Configure which product types and creation features are available',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function ProductOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <ProductOptionsSettingsClient tenantId={tenantId} />;
}
