'use client';

import { Package, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CloverDemoModeBannerProps {
  onConnectReal?: () => void;
  onDisableDemo?: () => void;
  onLearnMore?: () => void;
  className?: string;
}

export function CloverDemoModeBanner({
  onConnectReal,
  onDisableDemo,
  onLearnMore,
  className,
}: CloverDemoModeBannerProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-amber-200 bg-amber-50 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Package className="h-5 w-5 text-amber-600" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">
            📦 Demo Mode Active - Using 25 sample products
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            These are test items. Connect your real Clover account to sync your actual inventory.
          </p>
          
          <div className="mt-3 flex flex-wrap gap-2">
            {onConnectReal && (
              <Button
                variant="primary"
                size="sm"
                onClick={onConnectReal}
                className="bg-green-600 hover:bg-green-700"
              >
                Connect Clover
              </Button>
            )}
            {onLearnMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLearnMore}
              >
                Learn More
              </Button>
            )}
          </div>
        </div>

        {onDisableDemo && (
          <button
            onClick={onDisableDemo}
            className="flex-shrink-0 rounded-md p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors"
            aria-label="Disable demo mode"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
