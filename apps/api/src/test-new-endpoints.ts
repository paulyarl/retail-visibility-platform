/**
 * Test script for new v3.6.2-prep endpoints
 * Run with: npx ts-node src/test-new-endpoints.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFeedPushJobs() {
  console.log('\n🧪 Testing FeedPushJob Model...\n');

  try {
    // 1. Create a test job
    console.log('1. Creating test feed push job...');
    const job = await prisma.feedPushJobs.create({
      data: {
        tenantId: 'test-tenant-id',
        sku: 'TEST-SKU-001',
        jobStatus: 'queued',
        payload: {
          feedType: 'full',
          itemCount: 100,
        },
      },
    });
    console.log('✅ Job created:', job.id);

    // 2. List jobs
    console.log('\n2. Listing all jobs...');
    const jobs = await prisma.feedPushJobs.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log(`✅ Found ${jobs.length} jobs`);

    // 3. Update job status
    console.log('\n3. Updating job status to processing...');
    const updatedJob = await prisma.feedPushJobs.update({
      where: { id: job.id },
      data: {
        jobStatus: 'processing',
        lastAttempt: new Date(),
      },
    });
    console.log('✅ Job updated:', updatedJob.jobStatus);

    // 4. Mark as success
    console.log('\n4. Marking job as success...');
    const completedJob = await prisma.feedPushJobs.update({
      where: { id: job.id },
      data: {
        jobStatus: 'success',
        completed_at: new Date(),
        result: {
          itemsProcessed: 100,
          successCount: 98,
          errorCount: 2,
        },
      },
    });
    console.log('✅ Job completed:', completedJob.jobStatus);

    // 5. Get job statistics
    console.log('\n5. Getting job statistics...');
    const stats = await prisma.feedPushJobs.groupBy({
      by: ['jobStatus'],
      _count: true,
    });
    console.log('✅ Job stats:');
    stats.forEach(stat => {
      console.log(`   ${stat.jobStatus}: ${stat._count}`);
    });

    // 6. Test retry logic
    console.log('\n6. Testing retry logic...');
    const failedJob = await prisma.feedPushJobs.create({
      data: {
        tenantId: 'test-tenant-id',
        sku: 'TEST-SKU-002',
        jobStatus: 'queued',
      },
    });

    // Simulate failure with retry
    const retriedJob = await prisma.feedPushJobs.update({
      where: { id: failedJob.id },
      data: {
        jobStatus: 'queued',
        retryCount: 1,
        lastAttempt: new Date(),
        nextRetry: new Date(Date.now() + 60000), // 1 minute from now
        errorMessage: 'Connection timeout',
        errorCode: 'TIMEOUT',
      },
    });
    console.log('✅ Job queued for retry:', retriedJob.retryCount, 'attempts');

    // Cleanup test jobs
    console.log('\n7. Cleaning up test jobs...');
    await prisma.feedPushJobs.deleteMany({
      where: {
        tenantId: 'test-tenant-id',
      },
    });
    console.log('✅ Test jobs cleaned up');

    console.log('\n✅ FeedPushJob tests passed!\n');
  } catch (error) {
    console.error('❌ FeedPushJob test failed:', error);
    throw error;
  }
}

async function testOutreachFeedback() {
  console.log('\n🧪 Testing OutreachFeedback Model...\n');

  try {
    // 1. Submit feedback
    console.log('1. Submitting test feedback...');
    const feedback = await prisma.outreachFeedback.create({
      data: {
        tenantId: 'test-tenant-id',
        userId: 'test-user-id',
        feedback: {
          comment: 'Great feature! Very easy to use.',
          features_used: ['category_alignment', 'feed_push'],
          pain_points: [],
          suggestions: ['Add bulk import'],
        },
        score: 5,
        category: 'usability',
        context: 'category_alignment',
      },
    });
    console.log('✅ Feedback submitted:', feedback.id);

    // 2. Submit more feedback with different scores
    console.log('\n2. Submitting additional feedback...');
    await prisma.outreachFeedback.createMany({
      data: [
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          feedback: { comment: 'Good but slow' },
          score: 3,
          category: 'performance',
          context: 'feed_push',
        },
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          feedback: { comment: 'Excellent support!' },
          score: 5,
          category: 'support',
          context: 'onboarding',
        },
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          feedback: { comment: 'Needs more features' },
          score: 4,
          category: 'features',
          context: 'category_alignment',
        },
      ],
    });
    console.log('✅ Additional feedback submitted');

    // 3. Get feedback analytics
    console.log('\n3. Calculating feedback analytics...');
    const allFeedback = await prisma.outreachFeedback.findMany({
      where: { tenantId: 'test-tenant-id' },
    });

    const avgScore = allFeedback.reduce((sum, f) => sum + f.score, 0) / allFeedback.length;
    const positiveCount = allFeedback.filter(f => f.score >= 4).length;
    const satisfactionRate = (positiveCount / allFeedback.length) * 100;

    console.log('✅ Analytics:');
    console.log(`   Total feedback: ${allFeedback.length}`);
    console.log(`   Average score: ${avgScore.toFixed(2)}`);
    console.log(`   Satisfaction rate: ${satisfactionRate.toFixed(2)}%`);

    // 4. Group by category
    console.log('\n4. Grouping feedback by category...');
    const byCategory = await prisma.outreachFeedback.groupBy({
      by: ['category'],
      where: { tenantId: 'test-tenant-id' },
      _count: true,
      _avg: { score: true },
    });
    console.log('✅ By category:');
    byCategory.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count} (avg: ${cat._avg.score?.toFixed(2)})`);
    });

    // 5. Check pilot KPIs
    console.log('\n5. Checking pilot KPIs...');
    const kpis = {
      satisfaction: satisfactionRate >= 80 ? '✅' : '❌',
      avgScore: avgScore >= 4.0 ? '✅' : '❌',
      totalFeedback: allFeedback.length >= 10 ? '✅' : '❌',
    };
    console.log('✅ Pilot KPIs:');
    console.log(`   ${kpis.satisfaction} Satisfaction ≥80%: ${satisfactionRate.toFixed(2)}%`);
    console.log(`   ${kpis.avgScore} Avg Score ≥4.0: ${avgScore.toFixed(2)}`);
    console.log(`   ${kpis.totalFeedback} Total Feedback ≥10: ${allFeedback.length}`);

    // Cleanup test feedback
    console.log('\n6. Cleaning up test feedback...');
    await prisma.outreachFeedback.deleteMany({
      where: { tenantId: 'test-tenant-id' },
    });
    console.log('✅ Test feedback cleaned up');

    console.log('\n✅ OutreachFeedback tests passed!\n');
  } catch (error) {
    console.error('❌ OutreachFeedback test failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting v3.6.2-prep Database Tests\n');
  console.log('=' .repeat(50));

  try {
    await testFeedPushJobs();
    await testOutreachFeedback();

    console.log('=' .repeat(50));
    console.log('\n🎉 All tests passed successfully!\n');
  } catch (error) {
    console.error('\n💥 Tests failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
