'use client';

interface LocationClosedBannerProps {
  title: string;
  message: string;
  tenantId: string;
  businessName: string;
}

export default function LocationClosedBanner({ 
  title, 
  message, 
  tenantId, 
  businessName 
}: LocationClosedBannerProps) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-6">
            <svg 
              className="w-10 h-10 text-orange-600 dark:text-orange-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">
            {title}
          </h1>

          {/* Business Name */}
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-4">
            {businessName}
          </p>

          {/* Message */}
          <p className="text-neutral-700 dark:text-neutral-300 mb-8 leading-relaxed">
            {message}
          </p>

          {/* Contact Info Card */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-600 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">
              Need to get in touch?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Please contact the business directly for more information about their hours and availability.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
            >
              Browse Other Stores
            </a>
            <a
              href={`/tenant/${tenantId}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              Try Again
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
