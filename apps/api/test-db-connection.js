const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  console.log('Testing database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  
  try {
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Result:', result);
    
    // Test user table
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);
    
    // Test tenant table
    const tenantCount = await prisma.tenant.count();
    console.log(`✅ Found ${tenantCount} tenants in database`);
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.message.includes("Can't reach database server")) {
      console.error('\n🔍 Troubleshooting steps:');
      console.error('1. Check if Supabase project is active (not paused)');
      console.error('2. Verify DATABASE_URL is correct');
      console.error('3. Check network/firewall settings');
      console.error('4. Try direct connection instead of pooler');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
