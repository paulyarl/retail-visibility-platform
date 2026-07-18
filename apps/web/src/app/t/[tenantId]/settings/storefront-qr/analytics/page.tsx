import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QrAnalyticsClient from './QrAnalyticsClient';

export const metadata: Metadata = {
  title: 'QR Analytics - Store Settings',
  description: 'View QR code scan performance and conversion metrics',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function QrAnalyticsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <QrAnalyticsClient tenantId={tenantId} />;
}
