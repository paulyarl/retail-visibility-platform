"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedCard, Input, Button, Alert } from '@/components/ui';
import { motion } from 'framer-motion';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';
import Link from 'next/link';
import PublicFooter from '@/components/PublicFooter';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const { settings } = usePlatformSettings();
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const last = typeof window !== 'undefined' ? localStorage.getItem('last_tenant_route') : null;
      if (typeof window !== 'undefined' && last) localStorage.removeItem('last_tenant_route');
      if (typeof window !== 'undefined') {
        const tenantId = localStorage.getItem('tenantId');
        sessionStorage.setItem('restored_from_login', JSON.stringify({ path: last || '/', tenantId }));
      }
      router.push(last || '/');
      if (typeof window !== 'undefined') localStorage.removeItem('last_tenant_route');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      const last = typeof window !== 'undefined' ? localStorage.getItem('last_tenant_route') : null;
      if (typeof window !== 'undefined' && last) localStorage.removeItem('last_tenant_route');
      if (typeof window !== 'undefined') {
        const tenantId = localStorage.getItem('tenantId');
        sessionStorage.setItem('restored_from_login', JSON.stringify({ path: last || '/', tenantId }));
      }
      router.push(last || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="flex items-center justify-center flex-1 p-4">
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
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              {settings?.platformName || 'Visible Shelf'}
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
                Sign in to your account
              </p>
            </div>

            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Don't have an account?{' '}
                <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign up
                </Link>
              </p>
            </div>
            
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
            <p>Secure authentication with JWT tokens</p>
          </motion.div>
        </div>
      </div>
      
      <PublicFooter />
    </div>
  );
}
