const { PrismaClient } = require('@prisma/client');

async function clearBadSessions() {
  const prisma = new PrismaClient();

  try {
    // Clear all existing sessions with bad/incorrect data
    const result = await prisma.$executeRaw`DELETE FROM user_sessions_list`;

    console.log(`✅ Cleared ${result} sessions with incorrect data`);
    console.log('📝 Now try logging in again to create sessions with correct data');

  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearBadSessions();
