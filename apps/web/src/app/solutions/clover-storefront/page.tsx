import type { Metadata } from 'next';
import Link from 'next/link';
import { platformOrigin } from '@/lib/storefront-routing';

export const metadata: Metadata = {
  title: 'Clover to Google Shopping — Live in Minutes',
  description:
    'Connect your Clover POS once. VisibleShelf syncs your inventory to Google Shopping, a storefront, and our marketplace automatically — no manual data entry. Free listing, plans from $29/mo.',
  alternates: { canonical: `${platformOrigin()}/solutions/clover-storefront` },
  openGraph: {
    title: 'Clover to Google Shopping — Live in Minutes',
    description:
      'Connect your Clover POS once. Inventory syncs to Google Shopping, a storefront, and our marketplace automatically.',
    type: 'website',
    siteName: 'VisibleShelf',
  },
};

const STEPS = [
  { n: '1', title: 'Connect Clover', body: 'One-time OAuth — authorize and your POS inventory flows in automatically.' },
  { n: '2', title: 'We sync everywhere', body: 'Products feed Google Shopping, your storefront, and the VisibleShelf marketplace. Real-time, always current.' },
  { n: '3', title: 'Shoppers find you', body: 'Local searchers see your actual shelf — in stock, nearby, ready to buy.' },
];

const FEATURES = [
  'Automatic inventory sync — no manual data entry, ever',
  'Google Shopping feed (Merchant Center handled for you)',
  'Beautiful storefront — platform, subdomain, or your own domain',
  'Marketplace listing — 50K+ shoppers browsing local retailers',
  'QR codes for in-store marketing',
  'Plans from $29/mo — free listing tier included',
];

export default function CloverStorefrontPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24">
        <p className="text-blue-400 text-sm font-medium uppercase tracking-[0.22em] mb-4">
          Clover integration
        </p>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4">
          Clover to Google Shopping, live in minutes.
        </h1>
        <p className="text-lg text-white/70 max-w-2xl mb-8">
          You already entered your products into Clover. Connect once and VisibleShelf broadcasts them
          to Google Shopping, a storefront, and our marketplace — automatically.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link
            href="/directory"
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-center hover:bg-gray-100 transition-colors"
          >
            Find your store — claim it free
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-3 rounded-xl border border-white/20 font-semibold text-center hover:border-white/40 transition-colors"
          >
            Start free trial
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 rounded-xl border border-white/20 font-semibold text-center hover:border-white/40 transition-colors"
          >
            Talk to us
          </Link>
        </div>

        <section className="grid sm:grid-cols-3 gap-6 mb-16">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="text-blue-400 text-2xl font-bold mb-2">{s.n}</div>
              <h2 className="font-semibold mb-2">{s.title}</h2>
              <p className="text-sm text-white/60">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6">Everything included</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-white/80 text-sm">
                <span className="text-emerald-400 mt-0.5">✓</span> {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/20 to-indigo-600/10 p-8 text-center">
          <h2 className="text-2xl font-semibold mb-3">Your store may already be listed</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            We seed local retailers from public info — search your business name and claim it free.
          </p>
          <Link
            href="/directory"
            className="inline-block px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-100 transition-colors"
          >
            Search the directory
          </Link>
          <p className="mt-4 text-sm text-white/50">
            <Link href="/tenant/tid-25we5qgj" className="underline hover:text-white">See a live storefront</Link>
            {' · '}
            <Link href="/features#pricing" className="underline hover:text-white">Pricing</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
