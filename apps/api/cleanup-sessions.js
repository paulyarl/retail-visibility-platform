/**
 * Cleanup script to close any old active scan sessions
 * Run with: node cleanup-sessions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupSessions() {
  try {
    // Close all active sessions older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await prisma.scanSession.updateMany({
      where: {
        status: 'active',
        startedAt: {
          lt: oneDayAgo
        }
      },
      data: {
        status: 'cancelled'
      }
    });

    console.log(`✅ Cleaned up ${result.count} old active sessions`);
    
    // Show current active sessions count
    const activeCount = await prisma.scanSession.count({
      where: { status: 'active' }
    });
    
    console.log(`📊 Current active sessions: ${activeCount}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupSessions();
