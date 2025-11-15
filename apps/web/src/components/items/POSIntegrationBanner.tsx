'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';

interface POSIntegrationBannerProps {
  tenantId: string;
  itemCount: number;
}

/**
 * Contextual banner promoting POS integration
 * Shows when:
 * - User has 10+ items (manual entry pain point)
 * - POS is not connected
 * - Banner hasn't been dismissed
 */
export default function POSIntegrationBanner({
  tenantId,
  itemCount,
}: POSIntegrationBannerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasPOS, setHasPOS] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if POS is connected
  useEffect(() => {
    const checkPOSConnection = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Get access token from localStorage (same way AuthContext does)
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/integrations/clover`, {
          headers,
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setHasPOS(data.connected || false);
        } else if (response.status === 404) {
          // API not implemented yet, assume no POS connection
          console.warn('[POSIntegrationBanner] Clover integration API not available');
          setHasPOS(false);
        }
      } catch (error) {
        console.error('[POSIntegrationBanner] Failed to check POS connection:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPOSConnection();
  }, [tenantId]);

  // Check if banner was dismissed (localStorage)
  useEffect(() => {
    const dismissed = localStorage.getItem(`pos-banner-dismissed-${tenantId}`);
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, [tenantId]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(`pos-banner-dismissed-${tenantId}`, 'true');
  };

  const handleConnect = () => {
    router.push(`/t/${tenantId}/settings/integrations`);
  };

  // Don't show if:
  // - Loading
  // - POS is already connected
  // - Less than 10 items (not enough pain)
  // - User dismissed it
  if (loading || hasPOS || itemCount < 10 || isDismissed) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-linear-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        {/* Icon & Content */}
        <div className="flex items-start gap-3 flex-1">
          <div className="text-3xl shrink-0">💡</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Tired of manual entry?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Connect your Clover POS to sync <strong>{itemCount} products</strong> automatically. 
              No more double-entry, instant updates, and always in sync.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleConnect}
                size="sm"
                className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect Clover POS
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-gray-600 dark:text-gray-400"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
