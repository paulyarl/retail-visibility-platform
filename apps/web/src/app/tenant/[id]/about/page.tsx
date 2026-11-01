import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { tenantPublicService } from '@/services/TenantPublicService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';
import { directoryListingService } from '@/services/DirectoryListingSingletonService';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import { StorefrontHeader } from '@/components/storefront/sections/StorefrontHeader';
import PublicBotWidget from '@/components/bot/PublicBotWidget';
import { clientLogger } from '@/lib/client-logger';
import { isTenantHostName, platformOrigin, storefrontPath } from '@/lib/storefront-routing';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface AboutPageProps {
  params: Promise<{ id: string }>;
}

async function getTenantAbout(tenantId: string) {
  try {
    const idResolvedBySlug = await publicDirectoryService.resolveBySlug(tenantId);
    const tenant = await tenantPublicService.getPublicTenantInfo(idResolvedBySlug);
    const tenantData = (tenant as any)?.data || tenant;
    if (!tenantData) return null;

    // Gallery: tier/merchant-gated capability state + public listing photos.
    const [galleryState, photos] = await Promise.all([
      publicUnifiedCapabilityService.getStorefrontGalleryState(idResolvedBySlug).catch(() => null),
      directoryListingService.getDirectoryListingPhotos(idResolvedBySlug).catch(() => []),
    ]);
    return { tenant: tenantData, resolvedTenantId: idResolvedBySlug, galleryState, photos };
  } catch (error) {
    clientLogger.error('Error fetching tenant about data:', { detail: error });
    return null;
  }
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getTenantAbout(id);
  if (!data) return { title: 'About' };
  const businessName = data.tenant?.metadata?.businessName || data.tenant?.name || 'Store';
  return {
    title: `${businessName} - About Us`,
    description: data.tenant?.profileData?.business_description || `Learn more about ${businessName}.`,
  };
}

export default async function TenantAboutPage({ params }: AboutPageProps) {
  const { id } = await params;
  const data = await getTenantAbout(id);
  if (!data) notFound();

  const { tenant, resolvedTenantId, galleryState, photos } = data;
  const businessName = tenant?.metadata?.businessName || tenant?.name || 'Store';
  const tenantSlug = tenant?.slug || id;
  const profile = tenant?.profileData || {};
  const meta = tenant?.metadata || {};

  // Storefront URL delegate (server-side form — this is a server component):
  // host-relative paths on tenant hosts, /tenant/{id}-prefixed on the app.
  const reqHost = ((await headers()).get('x-forwarded-host') ?? (await headers()).get('host') ?? '').split(':')[0];
  const tenantHost = isTenantHostName(reqHost);
  const sp = (p: string) => storefrontPath(tenantHost, id, p);
  const storefrontOrigin = tenantHost
    ? `${reqHost.includes('localhost') ? 'http' : 'https'}://${reqHost}`
    : platformOrigin();

  // Same three-source social merge as the storefront layouts.
  const social = { ...(tenant?.socialLinks || {}), ...(meta.social_links || {}), ...(profile.social_links || {}), ...meta };
  const socialLinks: { platform: string; url: string }[] = [];
  if (social.facebook) socialLinks.push({ platform: 'Facebook', url: social.facebook });
  if (social.instagram) socialLinks.push({ platform: 'Instagram', url: social.instagram });
  if (social.twitter || social.x) socialLinks.push({ platform: 'X', url: social.twitter || social.x });
  if (social.linkedin) socialLinks.push({ platform: 'LinkedIn', url: social.linkedin });
  if (social.youtube) socialLinks.push({ platform: 'YouTube', url: social.youtube });
  if (social.tiktok) socialLinks.push({ platform: 'TikTok', url: social.tiktok });

  const description = profile.business_description || meta.business_description || null;
  const logoUrl = profile.logo_url || meta.logo_url || tenant?.logoUrl || null;
  const bannerUrl = profile.banner_url || meta.banner_url || tenant?.bannerUrl || null;
  const category = profile.gbp_category_name || tenant?.primaryCategory || null;
  const address = [profile.address_line1, profile.address_line2, [profile.city, profile.state].filter(Boolean).join(', '), profile.postal_code]
    .filter(Boolean)
    .filter((s: string) => s.trim() !== '')
    .join(', ');
  const phone = profile.phone_number || meta.phone || null;
  const email = profile.email || meta.email || null;
  const website = profile.website || meta.website || null;

  return (
    <ProductSingletonProvider>
      <TenantPaymentProvider tenantId={resolvedTenantId}>
        <StorefrontHeader
          tenantId={resolvedTenantId}
          tenant={tenant}
          businessName={businessName}
          logoUrl={logoUrl}
          layoutVariant="classic"
          storefrontStatus={{ shouldShowPanel: false }}
          isRetailStore={false}
          directoryPublished={false}
          tenantSlug={tenantSlug}
          primaryGBPCategory={null}
          secondaryGBPCategories={[]}
          hoursStatus={null}
          showsHours={false}
          showsHoursStatus={false}
          showsAnimatedHours={false}
          showsCategoryStore={false}
          showsStorefrontActions={false}
          showsSocialMedia={true}
          cartTotalItems={0}
          handleViewCart={() => {}}
          currentUrl={`${storefrontOrigin}${sp('/about')}`}
        />

        <main className="bg-neutral-50 dark:bg-neutral-900 min-h-screen">
          {/* Hero band */}
          <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center text-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={businessName} className="h-20 w-auto object-contain mb-4" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center mb-4">
                  <span className="text-white font-bold text-3xl">{businessName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">About {businessName}</h1>
              {category && (
                <span className="mt-3 inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 px-3 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">
                  {category}
                </span>
              )}
            </div>
            {bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerUrl} alt="" className="w-full max-h-64 object-cover" />
            )}
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            {/* Our story */}
            <section className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Our Story</h2>
              {description ? (
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">{description}</p>
              ) : (
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {businessName} hasn&apos;t shared its story yet — check back soon, or browse the store in the meantime.
                </p>
              )}
            </section>

            {/* Photo gallery — gated by the storefront-gallery capability
                (canUseGallery merges tier gates + merchant prefs); display
                mode + limit come from the merchant's gallery settings. */}
            {galleryState?.canUseGallery !== false && photos?.length > 0 && (() => {
              const limit = galleryState?.defaultGalleryLimit || 5;
              const shown = photos.slice(0, limit);
              const magazine = galleryState?.galleryDisplayMode === 'magazine' && galleryState?.canUseMagazineGallery !== false;
              return (
                <section className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Gallery</h2>
                  {magazine ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {shown.map((p: any, i: number) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id || i}
                          src={p.public_url || p.url}
                          alt={p.alt || `${businessName} photo ${i + 1}`}
                          loading="lazy"
                          className="w-full h-40 sm:h-48 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto snap-x pb-2">
                      {shown.map((p: any, i: number) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id || i}
                          src={p.public_url || p.url}
                          alt={p.alt || `${businessName} photo ${i + 1}`}
                          loading="lazy"
                          className="snap-start flex-shrink-0 w-64 h-48 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* Visit / contact */}
            {(address || phone || email || website) && (
              <section className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 sm:p-8">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Visit Us</h2>
                <ul className="space-y-3 text-neutral-700 dark:text-neutral-300">
                  {address && (
                    <li className="flex items-start gap-3">
                      <span aria-hidden className="mt-0.5">📍</span>
                      <span>{address}</span>
                    </li>
                  )}
                  {phone && (
                    <li className="flex items-start gap-3">
                      <span aria-hidden className="mt-0.5">📞</span>
                      <a href={`tel:${phone}`} className="text-primary-600 dark:text-primary-400 hover:underline">{phone}</a>
                    </li>
                  )}
                  {email && (
                    <li className="flex items-start gap-3">
                      <span aria-hidden className="mt-0.5">✉️</span>
                      <a href={`mailto:${email}`} className="text-primary-600 dark:text-primary-400 hover:underline">{email}</a>
                    </li>
                  )}
                  {website && (
                    <li className="flex items-start gap-3">
                      <span aria-hidden className="mt-0.5">🔗</span>
                      <a href={website} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">
                        {website}
                      </a>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* Social */}
            {socialLinks.length > 0 && (
              <section className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 sm:p-8">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">Follow {businessName}</h2>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                    >
                      {link.platform}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>

        <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
            <a
              href={sp('/')}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              ← Back to {businessName}
            </a>
          </div>
        </footer>
      </TenantPaymentProvider>
      <PublicBotWidget
        tenantId={resolvedTenantId}
        pageContext="storefront"
        hasActivePaymentGateway={tenant?.metadata?.hasActivePaymentGateway ?? false}
      />
    </ProductSingletonProvider>
  );
}
