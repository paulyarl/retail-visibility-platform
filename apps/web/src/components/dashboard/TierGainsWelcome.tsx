"use client";
import { useState, useEffect } from 'react';
import { UserProfileData } from "@/hooks/useUserProfile";
import { Card, CardContent } from '@/components/ui';
import Link from 'next/link';
import { tierSystemService } from '@/services/TierSystemService';

interface TierGainsWelcomeProps {
  currentTier: string;
  tierDisplayName: string;
  organizationTier?: string;
  organizationTierDisplayName?: string;
}

/**
 * Welcome pane that celebrates the gains unlocked from the current tier
 * Shows what major pillars/capabilities the user now has access to
 * Now uses database-driven tier information instead of hardcoded data
 */

export default function TierGainsWelcome({ currentTier, tierDisplayName, organizationTier, organizationTierDisplayName }: TierGainsWelcomeProps) {
  // Use database-driven tier gains
  const [tierGains, setTierGains] = useState<any>(null);
  const [orgGains, setOrgGains] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllPrimary, setShowAllPrimary] = useState(false);
  const [showAllSecondary, setShowAllSecondary] = useState(false);

  // Color palette based on tier combination
  const getColorPalette = () => {
    if (organizationTier) {
      // Organization tiers get purple/indigo theme
      return {
        primary: 'purple',
        secondary: 'blue',
        border: 'from-purple-300 to-indigo-300',
        bg: 'from-purple-50 to-indigo-50',
        dark: 'from-purple-900/20 to-indigo-900/20',
        icon: 'from-purple-500 to-indigo-600',
        primaryIcon: 'text-purple-600 dark:purple-800',
        secondaryIcon: 'text-blue-600 dark:blue-800',
        primaryButton: 'bg-purple-600 hover:bg-purple-700',
        secondaryButton: 'text-purple-600 hover:text-purple-700'
      };
    } else if (currentTier === 'enterprise') {
      // Enterprise gets red/purple theme
      return {
        primary: 'red',
        secondary: 'purple',
        border: 'from-red-300 to-purple-300',
        bg: 'from-red-50 to-purple-50',
        dark: 'from-red-900/20 to-purple-900/20',
        icon: 'from-red-500 to-purple-600',
        primaryIcon: 'text-red-600 dark:red-800',
        secondaryIcon: 'text-purple-600 dark:purple-800',
        primaryButton: 'bg-red-600 hover:bg-red-700',
        secondaryButton: 'text-red-600 hover:text-red-700'
      };
    } else if (currentTier === 'professional') {
      // Professional gets amber/orange theme
      return {
        primary: 'amber',
        secondary: 'orange',
        border: 'from-amber-300 to-orange-300',
        bg: 'from-amber-50 to-orange-50',
        dark: 'from-amber-900/20 to-orange-900/20',
        icon: 'from-amber-500 to-orange-600',
        primaryIcon: 'text-amber-600 dark:amber-800',
        secondaryIcon: 'text-orange-600 dark:orange-800',
        primaryButton: 'bg-amber-600 hover:bg-amber-700',
        secondaryButton: 'text-amber-600 hover:text-amber-700'
      };
    } else if (currentTier === 'commitment') {
      // Commitment gets green/emerald theme
      return {
        primary: 'green',
        secondary: 'emerald',
        border: 'from-green-300 to-emerald-300',
        bg: 'from-green-50 to-emerald-50',
        dark: 'from-green-900/20 to-emerald-900/20',
        icon: 'from-green-500 to-emerald-600',
        primaryIcon: 'text-green-600 dark:green-800',
        secondaryIcon: 'text-emerald-600 dark:emerald-800',
        primaryButton: 'bg-green-600 hover:bg-green-700',
        secondaryButton: 'text-green-600 hover:text-green-700'
      };
    } else if (currentTier === 'storefront') {
      // Storefront gets purple/indigo theme
      return {
        primary: 'purple',
        secondary: 'indigo',
        border: 'from-purple-300 to-indigo-300',
        bg: 'from-purple-50 to-indigo-50',
        dark: 'from-purple-900/20 to-indigo-900/20',
        icon: 'from-purple-500 to-indigo-600',
        primaryIcon: 'text-purple-600 dark:purple-800',
        secondaryIcon: 'text-indigo-600 dark:indigo-800',
        primaryButton: 'bg-purple-600 hover:bg-purple-700',
        secondaryButton: 'text-purple-600 hover:text-purple-700'
      };
    } else if (currentTier === 'discovery') {
      // Discovery gets blue/purple theme
      return {
        primary: 'blue',
        secondary: 'purple',
        border: 'from-blue-300 to-purple-300',
        bg: 'from-blue-50 to-purple-50',
        dark: 'from-blue-900/20 to-purple-900/20',
        icon: 'from-blue-500 to-purple-600',
        primaryIcon: 'text-blue-600 dark:blue-800',
        secondaryIcon: 'text-purple-600 dark:purple-800',
        primaryButton: 'bg-blue-600 hover:bg-blue-700',
        secondaryButton: 'text-blue-600 hover:text-blue-700'
      };
    } else {
      // Default gets rose/pink theme (for any unrecognized tiers)
      return {
        primary: 'rose',
        secondary: 'pink',
        border: 'from-rose-300 to-pink-300',
        bg: 'from-rose-50 to-pink-50',
        dark: 'from-rose-900/20 to-pink-900/20',
        icon: 'from-rose-500 to-pink-600',
        primaryIcon: 'text-rose-600 dark:rose-800',
        secondaryIcon: 'text-pink-600 dark:pink-800',
        primaryButton: 'bg-rose-600 hover:bg-rose-700',
        secondaryButton: 'text-rose-600 hover:text-rose-700'
      };
    }
  };

  const colors = getColorPalette();

  useEffect(() => {
    async function loadTierGains() {
      try {
        // console.log(`[TierGainsWelcome] Loading tier gains for currentTier: "${currentTier}"`);
        // console.log(`[TierGainsWelcome] Loading org gains for organizationTier: "${organizationTier}"`);
        
        // Load individual tier gains
        const gains = await tierSystemService.getTenantTierGains(currentTier);
        // console.log(`[TierGainsWelcome] Received individual gains:`, gains);
        
        // Load organization tier gains if available
        let orgGainsResult = null;
        if (organizationTier) {
          orgGainsResult = await tierSystemService.getTenantTierGains(organizationTier);
          // console.log(`[TierGainsWelcome] Received org gains:`, orgGainsResult);
        }
        
        setTierGains(gains);
        setOrgGains(orgGainsResult);
      } catch (error) {
        console.error('[TierGainsWelcome] Failed to load tier gains:', error);
      } finally {
        setLoading(false);
      }
    }

    if (currentTier) {
      loadTierGains();
    } else {
      console.log('[TierGainsWelcome] No currentTier provided');
      setLoading(false);
    }
  }, [currentTier, organizationTier]);

  if (loading) {
    return (
      <Card className={"border-2 border-gradient-to-r " + colors.border + " bg-gradient-to-br " + colors.bg + " " + colors.dark}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className={"animate-spin rounded-full h-8 w-8 border-b-2 " + colors.primary.replace('text-', 'border-') + "-600"}></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tierGains && !orgGains) {
    return null;
  }

  // Determine primary message (organization takes priority if available)
  const primaryGains = orgGains || tierGains;
  const secondaryGains = orgGains ? tierGains : null;

  return (
    <Card className={"border-2 border-gradient-to-r " + colors.border + " bg-gradient-to-br " + colors.bg + " " + colors.dark}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {/* Celebration Icon */}
          <div className="flex-shrink-0">
            <div className={"w-16 h-16 rounded-full bg-gradient-to-br " + colors.icon + " flex items-center justify-center"}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-neutral-900  mb-2">
              {primaryGains.title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-700 mb-4">
              {primaryGains.subtitle}
            </p>

            {/* Primary Gains */}
            <div className="space-y-3 mb-4">
              <h4 className="font-semibold text-neutral-800 text-sm">
                {orgGains ? '🏢 Organization Capabilities:' : '🎯 Your Features:'}
              </h4>
              {primaryGains.gains.slice(0, showAllPrimary ? primaryGains.gains.length : 5).map((gain: any, index: number) => (
                <div key={"primary-" + index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className={"w-5 h-5 " + colors.primaryIcon + " fill=\"currentColor\" viewBox=\"0 0 20 20\""}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900  text-sm">
                      {gain.name}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-700">
                      {gain.description}
                    </p>
                  </div>
                </div>
              ))}
              {primaryGains.gains.length > 5 && (
                <button
                  onClick={() => setShowAllPrimary(!showAllPrimary)}
                  className={"text-xs " + colors.secondaryButton + " font-medium flex items-center gap-1 mt-2"}
                >
                  {showAllPrimary ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Show Less
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show {primaryGains.gains.length - 5} More
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Secondary Gains (Individual tier when in organization) */}
            {secondaryGains && (
              <div className="space-y-3 mb-4 pt-4 border-t border-neutral-200">
                <h4 className="font-semibold text-neutral-800 text-sm">
                  🏪 Your Individual Tenant Features:
                </h4>
                {secondaryGains.gains.slice(0, showAllSecondary ? secondaryGains.gains.length : 5).map((gain: any, index: number) => (
                  <div key={"secondary-" + index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className={"w-5 h-5 " + colors.secondaryIcon + " fill=\"currentColor\" viewBox=\"0 0 20 20\""}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-900  text-sm">
                        {gain.name}
                      </p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-700">
                        {gain.description}
                      </p>
                    </div>
                  </div>
                ))}
                {secondaryGains.gains.length > 5 && (
                  <button
                    onClick={() => setShowAllSecondary(!showAllSecondary)}
                    className={"text-xs " + colors.secondaryButton + " font-medium flex items-center gap-1 mt-2"}
                  >
                    {showAllSecondary ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show {secondaryGains.gains.length - 5} More
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* CTA */}
            {primaryGains.cta && (
              <Link
                href={primaryGains.cta.href}
                className={"inline-flex items-center gap-2 px-4 py-2 " + colors.primaryButton + " text-white rounded-lg font-semibold transition-colors text-sm"}
              >
                {primaryGains.cta.text}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
