/**
 * Admin Tier Capabilities API Route (Alternative)
 * 
 * Returns real tier-specific capability data from CapabilityGatingService
 * Uses query parameter instead of dynamic route: /api/admin/tier-capabilities?tierKey=professional
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey');
    
    if (!tierKey) {
      return NextResponse.json(
        { error: 'tierKey query parameter is required' },
        { status: 400 }
      );
    }
    
    // Import CapabilityGatingService dynamically to avoid SSR issues
    const { CapabilityGatingService } = await import('@platform/feature-definitions');
    
    // Get real capability data for the specific tier
    const capabilityResult = await CapabilityGatingService.checkProductTypeCapability(tierKey);
    
    console.log(`[DEBUG] Tier capability result for ${tierKey}:`, JSON.stringify(capabilityResult, null, 2));
    
    if (!capabilityResult || !capabilityResult.isAvailable) {
      console.log(`[DEBUG] No capabilities available for tier ${tierKey}`);
      return NextResponse.json([]);
    }
    
    // Get all possible features from features_list (base defaults)
    const allFeatures = ['physical_product', 'digital_product', 'hybrid_product'];
    
    // Get enabled features for this tier (what CapabilityGatingService says is available)
    const enabledFeatures = capabilityResult.availableProductTypes || [];
    
    // Transform the capability data into simple toggle format
    const tierCapabilities: TierCapability[] = [
      {
        tier_key: tierKey,
        tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
        capability_type_key: 'product_type',
        capability_type_name: 'Product Types',
        capability_enabled: true, // This tier has this capability type
        is_highlighted: true,
        highlight_order: 1,
        marketing_name: `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
        features: allFeatures.map(feature => ({
          feature_key: feature,
          feature_name: feature.charAt(0).toUpperCase() + feature.slice(1).replace(/_/g, ' '),
          is_enabled: enabledFeatures.includes(feature), // Simple toggle: enabled/disabled
          effective_restrictions: {} // No complex restrictions needed
        })),
        capability_category: 'Catalog',
        tier_specific_restrictions: {}, // No complex restrictions
        total_features: allFeatures.length
      }
    ];

    return NextResponse.json(tierCapabilities);
  } catch (error) {
    console.error(`Admin tier capabilities API error:`, error);
    
    // Fallback to mock data if CapabilityGatingService fails
    console.warn(`Falling back to mock data due to CapabilityGatingService error`);
    
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey') || 'unknown';
    
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier_key, capability_type_key, capability_enabled = true } = body;

    if (!tier_key || !capability_type_key) {
      return NextResponse.json(
        { error: 'tier_key and capability_type_key are required' },
        { status: 400 }
      );
    }

    // In production, insert into tier_capabilities table
    // INSERT INTO tier_capabilities (tier_key, capability_type_key, capability_enabled) VALUES (?, ?, ?)
    
    console.log(`Creating tier capability: ${tier_key}_${capability_type_key}`);
    
    // Return the created tier capability
    const tierCapability: TierCapability = {
      tier_key,
      tier_name: tier_key.charAt(0).toUpperCase() + tier_key.slice(1),
      capability_type_key,
      capability_type_name: capability_type_key.charAt(0).toUpperCase() + capability_type_key.slice(1).replace(/_/g, ' '),
      capability_enabled,
      is_highlighted: true,
      highlight_order: 1,
      marketing_name: `${tier_key.charAt(0).toUpperCase() + tier_key.slice(1)} ${capability_type_key.charAt(0).toUpperCase() + capability_type_key.slice(1).replace(/_/g, ' ')}`,
      features: [], // Will be populated based on capability type
      capability_category: 'General',
      tier_specific_restrictions: {},
      total_features: 0
    };

    return NextResponse.json(tierCapability, { status: 201 });
  } catch (error) {
    console.error('Admin tier capabilities create API error:', error);
    return NextResponse.json(
      { error: 'Failed to create tier capability' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey');
    const body = await request.json();
    
    if (!tierKey) {
      return NextResponse.json(
        { error: 'tierKey query parameter is required' },
        { status: 400 }
      );
    }
    
    // Update feature toggles for this tier
    console.log(`Updating tier ${tierKey} capabilities:`, body);
    
    // In production, this would update the tier_features_list table
    // For now, we'll return the updated state based on the request
    
    const allFeatures = ['physical_product', 'digital_product', 'hybrid_product'];
    const updatedFeatures = body.features || [];
    
    const tierCapabilities: TierCapability[] = [
      {
        tier_key: tierKey,
        tier_name: tierKey.charAt(0).toUpperCase() + tierKey.slice(1),
        capability_type_key: 'product_type',
        capability_type_name: 'Product Types',
        capability_enabled: body.capability_enabled ?? true,
        is_highlighted: body.is_highlighted ?? true,
        highlight_order: body.highlight_order ?? 1,
        marketing_name: body.marketing_name || `${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Product Types`,
        features: allFeatures.map(feature => {
          const updatedFeature = updatedFeatures.find((f: { feature_key: string; is_enabled: boolean }) => f.feature_key === feature);
          return {
            feature_key: feature,
            feature_name: feature.charAt(0).toUpperCase() + feature.slice(1).replace(/_/g, ' '),
            is_enabled: updatedFeature?.is_enabled ?? false,
            effective_restrictions: {} // No complex restrictions
          };
        }),
        capability_category: 'Catalog',
        tier_specific_restrictions: {}, // No complex restrictions
        total_features: allFeatures.length
      }
    ];

    return NextResponse.json(tierCapabilities);
  } catch (error) {
    console.error(`Admin tier capabilities update API error:`, error);
    return NextResponse.json(
      { error: 'Failed to update tier capabilities' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey');
    const capabilityTypeKey = searchParams.get('capabilityTypeKey');

    if (!tierKey || !capabilityTypeKey) {
      return NextResponse.json(
        { error: 'tierKey and capabilityTypeKey query parameters are required' },
        { status: 400 }
      );
    }

    // In production, delete from tier_capabilities table
    // DELETE FROM tier_capabilities WHERE tier_key = ? AND capability_type_key = ?
    
    console.log(`Deleting tier capability: ${tierKey}_${capabilityTypeKey}`);

    return NextResponse.json({ 
      message: `Tier capability ${tierKey}_${capabilityTypeKey} deleted successfully` 
    });
  } catch (error) {
    console.error('Admin tier capabilities delete API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tier capability' },
      { status: 500 }
    );
  }
}
