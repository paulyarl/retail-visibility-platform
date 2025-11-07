const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 Starting PLATFORM_ADMIN migration...\n');

  try {
    // Update ADMIN users with no tenant assignments to PLATFORM_ADMIN
    const result = await prisma.$executeRaw`
      UPDATE users
      SET role = 'PLATFORM_ADMIN'
      WHERE role = 'ADMIN'
        AND id NOT IN (
          SELECT DISTINCT user_id 
          FROM user_tenants
        )
    `;

    console.log(`✅ Updated ${result} users to PLATFORM_ADMIN\n`);

    // Verify platform admins
    const platformAdmins = await prisma.user.findMany({
      where: { role: 'PLATFORM_ADMIN' },
      select: { 
        email: true, 
        role: true,
        _count: {
          select: { tenants: true }
        }
      }
    });

    console.log('📊 Platform Admins:');
    platformAdmins.forEach(admin => {
      console.log(`  - ${admin.email} (${admin.role}) - ${admin._count.tenants} tenant assignments`);
    });

    // Check remaining ADMIN users
    const remainingAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { 
        email: true, 
        role: true,
        _count: {
          select: { tenants: true }
        }
      }
    });

    if (remainingAdmins.length > 0) {
      console.log('\n⚠️  Remaining ADMIN users (have tenant assignments):');
      remainingAdmins.forEach(admin => {
        console.log(`  - ${admin.email} (${admin.role}) - ${admin._count.tenants} tenant assignments`);
      });
      console.log('\n💡 These users should use UserTenant.role for tenant-scoped admin access');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate()
  .finally(() => prisma.$disconnect());
