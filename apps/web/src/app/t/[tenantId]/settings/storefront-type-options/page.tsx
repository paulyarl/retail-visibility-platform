import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontTypeOptionsSettingsClient from './StorefrontTypeOptionsSettingsClient';

export const metadata: Metadata = {
  title: 'Storefront Type Options - Store Settings',
  description: 'Configure your storefront type and preferences',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontTypeOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <StorefrontTypeOptionsSettingsClient tenantId={tenantId} />;
}
