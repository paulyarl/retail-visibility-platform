import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QuickstartOptionsSettingsClient from './QuickstartOptionsSettingsClient';

export const metadata: Metadata = {
  title: 'Quickstart Options - Store Settings',
  description: 'Configure quickstart and AI options for your store',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function QuickstartOptionsSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <QuickstartOptionsSettingsClient tenantId={tenantId} />;
}
