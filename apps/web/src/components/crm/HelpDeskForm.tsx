'use client';

import { useState, useMemo, useCallback } from 'react';
import { helpDeskService } from '@/services/crm/HelpDeskService';
import { LifeBuoy, ChevronDown, ChevronUp, Send } from 'lucide-react';

function generateCaptcha(): { num1: number; num2: number; seed: string; answer: number } {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, seed: `${num1},${num2}`, answer: num1 + num2 };
}

const HELP_DESK_CATEGORIES = [
  'General Inquiry',
  'Pricing & Plans',
  'Technical Issue',
  'Account & Access',
  'Storefront & Directory',
  'Google Shopping Sync',
  'Payments & Checkout',
  'Clover / POS Integration',
  'Feature Request',
  'Bug Report',
  'Partnership & Business',
  'Other',
] as const;

export default function HelpDeskForm() {
  const [expanded, setExpanded] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [hpField, setHpField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const captcha = useMemo(() => generateCaptcha(), []);
  const [currentCaptcha, setCurrentCaptcha] = useState(captcha);
  const refreshCaptcha = useCallback(() => setCurrentCaptcha(generateCaptcha()), []);

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

    // Compose body with formatted context (same pattern as PublicInquiryForm)
    let inquiryBody = body.trim() || undefined;
    const contextParts: string[] = [];
    if (category) contextParts.push(`Category: ${category}`);
    if (typeof window !== 'undefined') {
      contextParts.push(`Page: ${window.location.href}`);
      contextParts.push(`Browser: ${navigator.userAgent.split(') ').pop() || navigator.userAgent}`);
    }
    if (contextParts.length > 0) {
      const contextLine = contextParts.join(' | ');
      inquiryBody = inquiryBody ? `${inquiryBody}\n\n===\n${contextLine}` : contextLine;
    }

    setSubmitting(true);
    try {
      await helpDeskService.submitHelpDeskInquiry({
        subject: subject.trim(),
        body: inquiryBody,
        sender_name: senderName.trim() || undefined,
        sender_email: senderEmail.trim() || undefined,
        sender_phone: senderPhone.trim() || undefined,
        captcha_answer: captchaInput,
        captcha_seed: currentCaptcha.seed,
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit. Please try again.';
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
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-green-600">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-lg font-semibold text-neutral-900 dark:text-white">Help Desk inquiry submitted!</p>
        <p className="text-sm text-neutral-500 mt-2 max-w-md mx-auto">
          Our platform support team will review your message and respond via email if you provided one.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setSubject('');
            setBody('');
            setCategory('');
            setSenderName('');
            setSenderEmail('');
            setSenderPhone('');
            setCaptchaInput('');
            refreshCaptcha();
          }}
          className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium"
        >
          Submit another inquiry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between gap-3 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-neutral-900 dark:text-white">Help Desk Support</p>
              <p className="text-sm text-neutral-500">
                Have a question about the platform? Reach out to our support team.
              </p>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-neutral-400 flex-shrink-0" />
        </button>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <LifeBuoy className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-900 dark:text-white">Help Desk Support</p>
                <p className="text-sm text-neutral-500">
                  Ask a question or report an issue. We will respond via email if you provide one.
                </p>
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
              title="Collapse"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Honeypot */}
            <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
              <label htmlFor="website_hp_hd">Website</label>
              <input
                id="website_hp_hd"
                name="website"
                type="text"
                value={hpField}
                onChange={e => setHpField(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Sender info */}
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

            {/* Category dropdown */}
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-600"
            >
              <option value="">What is this about? (optional)</option>
              {HELP_DESK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

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
              placeholder="Describe your question or issue..."
              rows={4}
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
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !subject.trim() || !captchaInput}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all"
              >
                {submitting ? 'Sending...' : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Help Desk Inquiry
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
