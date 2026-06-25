'use client';

import FaqStorefrontDisplay from '@/components/faq/FaqStorefrontDisplay';
import { StorefrontLayoutKey } from '@/app/products/[id]/layouts/types';

interface FAQSectionProps {
  tenantId: string;
  faqEnabled: boolean;
  faqFeedbackEnabled: boolean;
  layoutVariant: StorefrontLayoutKey;
}

export function FAQSection({
  tenantId,
  faqEnabled,
  faqFeedbackEnabled,
  layoutVariant,
}: FAQSectionProps) {
  if (!faqEnabled || !tenantId) return null;

  if (layoutVariant === 'editorial') {
    return (
      <section className="bg-neutral-50 dark:bg-neutral-950" aria-label="Frequently asked questions">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 text-center">
              Frequently Asked Questions
            </h2>
            <FaqStorefrontDisplay
              tenantId={tenantId}
              enabled={faqEnabled}
              feedbackEnabled={faqFeedbackEnabled}
            />
          </div>
        </div>
      </section>
    );
  }

  if (layoutVariant === 'immersive') {
    return (
      <FaqStorefrontDisplay
        tenantId={tenantId}
        enabled={faqEnabled}
        feedbackEnabled={faqFeedbackEnabled}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FaqStorefrontDisplay
        tenantId={tenantId}
        enabled={faqEnabled}
        feedbackEnabled={faqFeedbackEnabled}
      />
    </div>
  );
}
