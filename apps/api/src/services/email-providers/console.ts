import { EmailProvider, SendEmailParams, EmailResult } from '../email-service';

export class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📧 EMAIL SENT (Console Provider)');
      console.log('='.repeat(80));
      console.log(`To: ${params.to}`);
      console.log(`From: ${params.from || 'noreply@visibleshelf.store'}`);
      console.log(`Subject: ${params.subject}`);
      console.log('-'.repeat(80));
      
      if (params.text) {
        console.log('TEXT VERSION:');
        console.log(params.text);
        console.log('-'.repeat(80));
      }
      
      console.log('HTML VERSION:');
      console.log(this.stripHtml(params.html));
      console.log('-'.repeat(80));
      console.log('HTML SOURCE:');
      console.log(params.html.substring(0, 500) + (params.html.length > 500 ? '...' : ''));
      console.log('='.repeat(80));
      console.log('📧 END EMAIL');
      console.log('='.repeat(80) + '\n');
      
      return {
        success: true,
        messageId: `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        provider: 'console',
      };
    } catch (error: any) {
      console.error('[Console] Email logging failed:', error);
      
      return {
        success: false,
        error: error.message || 'Console logging failed',
        provider: 'console',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    console.log('[Console Email Provider] Configuration is always valid for development');
    return true;
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
      .replace(/\s+/g, ' ')
      .trim();
  }
}
