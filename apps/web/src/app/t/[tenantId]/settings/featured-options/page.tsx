import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FeaturedOptionsSettingsClient from './FeaturedOptionsSettingsClient';

export const metadata: Metadata = {
  title: 'Featured Options - Store Settings',
  description: 'Configure which featured product types are available for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FeaturedOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <FeaturedOptionsSettingsClient tenantId={tenantId} />;
}
