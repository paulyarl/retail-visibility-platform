'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { crmPublicInquiryService } from '@/services/crm/CrmPublicInquiryService';
import { publicFaqService, PublicFaq, PublicFaqCategory } from '@/services/PublicFaqService';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface PublicInquiryFormProps {
  tenantId: string;
  tenantName?: string;
  sourceLabel?: string; // e.g. "Storefront", "Directory"
  onSuccess?: () => void;
  /** If true, FAQs are fetched and shown above the form */
  showFaqs?: boolean;
  /** Product context — when set, product info is appended to the inquiry body */
  productId?: string;
  productName?: string;
}

function generateCaptcha(): { num1: number; num2: number; seed: string; answer: number } {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, seed: `${num1},${num2}`, answer: num1 + num2 };
}

export default function PublicInquiryForm({ tenantId, tenantName, sourceLabel, onSuccess, showFaqs = true, productId, productName }: PublicInquiryFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [hpField, setHpField] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [faqs, setFaqs] = useState<PublicFaq[]>([]);
  const [faqCategories, setFaqCategories] = useState<PublicFaqCategory[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const captcha = useMemo(() => generateCaptcha(), []);
  const [currentCaptcha, setCurrentCaptcha] = useState(captcha);
  const refreshCaptcha = useCallback(() => setCurrentCaptcha(generateCaptcha()), []);

  const isCustomer = crmPublicInquiryService.isCustomerAuthenticated();

  // Load FAQs and categories when component mounts
  useEffect(() => {
    if (!tenantId) return;
    if (showFaqs) {
      setFaqsLoading(true);
      Promise.all([
        publicFaqService.getStorefrontFAQs(tenantId),
        publicFaqService.getCategories(tenantId),
      ])
        .then(([faqData, catData]) => {
          setFaqs(faqData);
          setFaqCategories(catData);
        })
        .catch((err) => console.error('Failed to load FAQs for inquiry form:', err))
        .finally(() => setFaqsLoading(false));
    } else {
      // Still load categories for the inquiry dropdown
      publicFaqService.getCategories(tenantId)
        .then((catData) => setFaqCategories(catData))
        .catch((err) => console.error('Failed to load FAQ categories:', err));
    }
  }, [tenantId, showFaqs]);

  const faqsByCategory = useMemo(() => {
    const map = new Map<string, PublicFaq[]>();
    for (const faq of faqs) {
      const catId = faq.category_id || 'uncategorized';
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(faq);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.display_order - b.display_order);
    }
    return map;
  }, [faqs]);

  const sortedCategories = useMemo(
    () => [...faqCategories].sort((a, b) => a.display_order - b.display_order),
    [faqCategories]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!subject.trim()) {
      setError('Please enter a subject.');
      return;
    }

    if (Number(captchaInput) !== currentCaptcha.answer) {
      setError('CAPTCHA answer is incorrect. Please try again.');
      refreshCaptcha();
      setCaptchaInput('');
      return;
    }

    // Compose body with product/category context when available
    let inquiryBody = body.trim() || undefined;
    const contextParts: string[] = [];
    if (productName) contextParts.push(`Product: ${productName}`);
    if (productId) contextParts.push(`Product ID: ${productId}`);
    if (selectedCategory) {
      const catName = sortedCategories.find(c => c.id === selectedCategory)?.name;
      if (catName) contextParts.push(`Category: ${catName}`);
    }
    if (contextParts.length > 0) {
      const contextLine = contextParts.join(' | ');
      inquiryBody = inquiryBody ? `${inquiryBody}\n\n===\n${contextLine}` : contextLine;
    }

    setSubmitting(true);
    try {
      await crmPublicInquiryService.submitInquiry({
        tenant_id: tenantId,
        subject: subject.trim(),
        body: inquiryBody,
        sender_name: senderName.trim() || undefined,
        sender_email: senderEmail.trim() || undefined,
        sender_phone: senderPhone.trim() || undefined,
        captcha_answer: captchaInput,
        captcha_seed: currentCaptcha.seed,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit inquiry. Please try again.';
      if (msg.includes('captcha')) {
        setError('CAPTCHA verification failed. Please try again.');
        refreshCaptcha();
        setCaptchaInput('');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-green-600">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">Inquiry submitted!</p>
        <p className="text-xs text-neutral-500 mt-1">{tenantName || 'The merchant'} will respond to your inquiry.</p>
        <button
          onClick={() => {
            setSubmitted(false);
            setSubject('');
            setBody('');
            setSenderName('');
            setSenderEmail('');
            setSenderPhone('');
            setCaptchaInput('');
            refreshCaptcha();
          }}
          className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium"
        >
          Submit another inquiry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* FAQs above the form */}
      {showFaqs && faqs.length > 0 && (
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Before you reach out</p>
          {faqsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {sortedCategories.map((cat) => {
                const catFaqs = faqsByCategory.get(cat.id);
                if (!catFaqs || catFaqs.length === 0) return null;
                return (
                  <AccordionItem key={cat.id} value={`faq-${cat.slug}`}>
                    <AccordionTrigger className="text-sm font-medium text-neutral-800 hover:no-underline py-2">
                      {cat.name}
                      <span className="ml-2 text-xs font-normal text-neutral-400">({catFaqs.length})</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {catFaqs.map((faq) => (
                          <div key={faq.id}>
                            <p className="text-sm font-medium text-neutral-700">{faq.question}</p>
                            <p className="text-xs text-neutral-500 whitespace-pre-line">{faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      )}

      {/* Collapsed header */}
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Have a question?</p>
              <p className="text-xs text-neutral-500">
                Send us an inquiry. Include your email if you would like a direct response.
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        </button>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Send an Inquiry</p>
                <p className="text-xs text-neutral-500">
                  Ask a question or request information. We will respond via email if you provide one.
                </p>
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
              title="Collapse"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Honeypot — hidden from humans, bots auto-fill */}
            <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
              <label htmlFor="website_hp">Website</label>
              <input
                id="website_hp"
                name="website"
                type="text"
                value={hpField}
                onChange={e => setHpField(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Sender info (only for anonymous) */}
            {!isCustomer && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                  placeholder="Your email (optional)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  value={senderPhone}
                  onChange={e => setSenderPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* FAQ Category dropdown (when categories exist) */}
            {sortedCategories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-600"
              >
                <option value="">What is this about? (optional)</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject *"
              required
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />

            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe your question or request..."
              rows={3}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />

            {/* Math CAPTCHA */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 whitespace-nowrap">
                What is {currentCaptcha.num1} + {currentCaptcha.num2}?
              </span>
              <input
                type="number"
                value={captchaInput}
                onChange={e => setCaptchaInput(e.target.value)}
                placeholder="Answer"
                required
                className="w-20 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-center"
              />
              <button
                type="button"
                onClick={() => { refreshCaptcha(); setCaptchaInput(''); }}
                className="text-xs text-neutral-400 hover:text-neutral-600"
                title="New question"
              >
                ↻
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !subject.trim() || !captchaInput}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Sending...' : `Send Inquiry${sourceLabel ? ` (${sourceLabel})` : ''}`}
              </button>
            </div>

            {isCustomer && (
              <p className="text-[10px] text-neutral-400 text-center">Submitted as authenticated customer</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
