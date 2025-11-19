import { prisma } from './src/prisma.ts';

async function testPrisma() {
  console.log('=== PRISMA CLIENT TEST ===');
  console.log('Prisma client exists:', !!prisma);
  console.log('Has user model:', !!prisma.user);
  console.log('Has users model:', !!prisma.users);
  console.log('Has user_tenants model:', !!prisma.user_tenants);

  // List all available models
  console.log('\n=== AVAILABLE MODELS ===');
  const models = Object.keys(prisma).filter(key => 
    typeof prisma[key] === 'object' && 
    prisma[key] !== null && 
    !key.startsWith('$') && 
    !key.startsWith('_')
  );
  console.log('Models found:', models);

  // Test user-related models specifically
  console.log('\n=== USER-RELATED MODELS ===');
  const userModels = models.filter(m => m.toLowerCase().includes('user'));
  console.log('User models:', userModels);

  process.exit(0);
}

testPrisma();
