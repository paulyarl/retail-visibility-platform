/**
 * Admin Resolved Capabilities API Route
 * 
 * Uses TierCapabilityResolver to provide priority-based capability resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import { TierCapabilityResolver } from '@/utils/tierCapabilityResolver';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierKey = searchParams.get('tierKey');

    // In production, fetch from database
    // For now, we'll use mock data
    const features = [
      { feature_key: 'physical_product', feature_name: 'Physical Product' },
      { feature_key: 'digital_product', feature_name: 'Digital Product' },
      { feature_key: 'hybrid_product', feature_name: 'Hybrid Product' },
      { feature_key: 'inventory_tracking', feature_name: 'Inventory Tracking' },
      { feature_key: 'stock_alerts', feature_name: 'Stock Alerts' },
      { feature_key: 'warehouse_management', feature_name: 'Warehouse Management' },
      { feature_key: 'sales_reports', feature_name: 'Sales Reports' },
      { feature_key: 'customer_analytics', feature_name: 'Customer Analytics' },
      { feature_key: 'product_performance', feature_name: 'Product Performance' }
    ];

    const capabilityTypes = [
      {
        capability_type_key: 'product_type',
        capability_type_name: 'Product Types',
        allowed_features: ['physical_product', 'digital_product', 'hybrid_product']
      },
      {
        capability_type_key: 'inventory_management',
        capability_type_name: 'Inventory Management',
        allowed_features: ['inventory_tracking', 'stock_alerts', 'warehouse_management']
      },
      {
        capability_type_key: 'analytics',
        capability_type_name: 'Analytics',
        allowed_features: ['sales_reports', 'customer_analytics', 'product_performance']
      }
    ];

    const tiers = [
      {
        tier_key: 'discovery',
        tier_name: 'Discovery',
        features: ['physical_product'],
        capabilities: ['discovery_product_type']
      },
      {
        tier_key: 'storefront',
        tier_name: 'Storefront',
        features: ['physical_product', 'digital_product'],
        capabilities: ['storefront_product_type']
      },
      {
        tier_key: 'professional',
        tier_name: 'Professional',
        features: ['physical_product', 'digital_product', 'hybrid_product'],
        capabilities: ['professional_product_type']
      },
      {
        tier_key: 'enterprise',
        tier_name: 'Enterprise',
        features: ['physical_product', 'digital_product', 'hybrid_product'],
        capabilities: ['enterprise_product_type']
      }
    ];

    const resolver = new TierCapabilityResolver(features, capabilityTypes, tiers);

    if (tierKey) {
      // Get resolved capabilities for specific tier
      const resolved = resolver.resolveTierCapabilities(tierKey);
      return NextResponse.json(resolved);
    } else {
      // Get resolved capabilities for all tiers
      const allResolved = resolver.resolveAllTierCapabilities();
      return NextResponse.json(allResolved);
    }
  } catch (error) {
    console.error('Admin resolved capabilities API error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve capabilities' },
      { status: 500 }
    );
  }
}
