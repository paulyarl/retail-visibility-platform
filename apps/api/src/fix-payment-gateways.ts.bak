import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function fixPaymentGateways() {
  try {
    const tenantId = 'tid-m8ijkrnk';
    
    console.log('Fixing Payment Gateways for', tenantId);
    console.log('=====================================');
    
    // 1. Remove Stripe gateway
    const stripeDeleted = await prisma.tenant_payment_gateways.deleteMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'stripe'
      }
    });
    console.log(`✅ Removed ${stripeDeleted.count} Stripe gateway(s)`);
    
    // 2. Add Square gateway (test mode)
    const squareGateway = {
      id: randomUUID(),
      tenant_id: tenantId,
      gateway_type: 'square',
      is_active: true,
      is_default: true, // Make Square the default
      verification_status: 'verified' as const,
      config: {
        testMode: true,
        environment: 'sandbox',
        applicationId: 'sandbox-sq0idb-test-app-id', // Replace with actual test app ID
        accessToken: 'sandbox-sq0atb-test-access-token', // Replace with actual test token
        locationId: 'sandbox-sq0idb-test-location-id', // Replace with actual test location
        displayName: 'Square (Test Mode)'
      },
      oauth_connected: true,
      oauth_merchant_id: 'sandbox-test-merchant-id',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await prisma.tenant_payment_gateways.create({
      data: squareGateway
    });
    console.log('✅ Added Square gateway (test mode, default)');
    
    // 3. Update PayPal to not be default
    const paypalUpdated = await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'paypal'
      },
      data: {
        is_default: false
      }
    });
    console.log(`✅ Updated ${paypalUpdated.count} PayPal gateway(s) to not be default`);
    
    // 4. Show final result
    const finalGateways = await prisma.tenant_payment_gateways.findMany({
      where: { tenant_id: tenantId },
      select: {
        gateway_type: true,
        is_active: true,
        is_default: true,
        verification_status: true
      },
      orderBy: { is_default: 'desc' }
    });
    
    console.log('\nFinal Configuration:');
    console.log('=====================');
    finalGateways.forEach(gateway => {
      const status = gateway.is_default ? 'DEFAULT' : 'active';
      console.log(`${gateway.gateway_type}: ${status} (verified: ${gateway.verification_status})`);
    });
    
    console.log('\n🎉 Payment gateway configuration updated!');
    console.log('📝 Note: Update the Square credentials in the config with real test values');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPaymentGateways();
