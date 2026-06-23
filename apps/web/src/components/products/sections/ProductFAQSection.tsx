'use client';

import FaqProductDisplay from '@/components/faq/FaqProductDisplay';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';

interface ProductFAQSectionProps {
  tenantId: string;
  productId: string;
  businessName: string;
  faqOptionsFlags?: PublicFaqOptionsFlags | null;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ProductFAQSection({
  tenantId,
  productId,
  businessName,
  faqOptionsFlags,
  layoutVariant = 'classic',
}: ProductFAQSectionProps) {
  if (!faqOptionsFlags?.faq_enabled || !faqOptionsFlags?.faq_display_product_accordion) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FaqProductDisplay
        tenantId={tenantId}
        productId={productId}
        merchantName={businessName}
        enabled={faqOptionsFlags.faq_enabled && faqOptionsFlags.faq_display_product_accordion}
        feedbackEnabled={faqOptionsFlags.faq_enabled && faqOptionsFlags.faq_display_feedback}
      />
    </div>
  );
}
