/**
 * Seed script to create an admin user
 * Run with: doppler run --config local -- npx tsx scripts/seed-admin.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateTenantId } from '../src/lib/id-generator';

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Seeding Admin User...\n');

  const adminData = {
    email: 'admin@rvp.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  };

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email },
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Email:', existingAdmin.email);
      console.log('   ID:', existingAdmin.id);
      console.log('   Role:', existingAdmin.role);
      console.log('\n✅ You can log in with:');
      console.log('   Email:', adminData.email);
      console.log('   Password:', adminData.password);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminData.password, 12);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        id: generateTenantId(),
        email: adminData.email,
        passwordHash,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: adminData.role,
        emailVerified: true, // Auto-verify admin
        updatedAt: new Date(),
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
