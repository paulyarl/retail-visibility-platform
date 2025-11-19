// Direct Mailtrap API test (bypasses TypeScript compilation issues)
require('dotenv').config();

async function testMailtrapDirect() {
  console.log('🧪 Testing Mailtrap API Integration...\n');
  
  const apiToken = process.env.MAILTRAP_API_TOKEN;
  const fromEmail = process.env.MAILTRAP_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@rvp-platform.com';
  const fromName = process.env.MAILTRAP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'RVP Platform';
  
  console.log('Configuration:');
  console.log('   API Token:', apiToken ? '✅ Set' : '❌ Missing');
  console.log('   From Email:', fromEmail);
  console.log('   From Name:', fromName);
  
  if (!apiToken) {
    console.log('\n❌ MAILTRAP_API_TOKEN not found in environment');
    return;
  }
  
  try {
    // Test 1: Validate API token
    console.log('\n1. Validating API token...');
    const accountResponse = await fetch('https://mailtrap.io/api/accounts', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!accountResponse.ok) {
      console.log('   ❌ API token validation failed:', accountResponse.status);
      return;
    }
    
    const accountData = await accountResponse.json();
    console.log('   ✅ API token valid');
    console.log('   Account:', accountData[0]?.name || 'Unknown');
    
    // Test 2: Check sending domains
    console.log('\n2. Checking sending domains...');
    const domainsResponse = await fetch('https://mailtrap.io/api/accounts/' + accountData[0].id + '/domains', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (domainsResponse.ok) {
      const domains = await domainsResponse.json();
      console.log('   Available domains:', domains.length > 0 ? domains.map(d => d.name).join(', ') : 'None configured');
      
      if (domains.length === 0) {
        console.log('   ⚠️  No verified domains found. You may need to verify a domain first.');
        console.log('   📋 Go to https://mailtrap.io/sending-domains to add a domain');
      }
    }

    // Test 3: Send simple test email
    console.log('\n3. Sending test email...');
    const testEmailData = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: [
        {
          email: 'test@example.com',
        },
      ],
      subject: 'Test Email from RVP Platform',
      html: '<h1>Test Email</h1><p>If you received this, Mailtrap integration is working!</p>',
      text: 'Test Email\n\nIf you received this, Mailtrap integration is working!',
      category: 'Integration Test',
    };

    const emailResponse = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEmailData),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      console.log('   ❌ Test email failed:', emailResponse.status, errorData.message || errorData.errors?.[0]?.message || emailResponse.statusText);
      console.log('   💡 This might be because:');
      console.log('      - The sending domain is not verified');
      console.log('      - The API token doesn\'t have sending permissions');
      console.log('      - The from email domain needs to be verified');
      return;
    }

    const emailResult = await emailResponse.json();
    console.log('   ✅ Test email sent successfully');
    console.log('   Message ID:', emailResult.message_id);
    
    // Test 3: Send invitation email
    console.log('\n3. Sending invitation email...');
    const invitationHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>You're Invited!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .cta-button { display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; }
        .details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <h1>You're Invited!</h1>
        </div>
        <p>Join Demo Store and start collaborating</p>
    </div>
    
    <p>Hi there,</p>
    
    <p><strong>Platform Admin</strong> has invited you to join <strong>Demo Store</strong> on our platform. You'll have <strong>member</strong> access to help manage and grow the business.</p>
    
    <div class="details">
        <p><strong>Organization:</strong> Demo Store</p>
        <p><strong>Your Role:</strong> Member</p>
        <p><strong>Invited by:</strong> Platform Admin</p>
        <p><strong>Expires:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000/accept-invitation?token=test-token-123" class="cta-button">Accept Invitation</a>
    </div>
    
    <p>This invitation expires in 7 days. If you have any questions, feel free to reach out to Platform Admin or our support team.</p>
    
    <hr style="margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">
        This invitation was sent to test@example.com<br>
        If you didn't expect this invitation, you can safely ignore this email.
    </p>
</body>
</html>`;

    const invitationEmailData = {
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: [
        {
          email: 'invited-user@example.com',
        },
      ],
      subject: "You're invited to join Demo Store",
      html: invitationHtml,
      text: `You're invited to join Demo Store!\n\nPlatform Admin has invited you to join Demo Store with member access.\n\nAccept your invitation: http://localhost:3000/accept-invitation?token=test-token-123\n\nThis invitation expires in 7 days.`,
      category: 'Invitation',
    };

    const invitationResponse = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invitationEmailData),
    });

    if (!invitationResponse.ok) {
      const errorData = await invitationResponse.json().catch(() => ({}));
      console.log('   ❌ Invitation email failed:', invitationResponse.status, errorData.message || invitationResponse.statusText);
      return;
    }

    const invitationResult = await invitationResponse.json();
    console.log('   ✅ Invitation email sent successfully');
    console.log('   Message ID:', invitationResult.message_id);
    
    console.log('\n🎉 Mailtrap integration test complete!');
    console.log('📧 Check your Mailtrap inbox at: https://mailtrap.io/inboxes');
    console.log('📋 Both test emails should appear in your Mailtrap inbox');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testMailtrapDirect();
