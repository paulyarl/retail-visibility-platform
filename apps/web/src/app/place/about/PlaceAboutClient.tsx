'use client';

import Link from 'next/link';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import DirectoryBusinessSearch from '@/components/directory/DirectoryBusinessSearch';
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
import { TIER_DISPLAY_NAMES, TIER_PRICING } from '@/lib/tiers/tier-features';

function tierPrice(key: string): string {
  const price = TIER_PRICING[key];
  return price === 0 ? 'Free' : `$${price}/mo`;
}

// The Entry Presence triad, in claim-upgrade order (presence → discovery →
// storefront). Names and prices come from the tier ladder; the mode framing
// mirrors ENTRY_PRESENCE_MODES in DirectoryPresenceUpgradeOptionsService so a
// claimed tenant sees the same three choices here as on the claim screen.
const ENTRY_PRESENCE_MODES = [
  {
    key: 'presence',
    surface: 'Platform storefront + checkout',
    primary: true,
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
    icon: Store,
    title: 'Sell with deposit checkout',
    description:
      'An all-purpose storefront for your store and your products, with deposit checkout built in. Your register stays the fulfillment point — zero delivery drivers, zero commission.',
    features: [
      'Deposit checkout (Stripe) built in',
      'Branded mobile storefront for your whole catalog',
      'Up to 200 inventory items',
      'Full online payment as an add-on when you want it',
      '0% commission on orders (keep 100% of your margins)',
    ],
  },
  {
    key: 'discovery',
    surface: 'Third-party (Google)',
    primary: false,
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    icon: Search,
    title: 'Put your products on Google',
    description:
      'Stop losing customers who search for specific products like "cassava flour", "halal ribeye", or specialty imports. Your in-stock inventory gets indexed so searchers see you have it today.',
    features: [
      'Up to 200 products indexed for local search',
      'Item-level "In-Stock Nearby" discovery',
      'Google Business Profile synchronization',
      'Customer direction and phone call tracking',
    ],
  },
  {
    key: 'storefront',
    surface: 'Platform in-house marketplace',
    primary: false,
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
    icon: ShoppingBag,
    title: 'Showcase your full catalog',
    description:
      'The full storefront surface inside the marketplace — your aisles, your prices, your own address. Shoppers browse online and walk in; checkout, a custom domain, and fulfillment are add-ons you switch on when you need them.',
    features: [
      'Branded mobile web app (installable PWA)',
      'Storefront layouts, options, and your own subdomain',
      'Up to 200 inventory items',
      'Checkout, custom domain, and fulfillment as add-ons',
    ],
  },
];

export default function PlaceAboutClient() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* ─── Hero Section ─── */}
      <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 py-20 relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
            <Store className="w-4 h-4 text-white/80" />
            <span>Built for Independent Physical Retailers</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 leading-[1.15]">
            Make your physical shelves <br className="hidden sm:inline" />
            <span className="text-violet-200">visible to local shoppers.</span>
          </h1>

          <p className="text-lg sm:text-xl text-violet-100 leading-relaxed max-w-3xl mb-8 font-normal">
            Google knows your building&apos;s address, but it has no idea what is actually inside your door.
            When nearby customers search for specialty items on their phones, algorithms send them to big-box chains
            or delivery apps because your shelves are invisible online.
          </p>

          <p className="text-base text-violet-200/90 leading-relaxed max-w-3xl mb-10">
            Claim your free store listing in 60 seconds. Put your in-stock inventory in front of local shoppers,
            and turn online product searches into walk-in foot traffic. <strong>Zero delivery logistics, zero commissions.</strong>
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <DirectoryBusinessSearch variant="hero" label="Find your store" />
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
              <span className="text-sm text-violet-100 font-medium">Free 5-product shelf on claim</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm text-violet-100 font-medium">Your store is the fulfillment hub</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm text-violet-100 font-medium">0% commission on in-store sales</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── The Invisible Shelf Problem ─── */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 text-xs font-semibold uppercase tracking-wider mb-3">
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

        {/* Directory = bidirectional shelf exposure — the channel maps can't match */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-teal-50 dark:from-indigo-950/40 dark:to-teal-950/30 border-2 border-indigo-100 dark:border-indigo-900 p-6 sm:p-8">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
            Every shelf you belong on — not just one dot on a map
          </h3>
          <p className="text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed">
            Google shows your store as a single pin under one category label. Our directory works both ways:
            your page exposes <strong>every category shelf you qualify for</strong> — and each of those shelf
            pages carries your business. A specialty grocer can surface under African Grocery, International
            Foods, and Halal all at once, with no extra work. It&apos;s presence Google structurally can&apos;t
            give you.
          </p>
        </div>
      </div>

      {/* ─── 5 Free Product Slots Showcase ─── */}
      <div className="bg-white dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-800 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-4">
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
            Pick the surface that fits
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-base">
            Your claimed listing is the free gateway. From there you choose where your products show up —
            the rest is a step up from here, not a replacement. Every option works with the register you
            already run — Clover POS and Square sync your real catalog.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ENTRY_PRESENCE_MODES.map((mode) => {
            const Icon = mode.icon;
            const name = TIER_DISPLAY_NAMES[mode.key];
            return (
              <div
                key={mode.key}
                className={`bg-white dark:bg-neutral-900 rounded-2xl p-7 border shadow-sm flex flex-col justify-between hover:border-violet-400 dark:hover:border-violet-600 transition-colors ${
                  mode.primary
                    ? 'border-violet-300 dark:border-violet-700 ring-1 ring-violet-200 dark:ring-violet-800'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${mode.badgeColor}`}>
                        {name}
                      </span>
                      {mode.primary && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                    {mode.title}
                  </h3>
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3">
                    {mode.surface}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                    {mode.description}
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white mb-6">
                    {tierPrice(mode.key)}
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
                  href={`/auth/signup?tier=${mode.key}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors"
                >
                  Choose {name} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-8 max-w-2xl mx-auto">
          All three modes carry 200 product slots and a platform subdomain. Coupons, funnels, social
          commerce, wholesale matching, and chatbot unlock on the tiers above.
        </p>
      </div>

      {/* ─── The Store is the Fulfillment Center (DoorDash Contrast) ─── */}
      <div className="bg-slate-900 text-white py-16 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-300">
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
              <Building2 className="w-8 h-8 text-violet-300 mb-4" />
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
              <Package className="w-8 h-8 text-violet-400 mb-4" />
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
            <div className="w-12 h-12 rounded-full bg-violet-600 text-white font-extrabold flex items-center justify-center mx-auto mb-4 text-lg shadow-md">
              1
            </div>
            <h3 className="text-base font-bold mb-1">Find Your Store</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Search by business name or address in the public directory to locate your pre-seeded place page.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-600 text-white font-extrabold flex items-center justify-center mx-auto mb-4 text-lg shadow-md">
              2
            </div>
            <h3 className="text-base font-bold mb-1">Confirm Ownership</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Verify with a quick phone or email code. Your verified badge is activated immediately.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-600 text-white font-extrabold flex items-center justify-center mx-auto mb-4 text-lg shadow-md">
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
      <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to bring your physical shelves online?
          </h2>
          <p className="text-violet-100 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            Find your store&apos;s place page now. Claim it in under a minute and start capturing the local customers
            already searching for what is sitting on your shelves.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <DirectoryBusinessSearch variant="hero" label="Find your store" />
            <Link
              href="/directory/add-business"
              className="inline-flex items-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl transition-colors font-semibold text-base"
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
