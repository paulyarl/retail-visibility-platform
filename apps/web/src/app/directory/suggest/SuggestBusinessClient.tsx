'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lightbulb, ArrowLeft, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, TextInput, Textarea } from '@mantine/core';
import DirectorySuggestionPublicService from '@/services/DirectorySuggestionPublicService';

interface SuggestBusinessClientProps {
  defaultCategory?: string;
  defaultCity?: string;
  defaultState?: string;
}

export default function SuggestBusinessClient({
  defaultCategory = '',
  defaultCity = '',
  defaultState = '',
}: SuggestBusinessClientProps) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    businessName: '',
    address: '',
    city: defaultCity,
    state: defaultState,
    zipCode: '',
    phone: '',
    primaryCategory: defaultCategory,
    submitterEmail: '',
    submitterComment: '',
    sourcePage: '',
    honeyPot: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ slug: string | null; businessName: string } | null>(null);

  useEffect(() => {
    const source = searchParams.get('source') || (typeof window !== 'undefined' ? window.location.pathname : '');
    setForm((prev) => ({ ...prev, sourcePage: source }));
  }, [searchParams]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      setError('Please enter the business name.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setError(null);
    setExisting(null);

    const result = await DirectorySuggestionPublicService.submitSuggestion(form);

    if (result.success) {
      setStatus('success');
      setForm({
        businessName: '',
        address: '',
        city: defaultCity,
        state: defaultState,
        zipCode: '',
        phone: '',
        primaryCategory: defaultCategory,
        submitterEmail: '',
        submitterComment: '',
        sourcePage: typeof window !== 'undefined' ? window.location.pathname : '',
        honeyPot: '',
      });
      return;
    }

    if (result.error === 'already_listed' && result.existing) {
      setExisting({
        slug: result.existing.slug,
        businessName: result.existing.businessName,
      });
    }

    setError(
      result.error === 'already_listed'
        ? 'This business appears to already be listed.'
        : result.error === 'rate_limit_exceeded'
        ? 'Too many suggestions. Please wait an hour and try again.'
        : result.error === 'suspected_bot'
        ? 'Submission rejected.'
        : 'Something went wrong. Please try again.'
    );
    setStatus('error');
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>

        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="w-7 h-7 text-yellow-500" />
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Suggest a Business
            </h1>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Know a local business that should be listed? Tell us about it and our team will review the suggestion.
          </p>

          {status === 'success' ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                Suggestion received
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Thanks for helping us grow the directory. Our team will review it before publishing.
              </p>
              <Button component={Link} href="/directory" variant="light">
                Back to Directory
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 dark:text-red-200 text-sm font-medium">{error}</p>
                    {existing && existing.slug && (
                      <Link
                        href={`/place/${existing.slug}`}
                        className="text-sm text-blue-600 dark:text-blue-400 underline mt-1 inline-block"
                      >
                        View {existing.businessName}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <TextInput
                label="Business name"
                placeholder="e.g. Patel’s African Grocery"
                value={form.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                required
              />

              <TextInput
                label="Address"
                placeholder="123 Market St"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="City"
                  placeholder="Indianapolis"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
                <TextInput
                  label="State"
                  placeholder="IN"
                  value={form.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextInput
                  label="ZIP code"
                  placeholder="46204"
                  value={form.zipCode}
                  onChange={(e) => handleChange('zipCode', e.target.value)}
                />
                <TextInput
                  label="Phone"
                  placeholder="(317) 555-0100"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>

              <TextInput
                label="Category"
                placeholder="e.g. African grocery"
                value={form.primaryCategory}
                onChange={(e) => handleChange('primaryCategory', e.target.value)}
              />

              <TextInput
                label="Your email (optional)"
                placeholder="you@example.com"
                type="email"
                value={form.submitterEmail}
                onChange={(e) => handleChange('submitterEmail', e.target.value)}
              />

              <Textarea
                label="Why should this business be listed? (optional)"
                placeholder="Any details that help us verify the business..."
                value={form.submitterComment}
                onChange={(e) => handleChange('submitterComment', e.target.value)}
                rows={3}
              />

              {/* Honeypot — hidden from real users */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  value={form.honeyPot}
                  onChange={(e) => handleChange('honeyPot', e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <Button
                type="submit"
                leftSection={<Send className="w-4 h-4" />}
                loading={status === 'submitting'}
                fullWidth
              >
                Submit Suggestion
              </Button>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                Suggestions are reviewed before being published. You can also{' '}
                <Link href="/directory" className="underline text-blue-600 dark:text-blue-400">
                  browse the directory
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
