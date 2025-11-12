import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reactivateUsers() {
  console.log('🔄 Reactivating all users...\n');

  try {
    // Update all users to be active
    const result = await prisma.user.updateMany({
      where: {
        isActive: false,
      },
      data: {
        isActive: true,
      },
    });

    console.log(`✅ Reactivated ${result.count} user(s)\n`);

    // Show all users and their status
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    console.log('📋 Current users:');
    allUsers.forEach((user) => {
      const status = user.isActive ? '✅ Active' : '❌ Inactive';
      console.log(`   ${status} - ${user.email} (${user.role})`);
    });

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

reactivateUsers();
