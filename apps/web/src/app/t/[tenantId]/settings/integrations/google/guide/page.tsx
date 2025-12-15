'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle, 
  ExternalLink, 
  HelpCircle,
  ShoppingBag,
  AlertTriangle,
  Info,
  ChevronRight
} from 'lucide-react';

export default function GoogleMerchantGuide() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Settings
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Integrations
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/t/${tenantId}/settings/integrations/google`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Google
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-neutral-900 dark:text-neutral-100">Setup Guide</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Google Merchant Center Setup Guide
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Get your products listed on Google Shopping in 3 easy steps
            </p>
          </div>
        </div>
        <Link 
          href={`/t/${tenantId}/settings/integrations/google`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Integrations
        </Link>
      </div>

      {/* What is Google Merchant Center */}
      <section className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          What is Google Merchant Center?
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Google Merchant Center is a free tool that helps you upload and manage your product data so it can appear across Google, 
          including Google Shopping, Google Search, Google Images, and more.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Benefits:</strong> When customers search for products you sell, your products can appear in Google Shopping results, 
            helping you reach millions of potential customers.
          </p>
        </div>
      </section>

      {/* Prerequisites */}
      <section className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-amber-600" />
          Before You Begin
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Make sure you have the following ready:
        </p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">A Google Account</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                You'll need a Google account (Gmail) to sign in and authorize access.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">A Google Merchant Center Account</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                If you don't have one, you can create it for free at{' '}
                <a 
                  href="https://merchants.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  merchants.google.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Products in Your Inventory</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Your products should have titles, descriptions, prices, and images for best results.
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Step-by-Step Guide */}
      <section className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
          Step-by-Step Setup
        </h2>

        {/* Step 1 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Connect Your Google Account
            </h3>
          </div>
          <div className="ml-11 space-y-3">
            <p className="text-neutral-600 dark:text-neutral-400">
              Click the <strong>"Connect Google Account"</strong> button on the Google Integrations page.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-neutral-600 dark:text-neutral-400">
              <li>You'll be redirected to Google's sign-in page</li>
              <li>Sign in with your Google account (or select an existing session)</li>
              <li>Review the permissions and click <strong>"Allow"</strong></li>
              <li>You'll be redirected back to the integrations page</li>
            </ol>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Use the same Google account that has access to your Merchant Center account.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Link Your Merchant Center Account
            </h3>
          </div>
          <div className="ml-11 space-y-3">
            <p className="text-neutral-600 dark:text-neutral-400">
              After connecting your Google account, click <strong>"Link Merchant Center"</strong>.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-neutral-600 dark:text-neutral-400">
              <li>A list of your Merchant Center accounts will appear</li>
              <li>Click on the account you want to use for this store</li>
              <li>The account will be linked automatically</li>
            </ol>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Don't see your account?</strong> Make sure you've created a Merchant Center account at{' '}
                <a 
                  href="https://merchants.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline"
                >
                  merchants.google.com
                </a>
                {' '}using the same Google account.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Verify Authorization
            </h3>
          </div>
          <div className="ml-11 space-y-3">
            <p className="text-neutral-600 dark:text-neutral-400">
              Once both steps are complete, the "Authorization Active" step will show a green checkmark.
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">
              This means your store is now connected and ready to sync products to Google Shopping!
            </p>
          </div>
        </div>
      </section>

      {/* What Happens Next */}
      <section className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          What Happens Next?
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Product Feed Validation</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Visit the Feed Validation page to check if your products meet Google's requirements.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Push Your Feed</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Once validated, you can push your product feed to Google Merchant Center.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Products Appear on Google</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                After Google reviews your products (usually within 24-48 hours), they'll appear in Google Shopping.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Troubleshooting
        </h2>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
              "No Merchant Center accounts found"
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Create a Merchant Center account at{' '}
              <a 
                href="https://merchants.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                merchants.google.com
              </a>
              {' '}using the same Google account you connected.
            </p>
          </div>
          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
              "Authorization expired"
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Click "Disconnect" and then reconnect your Google account. Tokens are automatically refreshed, 
              but occasionally a full reconnection is needed.
            </p>
          </div>
          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
              "Products not appearing on Google"
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Check the Feed Validation page for errors. Common issues include missing product images, 
              incomplete descriptions, or unmapped categories.
            </p>
          </div>
        </div>
      </section>

      {/* Need Help */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Need Help?
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          If you're having trouble setting up Google Merchant Center, our support team is here to help.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link 
            href={`/t/${tenantId}/settings/integrations/google`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Go to Setup
          </Link>
          <Link 
            href={`/t/${tenantId}/feed-validation`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors border border-neutral-200 dark:border-neutral-700"
          >
            Check Feed Validation
          </Link>
        </div>
      </section>
    </div>
  );
}
