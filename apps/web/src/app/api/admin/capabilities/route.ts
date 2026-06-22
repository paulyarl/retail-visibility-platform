/**
 * Admin Capabilities API Route
 * 
 * Returns real capability data from CapabilityGatingService
 * Integrates with @platform/feature-definitions package
 */

import { NextRequest, NextResponse } from 'next/server';

export interface CapabilityData {
  capability_type_key: string;
  capability_type_name: string;
  category: string;
  tier_key: string;
  tier_name: string;
  description: string;
  feature_count: number;
  features_in_capability: string;
  capability_sort_order?: number;
  tier_sort_order?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Import CapabilityGatingService dynamically to avoid SSR issues
    const { CapabilityGatingService } = await import('@/lib/capability-gating-service');
    
    // Get all tiers and their capabilities
    const tiers = ['discovery', 'storefront', 'professional', 'enterprise'];
    const capabilities: CapabilityData[] = [];
    
    for (const tierKey of tiers) {
      try {
        // Get capability data for each tier
        const capabilityResult = await CapabilityGatingService.checkProductTypeCapability(tierKey);
        
        // console.log(`[DEBUG] Capability result for ${tierKey}:`, JSON.stringify(capabilityResult, null, 2));
        
        // Map the actual CapabilityGatingService structure to our expected format
        if (capabilityResult && capabilityResult.isAvailable) {
          capabilities.push({
            capability_type_key: 'product_types',
            capability_type_name: 'Product Types',
            category: 'Catalog',
            tier_key: tierKey,
            tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
            description: capabilityResult.marketingName || 'Product type management capabilities',
            feature_count: capabilityResult.availableProductTypes?.length || 0,
            features_in_capability: capabilityResult.availableProductTypes?.join(',') || '',
            capability_sort_order: 1,
            tier_sort_order: getTierSortOrder(tierKey)
          });
        } else {
          console.log(`[DEBUG] No capabilities available for ${tierKey}`);
        }
      } catch (tierError) {
        console.warn(`Failed to get capabilities for tier ${tierKey}:`, tierError);
        // Continue with other tiers even if one fails
      }
    }

    return NextResponse.json(capabilities);
  } catch (error) {
    console.error('Admin capabilities API error:', error);
    
    // Fallback to mock data if CapabilityGatingService fails
    console.warn('Falling back to mock data due to CapabilityGatingService error');
    
    const fallbackCapabilities: CapabilityData[] = [
      {
        capability_type_key: 'product_types',
        capability_type_name: 'Product Types',
        category: 'Catalog',
        tier_key: 'discovery',
        tier_name: 'Discovery',
        description: 'Basic product type management',
        feature_count: 1,
        features_in_capability: 'physical_product',
        capability_sort_order: 1,
        tier_sort_order: 1
      }
    ];
    
    return NextResponse.json(fallbackCapabilities);
  }
}

function getTierSortOrder(tierKey: string): number {
  const tierOrder = { 'discovery': 1, 'storefront': 2, 'professional': 3, 'enterprise': 4 };
  return tierOrder[tierKey as keyof typeof tierOrder] || 999;
}
