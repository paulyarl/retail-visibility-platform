import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FaqHub from '@/components/faq/FaqHub';
import SetTenantId from '@/components/client/SetTenantId';

export const metadata: Metadata = {
  title: 'FAQ Hub',
  description: 'Manage storefront, product, and template FAQs',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function FaqPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <FaqHub tenantId={tenantId} />
    </>
  );
}
