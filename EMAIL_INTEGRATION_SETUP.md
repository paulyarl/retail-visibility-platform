# 📧 Email Integration Setup Guide

## 🎯 **Overview**

Complete email integration system with support for **SendGrid**, **AWS SES**, and **Console** (development) providers. Includes professional invitation email templates and testing endpoints.

## 🚀 **Quick Start**

### **1. Install Dependencies**

```bash
cd apps/api
npm install @sendgrid/mail aws-sdk
```

### **2. Environment Configuration**

Add to your `.env` file:

```bash
# Email Configuration
EMAIL_PROVIDER=console
# Options: console, sendgrid, ses (aws-ses)

# General Email Settings (fallback for all providers)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your Platform Name
FRONTEND_URL=http://localhost:3000
```

### **3. Provider-Specific Setup**

#### **SendGrid Setup**
```bash
# SendGrid Configuration
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Your Platform Name
```

#### **AWS SES Setup**
```bash
# AWS SES Configuration
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SES_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_FROM_NAME=Your Platform Name
```

## 📋 **Provider Setup Instructions**

### **SendGrid Setup**

1. **Create SendGrid Account**
   - Go to [SendGrid.com](https://sendgrid.com)
   - Sign up for free account (100 emails/day)

2. **Create API Key**
   - Go to Settings → API Keys
   - Create new API key with "Full Access"
   - Copy the API key (shown only once)

3. **Verify Domain/Email**
   - Go to Settings → Sender Authentication
   - Verify your sending domain or email address

4. **Update Environment**
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your_api_key_here
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```

### **AWS SES Setup**

1. **AWS Account Setup**
   - Create AWS account if needed
   - Go to AWS SES console

2. **Verify Email/Domain**
   - Go to "Verified identities"
   - Add and verify your sending email/domain

3. **Create IAM User**
   - Go to IAM → Users → Create user
   - Attach policy: `AmazonSESFullAccess`
   - Create access keys

4. **Request Production Access** (if needed)
   - SES starts in sandbox mode (verified emails only)
   - Request production access to send to any email

5. **Update Environment**
   ```bash
   EMAIL_PROVIDER=ses
   AWS_SES_REGION=us-east-1
   AWS_SES_ACCESS_KEY_ID=your_access_key
   AWS_SES_SECRET_ACCESS_KEY=your_secret_key
   AWS_SES_FROM_EMAIL=noreply@yourdomain.com
   ```

## 🧪 **Testing**

### **1. Console Provider (Development)**
```bash
EMAIL_PROVIDER=console
```
- Emails logged to console
- No external dependencies
- Perfect for development

### **2. Test Endpoints**

```bash
# Check email configuration
GET /api/email/config

# Send test email
POST /api/email/test
{
  "to": "test@example.com"
}

# Send test invitation
POST /api/email/test-invitation
{
  "to": "test@example.com"
}
```

### **3. Manual Testing**

```javascript
// Test the email service directly
const { emailService } = require('./src/services/email-service');

// Test configuration
const isValid = await emailService.validateConfiguration();
console.log('Email config valid:', isValid);

// Send test email
const result = await emailService.testEmail('your-email@example.com');
console.log('Test result:', result);
```

## 📧 **Email Templates**

### **Invitation Email Features**

- **Professional Design** - Modern, responsive HTML template
- **Mobile Optimized** - Looks great on all devices
- **Brand Consistent** - Customizable colors and branding
- **Clear CTA** - Prominent "Accept Invitation" button
- **Security Info** - Expiration dates and security notices
- **Fallback Text** - Plain text version for all clients

### **Template Variables**

```typescript
interface InvitationEmailData {
  inviteeEmail: string;
  inviteeName?: string;
  inviterName: string;
  tenantName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
}
```

## 🔧 **Integration Points**

### **Invitation System Integration**

The email service is automatically integrated with the invitation system:

```typescript
// When sending an invitation
const emailResult = await emailService.sendInvitationEmail({
  inviteeEmail: 'user@example.com',
  inviterName: 'John Doe',
  tenantName: 'Acme Store',
  role: 'MEMBER',
  acceptUrl: 'https://yourapp.com/accept-invitation?token=abc123',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});
```

### **Error Handling**

- Email failures don't break invitation creation
- Errors logged for debugging
- Graceful fallbacks for all providers

## 📊 **Provider Comparison**

| Feature | Console | SendGrid | AWS SES |
|---------|---------|----------|---------|
| **Cost** | Free | Free tier: 100/day | Free tier: 200/day |
| **Setup** | None | Easy | Moderate |
| **Reliability** | N/A | High | High |
| **Analytics** | None | Advanced | Basic |
| **Templates** | None | Advanced | Basic |
| **Production Ready** | No | Yes | Yes |

## 🚨 **Production Checklist**

### **Before Going Live**

- [ ] Choose production email provider (SendGrid or SES)
- [ ] Verify sending domain/email
- [ ] Set up proper DNS records (SPF, DKIM, DMARC)
- [ ] Test email delivery to major providers (Gmail, Outlook, etc.)
- [ ] Configure monitoring and alerts
- [ ] Set up email bounce/complaint handling
- [ ] Update `FRONTEND_URL` to production domain

### **Security Best Practices**

- [ ] Use environment variables for all credentials
- [ ] Rotate API keys regularly
- [ ] Monitor for suspicious sending patterns
- [ ] Implement rate limiting on email endpoints
- [ ] Use HTTPS for all callback URLs

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Emails not sending**
   - Check API credentials
   - Verify sender email/domain
   - Check provider status pages

2. **Emails going to spam**
   - Set up SPF, DKIM, DMARC records
   - Use verified sending domain
   - Avoid spam trigger words

3. **Template not rendering**
   - Check HTML validity
   - Test in multiple email clients
   - Verify template data

### **Debug Commands**

```bash
# Check configuration
curl http://localhost:4000/api/email/config

# Send test email
curl -X POST http://localhost:4000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

## 📈 **Monitoring & Analytics**

### **Key Metrics to Track**

- Email delivery rate
- Open rates (if supported by provider)
- Click-through rates on invitation links
- Bounce rates
- Complaint rates

### **Logging**

All email operations are logged with:
- Timestamp
- Provider used
- Recipient email
- Success/failure status
- Error messages (if any)

## 🎨 **Customization**

### **Email Template Customization**

Edit `src/services/email-service.ts` to customize:
- Colors and branding
- Logo and images
- Email copy and messaging
- Button styles
- Footer information

### **Adding New Providers**

1. Create new provider in `src/services/email-providers/`
2. Implement `EmailProvider` interface
3. Add to provider factory in `email-service.ts`
4. Update environment configuration

---

## ✅ **Ready for Production!**

Your email integration is now complete with:
- ✅ **Multiple provider support** (SendGrid, AWS SES, Console)
- ✅ **Professional templates** with responsive design
- ✅ **Comprehensive testing** endpoints and utilities
- ✅ **Production-ready** error handling and logging
- ✅ **Easy configuration** via environment variables

The invitation system will now send beautiful, professional emails to invited users! 🎉
