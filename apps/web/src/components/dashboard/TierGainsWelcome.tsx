"use client";

import { Card, CardContent } from '@/components/ui';
import Link from 'next/link';

interface TierGainsWelcomeProps {
  currentTier: string;
  tierDisplayName: string;
}

/**
 * Welcome pane that celebrates the gains unlocked from the current tier
 * Shows what major pillars/capabilities the user now has access to
 */
export default function TierGainsWelcome({ currentTier, tierDisplayName }: TierGainsWelcomeProps) {
  // Define tier-specific gains (what they unlocked by being on this tier)
  const tierGains = getTierGains(currentTier);
  
  if (!tierGains) return null;

  return (
    <Card className="border-2 border-gradient-to-r from-green-300 to-emerald-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {/* Celebration Icon */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              {tierGains.title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {tierGains.subtitle}
            </p>

            {/* Unlocked Gains */}
            <div className="space-y-3 mb-4">
              {tierGains.gains.map((gain, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white text-sm">
                      {gain.name}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {gain.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            {tierGains.cta && (
              <Link
                href={tierGains.cta.href}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
              >
                {tierGains.cta.text}
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

/**
 * Get tier-specific gains based on pillar differentiation strategy
 */
function getTierGains(tier: string) {
  // Normalize tier name (handle both 'google_only' and 'starter' level names)
  const normalizedTier = tier.toLowerCase().replace(/_/g, '');
  
  switch (normalizedTier) {
    case 'googleonly':
      return {
        title: '🎯 You\'re on Google Shopping!',
        subtitle: 'Your products are now discoverable by millions of shoppers searching on Google.',
        gains: [
          {
            name: 'Google Merchant Center Sync',
            description: 'Your inventory automatically syncs to Google Shopping'
          },
          {
            name: 'Google Shopping Feed',
            description: 'Reach customers actively searching for your products'
          },
          {
            name: 'Manual Barcode Entry',
            description: 'Enrich your product listings with detailed information'
          },
          {
            name: 'Performance Analytics',
            description: 'See how your products perform on Google'
          }
        ],
        cta: {
          text: 'View Your Products',
          href: '/items'
        }
      };

    case 'starter':
    case 'growth':
      return {
        title: '🏪 You Now Have Your Own Storefront!',
        subtitle: 'Beyond Google - you now have a beautiful online store that\'s all yours.',
        gains: [
          // NEW in Starter
          {
            name: '✨ Public Storefront',
            description: 'Your own website where customers can browse and shop'
          },
          {
            name: '✨ Mobile-Responsive Design',
            description: 'Looks great on phones, tablets, and desktops'
          },
          {
            name: '✨ Enhanced SEO',
            description: 'Get found on search engines beyond just Google Shopping'
          },
          // From Google-Only
          {
            name: 'Google Merchant Center Sync',
            description: 'Your inventory automatically syncs to Google Shopping'
          },
          {
            name: 'Manual Barcode Entry',
            description: 'Enrich your product listings with detailed information'
          },
          {
            name: 'Performance Analytics',
            description: 'See how your products perform'
          }
        ],
        cta: {
          text: 'View Your Storefront',
          href: '/storefront'
        }
      };

    case 'professional':
    case 'pro':
      return {
        title: '⚡ Automation Unlocked!',
        subtitle: 'Save hours every week with smart automation tools that do the work for you.',
        gains: [
          // NEW in Professional
          {
            name: '✨ Smart Barcode Scanner',
            description: 'Scan products with your camera - we auto-fill everything instantly'
          },
          {
            name: '✨ Quick Start Wizard',
            description: 'Add 100 products in minutes with AI-powered setup'
          },
          {
            name: '✨ Google Business Profile Integration',
            description: 'Sync your inventory to your Google Business listing automatically'
          },
          {
            name: '✨ Custom Branding & Priority Support',
            description: 'Make it yours and get help when you need it'
          },
          // From Starter
          {
            name: 'Public Storefront',
            description: 'Your own website where customers can browse and shop'
          },
          {
            name: 'Enhanced SEO & Mobile Design',
            description: 'Get found on search engines, looks great everywhere'
          },
          // From Google-Only
          {
            name: 'Google Shopping & Analytics',
            description: 'Sync to Google Merchant Center and track performance'
          },
          {
            name: 'Manual Barcode Entry',
            description: 'Type in barcodes to enrich product data'
          }
        ],
        cta: {
          text: 'Start Scanning Products',
          href: '/scan'
        }
      };

    case 'enterprise':
      return {
        title: '🎨 Your Brand, Your Platform',
        subtitle: 'Full white-label customization - make this platform look like it\'s entirely yours.',
        gains: [
          // NEW in Enterprise
          {
            name: '✨ White Label Branding',
            description: 'Your logo, your colors, your brand everywhere'
          },
          {
            name: '✨ Custom Domain',
            description: 'Use your own domain name (shop.yourbrand.com)'
          },
          {
            name: '✨ API Access & Unlimited SKUs',
            description: 'Integrate with your systems, no product limits'
          },
          {
            name: '✨ Dedicated Account Manager',
            description: 'Personal support for your business'
          },
          // From Professional
          {
            name: 'Smart Scanner & Quick Start',
            description: 'Automated product setup and enrichment'
          },
          {
            name: 'Google Business Profile Integration',
            description: 'Sync inventory to your Google Business listing'
          },
          // From Starter
          {
            name: 'Public Storefront & SEO',
            description: 'Your own website optimized for search engines'
          },
          // From Google-Only
          {
            name: 'Google Shopping & Analytics',
            description: 'Sell on Google and track performance'
          }
        ],
        cta: {
          text: 'Customize Your Platform',
          href: '/settings/branding'
        }
      };

    case 'organization':
      return {
        title: '🏢 Chain-Wide Control Activated!',
        subtitle: 'Manage all your locations from one place - update once, apply everywhere.',
        gains: [
          // NEW in Organization
          {
            name: '✨ Product Propagation',
            description: 'Update prices, add products at HQ - push to all locations instantly'
          },
          {
            name: '✨ Organization Dashboard',
            description: 'See performance across all your locations in one view'
          },
          {
            name: '✨ Hero Location Testing',
            description: 'Test changes at one location before rolling out chain-wide'
          },
          {
            name: '✨ Unlimited Locations',
            description: 'Manage as many locations as you need from one place'
          },
          // From Professional
          {
            name: 'Smart Scanner & Quick Start',
            description: 'Automated product setup and enrichment'
          },
          {
            name: 'Google Business Profile Integration',
            description: 'Sync inventory to all your Google Business listings'
          },
          // From Starter
          {
            name: 'Public Storefront & SEO',
            description: 'Each location gets its own optimized website'
          },
          // From Google-Only
          {
            name: 'Google Shopping & Analytics',
            description: 'All locations on Google with centralized reporting'
          }
        ],
        cta: {
          text: 'Manage Your Locations',
          href: '/locations'
        }
      };

    default:
      return null;
  }
}
