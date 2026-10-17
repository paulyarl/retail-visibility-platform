'use client';

/**
 * FlyerSection — time-boxed specials surface (spec: FLYER_SURFACE_SPEC §4.1).
 *
 * Self-gating: renders nothing when the flyer capability is off, no live flyer
 * exists, or the surface soft-gate rejects this surface. Data comes from the
 * public flyer endpoint; per-surface gating is decided server-side via
 * ?surface= and the resolver's can_use_* flags.
 *
 * Order CTAs are derived server-side (orderable + cta.orderEnabled) — the
 * component never checks capability keys itself for ordering.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { publicFlyerService, type PublicFlyerPayload, type PublicFlyerItem, type FlyerSurface } from '@/services/PublicFlyerService';
import { useMultiCart } from '@/hooks/useMultiCart';
import { formatPrice } from '@/lib/pricing';
import { clientLogger } from '@/lib/client-logger';

interface FlyerSectionProps {
  tenantId: string;
  tenantSlug?: string | null;
  tenantName?: string;
  tenantLogo?: string | null;
  surface?: FlyerSurface;
  /** Merchant's default_title from flyer options (server payload may override). */
  fallbackTitle?: string;
}

function windowLabel(startsAt: string, endsAt: string): string {
  const end = new Date(endsAt);
  const now = new Date();
  const sameDay = end.toDateString() === now.toDateString();
  if (sameDay) return 'Today only';
  const msLeft = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft <= 1) return 'Ends today';
  return `Ends ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function FlyerSection({ tenantId, tenantSlug, tenantName, tenantLogo, surface = 'storefront', fallbackTitle }: FlyerSectionProps) {
  const [payload, setPayload] = useState<PublicFlyerPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { addToCart } = useMultiCart(tenantId);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const src = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('src') ?? undefined
      : undefined;
    (async () => {
      try {
        const data = await publicFlyerService.getFlyers(tenantSlug || tenantId, surface, src);
        if (!cancelled) setPayload(data);
      } catch (error) {
        clientLogger.error('[FlyerSection] failed to load flyers', { detail: error });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, tenantSlug, surface]);

  if (!loaded || !payload?.enabled || !payload.flyers?.length) return null;

  const handleOrder = async (flyerId: string, shareCode: string, item: PublicFlyerItem) => {
    publicFlyerService.trackEvent(shareCode, { type: 'add_to_cart', itemId: item.id, surface });
    if (!item.productId || !item.sku || item.priceCents == null) return;
    const priceCents = item.salePriceCents ?? item.priceCents;
    const result = await addToCart(tenantId, tenantName || 'Store', {
      product_id: item.productId,
      product_name: item.name || 'Special',
      product_sku: item.sku,
      product_image: item.imageUrl ?? undefined,
      quantity: 1,
      price_cents: priceCents,
      list_price_cents: item.salePriceCents ? item.priceCents : undefined,
      variant_id: item.kind === 'variant' ? item.id : undefined,
      variant_name: item.kind === 'variant' ? item.name ?? undefined : undefined,
      flyer_id: flyerId,
      productType: 'physical',
    }, tenantLogo ?? undefined);
    if (result.success) {
      setAddedId(item.id);
      setTimeout(() => setAddedId(null), 2000);
    }
  };

  return (
    <section className="bg-amber-50/60 dark:bg-neutral-900 border-t border-amber-200/60 dark:border-neutral-800" aria-label="Specials">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {payload.flyers.map((flyer) => (
          <div key={flyer.id}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{flyer.title || fallbackTitle || 'Specials'}</h2>
                {flyer.summary && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">{flyer.summary}</p>
                )}
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-medium px-3 py-1">
                {windowLabel(flyer.window.startsAt, flyer.window.endsAt)}
              </span>
            </div>

            {flyer.heroImageUrl && (
              <div className="relative w-full aspect-[16/6] rounded-2xl overflow-hidden mb-6 bg-neutral-100 dark:bg-neutral-800">
                <Image src={flyer.heroImageUrl} alt={flyer.title} fill className="object-cover" sizes="(max-width: 1280px) 100vw, 1280px" />
              </div>
            )}

            {flyer.items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {flyer.items.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden flex flex-col">
                    {item.imageUrl && (
                      <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-700">
                        <Image src={item.imageUrl} alt={item.name || 'Special'} fill className="object-cover" sizes="(max-width: 640px) 50vw, 240px" />
                      </div>
                    )}
                    <div className="p-3 flex flex-col gap-1 grow">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white leading-snug">{item.name}</p>
                      {item.note && <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.note}</p>}
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                        <div className="text-sm">
                          {item.salePriceCents != null ? (
                            <>
                              <span className="font-semibold text-amber-700 dark:text-amber-400">{formatPrice(item.salePriceCents)}</span>
                              {item.priceCents != null && <span className="ml-1 text-xs text-neutral-400 line-through">{formatPrice(item.priceCents)}</span>}
                            </>
                          ) : item.priceCents != null ? (
                            <span className="font-semibold text-neutral-900 dark:text-white">{formatPrice(item.priceCents)}</span>
                          ) : null}
                        </div>
                        {item.orderable && flyer.cta.orderEnabled && (
                          <button
                            type="button"
                            onClick={() => handleOrder(flyer.id, flyer.shareCode, item)}
                            disabled={!item.inStock}
                            className="text-xs font-medium rounded-lg px-2.5 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {!item.inStock ? 'Sold out' : addedId === item.id ? 'Added' : 'Add'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {flyer.cta.orderEnabled && flyer.cta.pickupEnabled && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
                Order ahead for pickup{flyer.cta.pickupReadyMinutes ? ` — ready in about ${Math.round(flyer.cta.pickupReadyMinutes / 60)}h` : ''}
              </p>
            )}
          </div>
        ))}

        {payload.frozen && payload.frozen.length > 0 && (
          <div className="border-t border-amber-200/60 dark:border-neutral-700 pt-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">From the freezer</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Past specials, frozen — while supplies last</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {payload.frozen.map((t) => (
                <div key={t.variantId} className="bg-white dark:bg-neutral-800 rounded-xl border border-sky-200 dark:border-sky-900/40 p-3 flex flex-col gap-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white leading-snug">{t.name}</p>
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {t.salePriceCents != null ? formatPrice(t.salePriceCents) : t.priceCents != null ? formatPrice(t.priceCents) : ''}
                    </span>
                    <span className="text-xs text-neutral-500">{t.inStock} left</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
