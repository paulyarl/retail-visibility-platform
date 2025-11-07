/**
 * TierGate Usage Examples
 * 
 * This file demonstrates various ways to use the TierGate component
 * for tier-based feature access control.
 */

'use client';

import { TierGate, TierBadge } from './TierGate';
import { useTierAccess } from '@/lib/tiers/useTierAccess';

interface ExampleProps {
  tenantId: string;
  tier: string;
}

/**
 * Example 1: Basic TierGate usage
 */
export function BasicTierGateExample({ tenantId, tier }: ExampleProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Basic Tier Gating</h2>
      
      {/* Storefront feature - available from Starter tier */}
      <TierGate feature="storefront" tier={tier} tenantId={tenantId}>
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          ✅ Storefront is available for your tier!
        </div>
      </TierGate>
      
      {/* Quick Start - Professional tier only */}
      <TierGate feature="quick_start_wizard" tier={tier} tenantId={tenantId}>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          ✅ Quick Start Wizard is available!
        </div>
      </TierGate>
    </div>
  );
}

/**
 * Example 2: Custom fallback instead of default upgrade prompt
 */
export function CustomFallbackExample({ tier }: ExampleProps) {
  return (
    <TierGate 
      feature="api_access" 
      tier={tier}
      fallback={
        <div className="p-4 bg-amber-50 border border-amber-200 rounded">
          <p className="font-semibold">API Access Not Available</p>
          <p className="text-sm">Contact sales for Enterprise features</p>
        </div>
      }
    >
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        <h3 className="font-bold">API Settings</h3>
        <p>Configure your API keys and webhooks</p>
      </div>
    </TierGate>
  );
}

/**
 * Example 3: Hide feature completely without showing upgrade prompt
 */
export function HiddenFeatureExample({ tier }: ExampleProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Conditional Features</h2>
      
      {/* This button only shows if tier has the feature */}
      <TierGate feature="white_label" tier={tier} showUpgrade={false}>
        <button className="px-4 py-2 bg-primary-600 text-white rounded">
          Configure White Label Settings
        </button>
      </TierGate>
      
      {/* Always visible, but shows badge if locked */}
      <button className="px-4 py-2 bg-neutral-200 rounded flex items-center gap-2">
        Advanced Analytics
        <TierBadge feature="advanced_analytics" tier={tier} />
      </button>
    </div>
  );
}

/**
 * Example 4: Programmatic tier checking with hook
 */
export function ProgrammaticExample({ tier }: ExampleProps) {
  const { 
    hasFeature, 
    requiresUpgrade, 
    tierDisplay, 
    tierPrice,
    hasAllFeatures,
    hasAnyFeature 
  } = useTierAccess(tier);
  
  const scanningUpgrade = requiresUpgrade('product_scanning');
  
  return (
    <div className="space-y-4 p-4 bg-neutral-50 rounded">
      <h2 className="text-xl font-bold">Current Plan: {tierDisplay}</h2>
      <p className="text-sm text-neutral-600">${tierPrice}/month</p>
      
      <div className="space-y-2">
        <h3 className="font-semibold">Feature Availability:</h3>
        <ul className="space-y-1 text-sm">
          <li className={hasFeature('storefront') ? 'text-green-600' : 'text-red-600'}>
            {hasFeature('storefront') ? '✅' : '❌'} Storefront
          </li>
          <li className={hasFeature('product_scanning') ? 'text-green-600' : 'text-red-600'}>
            {hasFeature('product_scanning') ? '✅' : '❌'} Product Scanning
          </li>
          <li className={hasFeature('gbp_integration') ? 'text-green-600' : 'text-red-600'}>
            {hasFeature('gbp_integration') ? '✅' : '❌'} Google Business Profile
          </li>
        </ul>
      </div>
      
      {scanningUpgrade.required && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
          <p className="font-semibold">Upgrade to unlock Product Scanning</p>
          <p>
            {scanningUpgrade.targetTierDisplay} tier - 
            ${scanningUpgrade.upgradeCost} more per month
          </p>
        </div>
      )}
      
      {/* Multiple feature checks */}
      {hasAllFeatures(['storefront', 'product_search']) && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
          ✅ You have full e-commerce capabilities
        </div>
      )}
      
      {hasAnyFeature(['api_access', 'custom_domain']) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          ✅ You have enterprise features enabled
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Navigation menu with tier badges
 */
export function NavigationExample({ tier }: ExampleProps) {
  const { hasFeature } = useTierAccess(tier);
  
  const menuItems = [
    { label: 'Dashboard', feature: null, href: '/dashboard' },
    { label: 'Products', feature: null, href: '/products' },
    { label: 'Storefront', feature: 'storefront', href: '/storefront' },
    { label: 'Quick Start', feature: 'quick_start_wizard', href: '/quick-start' },
    { label: 'Scanning', feature: 'product_scanning', href: '/scan' },
    { label: 'GBP Sync', feature: 'gbp_integration', href: '/gbp' },
    { label: 'API', feature: 'api_access', href: '/api' },
  ];
  
  return (
    <nav className="space-y-1">
      {menuItems.map(item => {
        const isLocked = item.feature && !hasFeature(item.feature);
        
        return (
          <a
            key={item.href}
            href={isLocked ? '#' : item.href}
            className={`
              flex items-center justify-between px-4 py-2 rounded
              ${isLocked 
                ? 'text-neutral-400 cursor-not-allowed' 
                : 'text-neutral-900 hover:bg-neutral-100'
              }
            `}
            onClick={isLocked ? (e) => e.preventDefault() : undefined}
          >
            <span>{item.label}</span>
            {item.feature && <TierBadge feature={item.feature} tier={tier} />}
          </a>
        );
      })}
    </nav>
  );
}
