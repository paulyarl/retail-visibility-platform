import { prisma } from './src/prisma.ts';

async function activateAdmin() {
  console.log('🔧 Activating admin user...');
  
  try {
    const result = await prisma.users.update({
      where: { email: 'admin@rvp.com' },
      data: { is_active: true },
      select: { id: true, email: true, is_active: true, role: true }
    });
    
    console.log('✅ Admin user activated successfully:');
    console.log('   Email:', result.email);
    console.log('   Active:', result.is_active);
    console.log('   Role:', result.role);
    
  } catch (error) {
    console.error('❌ Failed to activate admin user:', error.message);
  }
  
  process.exit(0);
}

activateAdmin();
