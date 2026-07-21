'use client';

import React from 'react';
import { ProductFunnelStep } from '@/services/ProductFunnelService';
import { Zap, TrendingUp, ArrowDownCircle, Flame, Tag, Package } from 'lucide-react';

interface FunnelStepperProps {
  steps: ProductFunnelStep[];
  productTitle: string;
}

const STEP_STYLES: Record<string, { icon: React.ElementType; label: string; classes: string }> = {
  order_bump: {
    icon: Zap,
    label: 'Order Bump',
    classes: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  },
  upsell: {
    icon: TrendingUp,
    label: 'Upsell',
    classes: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
  },
  downsell: {
    icon: ArrowDownCircle,
    label: 'Downsell',
    classes: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  },
  oto: {
    icon: Flame,
    label: 'One-Time Offer',
    classes: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
  },
  coupon_offer: {
    icon: Tag,
    label: 'Coupon',
    classes: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
  },
};

function getStepMeta(step?: ProductFunnelStep | null) {
  if (!step) {
    return {
      icon: Package,
      label: 'Main Product',
      sub: '',
      classes: 'bg-primary text-primary-foreground border-primary',
    };
  }
  const meta = STEP_STYLES[step.step_type] || {
    icon: Package,
    label: step.step_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    classes: 'bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  };
  return {
    ...meta,
    sub: step.display_description || meta.label,
  };
}

export function FunnelStepper({ steps, productTitle }: FunnelStepperProps) {
  const nodes: { key: string; icon: React.ElementType; label: string; sub: string; classes: string }[] = [
    {
      key: 'main',
      ...getStepMeta(null),
      sub: productTitle,
    },
    ...steps.map((step) => {
      const meta = getStepMeta(step);
      return {
        key: step.id,
        icon: meta.icon,
        label: step.display_title || meta.label,
        sub: meta.sub,
        classes: meta.classes,
      };
    }),
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          const isLast = idx === nodes.length - 1;
          return (
            <React.Fragment key={node.key}>
              <div className="flex flex-row md:flex-col md:items-center md:text-center gap-3 md:gap-0 md:flex-1">
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${node.classes}`}
                  aria-label={node.label}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 md:mt-2 text-left md:text-center">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {node.label}
                  </p>
                  {node.sub && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {node.sub}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <>
                  {/* Mobile vertical connector */}
                  <div className="md:hidden w-0.5 h-10 bg-neutral-200 dark:bg-neutral-700 ml-5 my-1" />
                  {/* Desktop horizontal connector */}
                  <div className="hidden md:block flex-1 h-0.5 bg-neutral-200 dark:bg-neutral-700 self-center mx-2 mt-5" />
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default FunnelStepper;
