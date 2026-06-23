'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

export default function CcpaPage() {
  const { settings } = usePlatformSettings();
  const platformName = settings?.platformName || 'Visible Shelf';

  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/ccpa/opt-out-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notes }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({ success: true, message: data.message });
        setEmail('');
        setNotes('');
      } else {
        setResult({ success: false, message: data.message || 'Failed to submit request. Please try again.' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again or contact support.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-neutral-900 hover:text-primary-600 transition-colors">
            {platformName}
          </Link>
          <a href="/auth/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Sign In
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-neutral-900 mb-4">
              Do Not Sell My Personal Information
            </h1>
            <p className="text-neutral-600 mb-8 text-sm">
              California Consumer Privacy Act (CCPA) Request Form
            </p>

            <div className="prose prose-neutral max-w-none mb-10">
              <p className="text-neutral-700 mb-4">
                California residents have the right under the CCPA to opt out of the
                &quot;sale&quot; of their personal information. &quot;Sale&quot; under CCPA
                is broadly defined and may include sharing information with third parties
                for advertising or analytics purposes.
              </p>
              <p className="text-neutral-700 mb-4">
                To exercise this right, please submit the form below. We will process your
                request within 15 business days and confirm via email.
              </p>
              <p className="text-neutral-700 mb-4">
                For other CCPA rights (right to know, right to delete), you may use the
                existing GDPR data export and account deletion tools available in your
                account settings.
              </p>
            </div>

            {/* Data Categories Disclosure */}
            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-4">
              Data Categories We Collect
            </h2>
            <div className="overflow-x-auto mb-10">
              <table className="min-w-full divide-y divide-neutral-200 border border-neutral-200 rounded-lg">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Examples</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-100">
                  <tr>
                    <td className="px-4 py-3 text-sm text-neutral-700">Identifiers</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Name, email, phone, IP address</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Account registration, checkout, site visits</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-neutral-700">Commercial Information</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Order history, purchase records</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Checkout process, cart activity</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-neutral-700">Internet Activity</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Browsing history, pages visited</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Cookies, analytics, site logs</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-neutral-700">Geolocation Data</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Shipping address, IP-based location</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Checkout, order fulfillment</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-neutral-700">Financial Information</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Payment method type, billing address</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">Payment processing (Stripe/Square/PayPal)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Opt-out Form */}
            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-4">
              Submit Opt-Out Request
            </h2>

            {result?.success && (
              <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-800">{result.message}</p>
              </div>
            )}

            {result && !result.success && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{result.message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="you@example.com"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-1">
                  Additional Details (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="Any additional information about your request"
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>

            <p className="text-xs text-neutral-500 mt-6 max-w-lg">
              We will not discriminate against you for exercising your CCPA rights.
              Your request will be processed within 15 business days. For questions,
              contact us at the email listed on our support page.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-700 transition-colors">{platformName}</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-neutral-700 transition-colors">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-neutral-700 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
