import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FaqControlPanel from '@/components/faq/FaqControlPanel';

export const metadata: Metadata = {
  title: 'FAQ Control Panel - Store Settings',
  description: 'Monitor FAQ coverage, health checks, and feedback metrics',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FaqControlPanelPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <FaqControlPanel tenantId={tenantId} />;
}
