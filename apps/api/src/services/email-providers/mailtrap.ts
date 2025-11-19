import { EmailProvider, SendEmailParams, EmailResult } from '../email-service';

export class MailtrapEmailProvider implements EmailProvider {
  private apiToken: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiToken = process.env.MAILTRAP_API_TOKEN || '';
    this.fromEmail = process.env.MAILTRAP_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@yourplatform.com';
    this.fromName = process.env.MAILTRAP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'RVP Platform';
  }

  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      if (!this.apiToken) {
        throw new Error('Mailtrap API token not configured');
      }

      const emailData = {
        from: {
          email: params.from || this.fromEmail,
          name: this.fromName,
        },
        to: [
          {
            email: params.to,
          },
        ],
        subject: params.subject,
        html: params.html,
        text: params.text || this.stripHtml(params.html),
        category: 'Integration Test',
      };

      const response = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mailtrap API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        messageId: result.message_id || 'unknown',
        provider: 'mailtrap',
      };
    } catch (error: any) {
      console.error('[Mailtrap] Email send failed:', error);
      
      return {
        success: false,
        error: error.message || 'Mailtrap send failed',
        provider: 'mailtrap',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.apiToken) {
        console.error('[Mailtrap] API token not configured');
        return false;
      }

      if (!this.fromEmail) {
        console.error('[Mailtrap] From email not configured');
        return false;
      }

      // Test API token by checking account info
      const response = await fetch('https://mailtrap.io/api/accounts', {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Mailtrap] API token validation failed:', response.status);
        return false;
      }

      console.log('[Mailtrap] Configuration validated successfully');
      return true;
    } catch (error) {
      console.error('[Mailtrap] Configuration validation error:', error);
      return false;
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
