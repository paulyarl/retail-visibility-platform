import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { tenantPublicService } from '@/services/TenantPublicService';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { storefrontSingletonService } from '@/services/StorefrontSingletonService';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import { StorefrontHeader } from '@/components/storefront/sections/StorefrontHeader';
import { ServiceSection } from '@/components/storefront/sections/ServiceSection';
import PublicBotWidget from '@/components/bot/PublicBotWidget';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ServicesPageProps {
  params: Promise<{ id: string }>;
}

async function getTenantServices(tenantId: string) {
  try {
    const idResolvedBySlug = await publicDirectoryService.resolveBySlug(tenantId);
    const tenant = await tenantPublicService.getPublicTenantInfo(idResolvedBySlug);
    const tenantData = (tenant as any)?.data || tenant;

    if (!tenantData) return null;

    const productsData = await storefrontSingletonService.getStorefrontProducts(idResolvedBySlug, {
      page: 1,
      limit: 100,
    });

    const rawProducts = productsData.items
      ? (Array.isArray(productsData.items) ? productsData.items : [])
      : (Array.isArray(productsData) ? productsData : []);

    const services = rawProducts.filter((p: any) =>
      p.productType === 'service' || p.product_type === 'service'
    );

    const productOptionFlags = await unifiedCapabilityService.getProductOptionFlags(idResolvedBySlug);

    const tier = tenantData.subscriptionTier || 'trial';
    const features = getLandingPageFeatures(tier);

    return {
      tenant: tenantData,
      services,
      productOptionFlags,
      tier,
      features,
      resolvedTenantId: idResolvedBySlug,
    };
  } catch (error) {
    console.error('Error fetching tenant services:', error);
    return null;
  }
}

export async function generateMetadata({ params }: ServicesPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getTenantServices(id);

  if (!data) {
    return { title: 'Services Not Found' };
  }

  const businessName = data.tenant?.metadata?.businessName || data.tenant?.name || 'Store';

  return {
    title: `${businessName} - Services`,
    description: `Book professional services from ${businessName}.`,
  };
}

export default async function TenantServicesPage({ params }: ServicesPageProps) {
  const { id } = await params;
  const data = await getTenantServices(id);

  if (!data) {
    notFound();
  }

  const { tenant, services, productOptionFlags, tier, features, resolvedTenantId } = data;
  const businessName = tenant?.metadata?.businessName || tenant?.name || 'Store';
  const tenantSlug = tenant?.slug || id;

  const showServices = !!(productOptionFlags?.merchantPreferences?.product_service_enabled);

  if (services.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">No Services Available</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {businessName} doesn&apos;t have any service offerings available at this time.
          </p>
          <a
            href={`/tenant/${id}`}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
          >
            Back to Store
          </a>
        </div>
      </div>
    );
  }

  const isServiceStore = true;

  return (
    <ProductSingletonProvider>
      <TenantPaymentProvider tenantId={resolvedTenantId}>
        <StorefrontHeader
          tenantId={resolvedTenantId}
          tenant={tenant}
          businessName={businessName}
          logoUrl={tenant?.metadata?.logo_url || null}
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
          currentUrl={`/tenant/${id}/services`}
        />

        <ServiceSection
          tenantId={resolvedTenantId}
          tenant={tenant}
          businessName={businessName}
          services={services}
          layoutVariant="classic"
          isServiceStore={isServiceStore}
          hasActivePaymentGateway={tenant?.metadata?.hasActivePaymentGateway}
        />

        <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
            <a
              href={`/tenant/${id}`}
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
