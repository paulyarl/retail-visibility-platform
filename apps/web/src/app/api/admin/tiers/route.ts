/**
 * Admin Tiers API Route
 * 
 * CRUD operations for tier management (features and capabilities)
 */

import { NextRequest, NextResponse } from 'next/server';

export interface Tier {
  tier_key: string;
  tier_name: string;
  description?: string;
  features: string[]; // List of feature keys this tier can use
  capabilities: string[]; // List of capability keys this tier has
  created_at?: string;
  updated_at?: string;
}

// Mock data - in production this would come from the database
const mockTiers: Tier[] = [
  {
    tier_key: 'discovery',
    tier_name: 'Discovery',
    description: 'Basic tier for getting started',
    features: ['physical_product'],
    capabilities: ['discovery_product_type']
  },
  {
    tier_key: 'storefront',
    tier_name: 'Storefront',
    description: 'Small business tier',
    features: ['physical_product', 'digital_product'],
    capabilities: ['storefront_product_type']
  },
  {
    tier_key: 'professional',
    tier_name: 'Professional',
    description: 'Growing business tier',
    features: ['physical_product', 'digital_product', 'hybrid_product'],
    capabilities: ['professional_product_type']
  },
  {
    tier_key: 'enterprise',
    tier_name: 'Enterprise',
    description: 'Large business tier',
    features: ['physical_product', 'digital_product', 'hybrid_product'],
    capabilities: ['enterprise_product_type']
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey');

    if (tierKey) {
      // Get specific tier
      const tier = mockTiers.find(t => t.tier_key === tierKey);
      if (!tier) {
        return NextResponse.json(
          { error: 'Tier not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(tier);
    } else {
      // Get all tiers
      return NextResponse.json(mockTiers);
    }
  } catch (error) {
    console.error('Admin tiers API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tiers' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier_key, tier_name, description, features, capabilities } = body;

    if (!tier_key) {
      return NextResponse.json(
        { error: 'tier_key is required' },
        { status: 400 }
      );
    }

    // In production, update tiers table and tier_features/capabilities relationships
    // UPDATE tiers SET tier_name = ?, description = ?, updated_at = NOW() WHERE tier_key = ?
    // UPDATE tier_features SET feature_key = ? WHERE tier_key = ?
    // UPDATE tier_capabilities SET capability_key = ? WHERE tier_key = ?
    
    const tierIndex = mockTiers.findIndex(t => t.tier_key === tier_key);
    if (tierIndex === -1) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      );
    }

    mockTiers[tierIndex] = {
      ...mockTiers[tierIndex],
      tier_name: tier_name || mockTiers[tierIndex].tier_name,
      description: description || mockTiers[tierIndex].description,
      features: features !== undefined ? features : mockTiers[tierIndex].features,
      capabilities: capabilities !== undefined ? capabilities : mockTiers[tierIndex].capabilities,
      updated_at: new Date().toISOString()
    };

    return NextResponse.json(mockTiers[tierIndex]);
  } catch (error) {
    console.error('Admin tiers update API error:', error);
    return NextResponse.json(
      { error: 'Failed to update tier' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier_key, tier_name, description, features = [], capabilities = [] } = body;

    if (!tier_key || !tier_name) {
      return NextResponse.json(
        { error: 'tier_key and tier_name are required' },
        { status: 400 }
      );
    }

    // In production, insert into tiers table and create relationships
    // INSERT INTO tiers (tier_key, tier_name, description) VALUES (?, ?, ?)
    // INSERT INTO tier_features (tier_key, feature_key) VALUES (?, ?)
    // INSERT INTO tier_capabilities (tier_key, capability_key) VALUES (?, ?)
    
    const newTier: Tier = {
      tier_key,
      tier_name,
      description: description || '',
      features,
      capabilities,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockTiers.push(newTier);

    return NextResponse.json(newTier, { status: 201 });
  } catch (error) {
    console.error('Admin tiers create API error:', error);
    return NextResponse.json(
      { error: 'Failed to create tier' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey');

    if (!tierKey) {
      return NextResponse.json(
        { error: 'tierKey query parameter is required' },
        { status: 400 }
      );
    }

    // In production, delete from tiers table and clean up relationships
    // DELETE FROM tier_features WHERE tier_key = ?
    // DELETE FROM tier_capabilities WHERE tier_key = ?
    // DELETE FROM tiers WHERE tier_key = ?
    
    const tierIndex = mockTiers.findIndex(t => t.tier_key === tierKey);
    if (tierIndex === -1) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      );
    }

    const deletedTier = mockTiers.splice(tierIndex, 1)[0];

    return NextResponse.json(deletedTier);
  } catch (error) {
    console.error('Admin tiers delete API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tier' },
      { status: 500 }
    );
  }
}
