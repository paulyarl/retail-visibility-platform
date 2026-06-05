import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPaymentGateways() {
  try {
    const gateways = await prisma.tenant_payment_gateways.findMany({
      where: { tenant_id: 'tid-m8ijkrnk' },
      select: {
        id: true,
        gateway_type: true,
        is_active: true,
        is_default: true,
        config: true,
        verification_status: true,
        created_at: true
      }
    });
    
    console.log('Payment Gateways for tid-m8ijkrnk:');
    console.log('=====================================');
    gateways.forEach(gateway => {
      console.log(`Type: ${gateway.gateway_type}`);
      console.log(`Active: ${gateway.is_active}`);
      console.log(`Default: ${gateway.is_default}`);
      console.log(`Verified: ${gateway.verification_status}`);
      console.log(`Config: ${JSON.stringify(gateway.config, null, 2)}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentGateways();
