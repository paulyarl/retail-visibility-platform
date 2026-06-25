import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AbandonedCartsClient from './AbandonedCartsClient';

export const metadata: Metadata = {
  title: 'Abandoned Carts - Recovery Dashboard',
  description: 'Track and recover abandoned shopping carts',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function AbandonedCartsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <AbandonedCartsClient tenantId={tenantId} />;
}
