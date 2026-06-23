'use client';

import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';

interface ProductInquirySectionProps {
  tenantId: string;
  businessName: string;
  productId: string;
  productName: string;
  crmOptionsFlags?: PublicCrmOptionsFlags | null;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ProductInquirySection({
  tenantId,
  businessName,
  productId,
  productName,
  crmOptionsFlags,
  layoutVariant = 'classic',
}: ProductInquirySectionProps) {
  if (!crmOptionsFlags?.crm_enabled || !crmOptionsFlags?.crm_inquiry_product_enabled) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Ask about this product</h3>
              <p className="text-xs text-neutral-500">Send an inquiry to {businessName}</p>
            </div>
          </div>
          <PublicInquiryForm
            tenantId={tenantId}
            tenantName={businessName}
            sourceLabel="Product"
            productId={productId}
            productName={productName}
          />
        </div>
      </div>
    </div>
  );
}
