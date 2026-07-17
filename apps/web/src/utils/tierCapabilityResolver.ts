import { clientLogger } from '@/lib/client-logger';

/**
 * Tier Capability Resolver Utility
 * 
 * Handles priority-based capability resolution for tiers:
 * 1. Priority 1: Capabilities-based resolution
 * 2. Priority 2: Features-based resolution
 * 3. Fallback: Capability type defaults
 */

export interface Feature {
  feature_key: string;
  feature_name: string;
  description?: string;
}

export interface CapabilityType {
  capability_type_key: string;
  capability_type_name: string;
  description?: string;
  allowed_features?: string[];
}

export interface Tier {
  tier_key: string;
  tier_name: string;
  description?: string;
  features: string[]; // Direct feature assignments
  capabilities: string[]; // Capability-based assignments
}

export interface ResolvedCapability {
  capability_type_key: string;
  capability_type_name: string;
  enabled_features: string[]; // Features that are actually enabled for this tier
  resolution_method: 'capabilities' | 'features' | 'fallback';
}

export interface TierCapabilitySummary {
  tier_key: string;
  tier_name: string;
  resolved_capabilities: ResolvedCapability[];
}

/**
 * Resolves tier capabilities using priority-based logic
 */
export class TierCapabilityResolver {
  private features: Feature[];
  private capabilityTypes: CapabilityType[];
  private tiers: Tier[];

  constructor(features: Feature[], capabilityTypes: CapabilityType[], tiers: Tier[]) {
    this.features = features;
    this.capabilityTypes = capabilityTypes;
    this.tiers = tiers;
  }

  /**
   * Resolve capabilities for a specific tier
   */
  resolveTierCapabilities(tierKey: string): TierCapabilitySummary {
    const tier = this.tiers.find(t => t.tier_key === tierKey);
    if (!tier) {
      throw new Error(`Tier ${tierKey} not found`);
    }

    const resolvedCapabilities: ResolvedCapability[] = [];

    // Priority 1: Capabilities-based resolution
    if (tier.capabilities && tier.capabilities.length > 0) {
      for (const capabilityKey of tier.capabilities) {
        const resolved = this.resolveCapabilityBasedCapability(capabilityKey);
        if (resolved) {
          resolvedCapabilities.push(resolved);
        }
      }
    }
    // Priority 2: Features-based resolution
    else if (tier.features && tier.features.length > 0) {
      const resolved = this.resolveFeaturesBasedCapability(tier.features);
      if (resolved) {
        resolvedCapabilities.push(resolved);
      }
    }
    // Fallback: Use capability type defaults
    else {
      const resolved = this.resolveFallbackCapability();
      if (resolved) {
        resolvedCapabilities.push(resolved);
      }
    }

    return {
      tier_key: tier.tier_key,
      tier_name: tier.tier_name,
      resolved_capabilities: resolvedCapabilities
    };
  }

  /**
   * Resolve capabilities for all tiers
   */
  resolveAllTierCapabilities(): TierCapabilitySummary[] {
    return this.tiers.map(tier => this.resolveTierCapabilities(tier.tier_key));
  }

  /**
   * Priority 1: Capabilities-based resolution
   */
  private resolveCapabilityBasedCapability(capabilityKey: string): ResolvedCapability | null {
    // Extract capability type from capability key
    // Example: "discovery_product_type" -> "product_type"
    const parts = capabilityKey.split('_');
    const tierKey = parts[0];
    const capabilityTypeKey = parts.slice(1).join('_');

    const capabilityType = this.capabilityTypes.find(ct => ct.capability_type_key === capabilityTypeKey);
    if (!capabilityType) {
      clientLogger.warn(`Capability type ${capabilityTypeKey} not found for capability ${capabilityKey}`);
      return null;
    }

    // Find the tier and get its actual features
    const tier = this.tiers.find(t => t.tier_key === tierKey);
    if (!tier) {
      clientLogger.warn(`Tier ${tierKey} not found for capability ${capabilityKey}`);
      return null;
    }

    // Use the tier's actual features, filtered by what the capability type allows
    const enabledFeatures = tier.features.filter(feature => 
      capabilityType.allowed_features?.includes(feature)
    );

    return {
      capability_type_key: capabilityTypeKey,
      capability_type_name: capabilityType.capability_type_name,
      enabled_features: enabledFeatures,
      resolution_method: 'capabilities'
    };
  }

  /**
   * Priority 2: Features-based resolution
   */
  private resolveFeaturesBasedCapability(tierFeatures: string[]): ResolvedCapability | null {
    // Find which capability types these features belong to
    const relevantCapabilityTypes = this.capabilityTypes.filter(ct => 
      ct.allowed_features && ct.allowed_features.some(feature => tierFeatures.includes(feature))
    );

    if (relevantCapabilityTypes.length === 0) {
      clientLogger.warn('No capability types found for tier features');
      return null;
    }

    // For now, we'll resolve to the first matching capability type
    // In production, you might want to handle multiple capability types
    const capabilityType = relevantCapabilityTypes[0];

    // Filter features to only those allowed by this capability type
    const enabledFeatures = tierFeatures.filter(feature => 
      capabilityType.allowed_features?.includes(feature)
    );

    return {
      capability_type_key: capabilityType.capability_type_key,
      capability_type_name: capabilityType.capability_type_name,
      enabled_features: enabledFeatures,
      resolution_method: 'features'
    };
  }

  /**
   * Fallback: Use capability type defaults
   */
  private resolveFallbackCapability(): ResolvedCapability | null {
    // Use the first capability type as fallback
    const capabilityType = this.capabilityTypes[0];
    if (!capabilityType) {
      clientLogger.warn('No capability types available for fallback');
      return null;
    }

    return {
      capability_type_key: capabilityType.capability_type_key,
      capability_type_name: capabilityType.capability_type_name,
      enabled_features: capabilityType.allowed_features || [],
      resolution_method: 'fallback'
    };
  }

  /**
   * Get feature details for enabled features
   */
  getFeatureDetails(featureKeys: string[]): Feature[] {
    return featureKeys.map(key => this.features.find(f => f.feature_key === key))
      .filter((f): f is Feature => f !== undefined);
  }

  /**
   * Check if a tier has access to a specific feature
   */
  tierHasFeature(tierKey: string, featureKey: string): boolean {
    const summary = this.resolveTierCapabilities(tierKey);
    return summary.resolved_capabilities.some(capability => 
      capability.enabled_features.includes(featureKey)
    );
  }

  /**
   * Get all tiers that have access to a specific feature
   */
  getTiersWithFeature(featureKey: string): string[] {
    return this.tiers
      .filter(tier => this.tierHasFeature(tier.tier_key, featureKey))
      .map(tier => tier.tier_key);
  }
}
