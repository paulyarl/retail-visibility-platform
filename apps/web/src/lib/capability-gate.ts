export interface FeatureGateContext {
  tier?: {
    key: string;
    name: string;
  };
  userRole?: string;
  platformUser?: {
    canBypassAll?: boolean;
    canBypassRole?: boolean;
  };
}

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

const CAPABILITY_DEFINITIONS = {
  'product_types': {
    discovery: {
      name: 'Product Types',
      enabled: true,
      level: 1,
      features: ['physical_product'],
      restrictions: {
        allowedTypes: ['physical_product'],
        maxItems: 10
      }
    },
    storefront: {
      name: 'Product Types',
      enabled: true,
      level: 3,
      features: ['physical_product', 'digital_product'],
      restrictions: {
        allowedTypes: ['physical_product', 'digital_product'],
        maxItems: 100
      }
    },
    professional: {
      name: 'Product Types',
      enabled: true,
      level: 5,
      features: ['physical_product', 'digital_product', 'hybrid_product', 'custom_product'],
      restrictions: {
        allowedTypes: ['physical_product', 'digital_product', 'hybrid_product', 'custom_product'],
        maxItems: 1000
      }
    }
  },
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
  'order_tracking': {
    commitment: {
      name: 'Order Tracking',
      enabled: true,
      level: 4,
      features: ['manual_tracking', 'auto_tracking_url', 'shipped_notification'],
      restrictions: {}
    },
    professional: {
      name: 'Order Tracking',
      enabled: true,
      level: 5,
      features: ['manual_tracking', 'auto_tracking_url', 'shipped_notification', 'tracking_events', 'status_progression'],
      restrictions: {}
    }
  },
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
  static checkCapabilityAccess(
    operation: string,
    capabilityType: string,
    context: FeatureGateContext
  ): CapabilityGateResult {
    const currentTier = context.tier?.key || 'discovery';
    const currentLevel = TIER_LEVELS[currentTier as keyof typeof TIER_LEVELS] || 1;

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

    let availableCapability: any = null;
    let requiredTier: string | null = null;

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

    const capabilities: Record<string, Capability> = {
      [capabilityType]: {
        name: availableCapability.name,
        enabled: availableCapability.enabled,
        level: availableCapability.level,
        maxLimit: availableCapability.restrictions?.maxItems,
        features: availableCapability.features
      }
    };

    return {
      hasAccess: true,
      capabilities,
      restrictions: availableCapability.restrictions
    };
  }

  static getAllCapabilities(context: FeatureGateContext): Record<string, Capability> {
    const currentTier = context.tier?.key || 'discovery';
    const currentLevel = TIER_LEVELS[currentTier as keyof typeof TIER_LEVELS] || 1;

    const allCapabilities: Record<string, Capability> = {};

    for (const [capabilityType, capabilityDef] of Object.entries(CAPABILITY_DEFINITIONS)) {
      let availableCapability: any = null;

      const tierKeys = Object.keys(capabilityDef) as Array<string>;
      for (const tierKey of tierKeys) {
        const tierLevel = TIER_LEVELS[tierKey as keyof typeof TIER_LEVELS] || 0;
        if (tierLevel <= currentLevel) {
          availableCapability = (capabilityDef as any)[tierKey];
        }
      }

      if (availableCapability) {
        allCapabilities[capabilityType] = {
          name: availableCapability.name,
          enabled: availableCapability.enabled,
          level: availableCapability.level,
          maxLimit: availableCapability.restrictions?.maxItems,
          features: availableCapability.features
        };
      }
    }

    return allCapabilities;
  }

  static hasCapabilityFeature(
    capabilityType: string,
    feature: string,
    context: FeatureGateContext
  ): boolean {
    const result = this.checkCapabilityAccess(capabilityType, capabilityType, context);
    const capability = result.capabilities[capabilityType];
    return capability?.features.includes(feature) || false;
  }

  static getUpgradePath(
    capabilityType: string,
    context: FeatureGateContext
  ): { currentTier: string; requiredTier: string; capabilities: string[] } | null {
    const currentTier = context.tier?.key || 'discovery';
    const currentLevel = TIER_LEVELS[currentTier as keyof typeof TIER_LEVELS] || 1;

    const capabilityDef = CAPABILITY_DEFINITIONS[capabilityType as keyof typeof CAPABILITY_DEFINITIONS];
    if (!capabilityDef) return null;

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
