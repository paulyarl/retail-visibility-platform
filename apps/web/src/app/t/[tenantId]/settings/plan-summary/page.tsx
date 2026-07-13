import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TenantGuard } from '@/components/tenant/TenantGuard';
import PlanSummaryPageClient from './PlanSummaryPageClient';

export const metadata: Metadata = {
  title: 'Plan Summary - Store Settings',
  description: 'Full overview of your plan capabilities and feature status',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function PlanSummaryPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <PlanSummaryPageClient tenantId={tenantId} />
    </TenantGuard>
  );
}
