import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontPoliciesClient from './StorefrontPoliciesClient';

export const metadata: Metadata = {
  title: 'Storefront Policies - Store Settings',
  description: 'Configure return, shipping, privacy, terms, and refund policies for your storefront',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function StorefrontPoliciesPage({ params }: PageProps) {
  const { tenantId } = await params;

  if (!tenantId) {
    redirect('/');
  }

  return <StorefrontPoliciesClient tenantId={tenantId} />;
}
