/**
 * Capability-Based Gate Engine
 * 
 * Extends the feature gate system to handle sophisticated capability gating
 * based on tier progression and operational sophistication.
 */

import { FEATURE_OPERATIONS } from './operations/feature-operations';
import { TIER_DEFINITIONS } from './definitions/tier-hierarchies';
import type { FeatureGateContext } from './types';

// Tier levels for capability comparison
const TIER_LEVELS = {
  'discovery': 1,
  'starter': 2,
  'storefront': 3,
  'commitment': 4,
  'ecommerce': 4,
  'professional': 5,
  'omnichannel': 5,
  'enterprise': 6
} as const;

// Capability types
export interface Capability {
  name: string;
  enabled: boolean;
  level: number;
  maxLimit?: number;
  features: string[];
}

export interface CapabilityGateResult {
  hasAccess: boolean;
  capabilities: Record<string, Capability>;
  upgradePath?: {
    currentTier: string;
    requiredTier: string;
    capabilities: string[];
  };
  restrictions?: {
    maxItems?: number;
    allowedTypes?: string[];
    blockedOperations?: string[];
  };
}

// TODO: Migrate to database-driven capabilities
// Should pull from:
// - tier_features table (tier_id, feature_key, capability_type, enabled, restrictions)
// - features table (feature_key, feature_name, description, category)
// - public_tiers table for anonymous access

// Capability definitions by tier - TEMPORARY until database integration
const CAPABILITY_DEFINITIONS = {
  // Product Type Capabilities - Using explicit naming convention
  'product_types': {
    discovery: {
      name: 'Product Types',
      enabled: true,
      level: 1,
      features: ['physical_product'], // Explicit naming
      restrictions: {
        allowedTypes: ['physical_product'],
        maxItems: 10
      }
    },
    storefront: {
      name: 'Product Types',
      enabled: true,
      level: 3,
      features: ['physical_product', 'digital_product'], // Explicit naming
      restrictions: {
        allowedTypes: ['physical_product', 'digital_product'],
        maxItems: 100
      }
    },
    professional: {
      name: 'Product Types',
      enabled: true,
      level: 5,
      features: ['physical_product', 'digital_product', 'hybrid_product', 'custom_product'], // Explicit naming
      restrictions: {
        allowedTypes: ['physical_product', 'digital_product', 'hybrid_product', 'custom_product'],
        maxItems: 1000
      }
    }
  },

  // Creation Method Capabilities
  'creation_methods': {
    discovery: {
      name: 'Creation Methods',
      enabled: true,
      level: 1,
      features: ['manual'],
      restrictions: {
        allowedTypes: ['manual'],
        blockedOperations: ['bulk_import', 'api_import']
      }
    },
    storefront: {
      name: 'Creation Methods',
      enabled: true,
      level: 3,
      features: ['manual', 'wizard'],
      restrictions: {
        allowedTypes: ['manual', 'wizard'],
        blockedOperations: ['api_import']
      }
    },
    professional: {
      name: 'Creation Methods',
      enabled: true,
      level: 5,
      features: ['manual', 'wizard', 'import', 'api'],
      restrictions: {
        allowedTypes: ['manual', 'wizard', 'import', 'api']
      }
    }
  },

  // Featured Product Capabilities
  'featured_products': {
    discovery: {
      name: 'Featured Products',
      enabled: true,
      level: 1,
      features: ['spotlight'],
      restrictions: {
        maxItems: 3,
        allowedTypes: ['spotlight']
      }
    },
    storefront: {
      name: 'Featured Products',
      enabled: true,
      level: 3,
      features: ['spotlight', 'new_arrival', 'sale'],
      restrictions: {
        maxItems: 10,
        allowedTypes: ['spotlight', 'new_arrival', 'sale']
      }
    },
    professional: {
      name: 'Featured Products',
      enabled: true,
      level: 5,
      features: ['spotlight', 'new_arrival', 'sale', 'seasonal', 'custom'],
      restrictions: {
        maxItems: 50,
        allowedTypes: ['spotlight', 'new_arrival', 'sale', 'seasonal', 'custom']
      }
    }
  },

  // Content Creation Capabilities
  'content_creation': {
    discovery: {
      name: 'Content Creation',
      enabled: true,
      level: 1,
      features: ['text'],
      restrictions: {
        allowedTypes: ['text'],
        blockedOperations: ['html_editor', 'video_upload']
      }
    },
    storefront: {
      name: 'Content Creation',
      enabled: true,
      level: 3,
      features: ['text', 'rich_text', 'images'],
      restrictions: {
        allowedTypes: ['text', 'rich_text', 'images'],
        blockedOperations: ['html_editor']
      }
    },
    professional: {
      name: 'Content Creation',
      enabled: true,
      level: 5,
      features: ['text', 'rich_text', 'html', 'images', 'videos', 'audio'],
      restrictions: {
        allowedTypes: ['text', 'rich_text', 'html', 'images', 'videos', 'audio']
      }
    }
  },

  // Payment Method Capabilities
  'payment_methods': {
    commitment: {
      name: 'Payment Methods',
      enabled: true,
      level: 4,
      features: ['credit_card'],
      restrictions: {
        allowedTypes: ['credit_card'],
        blockedOperations: ['recurring_billing', 'multi_currency']
      }
    },
    professional: {
      name: 'Payment Methods',
      enabled: true,
      level: 5,
      features: ['credit_card', 'paypal', 'apple_pay', 'google_pay'],
      restrictions: {
        allowedTypes: ['credit_card', 'paypal', 'apple_pay', 'google_pay'],
        blockedOperations: ['multi_currency']
      }
    },
    enterprise: {
      name: 'Payment Methods',
      enabled: true,
      level: 6,
      features: ['credit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer', 'crypto'],
      restrictions: {
        allowedTypes: ['credit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer', 'crypto']
      }
    }
  }
};

export class CapabilityGateEngine {
  /**
   * Check capability access for a specific operation and capability type
   */
  static checkCapabilityAccess(
    operation: string,
    capabilityType: string,
    context: FeatureGateContext
  ): CapabilityGateResult {
    const currentTier = context.tier?.key || 'discovery';
    const currentLevel = TIER_LEVELS[currentTier as keyof typeof TIER_LEVELS] || 1;
    
    // Get capability definition for this tier
    const capabilityDef = CAPABILITY_DEFINITIONS[capabilityType as keyof typeof CAPABILITY_DEFINITIONS];
    if (!capabilityDef) {
      return {
        hasAccess: false,
        capabilities: {},
        restrictions: {
          blockedOperations: [capabilityType]
        }
      };
    }

    // Find the highest capability level available at or below current tier
    let availableCapability = null;
    let requiredTier = null;

    const tierKeys = Object.keys(capabilityDef) as Array<keyof typeof capabilityDef>;
    for (const tierKey of tierKeys) {
      const tierLevel = TIER_LEVELS[tierKey as keyof typeof TIER_LEVELS] || 0;
      if (tierLevel <= currentLevel) {
        availableCapability = capabilityDef[tierKey];
      } else if (!requiredTier && tierLevel > currentLevel) {
        requiredTier = tierKey;
        break;
      }
    }

    if (!availableCapability) {
      return {
        hasAccess: false,
        capabilities: {},
        upgradePath: requiredTier ? {
          currentTier,
          requiredTier,
          capabilities: [capabilityType]
        } : undefined,
        restrictions: {
          blockedOperations: [capabilityType]
        }
      };
    }

    // Build capabilities object
    const capabilities: Record<string, Capability> = {
      [capabilityType]: {
        name: availableCapability.name,
        enabled: availableCapability.enabled,
        level: availableCapability.level,
        maxLimit: (availableCapability.restrictions as any)?.maxItems,
        features: availableCapability.features
      }
    };

    return {
      hasAccess: true,
      capabilities,
      restrictions: availableCapability.restrictions
    };
  }

  /**
   * Get all capabilities for the current tier
   */
  static getAllCapabilities(context: FeatureGateContext): Record<string, Capability> {
    const currentTier = context.tier?.key || 'discovery';
    const currentLevel = TIER_LEVELS[currentTier as keyof typeof TIER_LEVELS] || 1;
    
    const allCapabilities: Record<string, Capability> = {};

    for (const [capabilityType, capabilityDef] of Object.entries(CAPABILITY_DEFINITIONS)) {
      // Find the highest capability level available at or below current tier
      let availableCapability = null;

      const tierKeys = Object.keys(capabilityDef) as Array<string>;
      for (const tierKey of tierKeys) {
        const tierLevel = TIER_LEVELS[tierKey as keyof typeof TIER_LEVELS] || 0;
        if (tierLevel <= currentLevel) {
          availableCapability = capabilityDef[tierKey as keyof typeof capabilityDef];
        }
      }

      if (availableCapability) {
        allCapabilities[capabilityType] = {
          name: availableCapability.name,
          enabled: availableCapability.enabled,
          level: availableCapability.level,
          maxLimit: (availableCapability.restrictions as any)?.maxItems,
          features: availableCapability.features
        };
      }
    }

    return allCapabilities;
  }

  /**
   * Check if a specific capability feature is available
   */
  static hasCapabilityFeature(
    capabilityType: string,
    feature: string,
    context: FeatureGateContext
  ): boolean {
    const result = this.checkCapabilityAccess(capabilityType, capabilityType, context);
    const capability = result.capabilities[capabilityType];
    return capability?.features.includes(feature) || false;
  }

  /**
   * Get upgrade path for a capability
   */
  static getUpgradePath(
    capabilityType: string,
    context: FeatureGateContext
  ): { currentTier: string; requiredTier: string; capabilities: string[] } | null {
    const currentTier = context.tier?.key || 'discovery';
    const currentLevel = TIER_LEVELS[currentTier as keyof typeof TIER_LEVELS] || 1;
    
    const capabilityDef = CAPABILITY_DEFINITIONS[capabilityType as keyof typeof CAPABILITY_DEFINITIONS];
    if (!capabilityDef) return null;

    // Find the next tier that provides this capability
    for (const tierKey of Object.keys(capabilityDef)) {
      const tierLevel = TIER_LEVELS[tierKey as keyof typeof TIER_LEVELS] || 0;
      if (tierLevel > currentLevel) {
        return {
          currentTier,
          requiredTier: tierKey,
          capabilities: [capabilityType]
        };
      }
    }

    return null;
  }
}
