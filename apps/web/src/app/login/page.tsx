"use client";

import AuthPanel from '@/components/AuthPanel';
import { AnimatedCard } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { motion } from 'framer-motion';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';

export default function LoginPage() {
  const { settings } = usePlatformSettings();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <PageHeader
        title="Sign In"
        description="Access your account with a magic link"
        icon={Icons.Admin}
      />

      <div className="flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="relative w-full max-w-md">
        {/* Logo/Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          {settings?.logoUrl ? (
            <div className="inline-flex items-center justify-center mb-4">
              <Image
                src={settings.logoUrl}
                alt={settings.platformName || 'Platform Logo'}
                width={200}
                height={50}
                className="max-h-16 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            {settings?.platformName || 'Retail Visibility Platform'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {settings?.platformDescription || 'Sign in to manage your inventory'}
          </p>
        </motion.div>

        {/* Auth Card */}
        <AnimatedCard delay={0.2} hover={false} className="p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Enter your email to receive a magic link
            </p>
          </div>
          
          <AuthPanel />
          
          {/* Features */}
          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
              What you get
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Manage inventory across locations</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Sync with Google Merchant Center</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Upload and manage product photos</span>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center mt-6 text-sm text-neutral-600 dark:text-neutral-400"
        >
          <p>Secure authentication powered by Supabase</p>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
