'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import PublicFooter from '@/components/PublicFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';

const faqs = [
  {
    category: 'Subscription & Billing',
    questions: [
      {
        question: 'What happens when my trial expires?',
        answer: 'When your 30-day trial expires, your account automatically converts to the Starter plan ($49/mo) with no interruption to your service. You\'ll have 30 days to add payment information. All your data, including inventory, photos, and Google integrations, remain intact.'
      },
      {
        question: 'What happens if my payment fails or my subscription expires?',
        answer: 'If your payment fails, your account enters a "Past Due" status. During this time, all platform functionality is blocked, including inventory management, photo uploads, and Google sync. However, your data is safely preserved and will be immediately accessible once payment is resolved. Your public product landing pages remain visible to customers.'
      },
      {
        question: 'What happens to my data if I cancel my subscription?',
        answer: 'When you cancel, your account enters a "Canceled" status and all functionality is blocked. Your data (inventory, photos, settings) is preserved for 90 days, allowing you to reactivate without data loss. After 90 days, data may be permanently deleted. Contact support to reactivate your account at any time.'
      },
      {
        question: 'Does Google sync stop if my subscription is past due?',
        answer: 'Yes. When your account is in "Past Due" or "Canceled" status, all Google integrations (Merchant Center, Business Profile, SWIS) are paused. Your products will no longer sync to Google Shopping. Once payment is resolved, sync automatically resumes and your products are re-uploaded.'
      },
      {
        question: 'Can I change my subscription plan?',
        answer: 'Yes! You can upgrade or downgrade at any time from the Subscription page. Changes take effect immediately. When upgrading, you gain access to new features right away. When downgrading, you keep current features until your next billing cycle.'
      },
      {
        question: 'What\'s included in the 30-day trial?',
        answer: 'The trial includes full access to Professional tier features: 5,000 SKUs, 1024px QR codes, enhanced landing pages, business logo display, custom marketing copy, image galleries, and Google integrations. No credit card required to start.'
      }
    ]
  },
  {
    category: 'Data & Privacy',
    questions: [
      {
        question: 'Is my data safe during subscription issues?',
        answer: 'Yes! Your data is always safe and preserved, even during Past Due or Canceled status. We maintain full backups and your inventory, photos, and settings remain intact. You never lose data due to billing issues.'
      },
      {
        question: 'What happens to my product landing pages if I can\'t pay?',
        answer: 'Your public product landing pages remain live and accessible to customers even if your account is Past Due or Canceled. This ensures your customers can still view your products and contact you. However, you won\'t be able to update or add new products until payment is resolved.'
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
        answer: 'Individual pricing is per-location ($49-$499/mo). Chain pricing is for businesses with multiple locations and offers massive savings (e.g., 10 locations for $499/mo vs $490-$4,990/mo individually). Chain plans include centralized management, shared SKU pools, and organization-wide analytics.'
      },
      {
        question: 'Can I use my own branding?',
        answer: 'Yes! Professional tier includes business logo display on landing pages. Enterprise tier offers full white-label branding: custom colors, remove platform branding, custom domain, and fully branded landing pages. Upload your logo in Settings > Branding.'
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
        answer: 'Enterprise tier includes full API access with documentation. Integrate with your POS system, accounting software, or custom applications. API includes webhooks for real-time inventory updates and order notifications. Contact sales for API documentation.'
      }
    ]
  },
  {
    category: 'Support',
    questions: [
      {
        question: 'How do I get help?',
        answer: 'Starter: Email support (24-48hr response). Professional: Priority email support (12-24hr response). Enterprise: Dedicated account manager + 24/7 phone support. All tiers have access to documentation, video tutorials, and this FAQ.'
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
