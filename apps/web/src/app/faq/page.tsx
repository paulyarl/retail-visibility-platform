'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

const faqs = [
  {
    category: 'About the Platform',
    questions: [
      {
        question: 'What is this platform actually about?',
        answer:
          'We built this as the "Amazon of local retail"—but for your store, on your terms. The platform makes your physical shelves visible online so you can show up next to the giants instead of disappearing behind them. It takes the products you already have in-store and turns them into rich, searchable pages on Google, your own storefront, and a shared retail directory—without hiring agencies or writing a line of code.'
      },
      {
        question: 'I\'m a small retailer with no tech team. How does this actually help me compete?',
        answer:
          'Think of it like an Apple-style experience for retail: powerful under the hood, but with a big "it just works" button on top. You don\'t have a spare IT department, and your to-do list is already a mile long. We give you shortcuts: Quick Start to spin up a real catalog in minutes, product scanning to fill in the details automatically, and smart sync so everything stays up to date. Instead of paying thousands for a custom site that goes stale, you get a focused tool that quietly does the heavy lifting for you in the background.'
      },
      {
        question: 'Why is this different from just having a website or using my POS?',
        answer:
          'A standalone website or POS is only one piece of the puzzle. Your website goes out of date, and your POS is built for ringing up sales, not getting discovered. We aim to be the "Shopify of offline retail": a connecting layer that plugs into tools like Clover and Square, keeps inventory and pricing accurate, and then pushes that out to Google, your storefront, and a curated directory. It\'s the missing infrastructure that almost no one is building for small retailers right now.'
      },
      {
        question: 'Who is this platform designed for?',
        answer:
          'We designed this for independent retailers and small chains who feel invisible next to Amazon, CVS, Walmart, and other big-box players. If you have physical shelves and real-world inventory, we help you show that to the world—whether you\'re a single-location shop or an organization with dozens of locations. You get big-brand style visibility and control without giving up the local personality that makes your store special.'
      },
      {
        question: 'Why now, and what makes this platform different?',
        answer:
          'Until recently, the tech stack to do this was only available to giants: custom integrations, big data teams, and expensive agencies. Now the pieces are ready—modern APIs, AI, and cloud tools that can plug systems together instead of replacing them. This platform leans into that future. It doesn\'t try to be your POS or your website; it acts as the connector and enabler in the middle, using automation and AI to sync data and tell your story. The same way social media connected people to the world, we\'re here to connect local shelves to the world so the little guys can finally be seen.'
      },
      {
        question: 'Why do I only see big chains when I search for products on Google Maps?',
        answer:
          'Right now, when you search for a specific product on Google Maps or in the Shopping results, you mostly see the same names: CVS, Walmart, Target, Amazon, and a handful of big-box chains. It\'s not because local stores don\'t carry those products—it\'s because their inventory isn\'t connected to Google in a structured way. This platform exists to close that gap: we take your real in-store inventory and push it into the same Google surfaces (Maps, Shopping, and See What\'s In Store) so shoppers can finally see that a local merchant nearby actually has what they\'re looking for.'
      }
    ]
  },
  {
    category: 'Subscription & Billing',
    questions: [
      {
        question: 'What happens when my trial expires?',
        answer: 'During your 14-day free trial, you get full access to the features of the plan you chose at signup (within that plan\'s location and SKU limits). When the trial ends, you can upgrade to a paid plan (Starter, Professional, Enterprise, or Organization) to keep editing and syncing. If you don\'t upgrade, your account moves into a limited read-only mode: your data and public pages stay online for at least 90 days, but you won\'t be able to add new locations or products until you subscribe.'
      },
      {
        question: 'What happens if my payment fails or my subscription expires?',
        answer: 'If your payment fails, your account moves into a "Past Due" status. You\'ll see clear warnings to update your billing details, and for a short grace period your storefront, directory, and Google sync continue to work. If payment isn\'t resolved after that, your subscription moves into a frozen, read-only state: your public pages stay online, but you won\'t be able to add or edit products or locations until billing is fixed.'
      },
      {
        question: 'What happens to my data if I cancel my subscription?',
        answer: 'When you cancel, your account moves into a read-only "Canceled" state. Your data (inventory, photos, settings) is preserved for at least 90 days so you can reactivate without losing anything. After that retention window, we may permanently delete data in line with our data retention policies. Contact support any time to reactivate your account.'
      },
      {
        question: 'Does Google sync stop if my subscription is past due?',
        answer: 'If your account is Past Due, we continue syncing for a short grace period while we remind you to fix billing. If billing isn\'t resolved and your subscription becomes frozen or canceled, new syncs to Google (Merchant Center, Business Profile, SWIS) are paused. Your existing listings and product pages can remain online, and sync resumes as soon as you reactivate or resolve payment.'
      },
      {
        question: 'Can I change my subscription plan?',
        answer: 'Yes! You can upgrade or downgrade at any time from the Subscription page. Changes take effect immediately. When upgrading, you gain access to new features right away. When downgrading, you keep current features until your next billing cycle.'
      },
      {
        question: 'What\'s included in the free trial?',
        answer: 'The trial lasts 14 days and lets you experience the full feature set of the plan you chose at signup (Starter, Professional, Enterprise, or an Organization pilot) with one location. You can import products, connect Google, and launch your storefront. Before the trial ends, you can decide which paid plan fits your locations and SKU volume best—no credit card is required to start.'
      }
    ]
  },
  {
    category: 'Data & Privacy',
    questions: [
      {
        question: 'Is my data safe during subscription issues?',
        answer: 'Yes. We don\'t immediately delete data due to billing issues. During Past Due or Canceled status your inventory, photos, and settings remain intact, and you can reactivate your subscription without re-entering everything. We preserve data for at least 90 days after cancellation and will give you opportunities to reactivate before any permanent deletion.'
      },
      {
        question: 'What happens to my product landing pages if I can\'t pay?',
        answer: 'During a short grace period after payment issues, your public product landing pages remain live and you can still make changes. If billing isn\'t resolved and your account moves into a frozen, read-only state, your public pages remain live for a period of time so customers can still find you, but you won\'t be able to add or update products until you reactivate.'
      },
      {
        question: 'Can I export my data before canceling?',
        answer: 'Yes! You can export all your inventory data, photos, and settings at any time from the Settings page. We provide CSV exports for inventory and bulk download options for photos. This ensures you always have a backup of your data.'
      }
    ]
  },
  {
    category: 'Features & Functionality',
    questions: [
      {
        question: 'How do Google Sync, Storefront, and POS integration work together?',
        answer: 'They form the three core growth engines of the platform. Google Sync brings customers in by putting your products on Google Shopping and Google Business Profile. Your Storefront converts that traffic with a browsable, branded catalog. POS integrations like Clover and Square keep your inventory in sync automatically. As you move up plans (Starter → Professional → Enterprise → Organization), you unlock deeper analytics, automation, and multi-location controls on top of these same engines.'
      },
      {
        question: 'Is Clover and Square integration really included, or is it another paid app?',
        answer: 'Clover and Square integrations are built-in, not a bolt-on app with surprise fees. On higher tiers you connect once with OAuth, we pull in your products, and then keep everything in sync for you. No extra marketplace subscription, no “one more tool” to manage.'
      },
      {
        question: 'What actually happens when I connect my POS?',
        answer: 'Think of it as turning on autopilot. You connect Clover or Square, we import your catalog, then keep prices, inventory, and product details synced between your POS, Google, and your storefront. You stop doing copy‑paste and spreadsheet gymnastics, and changes flow through automatically.'
      },
      {
        question: 'What is the Quick Start Wizard and why should I care?',
        answer: 'Quick Start Wizard is the "skip the spreadsheet" button. Instead of typing products one-by-one, you pick a scenario and we spin up 50–100 realistic products in seconds as editable drafts. It is perfect for getting a new location live fast, then you can layer in product scanning and enrichment to make everything production-ready.'
      },
      {
        question: 'How does product scanning help me in real life?',
        answer: 'Product scanning lets you point a camera at a barcode and pull in the hard stuff automatically—photos, descriptions, nutrition facts, allergens, specs, and more. Combined with Quick Start, it turns "I should get my catalog online" into "I actually did it" without spending nights in front of a spreadsheet.'
      },
      {
        question: 'How much time does Quick Start + product scanning actually save?',
        answer: 'Instead of spending 15–17 hours hand-entering 100 products, you can generate them with Quick Start in seconds and enrich them with scanning in under an hour. In practice, that means saving hundreds of dollars in labor every time you onboard a new location, while ending up with better, more complete product pages.'
      },
      {
        question: 'Should I use Quick Start or scanning first?',
        answer: 'Use Quick Start to lay down the foundation—names, basic categories, and prices for a batch of products in one shot. Then use scanning on the products that matter most to add rich content: photos, nutrition, specs, and marketing copy. Quick Start gets you live fast; scanning makes your bestsellers shine.'
      },
      {
        question: 'What do I actually get with the storefront?',
        answer: 'The storefront is your online front door: a browsable, mobile-friendly catalog with search, categories, maps, and SEO built in. You get a link you can share anywhere (social, email, QR codes), and customers can explore what you sell before they ever walk in the door.'
      },
      {
        question: 'What is the directory and how is it different from my storefront?',
        answer: 'Your storefront is your own branded space. The directory is the bigger neighborhood—where shoppers can browse many retailers and discover you by category or location. Being in the directory helps new customers find you even if they have never heard of your store name before.'
      },
      {
        question: 'How does multi-location propagation work for chains?',
        answer: 'For multi-location retailers, you should not be copying changes by hand. Higher tiers let you set up one “hero” location, test changes there, then push updates (products, hours, branding, GBP settings, and more) out to some or all locations in a controlled way. It feels like AI-assisted autopilot for keeping every store in sync without losing local control.'
      },
      {
        question: 'What are Smart Business Hours and why do they matter?',
        answer: 'Smart Business Hours go beyond the simple open/close you get in most tools. You can handle split shifts, multiple periods per day, special events, and emergency changes—and your storefront always shows the correct “open now” status. We sync as much as Google allows and fill the gaps so your customers aren’t guessing.'
      },
      {
        question: 'How do Smart Categories keep me in sync with Google?',
        answer: 'We align your products to Google’s product taxonomy behind the scenes and keep your categories and Google Business Profile categories in sync. If something drifts out of alignment, we flag it and help you fix it with a couple of clicks so you stay discoverable in local search.'
      },
      {
        question: 'Can I manage inventory for multiple locations from one place?',
        answer: 'Yes. Inventory is centralized so you can see what’s in stock across locations, get low-stock alerts, and run bulk updates instead of logging into separate systems. Multi-location retailers use this to keep shelves accurate and avoid “sorry, we\'re out” moments that hurt trust.'
      },
      {
        question: 'How does photo management work? Do I have to think about image sizes?',
        answer: 'You upload once and we take it from there. Photos are stored in the cloud, optimized for web and mobile, and reused on storefront, directory, and Google where possible. You don’t have to worry about formats, compression, or crop sizes—we handle the tech so your products just look good everywhere.'
      },
      {
        question: 'What kind of analytics do I get?',
        answer: 'You can see which products, categories, and locations are doing the heavy lifting—plus which channels are driving the most traffic. Think simple, actionable insights: what’s getting views, what’s converting, and where you might be leaving money on the table, rather than a wall of confusing charts.'
      },
      {
        question: 'Is this secure enough for my business data?',
        answer: 'Yes. Access is role-based so staff only see what they need, changes are logged for accountability, and data is encrypted in transit and at rest. The short version: we treat your catalog and customer data like production infrastructure, not like a side project.'
      },
      {
        question: 'What are QR codes and how do they work?',
        answer: 'QR codes are scannable barcodes that link directly to your product landing pages. Print them on flyers, business cards, or store windows. When customers scan with their phone, they\'re taken to your product page with photos, pricing, and purchase information. Higher tiers get higher resolution codes (up to 2048px for print quality).'
      },
      {
        question: 'What is Google SWIS (See What\'s In Store)?',
        answer: 'SWIS is Google\'s "See What\'s In Store" feature that shows your real-time inventory in Google Search and Maps. When customers search for products near them, your in-stock items appear with availability and location. This drives foot traffic to your physical store.'
      },
      {
        question: 'How does Google Merchant Center integration work?',
        answer: 'We automatically generate and sync your product feed to Google Merchant Center. Your products appear in Google Shopping, with photos, prices, and availability. Updates sync in real-time, so your Google listings always match your inventory.'
      },
      {
        question: 'What\'s the difference between individual and chain pricing?',
        answer: 'Standard plans (Starter, Professional, Enterprise) are ideal for single retailers or small groups of locations. Organization plans are designed for chains and franchises with 25+ locations and use custom, volume-discounted pricing. Organization gives you centralized management, shared SKU pools, and organization-wide analytics so you can manage many locations from a single dashboard.'
      },
      {
        question: 'Can I use my own branding?',
        answer: 'Yes! Professional tier includes business logo display on landing pages. Enterprise and Organization tiers offer full white-label branding: custom colors, remove platform branding, custom domain, and fully branded landing pages. Upload your logo in Settings > Branding.'
      }
    ]
  },
  {
    category: 'Technical',
    questions: [
      {
        question: 'What image formats are supported?',
        answer: 'We support JPG, PNG, WebP, and HEIC formats. Images are automatically optimized for web and mobile. Maximum file size is 10MB per image. We recommend high-quality photos (at least 1200x1200px) for best results on landing pages and Google Shopping.'
      },
      {
        question: 'How do I connect Google Merchant Center?',
        answer: 'Go to Settings > Tenant, enter your Google Merchant Center ID, and click Connect. We\'ll automatically generate your product feed and start syncing. Approval typically takes 3-5 business days from Google. You\'ll receive email notifications about sync status.'
      },
      {
        question: 'Can I bulk upload inventory?',
        answer: 'Yes! Use the CSV import feature in the Items page. Download our template, fill in your products, and upload. Supports bulk photo uploads via ZIP file. Professional and Enterprise tiers include priority processing for large uploads (1000+ items).'
      },
      {
        question: 'Is there an API for custom integrations?',
        answer: 'Enterprise and Organization tiers include full API access with documentation. Integrate with your POS system, accounting software, or custom applications. The API includes webhooks for real-time inventory updates and order notifications. Contact sales for API documentation.'
      }
    ]
  },
  {
    category: 'Support',
    questions: [
      {
        question: 'How do I get help?',
        answer: 'Starter: Email support (24-48hr response). Professional: Priority email support (12-24hr response). Enterprise & Organization: Dedicated account manager plus priority channels. All tiers have access to documentation, video tutorials, and this FAQ.'
      },
      {
        question: 'Can I get help setting up my account?',
        answer: 'Yes! We offer managed services where our team handles data entry, photos, descriptions, and ongoing updates. Pricing starts at $0.50/SKU setup + $99/mo management. Perfect if you want to focus on your business while we handle the platform. Contact sales for details.'
      },
      {
        question: 'What if I need a custom solution?',
        answer: 'Enterprise tier includes custom development options. We can build custom integrations, specialized features, or white-label solutions for your specific needs. Contact sales to discuss your requirements and get a custom quote.'
      }
    ]
  }
];

export default function FAQPage() {
  const { settings } = usePlatformSettings();
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const toggleQuestion = (questionId: string) => {
    setOpenQuestion(openQuestion === questionId ? null : questionId);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {settings?.logoUrl ? (
              <Link href="/">
                <Image
                  src={settings.logoUrl}
                  alt={settings.platformName || 'Platform Logo'}
                  width={150}
                  height={40}
                  className="h-10 w-auto object-contain cursor-pointer"
                />
              </Link>
            ) : (
              <Link href="/">
                <h1 className="text-2xl font-bold text-neutral-900 cursor-pointer hover:text-primary-600 transition-colors">
                  {settings?.platformName || 'Visible Shelf'}
                </h1>
              </Link>
            )}
            <div className="flex items-center gap-3">
              <Link href="/features">
                <button className="text-neutral-600 hover:text-neutral-900 text-sm font-medium">
                  Features
                </button>
              </Link>
              <Link href="/login">
                <button className="text-neutral-600 hover:text-neutral-900 text-sm font-medium">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-primary-50 via-white to-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-neutral-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-neutral-600">
            Everything you need to know about subscriptions, features, and data management
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {faqs.map((category, categoryIndex) => (
            <div key={category.category} className="mb-12">
              <h2 className="text-2xl font-bold text-neutral-900 mb-6 pb-3 border-b-2 border-primary-600">
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.questions.map((faq, questionIndex) => {
                  const questionId = `${categoryIndex}-${questionIndex}`;
                  const isOpen = openQuestion === questionId;

                  return (
                    <Card key={questionId} className="border-2 border-neutral-200 hover:border-primary-300 transition-colors">
                      <button
                        onClick={() => toggleQuestion(questionId)}
                        className="w-full text-left"
                      >
                        <CardHeader className="cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-lg font-semibold text-neutral-900 pr-8">
                              {faq.question}
                            </CardTitle>
                            <div className={`flex-shrink-0 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </CardHeader>
                      </button>
                      {isOpen && (
                        <CardContent>
                          <p className="text-neutral-700 leading-relaxed">
                            {faq.answer}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Still Have Questions?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Our team is here to help. Contact us for personalized assistance.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/settings/contact">
              <button className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-neutral-100 transition-colors">
                Contact Support
              </button>
            </Link>
            <Link href="/login">
              <button className="bg-transparent text-white border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-colors">
                Start Free Trial
              </button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
