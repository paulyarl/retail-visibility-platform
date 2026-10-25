'use client';

import { motion } from 'framer-motion';

/**
 * The executive summary band — "Stocked shelves shouldn't be a secret" plus
 * the Mission / Vision / Promise pillars.
 *
 * Rendered by `(platform)/page.tsx`, which is a server component: this is a
 * client component only because the reveal animation needs framer-motion, but
 * client components are still server-rendered, so the whole band is in the
 * initial HTML. That is the point — this is the only prose on `/` that
 * explains the product, and crawlers (and unfurlers) never execute the
 * dashboard bundle below it.
 */
export default function PlatformSummaryBand() {
  return (
    <section
      aria-labelledby="platform-summary-title"
      className="max-w-4xl mx-auto px-3 sm:px-4 pt-6 sm:pt-8 mb-8 sm:mb-12 md:mb-16 text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h2 id="platform-summary-title" className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 mb-3 sm:mb-4">
          Stocked shelves shouldn't be a secret
        </h2>
        <p className="text-base sm:text-lg text-neutral-600 mb-6 sm:mb-8 leading-relaxed">
          Right now, your products sit on physical shelves — visible only to whoever walks through
          your door. Worse, most neighbors don't even know you're there. And a store nobody can
          find takes its products with it. We put both on the map, starting free — your business may
          already be in our directory from public information, and claiming it takes about two
          minutes. From there your catalog travels: the directory puts it on our shelves, Google
          Search and Shopping put it in front of searchers, and your own storefront gives it a home
          you own. Tools and integrations keep it in sync behind the scenes, and when a shopper is
          ready to buy, your storefront doubles as the fulfillment center — deposits, pickup,
          delivery, or full online payment, all run straight off your shelves. The store that was off
          the map gets found, and the product that was hidden on your shelf ends up in a neighbor's
          hands. No developer, no enterprise budget, no months of setup.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
          <motion.div
            className="p-4 sm:p-6 bg-primary-50 rounded-xl border-2 border-primary-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="mx-auto mb-3 sm:mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3.2c-2.9 0-5.2 2.3-5.2 5.2 0 3.7 5.2 8.9 5.2 8.9s5.2-5.2 5.2-8.9c0-2.9-2.3-5.2-5.2-5.2Z" />
                <circle cx="12" cy="8.4" r="1.9" />
                <path d="M3.5 19.6h17" />
              </svg>
            </div>
            <h3 className="font-bold text-neutral-900 mb-1 sm:mb-2 text-base sm:text-lg">Our Mission</h3>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Put every local business on the map — with the same discovery-to-sale tools the big chains built for themselves.
            </p>
          </motion.div>
          <motion.div
            className="p-4 sm:p-6 bg-green-50 rounded-xl border-2 border-green-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="mx-auto mb-3 sm:mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.2 9.4 5.6 5h12.8l1.4 4.4" />
                <path d="M4.2 9.4v10.8h16V9.4" />
                <path d="M9.8 20.2v-5.6h4.4v5.6" />
              </svg>
            </div>
            <h3 className="font-bold text-neutral-900 mb-1 sm:mb-2 text-base sm:text-lg">Our Vision</h3>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Buying from the shop down the street should be as easy as buying from a national chain.
            </p>
          </motion.div>
          <motion.div
            className="p-4 sm:p-6 bg-amber-50 rounded-xl border-2 border-amber-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="mx-auto mb-3 sm:mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3 5 5.8v5.4c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V5.8L12 3Z" />
                <path d="m9.2 11.4 2 2 3.6-3.9" />
              </svg>
            </div>
            <h3 className="font-bold text-neutral-900 mb-1 sm:mb-2 text-base sm:text-lg">Our Promise</h3>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Start free, stay in control: claim your listing at no cost, unlock only what you need, and pay when you're ready to grow.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
