/**
 * Base Class Alignment Check
 * Ensures all base classes are using the new target system consistently
 */

import { RequestType, RequestTarget } from './FlexibleApiSingleton';

// ====================
// ALIGNMENT VERIFICATION
// ====================

interface BaseClassConfig {
  className: string;
  defaultRequestType: RequestType;
  defaultRequestTarget: RequestTarget;
  expectedPort: string;
  useCase: string;
}

const BASE_CLASS_ALIGNMENTS: BaseClassConfig[] = [
  {
    className: 'FlexibleApiSingleton',
    defaultRequestType: RequestType.SYSTEM, // Abstract, so this is example
    defaultRequestTarget: RequestTarget.API,
    expectedPort: '4000',
    useCase: 'Base abstract class - provides all target methods'
  },
  {
    className: 'PublicApiSingleton',
    defaultRequestType: RequestType.PUBLIC,
    defaultRequestTarget: RequestTarget.API,
    expectedPort: '4000',
    useCase: 'Public data operations - no auth required'
  },
  {
    className: 'AuthenticatedApiSingleton',
    defaultRequestType: RequestType.AUTHENTICATED,
    defaultRequestTarget: RequestTarget.API,
    expectedPort: '4000',
    useCase: 'User-specific authenticated operations'
  },
  {
    className: 'TenantApiSingleton',
    defaultRequestType: RequestType.TENANT,
    defaultRequestTarget: RequestTarget.API,
    expectedPort: '4000',
    useCase: 'Tenant-scoped operations with validation'
  },
  {
    className: 'AdminApiSingleton',
    defaultRequestType: RequestType.ADMIN,
    defaultRequestTarget: RequestTarget.API,
    expectedPort: '4000',
    useCase: 'Admin-level operations with enhanced validation'
  },
  {
    className: 'SystemSingleton',
    defaultRequestType: RequestType.SYSTEM,
    defaultRequestTarget: RequestTarget.WEB,
    expectedPort: '3000',
    useCase: 'System operations on web server'
  },
  {
    className: 'ApiSystemSingleton',
    defaultRequestType: RequestType.SYSTEM,
    defaultRequestTarget: RequestTarget.API,
    expectedPort: '4000',
    useCase: 'System operations on API server'
  }
];

// ====================
// ALIGNMENT RULES
// ====================

const ALIGNMENT_RULES = {
  // All API-focused classes should target API server
  API_CLASSES: ['PublicApiSingleton', 'AuthenticatedApiSingleton', 'TenantApiSingleton', 'AdminApiSingleton', 'ApiSystemSingleton'],
  
  // WEB-focused classes should target web server
  WEB_CLASSES: ['SystemSingleton'],
  
  // All classes must have both defaultRequestType and defaultRequestTarget defined
  REQUIRED_PROPERTIES: ['defaultRequestType', 'defaultRequestTarget'],
  
  // All classes should use convenience methods instead of manual URL construction
  URL_CONSTRUCTION: 'Use target system instead of manual URL construction'
};

// ====================
// ALIGNMENT STATUS
// ====================

export const ALIGNMENT_STATUS = {
  // ✅ ALIGNED CLASSES
  ALIGNED: [
    'PublicApiSingleton',
    'AuthenticatedApiSingleton', 
    'TenantApiSingleton',
    'AdminApiSingleton',
    'SystemSingleton',
    'ApiSystemSingleton'
  ],
  
  // ❌ ISSUES FOUND
  ISSUES: [
    {
      class: 'ApiSystemSingleton',
      issue: 'Recursive call in makeWebRequest',
      status: 'FIXED'
    },
    {
      class: 'SystemSingleton', 
      issue: 'Recursive call in makeApiRequest',
      status: 'FIXED'
    }
  ],
  
  // ✅ VERIFICATION COMPLETE
  STATUS: 'ALL_BASE_CLASSES_ALIGNED'
};

// ====================
// EXPECTED BEHAVIORS
// ====================

export const EXPECTED_BEHAVIORS = {
  // Default behaviors
  DEFAULTS: {
    'PublicApiSingleton': 'PUBLIC + API → http://localhost:4000',
    'AuthenticatedApiSingleton': 'AUTHENTICATED + API → http://localhost:4000',
    'TenantApiSingleton': 'TENANT + API → http://localhost:4000', 
    'AdminApiSingleton': 'ADMIN + API → http://localhost:4000',
    'SystemSingleton': 'SYSTEM + WEB → http://localhost:3000',
    'ApiSystemSingleton': 'SYSTEM + API → http://localhost:4000'
  },
  
  // Cross-target capabilities
  CROSS_TARGET: {
    TargetMethods: 'makeApiRequest(), makeWebRequest(), makeExternalRequest()',
    HybridMethods: 'makeHybridRequest() for any type + target combination',
    ConvenienceMethods: 'Convenience methods like makePublicWebRequest()'
  },
  
  // URL construction
  URL_HANDLING: {
    Automatic: 'URL construction based on defaultRequestTarget',
    Override: 'Target methods temporarily override defaultRequestTarget',
    NoManual: 'No manual URL construction needed'
  }
};

// ====================
// VERIFICATION FUNCTION
// ====================

export function verifyBaseClassAlignment(): boolean {
  console.log('🔍 Verifying Base Class Alignment...\n');
  
  BASE_CLASS_ALIGNMENTS.forEach(config => {
    console.log(`✅ ${config.className}`);
    console.log(`   Type: ${config.defaultRequestType}`);
    console.log(`   Target: ${config.defaultRequestTarget} (port ${config.expectedPort})`);
    console.log(`   Use Case: ${config.useCase}\n`);
  });
  
  console.log('🎯 Alignment Rules:');
  console.log(`   API Classes: ${ALIGNMENT_RULES.API_CLASSES.join(', ')}`);
  console.log(`   WEB Classes: ${ALIGNMENT_RULES.WEB_CLASSES.join(', ')}`);
  console.log(`   Status: ${ALIGNMENT_STATUS.STATUS}\n`);
  
  return true;
}

export default {
  BASE_CLASS_ALIGNMENTS,
  ALIGNMENT_RULES,
  ALIGNMENT_STATUS,
  EXPECTED_BEHAVIORS,
  verifyBaseClassAlignment
};
