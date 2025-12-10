/**
 * Scan Products Layout with Tier Gating
 * 
 * Wraps the Scan Products page with tier-based access control.
 * Requires 'product_scanning' feature (Professional tier or higher).
 */

'use client';

import { useParams } from 'next/navigation';
import { TierGate } from '@/components/tier/TierGate';
import { useEffect, useState } from 'react';

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tenant tier
    const fetchTier = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(`${apiUrl}/api/tenants/${tenantId}`, {
          headers,
          credentials: 'include',
        });
        
        if (res.ok) {
          const data = await res.json();
          setTier(data.subscriptionTier || 'trial');
        }
      } catch (err) {
        console.error('Failed to fetch tenant tier:', err);
        setTier('trial'); // Default to trial on error
      } finally {
        setLoading(false);
      }
    };

    fetchTier();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <TierGate 
      feature="product_scanning" 
      tier={tier} 
      tenantId={tenantId}
    >
      {children}
    </TierGate>
  );
}
