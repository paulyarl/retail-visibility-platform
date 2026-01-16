'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy single-cart route - redirects to multi-cart page
 * This route is deprecated in favor of /carts
 */
export default function TenantCartPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/carts');
  }, [router]);

  return null;
}
