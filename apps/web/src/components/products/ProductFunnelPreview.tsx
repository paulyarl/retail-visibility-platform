'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FunnelStepper } from './FunnelStepper';
import { FunnelOfferCard } from './FunnelOfferCard';
import {
  productFunnelService,
  ProductFunnelPreview as ProductFunnelPreviewData,
} from '@/services/ProductFunnelService';
import { Sparkles, ChevronRight } from 'lucide-react';

interface ProductFunnelPreviewProps {
  tenantId: string;
  productId: string;
  productPriceCents: number | null;
  productType: 'physical' | 'digital' | 'hybrid';
  layoutVariant: 'classic' | 'showcase' | 'quick-commerce' | 'digital';
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function FunnelSkeleton() {
  return (
    <div className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 animate-pulse">
      <div className="h-5 w-48 bg-neutral-200 dark:bg-neutral-800 rounded mb-4" />
      <div className="flex flex-col md:flex-row gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1">
            <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800 mb-2" />
            <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductFunnelPreview({
  tenantId,
  productId,
  productPriceCents,
  productType,
  layoutVariant,
}: ProductFunnelPreviewProps) {
  const router = useRouter();
  const [funnel, setFunnel] = useState<ProductFunnelPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const isScroll = layoutVariant === 'quick-commerce' || layoutVariant === 'classic';
  const isDigital = layoutVariant === 'digital';

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const data = await productFunnelService.getProductFunnel(tenantId, productId);
        if (mounted) {
          setFunnel(data);
        }
      } catch (error) {
        // silent failure — funnel preview is non-critical
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tenantId, productId]);

  const savingsCents = useMemo(() => {
    if (!funnel || funnel.steps.length < 2) return 0;
    let individual = 0;
    let funnelTotal = 0;
    let pricedSteps = 0;

    for (const step of funnel.steps) {
      const itemPrice = step.offer_item?.price_cents ?? 0;
      const finalPrice = Math.max(0, (step.price_cents ?? itemPrice) - (step.discount_cents ?? 0));
      if (itemPrice > 0 || finalPrice > 0) {
        individual += itemPrice;
        funnelTotal += finalPrice;
        pricedSteps += 1;
      }
    }

    return pricedSteps >= 2 ? Math.max(0, individual - funnelTotal) : 0;
  }, [funnel]);

  const handleStepClick = (stepId: string, eventType: 'preview_step_clicked' | 'preview_buy_now_clicked') => {
    if (!funnel) return;
    productFunnelService
      .trackPreviewEvent(tenantId, funnel.funnel_id, stepId, eventType, productId)
      .catch(() => {});
    router.push(`/checkout?triggerProductId=${productId}`);
  };

  if (loading) {
    return <FunnelSkeleton />;
  }

  if (!funnel || !funnel.steps.length || funnel.metadata?.show_preview === false) {
    return null;
  }

  return (
    <section
      className={`w-full rounded-xl border bg-white dark:bg-neutral-900 p-4 md:p-6 shadow-sm ${
        isDigital
          ? 'border-indigo-200 dark:border-indigo-900/40'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles
          className={`w-5 h-5 ${isDigital ? 'text-indigo-500' : 'text-amber-500'}`}
        />
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Your Purchase Journey
        </h2>
        <ChevronRight className="w-5 h-5 text-neutral-400" />
      </div>

      <div className="mb-6">
        <FunnelStepper steps={funnel.steps} productTitle="Main Product" />
      </div>

      {savingsCents > 0 && (
        <div className="mb-4 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm font-medium text-green-800 dark:text-green-200">
          Save {formatCurrency(savingsCents)} vs. buying separately
        </div>
      )}

      <div
        className={
          isScroll
            ? 'flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
        }
      >
        {funnel.steps.filter((step) => step.is_active !== false).map((step) => (
          <div
            key={step.id}
            className={isScroll ? 'min-w-[260px] snap-start flex-shrink-0' : undefined}
          >
            <FunnelOfferCard
              step={step}
              productType={productType}
              onClick={() => handleStepClick(step.id, 'preview_step_clicked')}
              onBuyNow={() => handleStepClick(step.id, 'preview_buy_now_clicked')}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default ProductFunnelPreview;
