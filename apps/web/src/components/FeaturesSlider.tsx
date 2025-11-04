'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const features = [
  {
    icon: '⚡',
    title: 'Quick Start Wizard',
    description: 'Generate 50-100 products in 1 SECOND',
    gradient: 'from-blue-500 to-purple-600',
    badge: 'GAME CHANGER',
  },
  {
    icon: '🎯',
    title: 'SKU Scanning Intelligence',
    description: 'Complete nutrition facts, allergens & specifications',
    gradient: 'from-green-500 to-emerald-600',
    badge: 'BREAKTHROUGH',
  },
  {
    icon: '🔍',
    title: 'Google Integration Suite',
    description: 'Full GMB sync, Shopping feeds & SWIS',
    gradient: 'from-blue-500 to-green-600',
    badge: 'COMPLETE',
  },
  {
    icon: '📱',
    title: 'QR Code Marketing',
    description: 'High-res QR codes up to 2048px',
    gradient: 'from-purple-500 to-pink-600',
    badge: 'PRINT-READY',
  },
  {
    icon: '🏪',
    title: 'Complete Storefront',
    description: 'Beautiful, SEO-optimized product pages',
    gradient: 'from-orange-500 to-red-600',
    badge: 'NO CODE',
  },
  {
    icon: '📊',
    title: 'Real-Time Analytics',
    description: 'Track performance, ROI & data quality',
    gradient: 'from-cyan-500 to-blue-600',
    badge: 'INSIGHTS',
  },
  {
    icon: '🏷️',
    title: 'Smart Categories',
    description: '5,595 Google taxonomy categories',
    gradient: 'from-indigo-500 to-purple-600',
    badge: 'AUTO-SYNC',
  },
  {
    icon: '🕐',
    title: 'Business Hours Sync',
    description: 'Automatic sync across all channels',
    gradient: 'from-teal-500 to-cyan-600',
    badge: 'AUTOMATED',
  },
];

export default function FeaturesSlider() {
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate features for seamless infinite loop
  const duplicatedFeatures = [...features, ...features, ...features];

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
            Powerful Features at Your Fingertips
          </h3>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Everything you need to dominate local search and drive customers to your store
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
            x: isPaused ? undefined : [0, -((features.length * 320) + (features.length * 24))],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: features.length * 4, // 4 seconds per feature
              ease: "linear",
            },
          }}
          style={{ width: 'fit-content' }}
        >
          {duplicatedFeatures.map((feature, index) => (
            <motion.div
              key={`${feature.title}-${index}`}
              className="relative flex-shrink-0 w-80 h-48 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
              whileHover={{ scale: 1.05, zIndex: 20 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient}`} />
              
              {/* Content */}
              <div className="relative h-full p-6 flex flex-col justify-between text-white">
                {/* Badge */}
                <div className="flex justify-between items-start">
                  <motion.div
                    className="text-5xl"
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    {feature.icon}
                  </motion.div>
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                    {feature.badge}
                  </span>
                </div>

                {/* Title and description */}
                <div>
                  <h4 className="text-xl font-bold mb-2">{feature.title}</h4>
                  <p className="text-sm text-white/90">{feature.description}</p>
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
          <span>Explore All Features</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </motion.div>
    </div>
  );
}
