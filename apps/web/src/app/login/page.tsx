"use client";

import { useEffect } from 'react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';

/**
 * Login Page - Redirects to Auth0
 * 
 * This page redirects users to Auth0's hosted login page.
 * Auth0 handles authentication securely with MFA, social login, etc.
 */
export default function LoginPage() {
  const { settings } = usePlatformSettings();

  useEffect(() => {
    // Redirect to Auth0 login
    window.location.href = '/auth/login';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
      <div className="text-center">
        {settings?.logoUrl ? (
          <Image
            src={settings.logoUrl}
            alt={settings.platformName || 'Platform Logo'}
            width={200}
            height={50}
            className="max-h-16 w-auto object-contain mx-auto mb-4"
          />
        ) : (
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          {settings?.platformName || 'Visible Shelf'}
        </h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-neutral-600">Redirecting to secure login...</p>
      </div>
    </div>
  );
}
