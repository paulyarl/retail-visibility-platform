/**
 * Debug script to check what's actually in the security_alerts table
 */

import { prisma } from './prisma';

async function debugAlerts() {
  console.log('🔍 Debugging Security Alerts Database');
  console.log('=====================================');

  try {
    // Get all recent alerts with their user_id values
    const allAlerts = await prisma.security_alerts.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        user_id: true,
        type: true,
        severity: true,
        title: true,
        created_at: true,
        metadata: true
      }
    });

    console.log(`\n📊 Found ${allAlerts.length} recent alerts:`);
    allAlerts.forEach((alert, index) => {
      console.log(`   ${index + 1}. ID: ${alert.id}`);
      console.log(`      User ID: ${alert.user_id}`);
      console.log(`      Type: ${alert.type}`);
      console.log(`      Title: ${alert.title}`);
      console.log(`      Created: ${alert.created_at.toISOString()}`);
      console.log(`      Has telemetrySource: ${alert.metadata?.telemetrySource ? 'YES' : 'NO'}`);
      console.log('');
    });

    // Count alerts by user_id
    const counts = await prisma.security_alerts.groupBy({
      by: ['user_id'],
      _count: { user_id: true },
      orderBy: { _count: { user_id: 'desc' } }
    });

    console.log('\n📈 Alerts by User ID:');
    counts.forEach((count) => {
      console.log(`   User ID: ${count.user_id || 'NULL'}: ${count._count.user_id} alerts`);
    });

    // Check for telemetry events specifically
    const telemetryAlerts = await prisma.security_alerts.count({
      where: {
        metadata: {
          path: ['telemetrySource'],
          equals: 'frontend_batch'
        }
      }
    });

    console.log(`\n📊 Telemetry Events: ${telemetryAlerts}`);

    // Check for null user_id
    const nullUserAlerts = await prisma.security_alerts.count({
      where: {
        user_id: null
      }
    });

    console.log(`📊 Null User ID Alerts: ${nullUserAlerts}`);

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  debugAlerts();
}

export { debugAlerts };
