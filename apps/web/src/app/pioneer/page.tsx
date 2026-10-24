import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * Pioneer landing — the destination for field-recruitment QR traffic
 * (business card / leave-behind scans). PIONEER_RECRUITMENT_SPEC §3/§6:
 * hero claim + live demo storefront + Directory route + claim CTA.
 * Server-rendered so a scanned first-time arrival gets real content fast.
 */

const DEMO_TENANT_ID = 'tid-25we5qgj';

export const metadata: Metadata = {
  title: 'Be a Pioneer | VisibleShelf',
  description:
    'Join the first ten retailers this platform is built around. Your storefront may already be live — claim it free.',
};

export default function PioneerLandingPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <section className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-emerald-300 rounded-full" />
            Founding cohort — 10 stores
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Your store may already be here.
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
            We list local retailers from public information so neighbors can find
            you — before you ever sign up. Claim your listing free, and grow into
            a full online storefront: products, pickup orders, coupons, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/directory"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-xl hover:bg-gray-50 transition-all text-lg"
            >
              Find your store in the Directory →
            </Link>
            <Link
              href={`/tenant/${DEMO_TENANT_ID}`}
              className="inline-flex items-center justify-center px-8 py-4 bg-white/10 border-2 border-white/40 text-white font-bold rounded-xl hover:bg-white/20 transition-all text-lg"
            >
              See a live storefront
            </Link>
          </div>
          <p className="text-white/70 text-sm mt-6">
            Search your business name — if you&apos;re listed, claiming takes
            about two minutes and costs nothing.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">
          Why pioneers join early
        </h2>
        <p className="text-neutral-600 max-w-2xl mx-auto mb-8">
          Founding members shape what this platform becomes. Your listing is
          free to claim — the partnership grows as your storefront does: pickup
          orders, QR kits, coupons, customer inquiries, and a path to your own
          domain name.
        </p>
        <Link
          href="/auth/signup"
          className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all text-lg"
        >
          Claim your free listing →
        </Link>
      </section>
    </div>
  );
}
