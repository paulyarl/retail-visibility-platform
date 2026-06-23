'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { publicStorefrontPolicyService } from '@/services/PublicStorefrontPolicyService';

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

interface StorefrontFooterProps {
  tenantId: string;
  businessName: string;
  businessDescription?: string;
  logoUrl?: string | null;
  platformSettings?: any;
  features?: any;
  directoryPublished?: boolean;
  tenantSlug?: string;
  isRetailStore?: boolean;
  contactInfo?: {
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  socialLinks?: SocialLink[];
  showsSocialMedia?: boolean;
  optFlags?: any;
  currentUrl?: string;
  /** Compact 2-column variant for Immersive layout */
  variant?: 'full' | 'compact';
  className?: string;
  storefrontPolicies?: {
    return_policy: string | null;
    shipping_policy: string | null;
    privacy_policy: string | null;
    terms_of_service: string | null;
    refund_policy: string | null;
  } | null;
}

// Inline social icon SVGs (zero-dependency)
const socialIconMap: Record<string, React.ReactNode> = {
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.1 1.03-1.35 1.74-.25.69-.23 1.44-.07 2.15.34 1.44 1.75 2.59 3.27 2.63 1.12.04 2.2-.54 2.84-1.43.22-.29.39-.62.49-.97.14-.58.1-1.19.11-1.78.01-3.54 0-7.08.01-10.62-.01-1.59.06-3.2-.26-4.77z" />
    </svg>
  ),
  linkedin: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  youtube: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

export default function StorefrontFooter({
  tenantId,
  businessName,
  businessDescription,
  logoUrl,
  platformSettings,
  features,
  directoryPublished,
  tenantSlug,
  isRetailStore = true,
  contactInfo,
  socialLinks = [],
  showsSocialMedia = false,
  optFlags,
  currentUrl,
  variant = 'full',
  className = '',
  storefrontPolicies = null,
}: StorefrontFooterProps) {
  const platformName = platformSettings?.platformName || 'Visible Shelf';
  const platformLogo = platformSettings?.logoUrl;
  const removeBranding = features?.removePlatformBranding ?? false;

  // Fetch policies if not passed as prop
  const [policies, setPolicies] = useState(storefrontPolicies);
  useEffect(() => {
    if (storefrontPolicies) { setPolicies(storefrontPolicies); return; }
    if (!tenantId) return;
    let cancelled = false;
    publicStorefrontPolicyService.getPolicies(tenantId).then(result => {
      if (!cancelled && result) setPolicies(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [tenantId, storefrontPolicies]);

  // Compact variant (2-col) for Immersive layout
  if (variant === 'compact') {
    return (
      <footer className={`bg-neutral-900 text-white dark:bg-neutral-950 dark:text-white mt-8 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Col 1: Store info + links */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                {logoUrl ? (
                  <div className="relative w-8 h-8">
                    <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="32px" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {businessName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <span className="font-semibold text-white">{businessName}</span>
              </div>
              {businessDescription && (
                <p className="text-neutral-300 dark:text-neutral-400 text-sm line-clamp-2 mb-3">{businessDescription}</p>
              )}
              <ul className="space-y-1 text-sm">
                {directoryPublished && tenantSlug && isRetailStore && (
                  <>
                    <li>
                      <Link href={`/directory/${tenantSlug}`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">
                        Directory
                      </Link>
                    </li>
                    <li>
                      <Link href={`/shops/${tenantSlug}`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">
                        Shop
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link href="/directory" className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">
                    Browse Directory
                  </Link>
                </li>
                {policies?.return_policy && (
                  <li><Link href={`/tenant/${tenantId}/policies/return_policy`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">Returns</Link></li>
                )}
                {policies?.shipping_policy && (
                  <li><Link href={`/tenant/${tenantId}/policies/shipping_policy`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">Shipping</Link></li>
                )}
                {policies?.privacy_policy && (
                  <li><Link href={`/tenant/${tenantId}/policies/privacy_policy`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">Privacy</Link></li>
                )}
                {policies?.terms_of_service && (
                  <li><Link href={`/tenant/${tenantId}/policies/terms_of_service`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">Terms</Link></li>
                )}
                {policies?.refund_policy && (
                  <li><Link href={`/tenant/${tenantId}/policies/refund_policy`} className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">Refunds</Link></li>
                )}
                <li>
                  <Link href="/privacy/ccpa" className="text-neutral-300 dark:text-neutral-400 hover:text-white transition-colors">
                    Do Not Sell My Info
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 2: Contact + policies */}
            <div className="flex flex-col items-start sm:items-end">
              <div className="text-sm text-white space-y-1 text-right">
                {contactInfo?.address && <p className="text-neutral-300">{contactInfo.address}</p>}
                {contactInfo?.phone && (
                  <p>
                    <a href={`tel:${contactInfo.phone}`} className="text-white hover:text-neutral-300 transition-colors">
                      {contactInfo.phone}
                    </a>
                  </p>
                )}
                {contactInfo?.email && (
                  <p>
                    <a href={`mailto:${contactInfo.email}`} className="text-white hover:text-neutral-300 transition-colors">
                      {contactInfo.email}
                    </a>
                  </p>
                )}
              </div>
              {showsSocialMedia && socialLinks.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {socialLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 dark:text-neutral-500 hover:text-white transition-colors"
                      aria-label={link.platform}
                    >
                      {socialIconMap[link.icon] || (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Platform branding */}
          {!removeBranding && (
            <div className="mt-6 pt-6 border-t border-neutral-700 dark:border-neutral-800 text-center text-xs text-neutral-400 dark:text-neutral-500">
              <Link href="/" title={platformName} className="no-underline">
                <div className="flex items-center justify-center gap-2">
                  <span>Powered by</span>
                  {platformLogo && (
                    <img
                      src={platformLogo}
                      alt={platformName}
                      className="h-4 w-auto object-contain opacity-60"
                      loading="lazy"
                      decoding="async"
                      width="16"
                      height="16"
                    />
                  )}
                  <span>{platformName}</span>
                </div>
              </Link>
            </div>
          )}
        </div>
      </footer>
    );
  }

  // Full variant (4-col) for Editorial / Classic layouts
  return (
    <footer className={`bg-neutral-900 dark:bg-neutral-950 text-white mt-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 4-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              {logoUrl ? (
                <div className="relative w-10 h-10">
                  <Image src={logoUrl} alt={businessName} fill className="object-contain rounded" sizes="40px" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {businessName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <span className="font-semibold text-white text-lg">{businessName}</span>
            </div>
            {businessDescription && (
              <p className="text-neutral-400 text-sm line-clamp-3">{businessDescription}</p>
            )}
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {directoryPublished && tenantSlug && isRetailStore && (
                <>
                  <li>
                    <Link href={`/directory/${tenantSlug}`} className="text-neutral-400 hover:text-white transition-colors">
                      Directory
                    </Link>
                  </li>
                  <li>
                    <Link href={`/shops/${tenantSlug}`} className="text-neutral-400 hover:text-white transition-colors">
                      Shop
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/directory" className="text-neutral-400 hover:text-white transition-colors">
                  Browse Directory
                </Link>
              </li>
              <li>
                <Link href="/shops" className="text-neutral-400 hover:text-white transition-colors">
                  Browse Shops
                </Link>
              </li>
              {policies?.return_policy && (
                <li><Link href={`/tenant/${tenantId}/policies/return_policy`} className="text-neutral-400 hover:text-white transition-colors">Return Policy</Link></li>
              )}
              {policies?.shipping_policy && (
                <li><Link href={`/tenant/${tenantId}/policies/shipping_policy`} className="text-neutral-400 hover:text-white transition-colors">Shipping Policy</Link></li>
              )}
              {policies?.refund_policy && (
                <li><Link href={`/tenant/${tenantId}/policies/refund_policy`} className="text-neutral-400 hover:text-white transition-colors">Refund Policy</Link></li>
              )}
              {policies?.privacy_policy && (
                <li><Link href={`/tenant/${tenantId}/policies/privacy_policy`} className="text-neutral-400 hover:text-white transition-colors">Privacy Policy</Link></li>
              )}
              {policies?.terms_of_service && (
                <li><Link href={`/tenant/${tenantId}/policies/terms_of_service`} className="text-neutral-400 hover:text-white transition-colors">Terms of Service</Link></li>
              )}
              <li>
                <Link href="/privacy/ccpa" className="text-neutral-400 hover:text-white transition-colors">
                  Do Not Sell My Info
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Store Info */}
          <div>
            <h4 className="font-semibold text-white mb-4">Store Info</h4>
            <ul className="space-y-2 text-sm">
              {contactInfo?.address && <li className="text-neutral-400">{contactInfo.address}</li>}
              {contactInfo?.phone && (
                <li>
                  <a href={`tel:${contactInfo.phone}`} className="text-neutral-400 hover:text-white transition-colors">
                    {contactInfo.phone}
                  </a>
                </li>
              )}
              {contactInfo?.email && (
                <li>
                  <a href={`mailto:${contactInfo.email}`} className="text-neutral-400 hover:text-white transition-colors">
                    {contactInfo.email}
                  </a>
                </li>
              )}
              {showsSocialMedia && socialLinks.length > 0 && (
                <li className="pt-2">
                  <div className="flex items-center gap-2">
                    {socialLinks.map((link) => (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-white transition-colors"
                        aria-label={link.platform}
                      >
                        {socialIconMap[link.icon] ? (
                          <span className="w-4 h-4 [&_svg]:w-4 [&_svg]:h-4">{socialIconMap[link.icon]}</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        )}
                      </a>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Col 4: QR Code */}
          <div className="flex flex-col items-start lg:items-center">
            <h4 className="font-semibold text-white mb-4">Share This Store</h4>
            <TenantQRCode
              url={currentUrl || `/tenant/${tenantId}`}
              tenantId={tenantId}
              label="Scan to Share"
              downloadName={businessName?.toLowerCase().replace(/[^a-z0-9]/g, '-')}
              size={140}
              showDownload={true}
              pageType="storefront"
              capabilityFlags={optFlags}
            />
          </div>
        </div>

        {/* Platform branding */}
        {!removeBranding && (
          <div className="mt-10 pt-8 border-t border-neutral-800 text-center text-sm text-neutral-500">
            <Link href="/" title={platformName} style={{ textDecoration: 'none' }}>
              <div className="flex items-center justify-center gap-2">
                <span>Powered by</span>
                {platformLogo && (
                  <img
                    src={platformLogo}
                    alt={platformName}
                    className="h-5 w-auto object-contain opacity-60"
                    loading="lazy"
                    decoding="async"
                    width="20"
                    height="20"
                  />
                )}
                <span>{platformName}</span>
              </div>
            </Link>
          </div>
        )}
      </div>
    </footer>
  );
}
