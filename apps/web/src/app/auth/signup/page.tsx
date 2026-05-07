"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Signup Page - Redirect to Auth0 Wizard
 * 
 * This page redirects users to the new Auth0-connected signup wizard.
 */
export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new signup wizard
    router.replace('/auth/signup/wizard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-neutral-600">Redirecting to signup wizard...</p>
      </div>
    </div>
  );
}
