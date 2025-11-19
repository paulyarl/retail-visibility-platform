import { EmailProvider, SendEmailParams, EmailResult } from '../email-service';

export class SendGridEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@yourplatform.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || process.env.EMAIL_FROM_NAME || 'RVP Platform';
  }

  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      if (!this.apiKey) {
        throw new Error('SendGrid API key not configured');
      }

      const sgMail = await this.getSendGridClient();
      
      const message = {
        to: params.to,
        from: {
          email: params.from || this.fromEmail,
          name: this.fromName,
        },
        subject: params.subject,
        html: params.html,
        text: params.text || this.stripHtml(params.html),
      };

      const [response] = await sgMail.send(message);
      
      return {
        success: true,
        messageId: response.headers['x-message-id'] || 'unknown',
        provider: 'sendgrid',
      };
    } catch (error: any) {
      console.error('[SendGrid] Email send failed:', error);
      
      return {
        success: false,
        error: error.message || 'SendGrid send failed',
        provider: 'sendgrid',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.error('[SendGrid] API key not configured');
        return false;
      }

      if (!this.fromEmail) {
        console.error('[SendGrid] From email not configured');
        return false;
      }

      // Test API key by making a simple API call
      const response = await fetch('https://api.sendgrid.com/v3/user/account', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[SendGrid] API key validation failed:', response.status);
        return false;
      }

      console.log('[SendGrid] Configuration validated successfully');
      return true;
    } catch (error) {
      console.error('[SendGrid] Configuration validation error:', error);
      return false;
    }
  }

  private async getSendGridClient() {
    try {
      // Dynamic import to avoid requiring SendGrid when not used
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.apiKey);
      return sgMail;
    } catch (error) {
      throw new Error('SendGrid package not installed. Run: npm install @sendgrid/mail');
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
