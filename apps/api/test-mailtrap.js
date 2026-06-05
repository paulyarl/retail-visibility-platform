// Simple test script for Mailtrap email integration
require('dotenv').config();

async function testMailtrap() {
  console.log('🧪 Testing Mailtrap Email Integration...\n');
  
  try {
    // Test 1: Check configuration
    console.log('1. Checking configuration...');
    console.log('   EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
    console.log('   MAILTRAP_API_TOKEN:', process.env.MAILTRAP_API_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('   FROM_EMAIL:', process.env.MAILTRAP_FROM_EMAIL || process.env.EMAIL_FROM);
    console.log('   FROM_NAME:', process.env.MAILTRAP_FROM_NAME || process.env.EMAIL_FROM_NAME);
    
    // Test 2: Load email service
    console.log('\n2. Loading email service...');
    const { emailService } = require('./src/services/email-service');
    console.log('   ✅ Email service loaded');
    
    // Test 3: Validate configuration
    console.log('\n3. Validating configuration...');
    const isValid = await emailService.validateConfiguration();
    console.log('   Configuration valid:', isValid ? '✅' : '❌');
    
    if (!isValid) {
      console.log('   ❌ Configuration invalid - check your API token');
      return;
    }
    
    // Test 4: Send test email
    console.log('\n4. Sending test email...');
    const testResult = await emailService.testEmail('test@example.com');
    console.log('   Send result:', testResult.success ? '✅' : '❌');
    console.log('   Provider:', testResult.provider);
    console.log('   Message ID:', testResult.messageId);
    if (testResult.error) {
      console.log('   Error:', testResult.error);
    }
    
    // Test 5: Send test invitation
    console.log('\n5. Sending test invitation email...');
    const invitationResult = await emailService.sendInvitationEmail({
      inviteeEmail: 'invited-user@example.com',
      inviteeName: 'Test User',
      inviterName: 'Platform Admin',
      tenantName: 'Demo Store',
      role: 'MEMBER',
      acceptUrl: 'http://localhost:3000/accept-invitation?token=test-token-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    
    console.log('   Invitation result:', invitationResult.success ? '✅' : '❌');
    console.log('   Provider:', invitationResult.provider);
    console.log('   Message ID:', invitationResult.messageId);
    if (invitationResult.error) {
      console.log('   Error:', invitationResult.error);
    }
    
    console.log('\n🎉 Mailtrap integration test complete!');
    console.log('📧 Check your Mailtrap inbox at: https://mailtrap.io/inboxes');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMailtrap();
