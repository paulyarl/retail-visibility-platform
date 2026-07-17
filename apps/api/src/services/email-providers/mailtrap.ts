import { EmailProvider, SendEmailParams, EmailResult } from '../email-service';
import { logger } from '../../logger';

export class MailtrapEmailProvider implements EmailProvider {
  private apiToken: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiToken = process.env.MAILTRAP_API_TOKEN || '';
    this.fromEmail = process.env.MAILTRAP_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@visibleshelf.store';
    this.fromName = process.env.MAILTRAP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'Visible Shelf Platform';
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
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(`Mailtrap API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json() as { message_id?: string };
      
      return {
        success: true,
        messageId: result.message_id || 'unknown',
        provider: 'mailtrap',
      };
    } catch (error: any) {
      logger.error('[Mailtrap] Email send failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      
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
        logger.error('[Mailtrap] API token not configured', undefined);
        return false;
      }

      if (!this.fromEmail) {
        logger.error('[Mailtrap] From email not configured', undefined);
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
        logger.error('[Mailtrap] API token validation failed:', undefined, { error: { name: 'Error', message: String(response.status) } });
        return false;
      }

      console.log('[Mailtrap] Configuration validated successfully');
      return true;
    } catch (error) {
      logger.error('[Mailtrap] Configuration validation error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
