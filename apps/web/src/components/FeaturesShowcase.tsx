'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Business journey stages aligned with tier progression
const businessJourney = [
  {
    id: 'discovery',
    icon: '🔎',
    title: 'Get Found on Google',
    description: 'Shoppers discover your products on Search, Shopping & Maps — instantly.',
    subtext: 'Visibility-only tier for retailers who want Google presence without commerce complexity.',
    gradient: 'from-blue-500 to-indigo-600',
    badge: 'DISCOVERY',
    priority: 1,
    price: '$29/mo',
    upgradeTrigger: 'People are finding my products — now I want them to find my whole store.',
    nextEvolution: 'Storefront Tier →',
  },
  {
    id: 'storefront',
    icon: '🏪',
    title: 'Own Your Platform Presence',
    description: 'A branded storefront inside the marketplace — browse, inquire, and connect.',
    subtext: 'Platform presence for retailers ready to be discovered beyond Google.',
    gradient: 'from-indigo-500 to-purple-600',
    badge: 'STOREFRONT',
    priority: 1,
    price: '$59/mo',
    upgradeTrigger: 'Shoppers are browsing — now I want them to commit to buying.',
    nextEvolution: 'Commitment Tier →',
  },
  {
    id: 'commitment',
    icon: '🤝',
    title: 'Capture Intent & Drive Foot Traffic',
    description: 'Deposit-based reservations guarantee serious buyers walk through your door.',
    subtext: 'Commitment commerce for physical retailers. Transaction closes in-store via Clover POS.',
    gradient: 'from-purple-500 to-pink-600',
    badge: 'COMMITMENT',
    priority: 1,
    price: '$79/mo',
    upgradeTrigger: 'Shoppers reserve and show up — now I want to close the full sale online.',
    nextEvolution: 'E-commerce Tier →',
  },
  {
    id: 'ecommerce',
    icon: '🛒',
    title: 'Sell Online — Fully & Simply',
    description: 'Complete checkout, payment collection & delivery — pure e-commerce.',
    subtext: 'Full online sales for digital-first retailers. No deposit confusion.',
    gradient: 'from-pink-500 to-rose-600',
    badge: 'E-COMMERCE',
    priority: 1,
    price: '$99/mo',
    upgradeTrigger: 'I\'m selling online successfully — now I want to add physical pickup options.',
    nextEvolution: 'Omnichannel Tier →',
  },
  {
    id: 'omnichannel',
    icon: '🌐',
    title: 'Physical + Online — Unified Commerce',
    description: 'Shoppers choose: pay in full for delivery OR deposit & pick up in store.',
    subtext: 'Unified commerce for retailers with both physical and online presence.',
    gradient: 'from-rose-500 to-orange-600',
    badge: 'OMNICHANNEL',
    priority: 2,
    price: '$149/mo',
    upgradeTrigger: 'I have a physical store AND online sales — I want to offer every way to buy.',
    nextEvolution: 'Enterprise Tier →',
  },
  {
    id: 'enterprise',
    icon: '🏢',
    title: 'Complete Business Solution',
    description: 'Multi-location, enterprise-grade tools, custom contracts & white-label options.',
    subtext: 'For chains, franchises, and regional retailers with advanced needs.',
    gradient: 'from-orange-500 to-amber-600',
    badge: 'ENTERPRISE',
    priority: 2,
    price: '$499/mo',
    upgradeTrigger: 'Growth, scale, and advanced business needs.',
    nextEvolution: 'Ultimate Scale',
  },
];

export type ShowcaseMode = 'slider' | 'hybrid' | 'tabs' | 'grid' | 'video-hero' | 'random';

interface FeaturesShowcaseProps {
  mode?: ShowcaseMode;
  className?: string;
}

export default function FeaturesShowcase({ mode = 'grid', className = '' }: FeaturesShowcaseProps) {
  const [activeMode, setActiveMode] = useState<ShowcaseMode>(mode);
  const prefersReducedMotion = useReducedMotion();

  // console.log(`activeMode:  ${activeMode}`);

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

  // Hidden on mobile (< 768px), visible on tablet and desktop (≥ 768px)
  const showcaseContent = (() => {
    switch (activeMode) {
      case 'slider':
        return <SliderMode stages={businessJourney} prefersReducedMotion={prefersReducedMotion} className={className} />;
      case 'hybrid':
        return <HybridMode stages={businessJourney} prefersReducedMotion={prefersReducedMotion} className={className} />;
      case 'tabs':
        return <TabsMode stages={businessJourney} className={className} />;
      case 'grid':
        return <GridMode stages={businessJourney} className={className} />;
      case 'video-hero':
        return <VideoHeroMode stages={businessJourney} className={className} />;
      default:
        return <HybridMode stages={businessJourney} prefersReducedMotion={prefersReducedMotion} className={className} />;
    }
  })();

  return (
    <div className="w-full">
      {showcaseContent}
    </div>
  );
}

// ==================== MODE 1: SLIDER ====================
function SliderMode({ stages, prefersReducedMotion, className }: any) {
  const [isPaused, setIsPaused] = useState(false);
  const duplicatedStages = [...stages, ...stages, ...stages];

  return (
    <div className={`relative overflow-hidden py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-neutral-50 via-neutral-50/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-neutral-50 via-neutral-50/80 to-transparent z-10 pointer-events-none" />

      <div className="text-center mb-4 sm:mb-6 px-3 sm:px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Grow Your Business, One Tier at a Time
          </h3>
          <p className="text-sm sm:text-base text-neutral-600 max-w-2xl mx-auto">
            Every tier matches your business reality — move up as your ambition grows
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
          className="flex gap-3 sm:gap-4 md:gap-6 px-2 sm:px-4"
          animate={{
            x: prefersReducedMotion || isPaused ? undefined : [0, -((stages.length * 320) + (stages.length * 24))],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: stages.length * 4,
              ease: "linear",
            },
          }}
          style={{ width: 'fit-content' }}
        >
          {duplicatedStages.map((stage: any, index: number) => (
            <FeatureCard key={`${stage.id}-${index}`} feature={stage} />
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
function HybridMode({ stages, prefersReducedMotion, className }: any) {
  const topStages = stages.filter((s: any) => s.priority === 1);
  const secondaryStages = stages.filter((s: any) => s.priority === 2);
  const [isPaused, setIsPaused] = useState(false);
  const duplicatedSecondary = [...secondaryStages, ...secondaryStages];

  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
              A Tier for Every Business Model
            </h3>
            <p className="text-sm sm:text-base text-neutral-600 max-w-2xl mx-auto">
              Tiers aligned with how you actually operate — not just feature accumulation
            </p>
          </motion.div>
        </div>

        {/* Baseline / Pre-Discovery Mindset Shift */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-neutral-900/5 border border-dashed border-neutral-300 rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 p-3 text-neutral-200/50 text-7xl font-serif pointer-events-none select-none z-0">
              &ldquo;
            </div>
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-700 border border-neutral-300 mb-2">
                🔒 Baseline (The Retailer's Dilemma)
              </span>
              <p className="text-sm md:text-base text-neutral-600 font-medium italic leading-relaxed">
                &ldquo;My products are sitting on the physical shelves right now, but unless someone walks through my door, nobody in my neighborhood even knows what I have in stock.&rdquo;
              </p>
            </div>
            <div className="relative z-10 shrink-0 self-start md:self-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 block mb-1">Next Evolution</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
                🔎 Discovery Tier →
              </span>
            </div>
          </div>
        </motion.div>

        {/* Hero Feature - Largest, with video option */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6 sm:mb-8"
        >
          <HeroFeatureCard feature={topStages[0]} />
        </motion.div>

        {/* Top 2 Features - Side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {topStages.slice(1, 3).map((stage: any, index: number) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
            >
              <LargeFeatureCard feature={stage} />
            </motion.div>
          ))}
        </div>

        {/* Secondary Features - Slider */}
        <div className="mb-6 sm:mb-8">
          <h4 className="text-lg sm:text-xl font-bold text-neutral-900 mb-3 sm:mb-4 text-center">
            Advanced Tiers for Growing Businesses
          </h4>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-neutral-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-neutral-50 to-transparent z-10 pointer-events-none" />
            
            <div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              <motion.div
                className="flex gap-3 sm:gap-4"
                animate={{
                  x: prefersReducedMotion || isPaused ? undefined : [0, -((secondaryStages.length * 280) + (secondaryStages.length * 16))],
                }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: secondaryStages.length * 3,
                    ease: "linear",
                  },
                }}
                style={{ width: 'fit-content' }}
              >
                {duplicatedSecondary.map((stage: any, index: number) => (
                  <SmallFeatureCard key={`${stage.id}-${index}`} feature={stage} />
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
function TabsMode({ stages, className }: any) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            Explore Your Growth Path
          </h3>
          <p className="text-sm sm:text-base text-neutral-600">Click each tier to see the business model it unlocks</p>
        </div>

        {/* Baseline / Pre-Discovery Mindset Shift */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-neutral-900/5 border border-dashed border-neutral-300 rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="absolute top-0 right-0 p-3 text-neutral-200/50 text-7xl font-serif pointer-events-none select-none z-0">
              &ldquo;
            </div>
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-700 border border-neutral-300 mb-2">
                🔒 Baseline (The Retailer's Dilemma)
              </span>
              <p className="text-sm md:text-base text-neutral-600 font-medium italic leading-relaxed">
                &ldquo;My products are sitting on the physical shelves right now, but unless someone walks through my door, nobody in my neighborhood even knows what I have in stock.&rdquo;
              </p>
            </div>
            <div className="relative z-10 shrink-0 self-start md:self-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 block mb-1">Next Evolution</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
                🔎 Discovery Tier →
              </span>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 sm:mb-8">
          {stages.map((stage: any, index: number) => (
            <button
              key={stage.id}
              onClick={() => setActiveTab(index)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                activeTab === index
                  ? 'bg-primary-600 text-white shadow-lg scale-105'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {stage.icon} {stage.badge}
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
          <DetailedFeatureCard feature={stages[activeTab]} />
        </motion.div>

        <CTAButton />
      </div>
    </div>
  );
}

// ==================== MODE 4: GRID ====================
function GridMode({ stages, className }: any) {
  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            A Tier for Every Business Reality
          </h3>
          <p className="text-sm sm:text-base text-neutral-600">Align your tier with your business model — not the other way around</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {stages.map((stage: any, index: number) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <GridFeatureCard feature={stage} />
            </motion.div>
          ))}
        </div>

        <CTAButton />
      </div>
    </div>
  );
}

// ==================== MODE 5: VIDEO HERO ====================
function VideoHeroMode({ stages, className }: any) {
  const heroStage = stages.find((s: any) => s.priority === 1);

  return (
    <div className={`py-8 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-50 ${className}`}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
            See the Platform in Action
          </h3>
          <p className="text-sm sm:text-base text-neutral-600">How local retailers move from discovery to conversion</p>
        </div>

        {/* Video Section */}
        <div className="bg-neutral-900 rounded-xl sm:rounded-2xl overflow-hidden mb-6 sm:mb-8 aspect-video">
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🎬</div>
              <p className="text-lg sm:text-xl font-semibold">Video Demo Coming Soon</p>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2">{heroStage?.title}</p>
            </div>
          </div>
        </div>

        {/* Feature Grid Below */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {stages.slice(0, 4).map((stage: any) => (
            <div key={stage.id} className="text-center p-3 sm:p-4 bg-white rounded-lg">
              <div className="text-2xl sm:text-3xl mb-2">{stage.icon}</div>
              <p className="text-xs sm:text-sm font-semibold text-neutral-900">{stage.badge}</p>
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
      className="relative flex-shrink-0 w-64 sm:w-72 md:w-80 h-40 sm:h-44 md:h-48 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
      whileHover={{ scale: 1.05, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient}`} />
      <div className="relative h-full p-4 sm:p-5 md:p-6 flex flex-col justify-between text-white">
        <div className="flex justify-between items-start">
          <motion.div
            className="text-3xl sm:text-4xl md:text-5xl"
            whileHover={{ scale: 1.2, rotate: 10 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {feature.icon}
          </motion.div>
          <span className="bg-white/20 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-xs font-bold">
            {feature.badge}
          </span>
        </div>
        <div>
          <h4 className="text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2">{feature.title}</h4>
          <p className="text-xs sm:text-sm text-white/90">{feature.description}</p>
          {feature.price && (
            <p className="text-xs text-white/90 mt-1 font-semibold">{feature.price}</p>
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
    <div className={`relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${feature.gradient} p-6 sm:p-8 md:p-12`}>
      <div className="relative z-10 text-white">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="text-5xl sm:text-6xl md:text-7xl">{feature.icon}</div>
          <div className="flex flex-col items-end gap-2">
            <span className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-bold">
              {feature.badge}
            </span>
            {feature.nextEvolution && (
              <span className="bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/90 border border-white/15">
                Next Evolution: {feature.nextEvolution}
              </span>
            )}
          </div>
        </div>
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">{feature.title}</h3>
        <p className="text-base sm:text-lg md:text-xl mb-2">{feature.description}</p>
        <p className="text-sm sm:text-base md:text-lg text-white/80 mb-2 sm:mb-3">{feature.price}</p>
        {feature.upgradeTrigger && (
          <div className="mt-4 mb-6 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-white/60" />
            <p className="text-xs font-semibold tracking-wider text-white/50 uppercase mb-1">Retailer Growth Mindset</p>
            <p className="text-sm md:text-base text-white font-medium italic relative z-10 leading-relaxed">
              &ldquo;{feature.upgradeTrigger}&rdquo;
            </p>
            <div className="absolute -right-4 -bottom-4 text-white/5 text-6xl font-serif pointer-events-none select-none">
              &rdquo;
            </div>
          </div>
        )}
        <Link href={`/auth/signup?tier=${feature.id}`}>
          <Button size="lg" variant="secondary" className="bg-white text-neutral-900 hover:bg-neutral-100">
            Start with {feature.badge} →
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
    <div className={`relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br ${feature.gradient} p-4 sm:p-5 md:p-6 h-56 sm:h-60 md:h-64`}>
      <div className="relative z-10 text-white h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="text-4xl sm:text-5xl">{feature.icon}</div>
          <span className="bg-white/20 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-xs font-bold">
            {feature.badge}
          </span>
        </div>
        <div>
          <h4 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">{feature.title}</h4>
          <p className="text-xs sm:text-sm mb-1 sm:mb-2">{feature.description}</p>
          <p className="text-xs text-white/90 font-semibold">{feature.price}</p>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
    </div>
  );
}

function SmallFeatureCard({ feature }: any) {
  return (
    <div className={`relative flex-shrink-0 w-56 sm:w-64 md:w-72 h-36 sm:h-40 rounded-lg sm:rounded-xl overflow-hidden shadow-md bg-gradient-to-br ${feature.gradient} p-3 sm:p-4`}>
      <div className="relative z-10 text-white h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="text-2xl sm:text-3xl">{feature.icon}</div>
          <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 sm:py-1 rounded-full text-xs font-bold">
            {feature.badge}
          </span>
        </div>
        <div>
          <h5 className="text-base sm:text-lg font-bold mb-1">{feature.title}</h5>
          <p className="text-xs text-white/90 line-clamp-2">{feature.description}</p>
        </div>
      </div>
    </div>
  );
}

function DetailedFeatureCard({ feature }: any) {
  return (
    <div className={`relative rounded-xl sm:rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br ${feature.gradient} p-6 sm:p-8`}>
      <div className="relative z-10 text-white">
        <div className="flex items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-4xl sm:text-5xl md:text-6xl">{feature.icon}</div>
            <div>
              <span className="bg-white/20 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-xs font-bold mb-2 inline-block">
                {feature.badge}
              </span>
              <h4 className="text-2xl sm:text-3xl font-bold">{feature.title}</h4>
            </div>
          </div>
          {feature.nextEvolution && (
            <span className="bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/90 border border-white/15">
              Next Evolution: {feature.nextEvolution}
            </span>
          )}
        </div>
        <p className="text-base sm:text-lg md:text-xl mb-2 sm:mb-3">{feature.description}</p>
        <p className="text-sm sm:text-base md:text-lg text-white/80 mb-2 sm:mb-3">{feature.price}</p>
        {feature.upgradeTrigger && (
          <div className="mt-4 mb-6 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-white/60" />
            <p className="text-xs font-semibold tracking-wider text-white/50 uppercase mb-1">Retailer Growth Mindset</p>
            <p className="text-sm md:text-base text-white font-medium italic relative z-10 leading-relaxed">
              &ldquo;{feature.upgradeTrigger}&rdquo;
            </p>
            <div className="absolute -right-4 -bottom-4 text-white/5 text-6xl font-serif pointer-events-none select-none">
              &rdquo;
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Link href={`/auth/signup?tier=${feature.id}`} className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="bg-white text-neutral-900 hover:bg-neutral-100 w-full sm:w-auto">
              Start with {feature.badge} →
            </Button>
          </Link>
          <Link href="/features#pricing" className="w-full sm:w-auto">
            <Button size="lg" variant="ghost" className="text-white border-white hover:bg-white/10 w-full sm:w-auto">
              Compare Tiers
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
    <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 md:p-6 shadow-md hover:shadow-xl transition-shadow">
      <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">{feature.icon}</div>
      <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-bold mb-2 inline-block">
        {feature.badge}
      </span>
      <h4 className="text-base sm:text-lg font-bold text-neutral-900 mb-1 sm:mb-2">{feature.title}</h4>
      <p className="text-xs sm:text-sm text-neutral-600 mb-1 sm:mb-2">{feature.description}</p>
      <p className="text-xs text-neutral-500">{feature.price}</p>
      {feature.upgradeTrigger && (
        <div className="mt-4 p-3 rounded-lg bg-gray-50 border-l-2 border-primary-500 relative overflow-hidden">
          <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-0.5">Mindset Shift</p>
          <p className="text-xs text-gray-600 font-medium italic leading-normal select-none">
            &ldquo;{feature.upgradeTrigger}&rdquo;
          </p>
        </div>
      )}
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
          <span>Explore All Tiers</span>
          <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </Link>
    </motion.div>
  );
}
