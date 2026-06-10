'use client';

import { useState, useCallback, useMemo } from 'react';
import { crmPublicInquiryService } from '@/services/crm/CrmPublicInquiryService';

interface PublicInquiryFormProps {
  tenantId: string;
  tenantName?: string;
  sourceLabel?: string; // e.g. "Storefront", "Directory"
  onSuccess?: () => void;
}

function generateCaptcha(): { num1: number; num2: number; seed: string; answer: number } {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, seed: `${num1},${num2}`, answer: num1 + num2 };
}

export default function PublicInquiryForm({ tenantId, tenantName, sourceLabel, onSuccess }: PublicInquiryFormProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [hpField, setHpField] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const captcha = useMemo(() => generateCaptcha(), []);
  // Regenerate on focus to keep fresh
  const [currentCaptcha, setCurrentCaptcha] = useState(captcha);
  const refreshCaptcha = useCallback(() => setCurrentCaptcha(generateCaptcha()), []);

  const isCustomer = crmPublicInquiryService.isCustomerAuthenticated();

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

    setSubmitting(true);
    try {
      await crmPublicInquiryService.submitInquiry({
        tenant_id: tenantId,
        subject: subject.trim(),
        body: body.trim() || undefined,
        sender_name: senderName.trim() || undefined,
        sender_email: senderEmail.trim() || undefined,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>
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

      <button
        type="submit"
        disabled={submitting || !subject.trim() || !captchaInput}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all"
      >
        {submitting ? 'Sending...' : `Send Inquiry${sourceLabel ? ` (${sourceLabel})` : ''}`}
      </button>

      {isCustomer && (
        <p className="text-[10px] text-neutral-400 text-center">Submitted as authenticated customer</p>
      )}
    </form>
  );
}
