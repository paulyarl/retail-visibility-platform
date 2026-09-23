'use client';

import Link from 'next/link';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import ShelfSlotsPreview from '@/components/place/ShelfSlotsPreview';
import {
  ShieldCheck,
  MapPin,
  Tag,
  ShoppingBag,
  TrendingUp,
  ArrowRight,
  Store,
  Search,
  CheckCircle2,
  Sparkles,
  Package,
  Building2,
  Users,
  Check,
} from 'lucide-react';

const ENTRY_PRESENCE_MODES = [
  {
    mode: 'directory',
    badge: '100% Free Forever',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    icon: Store,
    title: 'Verified Local Storefront',
    tagline: 'Put your physical store on the map',
    description:
      'Take ownership of your place page. Keep your store hours, phone, street address, and specialty categories accurate so nearby shoppers discover your physical doors.',
    features: [
      'Verified store hours & phone number',
      'Specialty category alignment',
      'Local directory citation for search engines',
      '5 free product slots to showcase top sellers',
    ],
  },
  {
    mode: 'google',
    badge: 'Discovery Tier',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    icon: Search,
    title: 'Shelf Search & Google Visibility',
    tagline: 'Win shoppers searching for specific items',
    description:
      'Stop losing customers who search for specific products like "cassava flour", "halal ribeye", or specialty imports. Your in-stock inventory gets indexed so searchers see you have it in stock today.',
    features: [
      'Up to 75 products indexed for local search',
      'Item-level "In-Stock Nearby" discovery',
      'Google Business Profile synchronization',
      'Customer direction and phone call tracking',
    ],
  },
  {
    mode: 'platform',
    badge: 'Storefront Tier',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    icon: ShoppingBag,
    title: 'Digital Storefront & In-Store Pickup',
    tagline: 'Turn online searches into walk-in foot traffic',
    description:
      'Give local shoppers a branded mobile catalog to browse your aisles, check prices, and reserve or pay for counter pickup. Your physical register is the fulfillment hub — zero delivery drivers, zero packing boxes, 0% marketplace commission.',
    features: [
      'Branded mobile web app (installable PWA)',
      'Click-and-collect in-store & curbside pickup',
      'Expand up to 200+ inventory items',
      '0% commission on orders (keep 100% of your margins)',
    ],
  },
];

export default function PlaceAboutClient() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* ─── Hero Section ─── */}
      <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 py-20 relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
            <Store className="w-4 h-4 text-amber-300" />
            <span>Built for Independent Physical Retailers</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 leading-[1.15]">
            Make your physical shelves <br className="hidden sm:inline" />
            <span className="text-amber-300">visible to local shoppers.</span>
          </h1>

          <p className="text-lg sm:text-xl text-blue-100 leading-relaxed max-w-3xl mb-8 font-normal">
            Google knows your building&apos;s address, but it has no idea what is actually inside your door.
            When nearby customers search for specialty items on their phones, algorithms send them to big-box chains
            or delivery apps because your shelves are invisible online.
          </p>

          <p className="text-base text-blue-200/90 leading-relaxed max-w-3xl mb-10">
            Claim your free store listing in 60 seconds. Put your in-stock inventory in front of local shoppers,
            and turn online product searches into walk-in foot traffic. <strong>Zero delivery logistics, zero commissions.</strong>
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-all font-bold text-base shadow-lg shadow-black/20 hover:shadow-black/30 transform hover:-translate-y-0.5"
            >
              Find & Claim Your Store <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/directory/add-business"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white rounded-xl transition-colors font-semibold text-base backdrop-blur-sm"
            >
              Add a New Storefront
            </Link>
          </div>

          {/* Value Props Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 pt-8 border-t border-white/15">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm text-blue-100 font-medium">Free 5-product shelf on claim</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm text-blue-100 font-medium">Your store is the fulfillment hub</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm text-blue-100 font-medium">0% commission on in-store sales</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── The Invisible Shelf Problem ─── */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            The Local Retail Dilemma
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Why local shoppers walk past your store to buy online
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-3 text-base leading-relaxed">
            Search engines treat physical stores like static pins on a map. When customers search for specific items,
            they find big e-commerce sites or national chains, even when you have the exact item on your shelf 2 blocks away.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold mb-4">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">1. The Generic Map Pin</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Google, Yelp, and Apple Maps only know your store as a generic category label like &quot;Grocery&quot; or &quot;Convenience Store&quot;. They cannot see your unique inventory, imported goods, or fresh items.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-red-600 dark:text-red-400 font-medium">
              Result: Zero product-level search visibility
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-4">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">2. The Displaced Shopper</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                When a local resident searches for a specialty ingredient, spice, or provision, search engines direct them to Amazon or order via DoorDash at a 30% markup because your stock isn&apos;t indexed.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-amber-600 dark:text-amber-400 font-medium">
              Result: Lost foot traffic and basket sales
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3. The Visible Shelf</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                By claiming your listing and putting your products online, your physical shelves become searchable web pages. Local searchers see your in-stock items and drive to your store to buy.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Result: Real customers through your front door
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5 Free Product Slots Showcase ─── */}
      <div className="bg-white dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-800 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-4">
                <Tag className="w-3.5 h-3.5" />
                Free With Your Claimed Listing
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Put your 5 most-requested items online today.
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-base mb-6">
                Pick the 5 signature products that customers constantly call to ask about, or the specialty items
                that chain supermarkets never stock.
              </p>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-base mb-8">
                When local shoppers search for those items in your area, your store appears with actual prices
                and an <strong>&quot;In-Stock at Store&quot;</strong> badge, pointing them straight to your register.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    <strong>Zero setup fee:</strong> Included automatically when you claim your place page.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    <strong>Direct in-store foot traffic:</strong> Shoppers see the item is nearby and come in to purchase.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    <strong>Expand anytime:</strong> Ready to bring whole aisles online? Upgrade to 75 or 200+ products seamlessly.
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <ShelfSlotsPreview />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Three Growth Tiers ─── */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Three simple tiers to grow your foot traffic
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-base">
            Start completely free with your claimed directory listing. Upgrade only when you want to index more inventory or take online pre-orders for in-store pickup.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ENTRY_PRESENCE_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.mode}
                className="bg-white dark:bg-neutral-900 rounded-2xl p-7 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${mode.badgeColor}`}>
                      {mode.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                    {mode.title}
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">
                    {mode.tagline}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
                    {mode.description}
                  </p>

                  <div className="space-y-2.5 mb-8">
                    {mode.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/directory"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-sm transition-colors"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── The Store is the Fulfillment Center (DoorDash Contrast) ─── */}
      <div className="bg-slate-900 text-white py-16 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              The Retail Advantage
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-2 mb-4">
              Your physical store is already the ultimate fulfillment center.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Third-party delivery apps burn millions on gig drivers, dark stores, and refrigerated vans,
              then charge retailers 25% to 30% of their sales to pay for it. Physical retailers already have a superior model:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80">
              <Building2 className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Zero Extra Rent or Storage</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                You already pay rent for your storefront, electricity for your coolers, and wages for your staff.
                Your shelves are already stocked and ready.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80">
              <Users className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">The Shopper is the Delivery Driver</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                When customers see your item online, they drive to your store, pick it up at your counter,
                and transport it home for free. Zero driver delays or damaged goods.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80">
              <Package className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Basket Expansion at Counter</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                When a customer comes through your doors to buy the specific item they found online,
                they browse your aisles and add 2 to 3 more items to their physical basket.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── How to Claim in 60 Seconds ─── */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            How to claim your listing in 60 seconds
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-base">
            No credit card required. Claiming is free, fast, and gives you instant control over your presence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center mx-auto mb-4 text-lg shadow-md">
              1
            </div>
            <h3 className="text-base font-bold mb-1">Find Your Store</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Search by business name or address in the public directory to locate your pre-seeded place page.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center mx-auto mb-4 text-lg shadow-md">
              2
            </div>
            <h3 className="text-base font-bold mb-1">Confirm Ownership</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Verify with a quick phone or email code. Your verified badge is activated immediately.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center mx-auto mb-4 text-lg shadow-md">
              3
            </div>
            <h3 className="text-base font-bold mb-1">List 5 Signature Items</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Add photos and prices of your 5 top products to start appearing in item-level search results.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Final CTA Banner ─── */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to bring your physical shelves online?
          </h2>
          <p className="text-blue-100 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            Find your store&apos;s place page now. Claim it in under a minute and start capturing the local customers
            already searching for what is sitting on your shelves.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-blue-50 text-blue-700 rounded-xl transition-all font-bold text-base shadow-lg shadow-black/10 hover:shadow-black/20"
            >
              Find Your Store Listing <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/directory/add-business"
              className="inline-flex items-center gap-2 px-6 py-4 bg-blue-700 hover:bg-blue-800 border border-blue-400/40 text-white rounded-xl transition-colors font-semibold text-base"
            >
              Add My Store
            </Link>
          </div>
        </div>
      </div>

      <PoweredByFooter />
    </div>
  );
}
