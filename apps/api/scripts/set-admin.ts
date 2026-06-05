/**
 * Set user as PLATFORM_ADMIN
 * Creates user if doesn't exist, then assigns PLATFORM_ADMIN role
 * 
 * Usage: doppler run --config local -- npx ts-node scripts/set-admin.ts <email>
 */

import { PrismaClient, user_role } from '@prisma/client';
import { generateUserId } from '../src/lib/id-generator';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Usage: doppler run --config local -- npx ts-node scripts/set-admin.ts <email>');
    process.exit(1);
  }

  console.log(`Looking for user: ${email.toLowerCase()}`);
  
  let user = await prisma.users.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    console.log(`User not found. Creating new user: ${email}`);
    
    // Create the user with PLATFORM_ADMIN role
    user = await prisma.users.create({
      data: {
        id: generateUserId(),
        email: email.toLowerCase(),
        password_hash: '', // No password for OAuth users
        first_name: null,
        last_name: null,
        role: user_role.PLATFORM_ADMIN,
        is_active: true,
        email_verified: true, // Assume verified since coming from Auth0
        last_login: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    console.log(`✅ Created new user with PLATFORM_ADMIN role: ${user.email}`);
  } else {
    console.log(`Found existing user: ${user.id} - ${user.email} - Current role: ${user.role}`);
    
    // Update to PLATFORM_ADMIN if not already
    if (user.role !== user_role.PLATFORM_ADMIN) {
      const updated = await prisma.users.update({
        where: { id: user.id },
        data: { 
          role: user_role.PLATFORM_ADMIN,
          updated_at: new Date(),
        },
      });
      
      console.log(`✅ Updated user role to PLATFORM_ADMIN: ${updated.email}`);
    } else {
      console.log(`✅ User already has PLATFORM_ADMIN role`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
