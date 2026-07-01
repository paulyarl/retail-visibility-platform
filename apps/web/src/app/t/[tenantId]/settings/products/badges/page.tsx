import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CustomBadgeManagerClient from './CustomBadgeManagerClient';

export const metadata: Metadata = {
  title: 'Custom Badges - Store Settings',
  description: 'Create and manage custom badges for your products',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function CustomBadgesSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <CustomBadgeManagerClient tenantId={tenantId} />;
}
