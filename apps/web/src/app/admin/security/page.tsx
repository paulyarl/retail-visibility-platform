'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSecurityRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the correct settings admin security page
    router.replace('/settings/admin/security');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Security Settings...</p>
      </div>
    </div>
  );
}
