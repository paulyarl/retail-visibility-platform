'use client';

import Link from 'next/link';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

export default function TermsPage() {
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
            <h1 className="text-4xl font-bold text-neutral-900 mb-4">Terms of Service</h1>
            <p className="text-neutral-600 mb-8 text-sm">
              Last updated: November 2025
            </p>

            <p className="text-neutral-700 mb-6">
              These Terms of Service ("Terms") govern your access to and use of {platformName}.
              By creating an account or using the platform, you agree to these Terms. If you are
              using the platform on behalf of a business, you represent that you have authority to
              bind that business to these Terms.
            </p>
            <p className="text-neutral-700 mb-6">
              When we say "{platformName}", "we", or "us", we mean the company that operates this
              service. "You" means the business or organization using the platform. "Service"
              means the hosted software and related features, including your storefront, directory,
              and sync tools, as they may evolve over time.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">1. Your Account</h2>
            <p className="text-neutral-700 mb-4">
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity that occurs under your account. You agree to provide accurate
              information and to notify us promptly of any unauthorized access or security issues.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">2. Acceptable Use</h2>
            <p className="text-neutral-700 mb-3">
              You agree to use the platform only for lawful purposes and in accordance with these
              Terms. In particular, you will not:
            </p>
            <ul className="list-disc list-inside text-neutral-700 space-y-1 mb-4">
              <li>Use the platform to upload or distribute unlawful, harmful, or infringing content.</li>
              <li>Attempt to probe, scan, or test the vulnerability of the platform or its systems.</li>
              <li>Reverse engineer or attempt to derive source code from the service.</li>
              <li>Use the platform to misrepresent products, prices, or availability.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">3. Subscription, Billing, and Trials</h2>
            <p className="text-neutral-700 mb-4">
              Access to certain features is provided on a subscription basis. Trial periods, plan
              limits, and billing behavior (including what happens when a trial ends or a payment
              fails) are described in the in-product subscription views and related documentation.
              By starting a subscription, you authorize us and our payment processor to charge the
              applicable fees until you cancel in accordance with the service flows. Unless stated
              otherwise, subscriptions renew automatically at the then-current price, and you are
              responsible for any applicable taxes. If we change prices for your plan, we will
              provide notice through the product or by another reasonable method where required.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">4. Content and Intellectual Property</h2>
            <p className="text-neutral-700 mb-3">
              You retain ownership of the content you upload to the platform (such as product
              information, images, and branding). You grant {platformName} a limited license to host,
              process, and display that content as needed to provide the service (including
              storefront, directory, and integrations with partners like Google or POS providers
              when you choose to connect them).
            </p>
            <p className="text-neutral-700 mb-4">
              The platform itself, including its software, design, and branding, is owned by
              {platformName} and its licensors. You may not use our trademarks or trade dress without
              prior written permission.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">5. Service Changes and Availability</h2>
            <p className="text-neutral-700 mb-4">
              We may update or change features from time to time to improve the platform. We aim for
              high availability, but the service is provided on an "as is" and "as available" basis
              and may be interrupted for maintenance, upgrades, or factors outside our control.
              Some features rely on third-party services (such as Google or POS providers), and
              their availability or behavior may change based on those third parties' decisions and
              policies.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">6. Disclaimers and Limitation of Liability</h2>
            <p className="text-neutral-700 mb-4">
              To the maximum extent permitted by law, {platformName} is not liable for indirect,
              incidental, or consequential damages arising out of your use of the platform, including
              any third-party services you choose to connect to it. Our total liability for any
              claim related to the service is limited to the amount you paid for the service in the
              3 months preceding the claim, to the extent such limitation is permitted by applicable
              law.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">7. Termination</h2>
            <p className="text-neutral-700 mb-4">
              You may stop using the platform at any time. We may suspend or terminate your access
              if you materially breach these Terms or use the platform in a way that risks harm to
              the service or other users. Where reasonable, we will provide notice before
              termination. After termination, we may retain your content for a limited period to
              allow export or reactivation before it is deleted or anonymized in line with our
              retention practices and legal obligations.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">8. Changes to These Terms</h2>
            <p className="text-neutral-700 mb-4">
              We may update these Terms to reflect changes in the service or applicable law. When we
              make material changes, we will post an updated version and, where appropriate, notify
              you through the product or by email. Your continued use of the platform after changes
              take effect constitutes acceptance of the updated Terms. If you have a separate written
              agreement or order form with us, that document may govern over these Terms where they
              conflict, and applicable law may grant you additional rights that cannot be limited by
              contract.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-10 mb-3">9. Contact</h2>
            <p className="text-neutral-700 mb-6">
              If you have questions about these Terms, you can reach us from the in-product Contact
              page or via the Contact link in the footer.
            </p>

            <p className="text-neutral-500 text-sm">
              This page is a product-facing summary of key terms and is not a substitute for formal
              legal advice. You may need your own legal review before relying on these Terms for
              your jurisdiction.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
