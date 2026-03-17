/**
 * Set user as PLATFORM_ADMIN
 * 
 * Usage: npx ts-node scripts/set-admin.ts <email>
 */

import { PrismaClient, user_role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Usage: npx ts-node scripts/set-admin.ts <email>');
    process.exit(1);
  }

  const user = await prisma.users.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.id} - ${user.email} - Current role: ${user.role}`);

  const updated = await prisma.users.update({
    where: { id: user.id },
    data: { 
      role: user_role.PLATFORM_ADMIN,
      updated_at: new Date(),
    },
  });

  console.log(`✅ Updated user role to PLATFORM_ADMIN: ${updated.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
