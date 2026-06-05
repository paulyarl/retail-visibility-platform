/**
 * Seed script to create an admin user
 * Run with: doppler run --config local -- npx tsx scripts/seed-admin.ts
 */

import { PrismaClient, user_role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateUserId } from '../src/lib/id-generator';

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Seeding Admin User...\n');

  const adminData = {
    email: 'admin@rvp.com',
    password: 'Admin123!',
    first_name: 'Admin',
    last_name: 'User',
    role: user_role.PLATFORM_ADMIN,
  };

  try {
    // Check if admin already exists and delete it
    const existingAdmin = await prisma.users.findUnique({
      where: { email: adminData.email },
    });

    if (existingAdmin) {
      console.log('🗑️  Deleting existing admin user...');
      console.log('   Email:', existingAdmin.email);
      console.log('   ID:', existingAdmin.id);
      
      await prisma.users.delete({
        where: { email: adminData.email },
      });
      
      console.log('✅ Existing admin deleted\n');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminData.password, 12);

    // Create admin user
    const admin = await prisma.users.create({
      data: {
        id: generateUserId(),
        email: adminData.email,
        password_hash: passwordHash,
        first_name: adminData.first_name,
        last_name: adminData.last_name,
        role: adminData.role,
        email_verified: true, // Auto-verify admin
        updated_at: new Date(),
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('   ID:', admin.id);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('\n🔐 Login Credentials:');
    console.log('   Email:', adminData.email);
    console.log('   Password:', adminData.password);
    console.log('\n📝 Note: Change this password after first login!');
  } catch (error) {
    console.error('❌ Failed to seed admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeder
seedAdmin()
  .then(() => {
    console.log('\n✨ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
