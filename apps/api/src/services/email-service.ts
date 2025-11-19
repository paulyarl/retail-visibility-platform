import { SendGridEmailProvider } from './email-providers/sendgrid';
import { SESEmailProvider } from './email-providers/ses';
import { ConsoleEmailProvider } from './email-providers/console';
import { MailtrapEmailProvider } from './email-providers/mailtrap';
import { emailTrackingService } from './email-tracking.service';

export interface EmailProvider {
  sendEmail(params: SendEmailParams): Promise<EmailResult>;
  validateConfig(): Promise<boolean>;
}

export interface SendEmailParams {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  templateData?: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  trackingId?: string;
}

export interface InvitationEmailData {
  inviteeEmail: string;
  inviteeName?: string;
  inviterName: string;
  tenantName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
}

class EmailService {
  private providers: Map<string, EmailProvider> = new Map();
  private primaryProvider: string;
  private fallbackProviders: string[];

  constructor() {
    this.initializeProviders();
    this.primaryProvider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'console';
    this.fallbackProviders = this.getFallbackProviders();
  }

  private initializeProviders(): void {
    this.providers.set('sendgrid', new SendGridEmailProvider());
    this.providers.set('ses', new SESEmailProvider());
    this.providers.set('aws-ses', new SESEmailProvider());
    this.providers.set('mailtrap', new MailtrapEmailProvider());
    this.providers.set('console', new ConsoleEmailProvider());
  }

  private getFallbackProviders(): string[] {
    const fallbacks = process.env.EMAIL_FALLBACK_PROVIDERS?.split(',').map(p => p.trim().toLowerCase()) || [];
    
    // Default fallback order if not specified
    if (fallbacks.length === 0) {
      switch (this.primaryProvider) {
        case 'sendgrid':
          return ['ses', 'mailtrap', 'console'];
        case 'ses':
        case 'aws-ses':
          return ['sendgrid', 'mailtrap', 'console'];
        case 'mailtrap':
          return ['sendgrid', 'ses', 'console'];
        default:
          return ['console'];
      }
    }
    
    return fallbacks;
  }

  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    const providersToTry = [this.primaryProvider, ...this.fallbackProviders];
    let lastError: string = '';

    for (const providerName of providersToTry) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        // Validate provider configuration
        const isValid = await provider.validateConfig();
        if (!isValid) {
          console.warn(`[Email Service] Provider ${providerName} configuration invalid, skipping`);
          continue;
        }

        // Attempt to send email
        const result = await provider.sendEmail(params);
        
        if (result.success && result.messageId) {
          // Track successful email
          const trackingId = await emailTrackingService.trackEmail({
            messageId: result.messageId,
            provider: providerName,
            recipient: params.to,
            subject: params.subject,
            status: 'sent',
          });

          console.log(`[Email Service] ✅ Email sent via ${providerName} to ${params.to}`);
          
          return {
            ...result,
            provider: providerName,
            trackingId,
          };
        } else {
          lastError = result.error || 'Unknown error';
          console.warn(`[Email Service] Provider ${providerName} failed: ${lastError}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Email Service] Provider ${providerName} threw error:`, error);
      }
    }

    // All providers failed
    console.error(`[Email Service] ❌ All providers failed. Last error: ${lastError}`);
    
    return {
      success: false,
      error: `All email providers failed. Last error: ${lastError}`,
      provider: 'none',
    };
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<EmailResult> {
    const { html, text, subject } = this.generateInvitationTemplate(data);

    return this.sendEmail({
      to: data.inviteeEmail,
      subject,
      html,
      text,
      templateData: data,
    });
  }

  /**
   * Switch primary email provider
   */
  async switchProvider(newProvider: string): Promise<boolean> {
    const provider = this.providers.get(newProvider.toLowerCase());
    if (!provider) {
      console.error(`[Email Service] Provider ${newProvider} not found`);
      return false;
    }

    try {
      const isValid = await provider.validateConfig();
      if (!isValid) {
        console.error(`[Email Service] Provider ${newProvider} configuration invalid`);
        return false;
      }

      this.primaryProvider = newProvider.toLowerCase();
      console.log(`[Email Service] ✅ Switched to provider: ${newProvider}`);
      return true;
    } catch (error) {
      console.error(`[Email Service] Failed to switch to ${newProvider}:`, error);
      return false;
    }
  }

  /**
   * Get current provider status
   */
  async getProviderStatus(): Promise<Record<string, { available: boolean; primary: boolean }>> {
    const status: Record<string, { available: boolean; primary: boolean }> = {};

    for (const [name, provider] of this.providers) {
      try {
        const available = await provider.validateConfig();
        status[name] = {
          available,
          primary: name === this.primaryProvider,
        };
      } catch (error) {
        status[name] = {
          available: false,
          primary: name === this.primaryProvider,
        };
      }
    }

    return status;
  }

  /**
   * Test email delivery for all configured providers
   */
  async testAllProviders(testEmail: string): Promise<Record<string, EmailResult>> {
    const results: Record<string, EmailResult> = {};

    for (const [name, provider] of this.providers) {
      if (name === 'console') continue; // Skip console for real tests

      try {
        const isValid = await provider.validateConfig();
        if (!isValid) {
          results[name] = {
            success: false,
            error: 'Configuration invalid',
            provider: name,
          };
          continue;
        }

        const result = await provider.sendEmail({
          to: testEmail,
          subject: `Test Email from ${name.toUpperCase()} Provider`,
          html: `<h1>Test Email</h1><p>This is a test email sent via the ${name} provider.</p>`,
          text: `Test Email - This is a test email sent via the ${name} provider.`,
        });

        results[name] = result;
      } catch (error) {
        results[name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          provider: name,
        };
      }
    }

    return results;
  }

  private generateInvitationTemplate(data: InvitationEmailData): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = `You're invited to join ${data.tenantName}`;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation to ${data.tenantName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
        .title {
            color: #1a202c;
            font-size: 28px;
            font-weight: 700;
            margin: 0;
        }
        .subtitle {
            color: #718096;
            font-size: 16px;
            margin: 8px 0 0 0;
        }
        .invitation-details {
            background: #f7fafc;
            border-radius: 8px;
            padding: 24px;
            margin: 30px 0;
            border-left: 4px solid #667eea;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .detail-row:last-child {
            margin-bottom: 0;
        }
        .detail-label {
            font-weight: 600;
            color: #4a5568;
        }
        .detail-value {
            color: #2d3748;
            font-weight: 500;
        }
        .role-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            text-transform: capitalize;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 30px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
            font-size: 14px;
        }
        .expires-warning {
            background: #fef5e7;
            border: 1px solid #f6ad55;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            color: #744210;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 20px;
            }
            .detail-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">📧</div>
            <h1 class="title">You're Invited!</h1>
            <p class="subtitle">Join ${data.tenantName} and start collaborating</p>
        </div>

        <p>Hi${data.inviteeName ? ` ${data.inviteeName}` : ''},</p>
        
        <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.tenantName}</strong> on our platform. You'll have <strong>${data.role.toLowerCase()}</strong> access to help manage and grow the business.</p>

        <div class="invitation-details">
            <div class="detail-row">
                <span class="detail-label">Organization:</span>
                <span class="detail-value">${data.tenantName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Your Role:</span>
                <span class="role-badge">${data.role.toLowerCase()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Invited by:</span>
                <span class="detail-value">${data.inviterName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Expires:</span>
                <span class="detail-value">${data.expiresAt.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
            </div>
        </div>

        <div style="text-align: center;">
            <a href="${data.acceptUrl}" class="cta-button">Accept Invitation</a>
        </div>

        <div class="expires-warning">
            ⏰ <strong>This invitation expires in 7 days.</strong> Make sure to accept it before ${data.expiresAt.toLocaleDateString()}.
        </div>

        <p>If you have any questions, feel free to reach out to ${data.inviterName} or our support team.</p>

        <div class="footer">
            <p>This invitation was sent to ${data.inviteeEmail}</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <p style="margin-top: 20px;">
                <a href="${data.acceptUrl}" style="color: #667eea;">Accept Invitation</a>
            </p>
        </div>
    </div>
</body>
</html>`;

    const text = `
You're invited to join ${data.tenantName}!

Hi${data.inviteeName ? ` ${data.inviteeName}` : ''},

${data.inviterName} has invited you to join ${data.tenantName} with ${data.role.toLowerCase()} access.

Invitation Details:
- Organization: ${data.tenantName}
- Your Role: ${data.role}
- Invited by: ${data.inviterName}
- Expires: ${data.expiresAt.toLocaleDateString()}

To accept this invitation, click the link below:
${data.acceptUrl}

This invitation expires in 7 days (${data.expiresAt.toLocaleDateString()}).

If you have any questions, feel free to reach out to ${data.inviterName} or our support team.

This invitation was sent to ${data.inviteeEmail}. If you didn't expect this invitation, you can safely ignore this email.
`;

    return { subject, html, text };
  }

  /**
   * Validate current primary provider configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      const provider = this.providers.get(this.primaryProvider);
      if (!provider) return false;
      return await provider.validateConfig();
    } catch (error) {
      console.error('[Email Service] Configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Send test email using current primary provider
   */
  async testEmail(to: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Test Email from RVP Platform',
      html: '<h1>Test Email</h1><p>If you received this, email configuration is working!</p>',
      text: 'Test Email\n\nIf you received this, email configuration is working!',
    });
  }
}

export const emailService = new EmailService();
