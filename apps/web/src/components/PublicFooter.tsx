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
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-black text-sm select-none">
                VS
              </div>
              <span className="text-xl font-extrabold tracking-wider text-neutral-900 uppercase font-sans">
                {settings?.platformName || 'VisibleShelf'}
              </span>
            </div>
            <p className="text-neutral-600 text-sm mb-4 max-w-md">
              {settings?.platformDescription || 'Free directory listing, Google visibility, and a storefront — one platform to be found and get paid.'}
            </p>
            <div className="flex items-center space-x-4">
              <a href="https://www.facebook.com/shelfvisible" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">Facebook</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/shelfvisible" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="https://www.tiktok.com/@shelfvisible" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">TikTok</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
                </svg>
              </a>
              <a href="https://x.com/shelfvisible" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">X</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z" />
                </svg>
              </a>
              <a href="https://www.pinterest.com/shelfvisible" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">Pinterest</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.74.098.119.112.224.085.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.001 24c6.624 0 11.999-5.373 11.999-12C24 5.372 18.626.001 12.001.001z" />
                </svg>
              </a>
              <a href="https://www.threads.net/@shelfvisible" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <span className="sr-only">Threads</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.962v-.128c.01-2.385.832-5.197 2.421-7.24C5.912 3.342 8.86 2.108 12.186 2c1.93-.058 3.641.405 5.154 1.318 1.12.673 2.13 1.684 2.924 2.99l-1.55 1.033c-.733-1.151-1.56-2.021-2.469-2.54a5.73 5.73 0 00-4.066-1.166c-2.716.089-5.078 1.189-6.663 3.102-1.477 1.786-2.193 4.266-2.202 6.27-.009 2.242.73 4.755 2.182 6.57 1.523 1.9 3.891 2.889 6.684 2.907 1.37.009 2.648-.326 3.7-.97 1.2-.729 1.91-1.673 2.114-2.803.13-.724.077-1.827-1.422-2.592 1.346-1.055 2.27-1.046 2.841-1.008 1.785.086 2.683 1.553 2.479 3.971-.248 2.947-1.6 4.774-4.203 5.668-1.332.455-2.73.626-3.887.616l-.006-.002z" />
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
            © {currentYear} {settings?.platformName || 'VisibleShelf'}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
