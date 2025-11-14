'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { useAuth } from '@/contexts/AuthContext';

export default function PublicFooter() {
  const { settings } = usePlatformSettings();
  const { isAuthenticated } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-neutral-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-2">
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.platformName || 'Platform Logo'}
                width={150}
                height={40}
                className="h-10 w-auto object-contain mb-4"
              />
            ) : (
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                {settings?.platformName || 'Visible Shelf'}
              </h3>
            )}
            <p className="text-neutral-600 text-sm mb-4 max-w-md">
              {settings?.platformDescription || 'Manage your retail operations with ease'}
            </p>
            <div className="flex space-x-4">
              {/* Social Links - placeholder for now */}
              <a href="#" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/features" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/features#pricing" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/settings/subscription" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  Subscription
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/faq" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link 
                  href={isAuthenticated ? "/settings/contact" : "/contact"} 
                  className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  Legal
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-neutral-600 hover:text-neutral-900 text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-neutral-200">
          <p className="text-neutral-500 text-sm text-center">
            © {currentYear} {settings?.platformName || 'Visible Shelf'}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
