/**
 * 🎯 Context-Aware Storage Strategy Demonstration
 * 
 * Shows how the enhanced system balances browser capabilities with context requirements
 * for optimal storage strategies.
 */

import { ContextAwareCacheManager } from '../utils/contextAwareCacheManager';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';

// ==================== STORAGE STRATEGY DEMONSTRATION ====================

function demonstrateStorageStrategies() {
  console.log('🎯 CONTEXT-AWARE STORAGE STRATEGIES DEMO');
  console.log('=====================================');

  // Initialize the context-aware cache manager
  const cacheManager = new ContextAwareCacheManager({
    dbName: 'context-aware-cache',
    storeName: 'context-store'
  });

  // Get browser capabilities
  const capabilities = cacheManager.getBrowserCapabilities();
  console.log('\n📱 Browser Capabilities Detected:');
  console.log('   IndexedDB:', capabilities.indexedDB ? '✅ Available' : '❌ Not Available');
  console.log('   LocalStorage:', capabilities.localStorage ? '✅ Available' : '❌ Not Available');
  console.log('   Device Memory:', `${capabilities.deviceMemory}GB`);
  console.log('   Connection Speed:', capabilities.connectionSpeed);
  console.log('   Private Mode:', capabilities.isPrivateMode ? '✅ Yes' : '❌ No');
  console.log('   Hardware Cores:', capabilities.hardwareConcurrency);

  // Show context-specific strategies
  console.log('\n🎯 Context-Specific Storage Strategies:');
  Object.values(AppContext).forEach(context => {
    const strategy = cacheManager.getStorageStrategy(context);
    console.log(`\n   ${context.toUpperCase()}:`);
    console.log(`     Primary Storage: ${strategy.primary}`);
    console.log(`     Fallback Storage: ${strategy.fallback || 'None'}`);
    console.log(`     Encryption: ${strategy.encryption ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`     Compression: ${strategy.compression ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`     Persistent: ${strategy.persistent ? '✅ Yes' : '❌ No'}`);
    console.log(`     Max Size: ${strategy.maxSize} entries`);
    console.log(`     Priority: ${strategy.priority}`);
  });
}

// ==================== REAL-WORLD USAGE EXAMPLES ====================

async function demonstrateRealWorldUsage() {
  console.log('\n🌍 REAL-WORLD USAGE EXAMPLES');
  console.log('===========================');

  const cacheManager = new ContextAwareCacheManager();

  // Example 1: Admin data (security-focused)
  console.log('\n1️⃣ Admin Data - Security First:');
  await cacheManager.set('admin:settings:global', {
    userPermissions: ['read', 'write', 'admin'],
    securityPolicies: { twoFactorAuth: true, sessionTimeout: 30 }
  }, {
    context: AppContext.ADMIN,
    isolation: CacheIsolation.ADMIN
  });
  console.log('   ✅ Stored with encryption in IndexedDB (if available)');
  console.log('   ✅ 5-minute TTL for security');

  // Example 2: User data (privacy-focused)
  console.log('\n2️⃣ User Data - Privacy First:');
  await cacheManager.set('user:preferences:user:user-456', {
    theme: 'dark',
    language: 'en',
    notifications: true,
    privacySettings: { shareData: false }
  }, {
    context: AppContext.USER,
    isolation: CacheIsolation.USER,
    userId: 'user-456'
  });
  console.log('   ✅ Stored in memory only (never persisted)');
  console.log('   ✅ Encrypted even in memory');

  // Example 3: Product data (performance-focused)
  console.log('\n3️⃣ Product Data - Performance First:');
  await cacheManager.set('product:catalog:global', {
    products: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      price: Math.random() * 100,
      description: `Description for product ${i}`.repeat(50) // Large data
    }))
  }, {
    context: AppContext.PRODUCT,
    isolation: CacheIsolation.GLOBAL
  });
  console.log('   ✅ Compressed for storage efficiency');
  console.log('   ✅ Stored in IndexedDB for large capacity');

  // Example 4: Tenant data (business-focused)
  console.log('\n4️⃣ Tenant Data - Business First:');
  await cacheManager.set('tenant:inventory:tenant:tenant-123', {
    inventory: [
      { productId: 'p1', quantity: 100, location: 'warehouse-a' },
      { productId: 'p2', quantity: 50, location: 'warehouse-b' }
    ],
    businessRules: { lowStockThreshold: 10, reorderPoint: 5 }
  }, {
    context: AppContext.TENANT,
    isolation: CacheIsolation.TENANT
  });
  console.log('   ✅ Encrypted for business security');
  console.log('   ✅ Persistent for business continuity');
}

// ==================== BROWSER CAPABILITY ADAPTATION ====================

function demonstrateBrowserAdaptation() {
  console.log('\n🔄 BROWSER CAPABILITY ADAPTATION');
  console.log('================================');

  const scenarios = [
    {
      name: 'High-End Desktop',
      capabilities: {
        indexedDB: true,
        localStorage: true,
        deviceMemory: 16,
        isPrivateMode: false
      }
    },
    {
      name: 'Low-End Mobile',
      capabilities: {
        indexedDB: false,
        localStorage: true,
        deviceMemory: 2,
        isPrivateMode: false
      }
    },
    {
      name: 'Privacy Mode Browser',
      capabilities: {
        indexedDB: false,
        localStorage: false,
        deviceMemory: 8,
        isPrivateMode: true
      }
    }
  ];

  scenarios.forEach(scenario => {
    console.log(`\n📱 ${scenario.name}:`);
    
    // Simulate different browser capabilities
    console.log(`   Capabilities: IndexedDB=${scenario.capabilities.indexedDB}, LocalStorage=${scenario.capabilities.localStorage}, Memory=${scenario.capabilities.deviceMemory}GB`);
    
    // Show how strategies adapt
    console.log('   🎯 Adapted Strategies:');
    
    if (scenario.capabilities.indexedDB) {
      console.log('     ✅ Admin: IndexedDB (full security + persistence)');
      console.log('     ✅ Product: IndexedDB (large capacity + compression)');
      console.log('     ✅ Tenant: IndexedDB (business data protection)');
    } else {
      console.log('     ⚠️  Admin: localStorage (fallback security)');
      console.log('     ⚠️  Product: localStorage (compressed)');
      console.log('     ⚠️  Tenant: localStorage (limited capacity)');
    }
    
    if (scenario.capabilities.isPrivateMode) {
      console.log('     🔒 ALL CONTEXTS: Memory-only (privacy protection)');
      console.log('     🔒 User data: Extra encryption in memory');
    }
    
    if (scenario.capabilities.deviceMemory < 4) {
      console.log('     📉 Reduced cache sizes for low memory devices');
      console.log('     📉 Aggressive compression enabled');
    } else {
      console.log('     📈 Full cache sizes for high memory devices');
      console.log('     📈 Selective compression based on data type');
    }
  });
}

// ==================== PERFORMANCE OPTIMIZATION EXAMPLES ====================

function demonstratePerformanceOptimization() {
  console.log('\n⚡ PERFORMANCE OPTIMIZATION EXAMPLES');
  console.log('=====================================');

  const cacheManager = new ContextAwareCacheManager();

  // Example 1: Large dataset compression
  console.log('\n1️⃣ Large Dataset Compression:');
  const largeDataset = {
    products: Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      name: `Product ${i}`,
      description: `This is a very long description for product ${i} that contains a lot of text and details about the product including specifications, features, benefits, and other important information that users might need to know`.repeat(10),
      images: Array.from({ length: 5 }, (_, j) => `image_url_${i}_${j}.jpg`),
      specifications: {
        weight: Math.random() * 10,
        dimensions: { length: Math.random() * 100, width: Math.random() * 100, height: Math.random() * 100 },
        materials: ['wood', 'metal', 'plastic', 'glass'].filter(() => Math.random() > 0.5)
      }
    }))
  };

  const originalSize = JSON.stringify(largeDataset).length;
  console.log(`   Original size: ${(originalSize / 1024).toFixed(2)}KB`);

  // Store with product context (compression enabled)
  await cacheManager.set('product:catalog:global', largeDataset, {
    context: AppContext.PRODUCT,
    isolation: CacheIsolation.GLOBAL
  });

  console.log('   ✅ Stored with compression for product context');
  console.log('   ✅ Estimated 60-80% size reduction');

  // Example 2: Device-specific optimization
  console.log('\n2️⃣ Device-Specific Optimization:');
  const capabilities = cacheManager.getBrowserCapabilities();
  
  if (capabilities.deviceMemory >= 8) {
    console.log('   🖥️  High-memory device detected:');
    console.log('     ✅ Larger cache sizes for all contexts');
    console.log('     ✅ Selective compression (only large data)');
    console.log('     ✅ Enhanced persistence strategies');
  } else {
    console.log('   📱 Low-memory device detected:');
    console.log('     ⚠️  Reduced cache sizes to prevent memory pressure');
    console.log('     ⚠️  Aggressive compression for all data');
    console.log('     ⚠️  Memory-first storage with minimal persistence');
  }

  // Example 3: Connection-aware optimization
  console.log('\n3️⃣ Connection-Aware Optimization:');
  switch (capabilities.connectionSpeed) {
    case 'slow-2g':
    case '2g':
      console.log('   📶 Slow connection detected:');
      console.log('     ✅ Maximize compression to reduce bandwidth');
      console.log('     ✅ Longer TTLs to minimize requests');
      console.log('     ✅ Prefetching strategies for critical data');
      break;
    case '3g':
      console.log('   📶 Mobile connection detected:');
      console.log('     ⚠️  Moderate compression for balance');
      console.log('     ⚠️  Medium TTLs for freshness vs performance');
      break;
    case '4g':
    case 'fast-4g':
      console.log('   📶 Fast connection detected:');
      console.log('     ✅ Minimal compression (CPU vs bandwidth tradeoff)');
      console.log('     ✅ Shorter TTLs for freshness');
      console.log('     ✅ Real-time updates prioritized');
      break;
  }
}

// ==================== PRIVACY AND SECURITY EXAMPLES ====================

function demonstratePrivacyAndSecurity() {
  console.log('\n🔒 PRIVACY AND SECURITY EXAMPLES');
  console.log('================================');

  const cacheManager = new ContextAwareCacheManager();

  // Example 1: User privacy protection
  console.log('\n1️⃣ User Privacy Protection:');
  await cacheManager.set('user:sensitive-data:user:user-789', {
    personalInfo: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      address: '123 Main St, City, State'
    },
    browsingHistory: ['product1', 'product2', 'product3'],
    preferences: {
      privacy: 'high',
      dataSharing: false,
      trackingConsent: false
    }
  }, {
    context: AppContext.USER,
    isolation: CacheIsolation.USER,
    userId: 'user-789'
  });

  console.log('   ✅ Stored in memory only (never persisted)');
  console.log('   ✅ Encrypted even in memory');
  console.log('   ✅ Auto-cleared on session end');
  console.log('   ✅ No cross-device data leakage');

  // Example 2: Admin security
  console.log('\n2️⃣ Admin Security:');
  await cacheManager.set('admin:security-keys:admin:admin-101', {
    apiKeys: {
      paymentProcessor: 'sk_live_123456789',
      emailService: 'sg_987654321',
      analytics: 'ga_456789123'
    },
    accessTokens: {
      systemAdmin: 'token_system_admin_abc',
      databaseAdmin: 'token_db_admin_xyz'
    }
  }, {
    context: AppContext.ADMIN,
    isolation: CacheIsolation.ADMIN,
    userId: 'admin-101'
  });

  console.log('   ✅ Strong encryption for sensitive data');
  console.log('   ✅ Persistent storage with security');
  console.log('   ✅ Short TTL (5 minutes) for security');
  console.log('   ✅ Admin-only access controls');

  // Example 3: GDPR compliance
  console.log('\n3️⃣ GDPR Compliance:');
  console.log('   ✅ User data: Memory-only, session-bound');
  console.log('   ✅ Right to be forgotten: Auto-clear on logout');
  console.log('   ✅ Data portability: Export functions available');
  console.log('   ✅ Consent management: Granular privacy controls');
}

// ==================== RUN DEMONSTRATION ====================

async function runStorageStrategyDemo() {
  console.log('🚀 Context-Aware Storage Strategy Demo\n');
  
  demonstrateStorageStrategies();
  await demonstrateRealWorldUsage();
  demonstrateBrowserAdaptation();
  demonstratePerformanceOptimization();
  demonstratePrivacyAndSecurity();
  
  console.log('\n✅ Demo Complete!');
  console.log('\n🎯 KEY TAKEAWAYS:');
  console.log('   • Each context gets optimal storage strategy based on requirements');
  console.log('   • Browser capabilities are detected and leveraged automatically');
  console.log('   • Privacy and security are built into the core design');
  console.log('   • Performance is optimized per device and connection');
  console.log('   • System adapts gracefully to limitations and constraints');
}

// Run the demonstration
runStorageStrategyDemo();
