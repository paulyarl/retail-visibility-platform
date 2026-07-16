import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeSquareGateway() {
  try {
    const tenantId = 'tid-m8ijkrnk';
    
    console.log('Removing Square Gateway for', tenantId);
    console.log('=====================================');
    
    // Remove Square gateway
    const squareDeleted = await prisma.tenant_payment_gateways.deleteMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'square'
      }
    });
    console.log(`✅ Removed ${squareDeleted.count} Square gateway(s)`);
    
    // Set PayPal back to default since it's the only gateway left
    const paypalUpdated = await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        gateway_type: 'paypal'
      },
      data: {
        is_default: true
      }
    });
    console.log(`✅ Set PayPal as default gateway`);
    
    // Show final result
    const finalGateways = await prisma.tenant_payment_gateways.findMany({
      where: { tenant_id: tenantId },
      select: {
        gateway_type: true,
        is_active: true,
        is_default: true,
        verification_status: true
      }
    });
    
    console.log('\nFinal Configuration:');
    console.log('=====================');
    if (finalGateways.length === 0) {
      console.log('No payment gateways configured');
    } else {
      finalGateways.forEach(gateway => {
        const status = gateway.is_default ? 'DEFAULT' : 'active';
        console.log(`${gateway.gateway_type}: ${status} (verified: ${gateway.verification_status})`);
      });
    }
    
    console.log('\n🎉 Square gateway removed until OAuth is properly connected!');
    console.log('📝 Next steps:');
    console.log('   1. Connect Square OAuth in the payment gateway settings');
    console.log('   2. Square will be added to database automatically upon successful OAuth');
    console.log('   3. Storefront will then show Square as a payment option');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeSquareGateway();
