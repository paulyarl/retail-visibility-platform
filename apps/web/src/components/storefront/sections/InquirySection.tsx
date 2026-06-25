'use client';

import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface InquirySectionProps {
  tenantId: string;
  businessName: string;
  layoutVariant: StorefrontLayoutKey;
}

export function InquirySection({
  tenantId,
  businessName,
  layoutVariant,
}: InquirySectionProps) {
  if (!tenantId) return null;

  if (layoutVariant === 'immersive') {
    return (
      <div className="lg:border-l lg:border-neutral-200 lg:dark:border-neutral-800 lg:pl-8">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Contact Us</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Have a question? Send us a message and we will get back to you.</p>
        <PublicInquiryForm tenantId={tenantId} tenantName={businessName} sourceLabel="Storefront" />
      </div>
    );
  }

  if (layoutVariant === 'editorial') {
    return (
      <section className="bg-white dark:bg-neutral-900" aria-label="Send an inquiry">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-lg mx-auto">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Send an Inquiry
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Ask {businessName || 'this store'} a question
                  </p>
                </div>
              </div>
              <PublicInquiryForm tenantId={tenantId} tenantName={businessName} sourceLabel="Storefront" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Send an Inquiry</h3>
              <p className="text-xs text-neutral-500">Ask {businessName || 'this store'} a question</p>
            </div>
          </div>
          <PublicInquiryForm tenantId={tenantId} tenantName={businessName} sourceLabel="Storefront" />
        </div>
      </div>
    </div>
  );
}
