import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user...');
    
    // Simple check without relations first
    const user = await prisma.user.findUnique({
      where: { email: 'admin@rvp.com' }
    });
    
    if (!user) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Admin user found:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   First Name:', user.firstName);
    console.log('   Last Name:', user.lastName);
    console.log('   Email Verified:', user.emailVerified);
    
    // Try to get user tenants separately
    try {
      const userTenants = await prisma.userTenant.findMany({
        where: { userId: user.id }
      });
      console.log('   Tenant Count:', userTenants.length);
      
      if (userTenants.length > 0) {
        console.log('   Tenant IDs:', userTenants.map(ut => ut.tenantId));
      } else {
        console.log('   ⚠️  No tenants associated with this user');
        console.log('   💡 This is normal for PLATFORM_ADMIN users');
      }
    } catch (tenantError) {
      console.log('   ⚠️  Could not check tenant associations:', tenantError.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();
