/**
 * ❌ BEFORE: Manual Cache Management (The Problems We Solved)
 * 
 * This example shows the pain points of the old system that motivated the enhanced migration.
 */

// ==================== OLD SYSTEM PROBLEMS ====================

class OldProductService {
  constructor() {
    this.cache = new Map(); // Manual memory cache
    this.cacheKeys = {
      products: 'products-list',
      featured: 'featured-products',
      categories: 'product-categories'
    };
  }

  // ❌ PROBLEM 1: Manual caching with lots of boilerplate
  async getProducts() {
    const cacheKey = this.cacheKeys.products;
    let products = this.cache.get(cacheKey);
    
    if (!products || Date.now() - products.timestamp > 30 * 60 * 1000) {
      console.log('📡 Fetching products from API...');
      const response = await fetch('/api/products');
      products = {
        data: await response.json(),
        timestamp: Date.now()
      };
      
      // ❌ PROBLEM 2: Manual cache management
      this.cache.set(cacheKey, products);
      console.log('💾 Products cached manually');
    } else {
      console.log('📋 Products from manual cache');
    }
    
    return products.data;
  }

  // ❌ PROBLEM 3: No storage strategy - just memory
  async getFeaturedProducts() {
    const cacheKey = this.cacheKeys.featured;
    let featured = this.cache.get(cacheKey);
    
    if (!featured || Date.now() - featured.timestamp > 15 * 60 * 1000) {
      console.log('📡 Fetching featured products...');
      const response = await fetch('/api/products/featured');
      featured = {
        data: await response.json(),
        timestamp: Date.now()
      };
      
      // ❌ PROBLEM 4: Lost on browser refresh
      this.cache.set(cacheKey, featured);
      console.log('💾 Featured products cached in memory (lost on refresh)');
    }
    
    return featured.data;
  }

  // ❌ PROBLEM 5: No user-specific caching
  async getUserRecommendations(userId) {
    const cacheKey = `recommendations-${userId}`;
    let recommendations = this.cache.get(cacheKey);
    
    if (!recommendations || Date.now() - recommendations.timestamp > 10 * 60 * 1000) {
      console.log('📡 Fetching user recommendations...');
      const response = await fetch(`/api/users/${userId}/recommendations`);
      recommendations = {
        data: await response.json(),
        timestamp: Date.now()
      };
      
      // ❌ PROBLEM 6: No privacy protection
      this.cache.set(cacheKey, recommendations);
      console.log('💾 User recommendations cached in memory (privacy risk)');
    }
    
    return recommendations.data;
  }

  // ❌ PROBLEM 7: No admin security
  async getAdminSettings(adminId) {
    const cacheKey = `admin-settings-${adminId}`;
    let settings = this.cache.get(cacheKey);
    
    if (!settings || Date.now() - settings.timestamp > 5 * 60 * 1000) {
      console.log('📡 Fetching admin settings...');
      const response = await fetch(`/api/admin/${adminId}/settings`);
      settings = {
        data: await response.json(),
        timestamp: Date.now()
      };
      
      // ❌ PROBLEM 8: No encryption for sensitive data
      this.cache.set(cacheKey, settings);
      console.log('💾 Admin settings cached in memory (security risk)');
    }
    
    return settings.data;
  }

  // ❌ PROBLEM 9: Manual cache invalidation
  invalidateProductCache() {
    console.log('🧹 Manual cache invalidation...');
    Object.values(this.cacheKeys).forEach(key => {
      this.cache.delete(key);
    });
    console.log('💀 All product cache cleared manually');
  }

  // ❌ PROBLEM 10: No performance optimization
  async getLargeCatalog() {
    const cacheKey = 'large-catalog';
    let catalog = this.cache.get(cacheKey);
    
    if (!catalog) {
      console.log('📡 Fetching large catalog (10MB)...');
      const response = await fetch('/api/products/catalog');
      catalog = {
        data: await response.json(),
        timestamp: Date.now()
      };
      
      // ❌ PROBLEM 11: No compression for large data
      this.cache.set(cacheKey, catalog);
      console.log('💾 Large catalog cached (10MB in memory!)');
    }
    
    return catalog.data;
  }

  // ❌ PROBLEM 12: No cross-tab synchronization
  updateProductPreferences(preferences) {
    // ❌ PROBLEM 13: Other tabs don't know about updates
    this.cache.set('user-preferences', {
      data: preferences,
      timestamp: Date.now()
    });
    console.log('💾 Preferences updated (only in this tab)');
  }
}

// ==================== PROBLEMS SUMMARY ====================

const oldSystemProblems = {
  performance: {
    issue: 'No intelligent caching',
    impact: 'Slow repeated API calls',
    example: 'Every page refresh re-fetches data'
  },
  storage: {
    issue: 'Memory-only storage',
    impact: 'Data lost on browser refresh',
    example: 'User preferences reset every session'
  },
  security: {
    issue: 'No encryption or isolation',
    impact: 'Security vulnerabilities',
    example: 'Admin settings stored in plain text'
  },
  privacy: {
    issue: 'No user data protection',
    impact: 'Privacy violations',
    example: 'User recommendations accessible to anyone'
  },
  scalability: {
    issue: 'No compression or optimization',
    impact: 'Memory waste and slow performance',
    example: '10MB catalog stored uncompressed'
  },
  reliability: {
    issue: 'No fallback strategies',
    impact: 'Cache failures break functionality',
    example: 'Memory shortage loses all cached data'
  },
  maintainability: {
    issue: 'Manual boilerplate everywhere',
    impact: 'Code duplication and bugs',
    example: 'Every service has 50+ lines of cache code'
  }
};

console.log('❌ OLD SYSTEM PROBLEMS:');
Object.entries(oldSystemProblems).forEach(([area, problem]) => {
  console.log(`\n   ${area.toUpperCase()}:`);
  console.log(`     Issue: ${problem.issue}`);
  console.log(`     Impact: ${problem.impact}`);
  console.log(`     Example: ${problem.example}`);
});

// ==================== PERFORMANCE METRICS (BEFORE) ====================

const beforeMetrics = {
  pageLoadTime: '3.2 seconds',
  memoryUsage: '150MB',
  cacheHitRate: '15%',
  apiCallsPerSession: '47',
  dataTransfer: '25MB',
  userExperience: 'Poor',
  developerExperience: 'Frustrating',
  securityRating: 'Low',
  privacyCompliance: 'Non-compliant'
};

console.log('\n📊 BEFORE MIGRATION METRICS:');
console.log('   Page Load Time:', beforeMetrics.pageLoadTime);
console.log('   Memory Usage:', beforeMetrics.memoryUsage);
console.log('   Cache Hit Rate:', beforeMetrics.cacheHitRate);
console.log('   API Calls per Session:', beforeMetrics.apiCallsPerSession);
console.log('   Data Transfer:', beforeMetrics.dataTransfer);
console.log('   User Experience:', beforeMetrics.userExperience);
console.log('   Developer Experience:', beforeMetrics.developerExperience);
console.log('   Security Rating:', beforeMetrics.securityRating);
console.log('   Privacy Compliance:', beforeMetrics.privacyCompliance);

export { OldProductService, oldSystemProblems, beforeMetrics };
