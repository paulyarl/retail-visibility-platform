import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StorefrontPoliciesClient from './StorefrontPoliciesClient';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';

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

  let effectiveStorefrontType: string | undefined;
  try {
    const storefrontState = await unifiedCapabilityService.getStorefrontState(tenantId);
    effectiveStorefrontType = storefrontState.effectiveType !== 'none' && storefrontState.effectiveType !== 'flexible'
      ? storefrontState.effectiveType
      : undefined;
  } catch {
    // Fail gracefully — gallery will show all templates
  }

  return <StorefrontPoliciesClient tenantId={tenantId} effectiveStorefrontType={effectiveStorefrontType} />;
}
