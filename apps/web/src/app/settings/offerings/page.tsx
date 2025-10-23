'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { MANAGED_SERVICES, type ServiceLevel } from '@/lib/managed-services';
import { CHAIN_TIERS, type ChainTier } from '@/lib/chain-tiers';

export default function OfferingsPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Platform Offerings & Benefits"
        description="Explore all our subscription tiers, managed services, and features"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Individual Location Subscriptions */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Individual Location Subscriptions</h2>
          <p className="text-neutral-600 mb-6">Perfect for single-location businesses</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <Card className="border-2 border-neutral-200">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Starter</CardTitle>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">$49/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600">Get started with the basics</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>500 SKUs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>512px QR codes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Basic landing pages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Google Shopping integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Product descriptions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Professional */}
            <Card className="border-2 border-primary-500 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="success" className="bg-green-500 text-white">POPULAR</Badge>
              </div>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Professional</CardTitle>
                  <Badge variant="default" className="bg-purple-100 text-purple-800">$149/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600">Enhanced features for growth</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>5,000 SKUs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>1024px QR codes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Enhanced landing pages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Business logo display</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Custom marketing copy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Image galleries (5 photos)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Custom CTAs & social links</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="border-2 border-neutral-200">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>Enterprise</CardTitle>
                  <Badge variant="default" className="bg-amber-100 text-amber-800">$499/mo</Badge>
                </div>
                <p className="text-sm text-neutral-600">Full customization & white-label</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Unlimited SKUs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>2048px QR codes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Fully custom landing pages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Custom branding & colors</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Remove platform branding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Image galleries (10 photos)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Custom sections & themes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Priority support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Chain/Multi-Location Subscriptions */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Multi-Location Chain Pricing</h2>
          <p className="text-neutral-600 mb-6">Massive savings for chains and franchises</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(CHAIN_TIERS).map((tier) => (
              <Card key={tier.name} className="border-2 border-neutral-200">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle>{tier.name}</CardTitle>
                    <Badge variant="default" className={tier.color}>{tier.price}</Badge>
                  </div>
                  <p className="text-sm text-neutral-600">
                    {tier.maxLocations === Infinity ? 'Unlimited' : tier.maxLocations} locations • 
                    {tier.maxTotalSKUs === Infinity ? ' Unlimited' : ` ${tier.maxTotalSKUs.toLocaleString()}`} SKUs
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              <strong>Example Savings:</strong> 10-location chain saves 66% ($1,490/mo → $499/mo with Chain Professional)
            </p>
          </div>
        </section>

        {/* Managed Services */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Managed Services</h2>
          <p className="text-neutral-600 mb-6">Let our team manage your inventory for you</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(MANAGED_SERVICES).filter(s => s.id !== 'self_service').map((service) => (
              <Card key={service.id} className={`border-2 ${service.popular ? 'border-primary-500 shadow-lg' : 'border-neutral-200'}`}>
                {service.popular && (
                  <div className="bg-primary-500 text-white text-center py-1 text-xs font-semibold">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <p className="text-xs text-neutral-600">{service.tagline}</p>
                  <div className="mt-2">
                    {service.monthlyFee > 0 && (
                      <div className="text-2xl font-bold text-neutral-900">${service.monthlyFee}/mo</div>
                    )}
                    {service.skuSetupCost > 0 && (
                      <div className="text-sm text-neutral-600">${service.skuSetupCost}/SKU setup</div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5 text-xs">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Focus on your business.</strong> Our team handles data entry, photos, descriptions, and ongoing updates.
            </p>
          </div>
        </section>

        {/* All Benefits Summary */}
        <section>
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">Platform Benefits</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🛍️</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Google Shopping Integration</h3>
                <p className="text-sm text-neutral-600">
                  Automatic product feed generation and Google Shopping approval. Get your products in front of millions of shoppers.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">📱</div>
                <h3 className="font-semibold text-neutral-900 mb-2">QR Code Marketing</h3>
                <p className="text-sm text-neutral-600">
                  Generate high-resolution QR codes for in-store marketing. Print on flyers, business cards, and store windows.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🌐</div>
                <h3 className="font-semibold text-neutral-900 mb-2">SEO-Optimized Landing Pages</h3>
                <p className="text-sm text-neutral-600">
                  Professional product pages with NAP consistency, structured data, and mobile-responsive design for maximum visibility.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🌍</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Multi-Language Support</h3>
                <p className="text-sm text-neutral-600">
                  Reach global customers with English, Spanish, and French language support built-in.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Performance Analytics</h3>
                <p className="text-sm text-neutral-600">
                  Track impressions, clicks, and sales. Understand what products perform best and optimize accordingly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🏢</div>
                <h3 className="font-semibold text-neutral-900 mb-2">Multi-Location Support</h3>
                <p className="text-sm text-neutral-600">
                  Manage multiple locations with centralized billing, shared SKU pools, and consistent branding across all stores.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg mb-6 opacity-90">
            Choose the plan that's right for your business, or contact us for a custom solution.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-neutral-100 transition-colors">
              View Subscription Plans
            </button>
            <button className="bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-800 transition-colors border-2 border-white">
              Contact Sales
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
