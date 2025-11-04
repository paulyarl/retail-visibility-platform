import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import TenantMapSection from '@/components/tenant/TenantMapSection';
import { getTenantMapLocation, MapLocation } from '@/lib/map-utils';
import ProductSearch from '@/components/storefront/ProductSearch';
import ProductDisplay from '@/components/storefront/ProductDisplay';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  metadata?: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    logo_url?: string;
  };
}

interface PlatformSettings {
  platformName?: string;
  logoUrl?: string;
}

// Helpers to compute open/closed status from hours object
function parseTimeToMinutes(t: string): number | null {
  if (!t || typeof t !== 'string') return null;
  const s = t.trim();
  // HH:mm
  const m24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (m24) {
    const hh = parseInt(m24[1], 10);
    const mm = parseInt(m24[2], 10);
    return hh * 60 + mm;
  }
  // h:mm AM/PM
  const m12 = /^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i.exec(s);
  if (m12) {
    let hh = parseInt(m12[1], 10) % 12;
    const mm = parseInt(m12[2], 10);
    const ampm = m12[3].toUpperCase();
    if (ampm === 'PM') hh += 12;
    return hh * 60 + mm;
  }
  return null;
}

function minutesToLabel(mins: number, timeZone?: string): string {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  // Convert to 12-hour format
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 || 12;
  const mmStr = mm.toString().padStart(2, '0');
  return `${hour12}:${mmStr} ${period}`;
}

function computeStoreStatus(hours: any): { isOpen: boolean; label: string } | null {
  if (!hours || typeof hours !== 'object') return null;
  const now = new Date();
  const locale = 'en-US';
  const timeZone: string | undefined = typeof hours.timezone === 'string' ? hours.timezone : undefined;
  const weekday = (d: Date) => d.toLocaleDateString(locale, { weekday: 'long', timeZone });
  const todayName = weekday(now);
  const today = (hours as any)[todayName];
  // Compute "now" in target timezone
  const fmt = new Intl.DateTimeFormat('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: timeZone });
  const parts = fmt.formatToParts(now);
  const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const currentMins = hh * 60 + mm;

  const parseRange = (entry: any): { openM: number; closeM: number } | null => {
    if (!entry) return null;
    const openStr = entry.open || entry.start || entry.from;
    const closeStr = entry.close || entry.end || entry.to;
    const o = parseTimeToMinutes(openStr);
    const c = parseTimeToMinutes(closeStr);
    if (o == null || c == null) return null;
    return { openM: o, closeM: c };
  };

  const todayRange = parseRange(today);
  if (todayRange) {
    const { openM, closeM } = todayRange;
    if (currentMins >= openM && currentMins < closeM) {
      return { isOpen: true, label: `Open now • Closes at ${minutesToLabel(closeM, timeZone)}` };
    }
    if (currentMins < openM) {
      return { isOpen: false, label: `Closed • Opens today at ${minutesToLabel(openM, timeZone)}` };
    }
    // After close today, find next open day
  }

  // Find next open day within next 7 days
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const name = weekday(d);
    const r = parseRange((hours as any)[name]);
    if (r) {
      const dayLabel = i === 1 ? 'tomorrow' : name;
      return { isOpen: false, label: `Closed • Opens ${dayLabel} at ${minutesToLabel(r.openM, timeZone)}` };
    }
  }
  
  // If no hours found in next 7 days, check if any hours are set at all
  const hasAnyHours = Object.keys(hours).some(k => k !== 'timezone' && hours[k]);
  if (hasAnyHours) {
    return { isOpen: false, label: 'Closed • Check hours for details' };
  }
  
  return { isOpen: false, label: 'Closed' };
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}

async function getTenantWithProducts(tenantId: string, page: number = 1, limit: number = 12, search?: string) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

    // Fetch tenant basic info
    const tenantRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}`, {
      cache: 'no-store',
    });

    if (!tenantRes.ok) {
      return null;
    }

    const tenant: Tenant = await tenantRes.json();

    // Fetch business profile
    let hasHours = false;
    let businessHours: any = null;
    try {
      const profileRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}/profile`, {
        cache: 'no-store',
      });
      if (profileRes.ok) {
        const businessProfile = await profileRes.json();
        tenant.metadata = {
          ...tenant.metadata,
          businessName: businessProfile.business_name,
          phone: businessProfile.phone_number,
          email: businessProfile.email,
          website: businessProfile.website,
          address: businessProfile.address_line1 
            ? `${businessProfile.address_line1}${businessProfile.address_line2 ? ', ' + businessProfile.address_line2 : ''}, ${businessProfile.city}, ${businessProfile.state} ${businessProfile.postal_code}`
            : undefined,
          logo_url: businessProfile.logo_url,
        };
        // Detect hours presence for branding evaluation
        const hours = (businessProfile as any)?.hours;
        businessHours = hours ?? null;
        if (hours) {
          if (Array.isArray(hours)) {
            hasHours = hours.length > 0;
          } else if (typeof hours === 'object') {
            hasHours = Object.keys(hours).length > 0;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch business profile:', e);
    }

    // Fetch map location using utility
    const mapLocation = await getTenantMapLocation(tenantId);

    // Fetch products for this tenant with optional search (using public endpoint)
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const productsRes = await fetch(`${apiBaseUrl}/public/tenant/${tenantId}/items?page=${page}&limit=${limit}${searchParam}`, {
      cache: 'no-store',
    });

    const productsData = productsRes.ok ? await productsRes.json() : { items: [], pagination: { totalItems: 0 } };
    // Handle both old (array) and new (paginated object) response formats
    const rawProducts = productsData.items 
      ? (Array.isArray(productsData.items) ? productsData.items : [])
      : (Array.isArray(productsData) ? productsData : []);
    
    // Transform products: convert priceCents to price
    const products: Product[] = rawProducts.map((p: any) => ({
      ...p,
      price: typeof p.price === 'number' ? p.price : (typeof p.priceCents === 'number' ? p.priceCents / 100 : 0),
      title: p.title || p.name,
      currency: p.currency || 'USD',
    }));
    
    const total = productsData.pagination?.totalItems || productsData.total || products.length;

    // Fetch platform settings for footer
    let platformSettings: PlatformSettings = {};
    try {
      const settingsRes = await fetch(`${apiBaseUrl}/platform-settings`, {
        cache: 'no-store',
      });
      if (settingsRes.ok) {
        platformSettings = await settingsRes.json();
      }
    } catch (e) {
      console.error('Failed to fetch platform settings:', e);
    }

    const hasLogo = !!tenant.metadata?.logo_url;
    const hasBranding = hasLogo || hasHours;
    const storeStatus = computeStoreStatus(businessHours);
    return { tenant, products, total, page, limit, platformSettings, mapLocation, hasBranding, businessHours, storeStatus };
  } catch (error) {
    console.error('Error fetching tenant storefront:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getTenantWithProducts(id);

  if (!data) {
    return {
      title: 'Store Not Found',
    };
  }

  const { tenant } = data;
  const businessName = tenant.metadata?.businessName || tenant.name;

  return {
    title: `${businessName} - Product Catalog`,
    description: `Browse products from ${businessName}. ${tenant.metadata?.address || ''}`,
    openGraph: {
      title: businessName,
      description: `Shop products from ${businessName}`,
      images: tenant.metadata?.logo_url ? [tenant.metadata.logo_url] : [],
      type: 'website',
    },
  };
}

export default async function TenantStorefrontPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { page: pageParam, search } = await searchParams;
  const currentPage = parseInt(pageParam || '1', 10);
  
  const data = await getTenantWithProducts(id, currentPage, 12, search);

  if (!data) {
    notFound();
  }

  const { tenant, products, total, limit, platformSettings, mapLocation, hasBranding, businessHours, storeStatus } = data as any;
  const businessName = tenant.metadata?.businessName || tenant.name;
  const totalPages = Math.ceil(total / limit);
  
  // Get tier features for footer
  const tier = tenant.subscriptionTier || 'trial';
  const features = getLandingPageFeatures(tier);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header with Business Name and Logo */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-6">
            {tenant.metadata?.logo_url && (
              <div className="relative w-24 h-24 flex-shrink-0">
                <Image
                  src={tenant.metadata.logo_url}
                  alt={businessName}
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                {businessName}
              </h1>
              {storeStatus && (
                <p className="text-neutral-600 dark:text-neutral-400 mt-2 flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${storeStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {storeStatus.label}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header with Search */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
              Products ({total})
              {search && (
                <span className="text-base font-normal text-neutral-600 dark:text-neutral-400 ml-2">
                  - Results for "{search}"
                </span>
              )}
            </h2>
            {totalPages > 1 && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
          
          {/* Search Box */}
          <div className="max-w-md">
            <ProductSearch tenantId={id} />
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 space-y-6">
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">
              {search 
                ? `No products found matching "${search}". Try a different search term.`
                : 'No products available at this time.'}
            </p>
            {!hasBranding && (
              <div className="mx-auto max-w-2xl p-5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <svg className="h-6 w-6 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium">Set your store branding and add products to populate this page automatically.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/t/${id}/onboarding`}
                        className="inline-flex items-center px-3 py-1.5 rounded bg-primary-600 text-white text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1"
                      >
                        Edit Branding
                      </a>
                      <a
                        href={`/t/${id}/items`}
                        className="inline-flex items-center px-3 py-1.5 rounded border border-primary-300 bg-white text-primary-700 text-sm hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1 dark:bg-neutral-900 dark:text-primary-300 dark:border-primary-700 dark:hover:bg-neutral-800"
                      >
                        Add Products
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Product Display with Grid/List Toggle */}
            <ProductDisplay products={products} tenantId={id} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                {currentPage > 1 && (
                  <Link
                    href={`/tenant/${id}?page=${currentPage - 1}`}
                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    ← Previous
                  </Link>
                )}
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Link
                      key={pageNum}
                      href={`/tenant/${id}?page=${pageNum}`}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        pageNum === currentPage
                          ? 'bg-primary-600 text-white'
                          : 'border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}

                {currentPage < totalPages && (
                  <Link
                    href={`/tenant/${id}?page=${currentPage + 1}`}
                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Map Section - How to Get There */}
      {mapLocation && (
        <TenantMapSection 
          location={mapLocation} 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        />
      )}

      {/* Tier-Based Footer */}
      <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Business Info */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                {businessName}
              </h3>
              
              {/* Contact Information */}
              <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                {/* Phone */}
                {tenant.metadata?.phone && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${tenant.metadata.phone}`} className="hover:underline">
                      {tenant.metadata.phone}
                    </a>
                  </p>
                )}

                {/* Email */}
                {tenant.metadata?.email && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a href={`mailto:${tenant.metadata.email}`} className="hover:underline">
                      {tenant.metadata.email}
                    </a>
                  </p>
                )}

                {/* Address - Required for NAP */}
                {tenant.metadata?.address && (
                  <p className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{tenant.metadata.address}</span>
                  </p>
                )}

                {/* Hours Schedule */}
                {businessHours && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                      <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Hours
                    </h4>
                    <div className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                        const dayHours = businessHours[day];
                        const formatTime = (time24: string): string => {
                          if (!time24) return "";
                          const [h, m] = time24.split(":").map(Number);
                          const period = h >= 12 ? "PM" : "AM";
                          const hour12 = h % 12 || 12;
                          return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
                        };
                        return (
                          <div key={day} className="flex justify-between">
                            <span className="font-medium">{day}</span>
                            <span>
                              {dayHours ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}` : 'Closed'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="space-y-2 text-sm">
                <Link href={`/tenant/${id}`} className="block text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400">
                  All Products
                </Link>
                {tenant.metadata?.website && (
                  <a href={tenant.metadata.website} target="_blank" rel="noopener noreferrer" className="block text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400">
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Platform Branding (unless Enterprise with removal) */}
          {!features.removePlatformBranding && (
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700 text-center text-sm text-neutral-500">
              <p>Powered by {platformSettings?.platformName || 'Visible Shelf'} ⚡</p>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
