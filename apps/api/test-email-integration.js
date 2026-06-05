import { emailService } from './src/services/email-service.ts';

async function testEmailIntegration() {
  console.log('🧪 EMAIL INTEGRATION TEST');
  console.log('========================');

  try {
    // Test 1: Check provider status
    console.log('\n1. 📊 Checking provider status...');
    const status = await emailService.getProviderStatus();
    console.log('Provider Status:', status);

    // Test 2: Validate configuration
    console.log('\n2. ✅ Validating configuration...');
    const isValid = await emailService.validateConfiguration();
    console.log('Configuration valid:', isValid);

    // Test 3: Test provider switching
    console.log('\n3. 🔄 Testing provider switching...');
    const switchResult = await emailService.switchProvider('console');
    console.log('Switch to console:', switchResult);

    // Test 4: Send test email
    console.log('\n4. 📧 Sending test email...');
    const emailResult = await emailService.testEmail('test@example.com');
    console.log('Email result:', emailResult);

    // Test 5: Send invitation email
    console.log('\n5. 💌 Testing invitation email...');
    const invitationResult = await emailService.sendInvitationEmail({
      inviteeEmail: 'newuser@example.com',
      inviteeName: 'New User',
      inviterName: 'Admin User',
      tenantName: 'Test Store',
      role: 'MEMBER',
      acceptUrl: 'https://platform.com/accept/abc123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log('Invitation result:', invitationResult);

    console.log('\n🎉 EMAIL INTEGRATION TEST COMPLETED');
    console.log('===================================');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

testEmailIntegration();
