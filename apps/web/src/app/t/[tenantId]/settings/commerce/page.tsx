import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CommerceSettingsClient from './CommerceSettingsClient';

export const metadata: Metadata = {
  title: 'Commerce Settings - Store Settings',
  description: 'Configure payment options and checkout behavior for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function CommerceSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <CommerceSettingsClient tenantId={tenantId} />;
}
