'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, MessageSquare, ThumbsUp, ThumbsDown, Package, Store } from 'lucide-react';
import { publicFaqService, PublicFaq } from '@/services/PublicFaqService';
import { clientLogger } from '@/lib/client-logger';

interface FeedbackState {
  [faqId: string]: 'up' | 'down' | null;
}

interface FaqProductDisplayProps {
  tenantId: string;
  productId: string;
  merchantName?: string;
  askBotCta?: boolean;
  /** If provided, FAQ section is hidden when not enabled */
  enabled?: boolean;
  /** If provided, feedback buttons are hidden when not enabled */
  feedbackEnabled?: boolean;
}

export default function FaqProductDisplay({
  tenantId,
  productId,
  merchantName = 'Merchant',
  askBotCta = true,
  enabled = true,
  feedbackEnabled = true,
}: FaqProductDisplayProps) {
  const [productFAQs, setProductFAQs] = useState<PublicFaq[]>([]);
  const [storefrontFAQs, setStorefrontFAQs] = useState<PublicFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>({});

  useEffect(() => {
    async function fetchProductFaqs() {
      try {
        const data = await publicFaqService.getProductFAQs(tenantId, productId);
        setProductFAQs(data.productFAQs);
        setStorefrontFAQs(data.storefrontFAQs);
      } catch (err) {
        clientLogger.error('Failed to load product FAQs:', { detail: err });
      } finally {
        setLoading(false);
      }
    }
    if (tenantId && productId && enabled) fetchProductFaqs();
  }, [tenantId, productId, enabled]);

  const filteredProductFAQs = useMemo(() => {
    if (!searchQuery.trim()) return productFAQs;
    const q = searchQuery.toLowerCase();
    return productFAQs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [productFAQs, searchQuery]);

  const filteredStorefrontFAQs = useMemo(() => {
    if (!searchQuery.trim()) return storefrontFAQs;
    const q = searchQuery.toLowerCase();
    return storefrontFAQs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [storefrontFAQs, searchQuery]);

  const handleFeedback = async (faqId: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [faqId]: type }));
    await publicFaqService.submitFeedback(tenantId, faqId, type);
  };

  const renderFaqList = (faqs: PublicFaq[]) => (
    <div className="space-y-4">
      {faqs.map((faq) => (
        <div key={faq.id} className="group">
          <h4 className="text-sm font-medium text-neutral-800 mb-1">{faq.question}</h4>
          <p className="text-sm text-neutral-600 whitespace-pre-line">{faq.answer}</p>
          {feedbackEnabled && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleFeedback(faq.id, 'up')}
              className={`p-1 rounded hover:bg-green-50 transition-colors ${
                feedback[faq.id] === 'up' ? 'text-green-600' : 'text-neutral-400'
              }`}
              aria-label="Helpful"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleFeedback(faq.id, 'down')}
              className={`p-1 rounded hover:bg-red-50 transition-colors ${
                feedback[faq.id] === 'down' ? 'text-red-500' : 'text-neutral-400'
              }`}
              aria-label="Not helpful"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
          )}
        </div>
      ))}
    </div>
  );

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="py-6 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (productFAQs.length === 0 && storefrontFAQs.length === 0) return null;

  return (
    <section id="faq-product-section" className="w-full" data-product-id={productId}>
      {/* Header */}
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">FAQs</h2>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search product FAQs..."
          className="pl-9"
        />
      </div>

      <Accordion type="multiple" defaultValue={['product', 'storefront']} className="w-full">
        {/* Tier 1: About This Product */}
        {filteredProductFAQs.length > 0 && (
          <AccordionItem value="product">
            <AccordionTrigger className="text-sm font-semibold text-neutral-900 hover:no-underline">
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                About This Product
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {renderFaqList(filteredProductFAQs)}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Tier 2: From [Merchant] */}
        {filteredStorefrontFAQs.length > 0 && (
          <AccordionItem value="storefront">
            <AccordionTrigger className="text-sm font-semibold text-neutral-900 hover:no-underline">
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4 text-neutral-500" />
                From {merchantName}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {renderFaqList(filteredStorefrontFAQs)}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* No results */}
      {filteredProductFAQs.length === 0 && filteredStorefrontFAQs.length === 0 && (
        <p className="text-center text-neutral-500 py-6">No FAQs match your search.</p>
      )}

      {/* Ask Bot CTA */}
      {askBotCta && (
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Ask about this product
          </Button>
        </div>
      )}
    </section>
  );
}
