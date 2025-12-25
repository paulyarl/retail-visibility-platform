'use client';

import Link from 'next/link';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const { settings } = usePlatformSettings();
  const platformName = settings?.platformName || 'Visible Shelf';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-neutral-900 hover:text-primary-600 transition-colors">
            {platformName}
          </Link>
          <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Sign In
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-neutral-900 mb-4">Privacy Policy</h1>
            <p className="text-neutral-600 mb-8 text-sm">
              Last updated: November 2025
            </p>

            <p className="text-neutral-700 mb-6">
              {platformName} is built by retailers, for retailers. We know your catalog, pricing,
              and customer data are real assets, not demo content. This Privacy Policy explains
              how we collect, use, and protect your information when you use our platform.
              The service is designed for businesses and is not directed to children under 16.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">1. Information We Collect</h2>
            <p className="text-neutral-700 mb-3">
              We only collect the information we need to run the service and improve it over time.
              This includes:
            </p>
            <ul className="list-disc list-inside text-neutral-700 space-y-1 mb-4">
              <li>Account details (name, email, business name, contact information).</li>
              <li>Tenant and location data (store addresses, hours, branding, categories).</li>
              <li>Product and inventory data (SKUs, prices, descriptions, photos, metadata).</li>
              <li>
                Customer data your connected commerce tools send to us (for example, order history
                and buyer contact details), when those integrations are enabled.
              </li>
              <li>Usage data (feature usage, performance metrics, error logs).</li>
              <li>Billing details processed via our payment provider (e.g. Stripe).</li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">2. How We Use Your Information</h2>
            <p className="text-neutral-700 mb-3">We use your data to:</p>
            <ul className="list-disc list-inside text-neutral-700 space-y-1 mb-4">
              <li>Provide and maintain the platform (storefront, directory, Google sync, POS sync).</li>
              <li>Keep your products, locations, and analytics accurate and up to date.</li>
              <li>Secure your account, prevent abuse, and monitor platform health.</li>
              <li>Communicate about product updates, billing, and support.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">3. How We Share Data</h2>
            <p className="text-neutral-700 mb-3">
              We do not sell your data. We only share it with:
            </p>
            <ul className="list-disc list-inside text-neutral-700 space-y-1 mb-4">
              <li>
                Service providers that power the platform (e.g. hosting, storage, analytics, payment
                processing) under strict confidentiality terms.
              </li>
              <li>
                Commerce and discovery partners you choose to connect to, such as Google Merchant
                Center, Google Business Profile, or POS providers like Clover and Square.
              </li>
              <li>
                Authorities, if required to comply with applicable law, regulation, or a valid
                legal process.
              </li>
            </ul>
            <p className="text-neutral-700 mb-4">
              When we process your customers' data that flows in from tools like your POS or
              ecommerce systems, we do so as a service provider on your behalf. You remain
              responsible for your relationship with those customers and for complying with any
              obligations you have to them under applicable law.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">4. Data Security</h2>
            <p className="text-neutral-700 mb-4">
              We treat your catalog and customer data like production infrastructure, not like a side
              project. We use role-based access controls, audit logging, and encryption in transit
              and at rest to help protect your information. No system is perfectly secure, but we
              design and operate the platform with a security-first mindset.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">5. Data Retention</h2>
            <p className="text-neutral-700 mb-4">
              We retain your data for as long as you have an active account. When you cancel, we
              typically preserve data for a limited retention window so you can reactivate without
              losing everything. After that window, we may delete or anonymize data in line with our
              retention policies and legal obligations.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">6. Your Choices</h2>
            <p className="text-neutral-700 mb-3">You can:</p>
            <ul className="list-disc list-inside text-neutral-700 space-y-1 mb-4">
              <li>Update your account and business details from the Settings pages.</li>
              <li>Export key data (like products and inventory) from within the app.</li>
              <li>Request account cancellation via the in-product flows or by contacting support.</li>
              <li>
                Depending on where you are located, you may have additional rights (like access,
                correction, or deletion of certain data). You can contact us if you would like to
                exercise these rights where they apply.
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">7. Cookies and Analytics</h2>
            <p className="text-neutral-700 mb-6">
              We may use cookies and similar technologies to keep you signed in, remember your
              preferences, and understand how the platform is used. We may also use third-party
              analytics tools to help us measure performance. You can usually control cookies via
              your browser settings, but disabling them may affect how the service works.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">8. Contact Us</h2>
            <p className="text-neutral-700 mb-6">
              If you have questions about this Privacy Policy or how we handle data, you can contact
              us from the in-product Contact page or by using the Contact link in the footer.
            </p>

            <p className="text-neutral-500 text-sm">
              This page is a product-facing summary, not legal advice. Your specific rights and
              obligations may vary based on your jurisdiction and agreements with us.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
