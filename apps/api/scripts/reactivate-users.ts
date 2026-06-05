import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reactivateUsers() {
  console.log('🔄 Reactivating all users...\n');

  try {
    // Update all users to be active
    const result = await prisma.users.updateMany({
      where: {
        is_active: false,
      },
      data: {
        is_active: true,
      },
    });

    console.log(`✅ Reactivated ${result.count} user(s)\n`);

    // Show all users and their status
    const allUsers = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
      },
    });

    console.log('📋 Current users:');
    allUsers.forEach((user) => {
      const status = user.is_active ? '✅ Active' : '❌ Inactive';
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
