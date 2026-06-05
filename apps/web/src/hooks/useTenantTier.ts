/**
 * Tenant Tier Hook
 * 
 * Hook for accessing current tenant tier information
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface Tier {
  key: string;
  name: string;
  level: number;
  displayName: string;
  description: string;
  price: number;
}

export function useTenantTier() {
  const { user } = useAuth();
  
  return useMemo(() => {
    // TODO: Connect to database to get actual tenant tier
    // Should fetch from:
    // - tenants.subscription_tier (references subscription_tiers_list.id)
    // - subscription_tiers_list table for tier details
    // - Use tenant context or API call for real-time tier data
    
    // Current hardcoded tier - should be replaced with database query:
    // SELECT stl.* FROM subscription_tiers_list stl
    // JOIN tenants t ON t.subscription_tier = stl.id
    // WHERE t.id = ?
    
    const tier: Tier = {
      key: 'discovery', // Should come from subscription_tiers_list.tier_key
      name: 'Discovery', // Should come from subscription_tiers_list.name
      level: 1, // Should come from subscription_tiers_list.sort_order
      displayName: 'Discovery', // Should come from subscription_tiers_list.display_name
      description: 'Try platform features with limited access', // Should come from subscription_tiers_list.description
      price: 0 // Should come from subscription_tiers_list.price_monthly
    };
    
    const userRole = user?.role || 'user';
    
    return {
      tier,
      userRole
    };
  }, [user]);
}
