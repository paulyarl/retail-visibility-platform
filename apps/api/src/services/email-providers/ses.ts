import { EmailProvider, SendEmailParams, EmailResult } from '../email-service';

export class SESEmailProvider implements EmailProvider {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.region = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1';
    this.accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@visibleshelf.store';
    this.fromName = process.env.AWS_SES_FROM_NAME || process.env.EMAIL_FROM_NAME || 'RVP Platform';
  }

  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      if (!this.accessKeyId || !this.secretAccessKey) {
        throw new Error('AWS SES credentials not configured');
      }

      const ses = await this.getSESClient();
      
      const emailParams = {
        Source: `${this.fromName} <${params.from || this.fromEmail}>`,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: params.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: params.text || this.stripHtml(params.html),
              Charset: 'UTF-8',
            },
          },
        },
      };

      const result = await ses.sendEmail(emailParams).promise();
      
      return {
        success: true,
        messageId: result.MessageId || 'unknown',
        provider: 'aws-ses',
      };
    } catch (error: any) {
      console.error('[AWS SES] Email send failed:', error);
      
      return {
        success: false,
        error: error.message || 'AWS SES send failed',
        provider: 'aws-ses',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      if (!this.accessKeyId || !this.secretAccessKey) {
        console.error('[AWS SES] Credentials not configured');
        return false;
      }

      if (!this.fromEmail) {
        console.error('[AWS SES] From email not configured');
        return false;
      }

      // Test credentials by checking sending quota
      const ses = await this.getSESClient();
      await ses.getSendQuota().promise();
      
      console.log('[AWS SES] Configuration validated successfully');
      return true;
    } catch (error) {
      console.error('[AWS SES] Configuration validation error:', error);
      return false;
    }
  }

  private async getSESClient() {
    try {
      // Dynamic import to avoid requiring AWS SDK when not used
      const AWS = require('aws-sdk');
      
      AWS.config.update({
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });

      return new AWS.SES({ apiVersion: '2010-12-01' });
    } catch (error) {
      throw new Error('AWS SDK not installed. Run: npm install aws-sdk');
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
