'use client';

import React from 'react';
import { SocialPlatformBadges } from '../SocialPlatformBadges';
import { SocialShareButtons } from '../SocialShareButtons';

export interface SocialProofSectionProps {
  tenantId: string;
  tenant: any;
  businessName: string;
  layoutVariant: 'classic' | 'editorial' | 'immersive';
  isSocialStore: boolean;
  socialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;
}

export function SocialProofSection({
  tenantId,
  tenant,
  businessName,
  layoutVariant,
  isSocialStore,
  socialCommerceFlags,
}: SocialProofSectionProps) {
  if (layoutVariant === 'immersive') {
    return (
      <ImmersiveSocialProof
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        isSocialStore={isSocialStore}
        socialCommerceFlags={socialCommerceFlags}
        layoutVariant={layoutVariant}
      />
    );
  }

  if (layoutVariant === 'editorial') {
    return (
      <EditorialSocialProof
        tenantId={tenantId}
        tenant={tenant}
        businessName={businessName}
        isSocialStore={isSocialStore}
        socialCommerceFlags={socialCommerceFlags}
        layoutVariant={layoutVariant}
      />
    );
  }

  return (
    <ClassicSocialProof
      tenantId={tenantId}
      tenant={tenant}
      businessName={businessName}
      isSocialStore={isSocialStore}
      socialCommerceFlags={socialCommerceFlags}
      layoutVariant={layoutVariant}
    />
  );
}

export default SocialProofSection;

// ---------------------------------------------------------------------------
// Classic variant
// ---------------------------------------------------------------------------

function ClassicSocialProof({
  tenantId,
  tenant,
  businessName,
  isSocialStore,
  socialCommerceFlags,
  layoutVariant,
}: SocialProofSectionProps) {
  const meta = tenant?.metadata || {};
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons);

  return (
    <section className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800" aria-label="Social proof">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-3">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Follow {businessName}
            </h2>
            <SocialPlatformBadges tenant={tenant} layoutVariant={layoutVariant} />
          </div>
          {showShareButtons && (
            <div className="flex flex-col items-center sm:items-end gap-2">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Share this store</span>
              <SocialShareButtons url={shareUrl} title={businessName} layoutVariant={layoutVariant} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Editorial variant
// ---------------------------------------------------------------------------

function EditorialSocialProof({
  tenantId,
  tenant,
  businessName,
  isSocialStore,
  socialCommerceFlags,
  layoutVariant,
}: SocialProofSectionProps) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons);

  return (
    <section className="bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800" aria-label="Social proof">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">
              Connect with {businessName}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Follow us on social media for the latest updates, behind-the-scenes content, and exclusive offers.
            </p>
            <SocialPlatformBadges tenant={tenant} layoutVariant={layoutVariant} />
          </div>
          {showShareButtons && (
            <div className="flex flex-col items-center md:items-end gap-3">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Share this store</span>
              <SocialShareButtons url={shareUrl} title={businessName} layoutVariant={layoutVariant} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Immersive variant
// ---------------------------------------------------------------------------

function ImmersiveSocialProof({
  tenantId,
  tenant,
  businessName,
  isSocialStore,
  socialCommerceFlags,
  layoutVariant,
}: SocialProofSectionProps) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const showShareButtons = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseShareButtons);

  return (
    <section className="bg-white dark:bg-neutral-900 py-8" aria-label="Social proof">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">Follow</span>
            <SocialPlatformBadges tenant={tenant} layoutVariant={layoutVariant} />
          </div>
          {showShareButtons && (
            <SocialShareButtons url={shareUrl} title={businessName} layoutVariant={layoutVariant} />
          )}
        </div>
      </div>
    </section>
  );
}
