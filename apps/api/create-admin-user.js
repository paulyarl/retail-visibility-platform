#!/usr/bin/env node
/**
 * Create Admin User
 * Creates a test admin user with known credentials
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Creating admin user...\n');

  const email = 'admin@demo.local';
  const password = '2481visible';
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create or update user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('✅ Admin user created successfully!\n');
  console.log('📋 Login Credentials:');
  console.log('━'.repeat(40));
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     ${user.role}`);
  console.log('━'.repeat(40));
  console.log('\n🌐 Login at: http://localhost:3000/login\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
