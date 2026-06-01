'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

// Business journey stages aligned with tier progression
const businessJourney = [
  {
    icon: '🔎',
    title: 'Get Found on Google',
    description: 'Shoppers discover your products on Search, Shopping & Maps — instantly.',
    gradient: 'from-blue-500 to-indigo-600',
    badge: 'DISCOVERY',
    price: '$29/mo',
  },
  {
    icon: '🏪',
    title: 'Own Your Storefront',
    description: 'A branded presence inside the platform — browse, inquire, and connect.',
    gradient: 'from-indigo-500 to-purple-600',
    badge: 'STOREFRONT',
    price: '$59/mo',
  },
  {
    icon: '🤝',
    title: 'Capture Intent & Drive Foot Traffic',
    description: 'Deposit-based reservations guarantee serious buyers walk through your door.',
    gradient: 'from-purple-500 to-pink-600',
    badge: 'COMMITMENT',
    price: '$79/mo',
  },
  {
    icon: '🛒',
    title: 'Sell Online — Fully & Simply',
    description: 'Complete checkout, payment collection & delivery — pure e-commerce.',
    gradient: 'from-pink-500 to-rose-600',
    badge: 'E-COMMERCE',
    price: '$99/mo',
  },
  {
    icon: '🌐',
    title: 'Physical + Online — Unified Commerce',
    description: 'Let shoppers choose: pay in full for delivery OR deposit & pick up in store.',
    gradient: 'from-rose-500 to-orange-600',
    badge: 'OMNICHANNEL',
    price: '$149/mo',
  },
  {
    icon: '🏢',
    title: 'Complete Business Solution',
    description: 'Multi-location, enterprise-grade tools, custom contracts & white-label options.',
    gradient: 'from-orange-500 to-amber-600',
    badge: 'ENTERPRISE',
    price: '$499/mo',
  },
];

export default function FeaturesSlider() {
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate journey stages for seamless infinite loop
  const duplicatedStages = [...businessJourney, ...businessJourney, ...businessJourney];

  return (
    <div className="relative overflow-hidden py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50">
      {/* Gradient overlays for fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-neutral-50 via-neutral-50/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-neutral-50 via-neutral-50/80 to-transparent z-10 pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Grow Your Business, One Tier at a Time
          </h3>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Every tier matches your business reality — move up as your ambition grows
          </p>
        </motion.div>
      </div>

      {/* Animated slider container */}
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.div
          className="flex gap-6 px-4"
          animate={{
            x: isPaused ? undefined : [0, -((businessJourney.length * 320) + (businessJourney.length * 24))],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: businessJourney.length * 4, // 4 seconds per stage
              ease: "linear",
            },
          }}
          style={{ width: 'fit-content' }}
        >
          {duplicatedStages.map((stage, index) => (
            <motion.div
              key={`${stage.title}-${index}`}
              className="relative flex-shrink-0 w-80 h-48 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
              whileHover={{ scale: 1.05, zIndex: 20 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stage.gradient}`} />
              
              {/* Content */}
              <div className="relative h-full p-6 flex flex-col justify-between text-white">
                {/* Badge & Price */}
                <div className="flex justify-between items-start">
                  <motion.div
                    className="text-5xl"
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    {stage.icon}
                  </motion.div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                      {stage.badge}
                    </span>
                    <span className="text-xs font-semibold text-white/90">{stage.price}</span>
                  </div>
                </div>

                {/* Title and description */}
                <div>
                  <h4 className="text-xl font-bold mb-2">{stage.title}</h4>
                  <p className="text-sm text-white/90">{stage.description}</p>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-4"
        >
          <span className="text-xs text-neutral-500 bg-white px-3 py-1 rounded-full shadow-sm">
            ⏸️ Hover to pause • Move away to continue
          </span>
        </motion.div>
      )}

      {/* CTA Button */}
      <motion.div
        className="text-center mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <a
          href="/features"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <span>Explore All Tiers</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </motion.div>
    </div>
  );
}
