import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TenantGuard } from '@/components/tenant/TenantGuard';
import SocialProofClient from './SocialProofClient';

export const metadata: Metadata = {
  title: 'Social Proof - Store Settings',
  description: 'Moderate and display user-generated content and social proof',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function SocialProofPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <TenantGuard tenantId={tenantId}>
      <SocialProofClient tenantId={tenantId} />
    </TenantGuard>
  );
}
