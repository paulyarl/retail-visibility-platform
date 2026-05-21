/**
 * Admin Tier Capabilities API Route
 * 
 * Returns real tier-specific capability data from CapabilityGatingService
 * Integrates with @platform/feature-definitions package
 */

import { NextRequest, NextResponse } from 'next/server';

export interface TierCapability {
  tier_key: string;
  tier_name: string;
  capability_type_key: string;
  capability_type_name: string;
  capability_enabled: boolean;
  is_highlighted: boolean;
  highlight_order: number;
  marketing_name: string;
  features: Array<{
    feature_key: string;
    feature_name: string;
    is_enabled: boolean;
    effective_restrictions?: any;
  }>;
  capability_category?: string;
  tier_specific_restrictions?: any;
  total_features?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tierKey: string }> }
) {
  try {
    const { tierKey } = await params;
    
    // Import CapabilityGatingService dynamically to avoid SSR issues
    const { CapabilityGatingService } = await import('@platform/feature-definitions');
    
    // Get real capability data for the specific tier
    const capabilityResult = await CapabilityGatingService.checkProductTypeCapability(tierKey);
    
    console.log(`[DEBUG] Tier capability result for ${tierKey}:`, JSON.stringify(capabilityResult, null, 2));
    
    if (!capabilityResult || !capabilityResult.isAvailable) {
      console.log(`[DEBUG] No capabilities available for tier ${tierKey}`);
      return NextResponse.json([]);
    }
    
    // Transform the capability data into the expected format
    const tierCapabilities: TierCapability[] = [
      {
        tier_key: tierKey,
        tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
        capability_type_key: 'product_types',
        capability_type_name: 'Product Types',
        capability_enabled: true, // Always enabled for admin view
        is_highlighted: true,
        highlight_order: 1,
        marketing_name: 'Product Management',
        features: capabilityResult.availableProductTypes?.map(feature => ({
          feature_key: feature,
          feature_name: feature.charAt(0).toUpperCase() + feature.slice(1).replace(/_/g, ' '),
          is_enabled: true, // All availableProductTypes from CapabilityGatingService are enabled for this tier
          effective_restrictions: capabilityResult.restrictions || {}
        })) || [],
        capability_category: 'Catalog',
        tier_specific_restrictions: capabilityResult.restrictions || {},
        total_features: capabilityResult.availableProductTypes?.length || 0
      }
    ];

    return NextResponse.json(tierCapabilities);
  } catch (error) {
    const { tierKey: errTierKey } = await params;
    console.error(`Admin tier capabilities API error for tier ${errTierKey}:`, error);
    
    // Fallback to mock data if CapabilityGatingService fails
    console.warn(`Falling back to mock data for tier ${errTierKey} due to CapabilityGatingService error`);
    
    const tierKey = errTierKey;
    const fallbackTierCapabilities: TierCapability[] = [
      {
        tier_key: tierKey,
        tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
        capability_type_key: 'product_types',
        capability_type_name: 'Product Types',
        capability_enabled: true,
        is_highlighted: true,
        highlight_order: 1,
        marketing_name: 'Product Management',
        features: [
          {
            feature_key: 'physical_product',
            feature_name: 'Physical Products',
            is_enabled: true,
            effective_restrictions: {}
          }
        ],
        capability_category: 'Catalog',
        total_features: 1
      }
    ];
    
    return NextResponse.json(fallbackTierCapabilities);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tierKey: string }> }
) {
  try {
    const { tierKey } = await params;
    const body = await request.json();
    
    // Mock update response - in production this would update the database
    console.log(`Mock update for tier ${tierKey}:`, body);
    
    // Return the updated capabilities (same as GET for demo)
    const mockTierCapabilities: TierCapability[] = [
      {
        tier_key: tierKey,
        tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
        capability_type_key: 'product_types',
        capability_type_name: 'Product Types',
        capability_enabled: body.capability_enabled ?? true,
        is_highlighted: body.is_highlighted ?? true,
        highlight_order: body.highlight_order ?? 1,
        marketing_name: body.marketing_name || 'Product Management',
        features: body.features || [
          {
            feature_key: 'physical_product',
            feature_name: 'Physical Products',
            is_enabled: true,
            effective_restrictions: {}
          }
        ],
        capability_category: 'Catalog',
        total_features: (body.features || []).length
      }
    ];

    return NextResponse.json(mockTierCapabilities);
  } catch (error) {
    console.error(`Admin tier capabilities update API error for tier:`, error);
    return NextResponse.json(
      { error: 'Failed to update tier capabilities' },
      { status: 500 }
    );
  }
}
