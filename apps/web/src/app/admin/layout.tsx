'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rewrite /admin/* → /settings/admin/*
    const newPath = pathname.replace(/^\/admin/, '/settings/admin');
    if (newPath !== pathname) {
      router.replace(newPath);
    }
  }, [pathname, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Admin Panel...</p>
      </div>
    </div>
  );
}
