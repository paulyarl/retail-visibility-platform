import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user...');
    
    // Simple check without relations first
    const user = await prisma.users.findUnique({
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
    console.log('   First Name:', user.first_name);
    console.log('   Last Name:', user.last_name);
    console.log('   Email Verified:', user.email_verified);
    
    // Try to get user tenants separately
    try {
      const userTenants = await prisma.user_tenants.findMany({
        where: { userId: user.id }
      });
      console.log('   Tenant Count:', userTenants.length);
      
      if (userTenants.length > 0) {
        console.log('   Tenant IDs:', userTenants.map(ut => ut.tenant_id));
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
