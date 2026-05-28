import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontOptionsSettingsClient from './StorefrontOptionsSettingsClient';

export const metadata: Metadata = {
  title: 'Storefront Options - Store Settings',
  description: 'Configure storefront display and behavior options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <StorefrontOptionsSettingsClient tenantId={tenantId} />;
}
