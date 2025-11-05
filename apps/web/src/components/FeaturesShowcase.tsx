'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import Link from 'next/link';

// Feature data
const features = [
  {
    id: 'quick-start',
    icon: '⚡',
    title: 'Quick Start Wizard',
    description: 'Generate 50-100 products in 1 SECOND',
    subtext: 'Save $2,400/month vs manual entry',
    gradient: 'from-blue-500 to-purple-600',
    badge: 'GAME CHANGER',
    priority: 1, // Top 3 feature
    videoUrl: '/videos/quick-start-demo.mp4', // Placeholder
  },
  {
    id: 'sku-scanning',
    icon: '🎯',
    title: 'SKU Scanning Intelligence',
    description: 'Complete nutrition facts, allergens & specifications',
    subtext: 'Compete with CVS, Walmart & Target',
    gradient: 'from-green-500 to-emerald-600',
    badge: 'BREAKTHROUGH',
    priority: 1, // Top 3 feature
  },
  {
    id: 'chain-management',
    icon: '🔗',
    title: 'Chain Management & Sync',
    description: 'Distribute & UPDATE products across 50+ locations in ONE CLICK',
    subtext: 'Save 400+ hours per rollout - Enterprise retailers pay $50K+/year for this',
    gradient: 'from-emerald-500 to-teal-600',
    badge: 'ENTERPRISE',
    priority: 1, // Top 3 feature
  },
  {
    id: 'google-integration',
    icon: '🔍',
    title: 'Google Integration Suite',
    description: 'Full GMB sync, Shopping feeds & SWIS',
    subtext: 'Instant local visibility',
    gradient: 'from-blue-500 to-green-600',
    badge: 'COMPLETE',
    priority: 1, // Top 3 feature
  },
  {
    id: 'qr-marketing',
    icon: '📱',
    title: 'QR Code Marketing',
    description: 'High-res QR codes up to 2048px',
    subtext: 'Print-ready for flyers & signage',
    gradient: 'from-purple-500 to-pink-600',
    badge: 'PRINT-READY',
    priority: 2,
  },
  {
    id: 'storefront',
    icon: '🏪',
    title: 'Complete Storefront',
    description: 'Beautiful, SEO-optimized product pages',
    subtext: 'No coding required',
    gradient: 'from-orange-500 to-red-600',
    badge: 'NO CODE',
    priority: 2,
  },
  {
    id: 'analytics',
    icon: '📊',
    title: 'Real-Time Analytics',
    description: 'Track performance, ROI & data quality',
    subtext: 'Data-driven decisions',
    gradient: 'from-cyan-500 to-blue-600',
    badge: 'INSIGHTS',
    priority: 2,
  },
  {
    id: 'categories',
    icon: '🏷️',
    title: 'Smart Categories',
    description: '5,595 Google taxonomy categories',
    subtext: 'Auto-categorization & sync',
    gradient: 'from-indigo-500 to-purple-600',
    badge: 'AUTO-SYNC',
    priority: 3,
  },
  {
    id: 'business-hours',
    icon: '🕐',
    title: 'Smart Business Hours',
    description: 'Real-time status that goes beyond Google',
    subtext: 'Multiple periods, split shifts, emergency updates - your storefront shows it all',
    gradient: 'from-teal-500 to-cyan-600',
    badge: 'REAL-TIME',
    priority: 3,
  },
];

export type ShowcaseMode = 'slider' | 'hybrid' | 'tabs' | 'grid' | 'video-hero' | 'random';

interface FeaturesShowcaseProps {
  mode?: ShowcaseMode;
  className?: string;
}

export default function FeaturesShowcase({ mode = 'hybrid', className = '' }: FeaturesShowcaseProps) {
  const [activeMode, setActiveMode] = useState<ShowcaseMode>(mode);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Handle random mode - pick a random showcase on mount
    if (mode === 'random') {
      const modes: ShowcaseMode[] = ['slider', 'hybrid', 'tabs', 'grid'];
      const randomMode = modes[Math.floor(Math.random() * modes.length)];
      setActiveMode(randomMode);
    } else {
      setActiveMode(mode);
    }
  }, [mode]);

  // Render based on active mode
  switch (activeMode) {
    case 'slider':
      return <SliderMode features={features} prefersReducedMotion={prefersReducedMotion} className={className} />;
    case 'hybrid':
      return <HybridMode features={features} prefersReducedMotion={prefersReducedMotion} className={className} />;
    case 'tabs':
      return <TabsMode features={features} className={className} />;
    case 'grid':
      return <GridMode features={features} className={className} />;
    case 'video-hero':
      return <VideoHeroMode features={features} className={className} />;
    default:
      return <HybridMode features={features} prefersReducedMotion={prefersReducedMotion} className={className} />;
  }
}

// ==================== MODE 1: SLIDER ====================
function SliderMode({ features, prefersReducedMotion, className }: any) {
  const [isPaused, setIsPaused] = useState(false);
  const duplicatedFeatures = [...features, ...features, ...features];

  return (
    <div className={`relative overflow-hidden py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-neutral-50 via-neutral-50/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-neutral-50 via-neutral-50/80 to-transparent z-10 pointer-events-none" />

      <div className="text-center mb-6 px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Powerful Features at Your Fingertips
          </h3>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Everything you need to dominate local search and drive customers to your store
          </p>
        </motion.div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <motion.div
          className="flex gap-6 px-4"
          animate={{
            x: prefersReducedMotion || isPaused ? undefined : [0, -((features.length * 320) + (features.length * 24))],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: features.length * 4,
              ease: "linear",
            },
          }}
          style={{ width: 'fit-content' }}
        >
          {duplicatedFeatures.map((feature: any, index: number) => (
            <FeatureCard key={`${feature.id}-${index}`} feature={feature} />
          ))}
        </motion.div>
      </div>

      {isPaused && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-4">
          <span className="text-xs text-neutral-500 bg-white px-3 py-1 rounded-full shadow-sm">
            ⏸️ Paused • Move away to continue
          </span>
        </motion.div>
      )}

      <CTAButton />
    </div>
  );
}

// ==================== MODE 2: HYBRID (RECOMMENDED) ====================
function HybridMode({ features, prefersReducedMotion, className }: any) {
  const topFeatures = features.filter((f: any) => f.priority === 1);
  const secondaryFeatures = features.filter((f: any) => f.priority === 2);
  const [isPaused, setIsPaused] = useState(false);
  const duplicatedSecondary = [...secondaryFeatures, ...secondaryFeatures];

  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
              Game-Changing Features
            </h3>
            <p className="text-neutral-600 max-w-2xl mx-auto">
              The complete toolkit to compete with major retailers and dominate local search
            </p>
          </motion.div>
        </div>

        {/* Hero Feature - Largest, with video option */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <HeroFeatureCard feature={topFeatures[0]} />
        </motion.div>

        {/* Top 2 Features - Side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {topFeatures.slice(1, 3).map((feature: any, index: number) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
            >
              <LargeFeatureCard feature={feature} />
            </motion.div>
          ))}
        </div>

        {/* Secondary Features - Slider */}
        <div className="mb-8">
          <h4 className="text-xl font-bold text-neutral-900 mb-4 text-center">
            Plus More Powerful Tools
          </h4>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-neutral-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-neutral-50 to-transparent z-10 pointer-events-none" />
            
            <div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              <motion.div
                className="flex gap-4"
                animate={{
                  x: prefersReducedMotion || isPaused ? undefined : [0, -((secondaryFeatures.length * 280) + (secondaryFeatures.length * 16))],
                }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: secondaryFeatures.length * 3,
                    ease: "linear",
                  },
                }}
                style={{ width: 'fit-content' }}
              >
                {duplicatedSecondary.map((feature: any, index: number) => (
                  <SmallFeatureCard key={`${feature.id}-${index}`} feature={feature} />
                ))}
              </motion.div>
            </div>
          </div>
        </div>

        <CTAButton />
      </div>
    </div>
  );
}

// ==================== MODE 3: TABS ====================
function TabsMode({ features, className }: any) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Explore Our Features
          </h3>
          <p className="text-neutral-600">Click to learn more about each capability</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {features.map((feature: any, index: number) => (
            <button
              key={feature.id}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === index
                  ? 'bg-primary-600 text-white shadow-lg scale-105'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {feature.icon} {feature.title}
            </button>
          ))}
        </div>

        {/* Active Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <DetailedFeatureCard feature={features[activeTab]} />
        </motion.div>

        <CTAButton />
      </div>
    </div>
  );
}

// ==================== MODE 4: GRID ====================
function GridMode({ features, className }: any) {
  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Complete Feature Suite
          </h3>
          <p className="text-neutral-600">Everything you need in one powerful platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {features.map((feature: any, index: number) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <GridFeatureCard feature={feature} />
            </motion.div>
          ))}
        </div>

        <CTAButton />
      </div>
    </div>
  );
}

// ==================== MODE 5: VIDEO HERO ====================
function VideoHeroMode({ features, className }: any) {
  const heroFeature = features.find((f: any) => f.priority === 1);

  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            See It In Action
          </h3>
          <p className="text-neutral-600">Watch how easy it is to get started</p>
        </div>

        {/* Video Section */}
        <div className="bg-neutral-900 rounded-2xl overflow-hidden mb-8 aspect-video">
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-6xl mb-4">🎬</div>
              <p className="text-xl font-semibold">Video Demo Coming Soon</p>
              <p className="text-sm text-neutral-400 mt-2">{heroFeature?.title}</p>
            </div>
          </div>
        </div>

        {/* Feature Grid Below */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.slice(0, 4).map((feature: any) => (
            <div key={feature.id} className="text-center p-4 bg-white rounded-lg">
              <div className="text-3xl mb-2">{feature.icon}</div>
              <p className="text-sm font-semibold text-neutral-900">{feature.title}</p>
            </div>
          ))}
        </div>

        <CTAButton />
      </div>
    </div>
  );
}

// ==================== FEATURE CARD COMPONENTS ====================

function FeatureCard({ feature }: any) {
  return (
    <motion.div
      className="relative flex-shrink-0 w-80 h-48 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
      whileHover={{ scale: 1.05, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient}`} />
      <div className="relative h-full p-6 flex flex-col justify-between text-white">
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
        <div>
          <h4 className="text-xl font-bold mb-2">{feature.title}</h4>
          <p className="text-sm text-white/90">{feature.description}</p>
          {feature.subtext && (
            <p className="text-xs text-white/70 mt-1">💰 {feature.subtext}</p>
          )}
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
      </div>
    </motion.div>
  );
}

function HeroFeatureCard({ feature }: any) {
  return (
    <div className={`relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${feature.gradient} p-8 md:p-12`}>
      <div className="relative z-10 text-white">
        <div className="flex items-start justify-between mb-6">
          <div className="text-7xl">{feature.icon}</div>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold">
            {feature.badge}
          </span>
        </div>
        <h3 className="text-3xl md:text-4xl font-bold mb-4">{feature.title}</h3>
        <p className="text-xl mb-2">{feature.description}</p>
        <p className="text-lg text-white/80 mb-6">💰 {feature.subtext}</p>
        <Link href={`/signup?feature=${feature.id}`}>
          <Button size="lg" variant="secondary" className="bg-white text-neutral-900 hover:bg-neutral-100">
            Try This Feature Now →
          </Button>
        </Link>
      </div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
    </div>
  );
}

function LargeFeatureCard({ feature }: any) {
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br ${feature.gradient} p-6 h-64`}>
      <div className="relative z-10 text-white h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="text-5xl">{feature.icon}</div>
          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
            {feature.badge}
          </span>
        </div>
        <div>
          <h4 className="text-2xl font-bold mb-2">{feature.title}</h4>
          <p className="text-sm mb-2">{feature.description}</p>
          <p className="text-xs text-white/70">💰 {feature.subtext}</p>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
    </div>
  );
}

function SmallFeatureCard({ feature }: any) {
  return (
    <div className={`relative flex-shrink-0 w-72 h-40 rounded-xl overflow-hidden shadow-md bg-gradient-to-br ${feature.gradient} p-4`}>
      <div className="relative z-10 text-white h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="text-3xl">{feature.icon}</div>
          <span className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold">
            {feature.badge}
          </span>
        </div>
        <div>
          <h5 className="text-lg font-bold mb-1">{feature.title}</h5>
          <p className="text-xs text-white/90">{feature.description}</p>
        </div>
      </div>
    </div>
  );
}

function DetailedFeatureCard({ feature }: any) {
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br ${feature.gradient} p-8`}>
      <div className="relative z-10 text-white">
        <div className="flex items-center gap-6 mb-6">
          <div className="text-6xl">{feature.icon}</div>
          <div>
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold mb-2 inline-block">
              {feature.badge}
            </span>
            <h4 className="text-3xl font-bold">{feature.title}</h4>
          </div>
        </div>
        <p className="text-xl mb-3">{feature.description}</p>
        <p className="text-lg text-white/80 mb-6">💰 {feature.subtext}</p>
        <div className="flex gap-4">
          <Link href={`/signup?feature=${feature.id}`}>
            <Button size="lg" variant="secondary" className="bg-white text-neutral-900 hover:bg-neutral-100">
              Try This Feature →
            </Button>
          </Link>
          <Link href="/features">
            <Button size="lg" variant="ghost" className="text-white border-white hover:bg-white/10">
              Learn More
            </Button>
          </Link>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
    </div>
  );
}

function GridFeatureCard({ feature }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
      <div className="text-4xl mb-3">{feature.icon}</div>
      <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-bold mb-2 inline-block">
        {feature.badge}
      </span>
      <h4 className="text-lg font-bold text-neutral-900 mb-2">{feature.title}</h4>
      <p className="text-sm text-neutral-600 mb-2">{feature.description}</p>
      <p className="text-xs text-neutral-500">💰 {feature.subtext}</p>
    </div>
  );
}

function CTAButton() {
  return (
    <motion.div
      className="text-center mt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      <Link href="/features">
        <Button size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <span>Explore All Features</span>
          <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </Link>
    </motion.div>
  );
}
