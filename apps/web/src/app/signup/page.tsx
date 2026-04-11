"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect page for /signup -> /auth/signup
 * Maintains backwards compatibility with old links
 */
export default function SignupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-neutral-600">Redirecting to signup...</p>
      </div>
    </div>
  );
}
