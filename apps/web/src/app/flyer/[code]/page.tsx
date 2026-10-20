import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { cache } from 'react';
import { publicFlyerService, type PublicFlyerPayload } from '@/services/PublicFlyerService';
import FlyerReportButton from './FlyerReportButton';
import { formatPrice } from '@/lib/pricing';
import { clientLogger } from '@/lib/client-logger';
import ZoomableImageCarousel from '@/components/directory/ZoomableImageCarousel';

// Never prerender — flyer content is live/window-scoped.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ src?: string }>;
}

// Shared fetch — generateMetadata + page render hit the API once per request.
const getFlyer = cache(async (code: string, src?: string): Promise<PublicFlyerPayload | null> => {
  try {
    return await publicFlyerService.getFlyerByCode(code, src);
  } catch (error) {
    clientLogger.error('[FlyerPage] fetch failed', { detail: error });
    return null;
  }
});

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const { src } = await searchParams;
  const payload = await getFlyer(code, src);

  if (!payload?.enabled || !payload.flyers?.length) {
    return {
      title: 'Specials',
      description: 'Current specials flyer',
      // Thin dead-end state — keep it out of the index.
      robots: { index: false, follow: false },
    };
  }

  const tenantName = payload.tenant?.name;
  const flyer = payload.flyers[0];
  const itemNames = flyer.items.map(i => i.name).filter(Boolean).slice(0, 6).join(', ');
  const description = flyer.summary
    || (itemNames ? `${flyer.title} — ${itemNames}` : `${flyer.title} — current specials${tenantName ? ` at ${tenantName}` : ''}`);

  return {
    title: tenantName ? `${flyer.title} — ${tenantName}` : flyer.title,
    description,
    keywords: flyer.keywords?.length ? flyer.keywords : undefined,
    openGraph: {
      title: tenantName ? `${flyer.title} — ${tenantName}` : flyer.title,
      description,
      type: 'website',
      images: flyer.heroImageUrl ? [{ url: flyer.heroImageUrl }] : undefined,
    },
  };
}

/** schema.org ItemList — priced items become Offers with the flyer window as validity. */
function flyerJsonLd(payload: PublicFlyerPayload) {
  const tenantName = payload.tenant?.name ?? undefined;
  return payload.flyers!.map((flyer) => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: flyer.title,
    description: flyer.summary ?? undefined,
    keywords: flyer.keywords?.length ? flyer.keywords.join(', ') : undefined,
    url: flyer.shareUrl,
    itemListElement: flyer.items.map((item, i) => {
      const priced = item.salePriceCents ?? item.priceCents;
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: item.name ?? 'Special',
          description: item.note ?? undefined,
          image: item.imageUrl ?? undefined,
          ...(priced != null ? {
            offers: {
              '@type': 'Offer',
              price: (priced / 100).toFixed(2),
              priceCurrency: 'USD',
              availability: item.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              validThrough: flyer.window.endsAt,
              url: flyer.shareUrl,
              ...(tenantName ? { seller: { '@type': 'Organization', name: tenantName } } : {}),
            },
          } : {}),
        },
      };
    }),
  }));
}

export default async function FlyerPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { src } = await searchParams;
  if (!code) notFound();

  const payload = await getFlyer(code, src);

  if (!payload?.enabled) {
    return (
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">No active specials</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            {payload?.ended
              ? 'This flyer has ended — check back soon for the next one.'
              : "This store doesn't have a live flyer right now."}
          </p>
        </div>
      </main>
    );
  }

  const jsonLd = flyerJsonLd(payload);

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {jsonLd.map((doc, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(doc) }} />
      ))}
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {payload.flyers?.map((flyer) => (
          <article key={flyer.id}>
            {flyer.heroImageUrl && (
              <div className="mb-6">
                <ZoomableImageCarousel photos={[{ id: flyer.id, url: flyer.heroImageUrl, position: 1, alt: flyer.title }]} fallbackAlt={flyer.title} fit="natural" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{flyer.title}</h1>
            {flyer.summary && <p className="text-neutral-600 dark:text-neutral-400 mt-2">{flyer.summary}</p>}
            <p className="text-sm text-neutral-500 mt-1">
              Through {new Date(flyer.window.endsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            </p>

            {flyer.items.length > 0 && (
              <div className="mt-8 space-y-3">
                {flyer.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
                    {item.imageUrl && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                        <Image src={item.imageUrl} alt={item.name || 'Special'} fill className="object-cover" sizes="64px" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white">{item.name}</p>
                      {item.note && <p className="text-sm text-neutral-500">{item.note}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {item.salePriceCents != null ? (
                        <>
                          <p className="font-semibold text-amber-700 dark:text-amber-400">{formatPrice(item.salePriceCents)}</p>
                          {item.priceCents != null && <p className="text-xs text-neutral-400 line-through">{formatPrice(item.priceCents)}</p>}
                        </>
                      ) : item.priceCents != null ? (
                        <p className="font-semibold text-neutral-900 dark:text-white">{formatPrice(item.priceCents)}</p>
                      ) : null}
                      {item.orderable && !item.inStock && <p className="text-xs text-neutral-500">Sold out</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {flyer.cta.pickupEnabled && (
              <p className="text-sm text-neutral-500 mt-4">
                Order ahead for pickup{flyer.cta.pickupReadyMinutes ? ` — usually ready in about ${Math.round(flyer.cta.pickupReadyMinutes / 60)}h` : ''}
              </p>
            )}
          </article>
        ))}

        {payload.frozen && payload.frozen.length > 0 && (
          <section className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">From the freezer</h2>
            <p className="text-sm text-neutral-500 mt-1 mb-4">Past specials, frozen — while supplies last</p>
            <div className="space-y-3">
              {payload.frozen.map((t) => (
                <div key={t.variantId} className="flex items-center justify-between bg-white dark:bg-neutral-900 rounded-xl border border-sky-200 dark:border-sky-900/40 p-4">
                  <p className="font-medium text-neutral-900 dark:text-white">{t.name}</p>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900 dark:text-white">
                      {t.salePriceCents != null ? formatPrice(t.salePriceCents) : t.priceCents != null ? formatPrice(t.priceCents) : ''}
                    </p>
                    <p className="text-xs text-neutral-500">{t.inStock} left</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-between pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-400">
            Specials rotate — this page always shows what's current.
          </p>
          <FlyerReportButton code={code} />
        </div>
      </div>
    </main>
  );
}
