/**
 * Subscription State Banner Component
 * Shows prominent banners for maintenance/freeze states
 * Dismissible with localStorage persistence
 * 
 * Usage:
 * <SubscriptionStateBanner tenantId={tenantId} />
 */

'use client';

import { useState, useEffect } from 'react';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { Card, CardContent, Button } from '@/components/ui';
import { AlertTriangle, Lock, X, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionStateBannerProps {
  tenantId?: string;
  className?: string;
}

export default function SubscriptionStateBanner({
  tenantId,
  className = '',
}: SubscriptionStateBannerProps) {
  const { usage, loading, error } = useSubscriptionUsage(tenantId);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissal state
  useEffect(() => {
    if (usage?.tenantId) {
      const dismissKey = `subscription-banner-dismissed-${usage.tenantId}`;
      const dismissed = localStorage.getItem(dismissKey);
      setIsDismissed(dismissed === 'true');
    }
  }, [usage?.tenantId]);

  if (loading || error || !usage) {
    return null;
  }

  // Only show for maintenance or freeze states
  const isFrozen = usage.internalStatus === 'frozen';
  const isMaintenance = usage.internalStatus === 'maintenance';

  if (!isFrozen && !isMaintenance) {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    const dismissKey = `subscription-banner-dismissed-${usage.tenantId}`;
    localStorage.setItem(dismissKey, 'true');
    setIsDismissed(true);
  };

  // Frozen state banner (red, critical)
  if (isFrozen) {
    return (
      <Card className={`border-red-300 bg-red-50 shadow-sm ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-red-100 p-2 shrink-0">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 className="font-semibold text-red-900 text-lg">
                    Account Frozen - Read-Only Mode
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Your maintenance window has ended. Your storefront and directory remain visible, but you cannot make changes.
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-red-600 hover:text-red-800 shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                <Link href="/settings/subscription">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                    View Plans & Upgrade
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <div className="text-xs text-red-700">
                  Upgrade to regain full access and continue growing your business
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Maintenance state banner (yellow, warning)
  return (
    <Card className={`border-yellow-300 bg-yellow-50 shadow-sm ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-yellow-100 p-2 shrink-0">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="font-semibold text-yellow-900 text-lg">
                  Maintenance Mode - Limited Access
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your trial has ended. You can update existing products but cannot add new ones or use premium features.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-yellow-600 hover:text-yellow-800 shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-yellow-100 rounded-lg p-3 mb-3">
              <p className="text-sm text-yellow-800 font-medium mb-2">What you can do right now:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>✓ Update existing products (prices, descriptions, images)</li>
                <li>✓ Sync changes to Google and your storefront</li>
                <li>✓ Update your business profile and hours</li>
              </ul>
              <p className="text-sm text-yellow-800 font-medium mt-3 mb-2">What's currently blocked:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>✗ Add new products or locations</li>
                <li>✗ Use Quick Start wizard or barcode scanner</li>
                <li>✗ Bulk operations that increase SKU count</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/settings/subscription">
                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                  View Plans & Upgrade
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <div className="text-xs text-yellow-700">
                Choose a paid plan to restore full access and continue growing
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
