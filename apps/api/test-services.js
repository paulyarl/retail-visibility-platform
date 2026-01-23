#!/usr/bin/env node

console.log('🔧 Testing UniversalSingleton Service Instantiation...');
console.log('==================================================');

async function testServices() {
  try {
    console.log('\n📦 Testing SecurityMonitoringService...');
    
    // Test SecurityMonitoringService
    const SecurityMonitoringService = require('./src/services/SecurityMonitoringService.tsx').default;
    const securityService = SecurityMonitoringService.getInstance();
    console.log('✅ SecurityMonitoringService instantiated successfully!');
    console.log('   Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(securityService)).filter(name => name !== 'constructor'));

    console.log('\n⚡ Testing RateLimitingService...');
    
    // Test RateLimitingService
    const RateLimitingService = require('./src/services/RateLimitingService.tsx').default;
    const rateLimitService = RateLimitingService.getInstance();
    console.log('✅ RateLimitingService instantiated successfully!');
    console.log('   Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(rateLimitService)).filter(name => name !== 'constructor'));

    console.log('\n📊 Testing BehaviorTrackingService...');
    
    // Test BehaviorTrackingService
    const BehaviorTrackingService = require('./src/services/BehaviorTrackingService.tsx').default;
    const behaviorService = BehaviorTrackingService.getInstance();
    console.log('✅ BehaviorTrackingService instantiated successfully!');
    console.log('   Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(behaviorService)).filter(name => name !== 'constructor'));

    console.log('\n🏢 Testing TenantProfileService...');
    
    // Test TenantProfileService
    const TenantProfileService = require('./src/services/TenantProfileService.tsx').default;
    const tenantService = TenantProfileService.getInstance();
    console.log('✅ TenantProfileService instantiated successfully!');
    console.log('   Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tenantService)).filter(name => name !== 'constructor'));

    console.log('\n🎉 ALL SERVICES INSTANTIATED SUCCESSFULLY!');
    console.log('🚀 UniversalSingleton system is ready for integration!');

  } catch (error) {
    console.error('❌ Service instantiation failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testServices();
