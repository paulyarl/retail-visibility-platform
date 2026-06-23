'use client';

import StorefrontFooter from '@/app/tenant/[id]/layouts/shared/StorefrontFooter';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductFooterSectionProps {
  product: any;
  tenantProfile: any;
  businessName: string;
  platformSettings: any;
  optFlags?: StorefrontOptionFlags | null;
  currentUrl: string;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ProductFooterSection({
  product,
  tenantProfile,
  businessName,
  platformSettings,
  optFlags,
  currentUrl,
  layoutVariant = 'classic',
}: ProductFooterSectionProps) {
  return (
    <StorefrontFooter
      tenantId={product.tenantId}
      businessName={tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name || businessName || 'Store'}
      businessDescription={tenantProfile?.profileData?.business_description || tenantProfile?.profileData?.businessDescription || ''}
      logoUrl={tenantProfile?.profileData?.logo_url || null}
      platformSettings={platformSettings}
      features={null}
      directoryPublished={tenantProfile?.hasDirectory || false}
      tenantSlug={product.tenant?.slug || ''}
      isRetailStore={tenantProfile?.metadata?.store_type !== 'online'}
      contactInfo={{
        address: tenantProfile?.profileData
          ? [
              tenantProfile.profileData.address_line1,
              tenantProfile.profileData.city,
              tenantProfile.profileData.state,
              tenantProfile.profileData.postal_code,
            ].filter(Boolean).join(', ') || null
          : null,
        phone: tenantProfile?.profileData?.phone_number || null,
        email: tenantProfile?.profileData?.email || null,
        website: tenantProfile?.profileData?.website || null,
      }}
      socialLinks={((): { platform: string; url: string; icon: string }[] => {
        const links: { platform: string; url: string; icon: string }[] = [];
        const meta = tenantProfile?.metadata || {};
        if (meta.instagram) links.push({ platform: 'Instagram', url: meta.instagram, icon: 'instagram' });
        if (meta.facebook) links.push({ platform: 'Facebook', url: meta.facebook, icon: 'facebook' });
        if (meta.twitter || meta.x) links.push({ platform: 'X', url: meta.twitter || meta.x, icon: 'x' });
        if (meta.tiktok) links.push({ platform: 'TikTok', url: meta.tiktok, icon: 'tiktok' });
        if (meta.linkedin) links.push({ platform: 'LinkedIn', url: meta.linkedin, icon: 'linkedin' });
        if (meta.youtube) links.push({ platform: 'YouTube', url: meta.youtube, icon: 'youtube' });
        return links;
      })()}
      showsSocialMedia={!!(tenantProfile?.metadata?.instagram || tenantProfile?.metadata?.facebook || tenantProfile?.metadata?.twitter || tenantProfile?.metadata?.x || tenantProfile?.metadata?.tiktok || tenantProfile?.metadata?.linkedin || tenantProfile?.metadata?.youtube)}
      optFlags={optFlags}
      currentUrl={currentUrl}
      variant={layoutVariant === 'quick-commerce' ? 'compact' : 'full'}
    />
  );
}
