import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllGateways() {
  try {
    // Check all gateways for this tenant
    const gateways = await prisma.tenant_payment_gateways.findMany({
      where: { tenant_id: 'tid-m8ijkrnk' },
      select: {
        id: true,
        gateway_type: true,
        is_active: true,
        is_default: true,
        verification_status: true
      }
    });
    
    console.log('Current Gateways for tid-m8ijkrnk:');
    console.log('=====================================');
    gateways.forEach(gateway => {
      console.log(`${gateway.gateway_type}: active=${gateway.is_active}, default=${gateway.is_default}, verified=${gateway.verification_status}`);
    });
    
    // Check if Square exists anywhere
    const squareGateways = await prisma.tenant_payment_gateways.findMany({
      where: { gateway_type: 'square' },
      select: {
        id: true,
        tenant_id: true,
        is_active: true,
        is_default: true
      }
    });
    
    console.log('\nAll Square Gateways in System:');
    console.log('================================');
    if (squareGateways.length === 0) {
      console.log('No Square gateways found in the system');
    } else {
      squareGateways.forEach(gateway => {
        console.log(`Tenant: ${gateway.tenant_id}, active=${gateway.is_active}, default=${gateway.is_default}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllGateways();
