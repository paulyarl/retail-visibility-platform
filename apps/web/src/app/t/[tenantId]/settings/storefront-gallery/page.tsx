import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontGallerySettingsClient from './StorefrontGallerySettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export const metadata: Metadata = {
  title: 'Image Gallery - Store Settings',
  description: 'Configure image gallery display and layout options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontGallerySettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <StorefrontGallerySettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
