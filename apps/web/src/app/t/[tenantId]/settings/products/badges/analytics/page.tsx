import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import BadgeAnalyticsClient from './BadgeAnalyticsClient';

export const metadata: Metadata = {
  title: 'Badge Analytics - Store Settings',
  description: 'View badge performance metrics and ROI analysis',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function BadgeAnalyticsPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <BadgeAnalyticsClient tenantId={tenantId} />;
}
