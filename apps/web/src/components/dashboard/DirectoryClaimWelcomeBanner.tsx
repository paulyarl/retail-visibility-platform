'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, X, ArrowRight, CheckCircle } from 'lucide-react';

interface DirectoryClaimWelcomeBannerProps {
  tenantId: string;
  businessName?: string;
  category?: string;
  city?: string;
  /** Whether the ?welcome=true query param is present */
  show: boolean;
}

const TASKS = [
  { label: 'Verify your listing information', href: '/t/{tenantId}/settings/directory' },
  { label: 'Add business hours', href: '/t/{tenantId}/settings/directory' },
  { label: 'Upload a logo or photo', href: '/t/{tenantId}/settings/directory' },
  { label: 'Confirm SNAP/EBT status (if applicable)', href: '/t/{tenantId}/settings/directory' },
  { label: 'Upgrade to sell online', href: '/t/{tenantId}/settings/subscription/upgrade' },
];

export default function DirectoryClaimWelcomeBanner({
  tenantId,
  businessName,
  category,
  city,
  show,
}: DirectoryClaimWelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  const tasks = TASKS.map((t) => ({
    ...t,
    href: t.href.replace('{tenantId}', tenantId),
  }));

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-blue-400 hover:text-blue-600"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Welcome! You&apos;re now the owner of {businessName || 'this listing'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Your listing is live on the {city ? `${city} ` : ''}{category || 'directory'}{' '}
            directory. Here&apos;s what to do next:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
        {tasks.map((task, idx) => (
          <Link
            key={idx}
            href={task.href}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-700 bg-white/60 hover:bg-white rounded-lg px-3 py-2 transition-colors"
          >
            <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>{task.label}</span>
            <ArrowRight className="w-3 h-3 ml-auto text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
