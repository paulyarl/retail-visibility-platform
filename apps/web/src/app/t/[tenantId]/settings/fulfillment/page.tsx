import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button } from '@mantine/core';
import FulfillmentSettingsClient from './FulfillmentSettingsClient';
import { TenantGuard } from '@/components/tenant/TenantGuard';

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

  return (
    <TenantGuard tenantId={tenantId}>
      <FulfillmentSettingsClient tenantId={tenantId} />
    </TenantGuard>
  );
}
