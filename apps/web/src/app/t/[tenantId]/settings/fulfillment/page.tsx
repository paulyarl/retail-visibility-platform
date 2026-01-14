import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FulfillmentSettingsClient from './FulfillmentSettingsClient';

export const metadata: Metadata = {
  title: 'Fulfillment Settings - Store Settings',
  description: 'Configure how customers can receive their orders',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FulfillmentSettingsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <FulfillmentSettingsClient tenantId={tenantId} />;
}
