'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { navigateToTenant } from '@/lib/tenant-navigation'
import { api } from '@/lib/api'

export type TenantOption = { id: string; name: string }

// Utility function to truncate tenant names for display
const truncateTenantName = (name: string, maxLength: number = 30): string => {
  if (!name || name.length <= maxLength) return name;
  return name.substring(0, maxLength) + '...';
};

// Get display name with fallback to ID
const getDisplayName = (tenant: TenantOption, maxLength: number = 30): string => {
  const name = tenant.name || tenant.id;
  return truncateTenantName(name, maxLength);
};

export default function TenantSwitcher({ currentTenantId, tenants }: { currentTenantId: string; tenants: TenantOption[] }) {
  const router = useRouter()
  const { user } = useAuth()
  const [value, setValue] = useState(currentTenantId)
  const [navigationPreference, setNavigationPreference] = useState<'last-visited' | 'current-page'>('last-visited')

  // Load user's navigation preference (server first, localStorage fallback)
  useEffect(() => {
    const loadPreference = async () => {
      if (!user?.id) return;
      
      // Try server first
      try {
        const response = await api.get('/user/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.data?.navigationPreference) {
            setNavigationPreference(data.data.navigationPreference);
            localStorage.setItem(`user-nav-preference-${user.id}`, data.data.navigationPreference);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to load preference from server, using localStorage:', error);
      }
      
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`user-nav-preference-${user.id}`);
        if (saved === 'current-page' || saved === 'last-visited') {
          setNavigationPreference(saved);
        }
      }
    };

    loadPreference();
  }, [user?.id]);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tid = e.target.value
    setValue(tid)
    
    // Use user's navigation preference to determine behavior
    const preserveCurrentPage = navigationPreference === 'current-page'
    
    // Use centralized navigation utility with user's preference
    await navigateToTenant(tid, {
      skipOnboarding: true, // Skip onboarding check when already in tenant context
      preserveCurrentPage, // Use user's preference
      navigate: (url) => router.push(url)
    })
  }

  if (!tenants || tenants.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tenant-switcher" className="text-sm text-gray-600">Tenant</label>
      <select
        id="tenant-switcher"
        value={value}
        onChange={onChange}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {tenants.map(t => (
          <option key={t.id} value={t.id}>
            {getDisplayName(t)}
          </option>
        ))}
      </select>
    </div>
  )
}
