/**
 * Invoice Email Service
 * Sends branded invoice notifications to customers
 */

import { prisma } from '../../prisma';

interface PlatformBranding {
  platformName: string;
  platformDescription: string;
  logoUrl: string;
  faviconUrl: string;
  bannerUrl: string;
  themePreset: string;
  themeColors: {
    accent: string;
    neutral: string;
    primary: string;
    [key: string]: string;
  };
  themeFontFamily: string;
  themeBorderRadius: string;
  themeButtonSize: string;
  themeSpacing: number;
  // Contact information
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactWebsite: string;
  // Social media
  socialFacebook: string;
  socialTwitter: string;
  socialInstagram: string;
  socialLinkedIn: string;
  socialYoutube: string;
}

export interface InvoiceEmailData {
  customerEmail: string;
  customerName: string;
  tenantName?: string;
  invoiceId: string;
  invoiceNumber?: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  tier: string;
  paymentMethod?: string;
  paymentDate?: Date;
  downloadUrl?: string;
}

export class InvoiceEmailService {
  /**
   * Fetch platform branding data
   */
  private async getPlatformBranding(): Promise<PlatformBranding> {
    try {
      // Try to fetch from the public branding endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/platform/branding`);
      if (response.ok) {
        const branding = await response.json();
        return branding as PlatformBranding;
      }
    } catch (error) {
      console.warn('[InvoiceEmailService] Failed to fetch platform branding, using defaults:', error);
    }

    // Fallback to default branding
    return {
      platformName: 'Visible Shelf',
      platformDescription: 'Retail visibility platform empowering local businesses',
      logoUrl: '',
      faviconUrl: '',
      bannerUrl: '',
      themePreset: 'vibrant',
      themeColors: {
        accent: '#f59e0b',
        neutral: '#64748b',
        primary: '#7c3aed',
      },
      themeFontFamily: '"Poppins", sans-serif',
      themeBorderRadius: 'md',
      themeButtonSize: 'md',
      themeSpacing: 16,
      // Contact information
      contactEmail: 'billing@visible-shelf.com',
      contactPhone: '',
      contactAddress: '',
      contactWebsite: 'https://visible-shelf.com',
      // Social media
      socialFacebook: '',
      socialTwitter: '',
      socialInstagram: '',
      socialLinkedIn: '',
      socialYoutube: '',
    };
  }

  /**
   * Send invoice notification email
   */
  async sendInvoiceNotification(data: InvoiceEmailData): Promise<void> {
    console.log('[InvoiceEmailService] Sending invoice notification to:', data.customerEmail);

    const branding = await this.getPlatformBranding();
    const emailHtml = this.generateInvoiceHtml(data, branding);
    const emailText = this.generateInvoiceText(data, branding);

    // Get the email service
    const { emailService } = await import('../email-service');

    const subject = this.getSubject(data.status, data.invoiceNumber);
    
    try {
      const result = await emailService.sendEmail({
        to: data.customerEmail,
        subject,
        html: emailHtml,
        text: emailText,
        from: branding.contactEmail ? `billing@${branding.platformName.toLowerCase().replace(/\s+/g, '-')}.com` : 'billing@visible-shelf.com', // Platform branded from email
      });

      if (result.success) {
        console.log(`[InvoiceEmailService] Invoice email sent successfully to ${data.customerEmail}`);
      } else {
        console.error(`[InvoiceEmailService] Failed to send invoice email:`, result.error);
      }
    } catch (error) {
      console.error('[InvoiceEmailService] Error sending invoice email:', error);
    }
  }

  private getSubject(status: string, invoiceNumber?: string): string {
    const prefix = invoiceNumber ? `Invoice #${invoiceNumber}` : 'Invoice';
    
    switch (status) {
      case 'paid':
        return `${prefix} - Payment Received! Thank you!`;
      case 'pending':
        return `${prefix} - Action Required`;
      case 'overdue':
        return `${prefix} - Payment Overdue`;
      case 'cancelled':
        return `${prefix} - Cancelled`;
      default:
        return `${prefix} - Receipt`;
    }
  }

  private generateInvoiceHtml(data: InvoiceEmailData, branding: PlatformBranding): string {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency,
    }).format(data.amount / 100);

    const formattedDueDate = data.dueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedPaidDate = data.paymentDate 
      ? data.paymentDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

    const statusColor = this.getStatusColor(data.status);
    const statusIcon = this.getStatusIcon(data.status);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.getSubject(data.status, data.invoiceNumber)}</title>
    <style>
        body {
            font-family: ${branding.themeFontFamily};
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: ${branding.themeBorderRadius === 'sm' ? '8px' : branding.themeBorderRadius === 'lg' ? '16px' : '12px'};
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 30px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: ${branding.themeColors.primary};
            margin-bottom: 8px;
        }
        .tagline {
            color: ${branding.themeColors.neutral};
            font-size: 14px;
        }
        .branding {
            background: linear-gradient(135deg, ${branding.themeColors.primary} 0%, ${branding.themeColors.accent} 100%);
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .invoice-number {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }
        .status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            ${statusColor}
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 15px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 8px;
        }
        .billing-period {
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .amount {
            font-size: 32px;
            font-weight: bold;
            color: #28a745;
        }
        .details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .payment-method {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 15px;
        }
        .footer {
            text-align: center;
            border-top: 2px solid #e9ecef;
            padding-top: 30px;
            margin-top: 40px;
            color: #6c757d;
            font-size: 14px;
        }
        .footer-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 15px;
        }
        .footer-links a {
            color: #007bff;
            text-decoration: none;
        }
        .footer-links a:hover {
            text-decoration: underline;
        }
        .platform-info {
            margin-top: 20px;
            padding: 15px;
            background: #e8f4f8;
            border-radius: 8px;
            font-size: 12px;
            color: #495057;
        }
        .download-btn {
            display: inline-block;
            background: linear-gradient(135deg, ${branding.themeColors.primary} 0%, ${branding.themeColors.accent} 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin-top: 20px;
        }
        .download-btn:hover {
            background: linear-gradient(135deg, ${branding.themeColors.primary}dd 0%, ${branding.themeColors.accent}dd 100%);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.platformName}" style="max-height: 60px; margin-bottom: 8px;" />` : `<div class="logo">${branding.platformName}</div>`}
            <div class="tagline">${branding.platformDescription}</div>
            <div class="branding">Powered by ${branding.platformName}</div>
        </div>

        <div class="invoice-info">
            <div>
                <div class="invoice-number">Invoice #${data.invoiceNumber || data.invoiceId}</div>
                <div class="billing-period">
                    ${data.billingPeriodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - 
                    ${data.billingPeriodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
            </div>
            <div class="status">
                ${statusIcon}
                ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Invoice Details</div>
            <div class="amount">${formattedAmount}</div>
            <div class="billing-period">Billing period: ${data.billingPeriodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${data.billingPeriodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            ${data.dueDate && data.status !== 'paid' ? `<div class="billing-period">Due date: ${formattedDueDate}</div>` : ''}
            ${formattedPaidDate ? `<div class="billing-period">Paid on: ${formattedPaidDate}</div>` : ''}
        </div>

        <div class="section">
            <div class="section-title">Customer Information</div>
            <div class="details">
                <div class="detail-row">
                    <span>Customer:</span>
                    <span>${data.customerName}</span>
                </div>
                <div class="detail-row">
                    <span>Email:</span>
                    <span>${data.customerEmail}</span>
                </div>
                ${data.tenantName ? `
                <div class="detail-row">
                    <span>Business:</span>
                    <span>${data.tenantName}</span>
                </div>
                ` : ''}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Service Details</div>
            <div class="details">
                <div class="detail-row">
                    <span>Service Plan:</span>
                    <span>${data.tier.charAt(0).toUpperCase() + data.tier.slice(1)}</span>
                </div>
                ${data.paymentMethod ? `
                <div class="payment-method">
                    <span>Payment Method:</span>
                    <span>${data.paymentMethod}</span>
                </div>
                ` : ''}
            </div>
        </div>

        ${data.downloadUrl ? `
        <div style="text-align: center; margin-top: 30px;">
            <a href="${data.downloadUrl}" class="download-btn">
                Download Invoice PDF
            </a>
        </div>
        ` : ''}

        <div class="footer">
            <div>Thank you for your business!</div>
            
            ${branding.contactEmail || branding.contactPhone || branding.contactAddress ? `
            <div class="contact-info" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px;">
              <strong>Contact Information:</strong><br>
              ${branding.contactEmail ? `Email: <a href="mailto:${branding.contactEmail}" style="color: ${branding.themeColors.primary}; text-decoration: none;">${branding.contactEmail}</a><br>` : ''}
              ${branding.contactPhone ? `Phone: ${branding.contactPhone}<br>` : ''}
              ${branding.contactAddress ? `Address: ${branding.contactAddress}<br>` : ''}
              ${branding.contactWebsite ? `Website: <a href="${branding.contactWebsite}" style="color: ${branding.themeColors.primary}; text-decoration: none;">${branding.contactWebsite}</a><br>` : ''}
            </div>
            ` : ''}
            
            ${branding.socialFacebook || branding.socialTwitter || branding.socialInstagram || branding.socialLinkedIn || branding.socialYoutube ? `
            <div class="social-links" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 12px;">
              <strong>Follow Us:</strong><br>
              ${branding.socialFacebook ? `<a href="${branding.socialFacebook}" style="color: #1877f2; text-decoration: none; margin-right: 10px;">Facebook</a>` : ''}
              ${branding.socialTwitter ? `<a href="${branding.socialTwitter}" style="color: #1da1f2; text-decoration: none; margin-right: 10px;">Twitter</a>` : ''}
              ${branding.socialInstagram ? `<a href="${branding.socialInstagram}" style="color: #e4405f; text-decoration: none; margin-right: 10px;">Instagram</a>` : ''}
              ${branding.socialLinkedIn ? `<a href="${branding.socialLinkedIn}" style="color: #0077b5; text-decoration: none; margin-right: 10px;">LinkedIn</a>` : ''}
              ${branding.socialYoutube ? `<a href="${branding.socialYoutube}" style="color: #ff0000; text-decoration: none; margin-right: 10px;">YouTube</a>` : ''}
            </div>
            ` : ''}
            
            <div class="footer-links" style="margin-top: 15px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || branding.contactWebsite || 'https://visible-shelf.com'}" style="color: ${branding.themeColors.primary}; text-decoration: none; margin-right: 20px;">Website</a>
              <a href="mailto:${branding.contactEmail || 'support@visible-shelf.com'}" style="color: ${branding.themeColors.primary}; text-decoration: none; margin-right: 20px;">Support</a>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://visible-shelf.com'}/terms" style="color: ${branding.themeColors.primary}; text-decoration: none; margin-right: 20px;">Terms</a>
            </div>
            <div class="platform-info" style="margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 8px; font-size: 12px; color: #495057;">
              <strong>${branding.platformName}</strong> - ${branding.platformDescription}<br>
              Invoice generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateInvoiceText(data: InvoiceEmailData, branding: PlatformBranding): string {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency,
    }).format(data.amount / 100);

    return `
${branding.platformName.toUpperCase()} - INVOICE

Invoice #${data.invoiceNumber || data.invoiceId}
${data.status.charAt(0).toUpperCase() + data.status.slice(1)}

Customer: ${data.customerName}
Email: ${data.customerEmail}
${data.tenantName ? `Business: ${data.tenantName}` : ''}

Amount: ${formattedAmount}
${data.dueDate ? `Due Date: ${data.dueDate.toLocaleDateString('en-US')}` : ''}
${data.paymentDate ? `Paid Date: ${data.paymentDate.toLocaleDateString('en-US')}` : ''}

Service Plan: ${data.tier}
${data.paymentMethod ? `Payment Method: ${data.paymentMethod}` : ''}

Billing Period: ${data.billingPeriodStart.toLocaleDateString('en-US')} - ${data.billingPeriodEnd.toLocaleDateString('en-US')}

Thank you for choosing ${branding.platformName} for your retail visibility needs!

${branding.contactEmail ? `Contact: ${branding.contactEmail}` : ''}
${branding.contactPhone ? `Phone: ${branding.contactPhone}` : ''}
${branding.contactAddress ? `Address: ${branding.contactAddress}` : ''}
${branding.contactWebsite ? `Website: ${branding.contactWebsite}` : ''}

${branding.socialFacebook || branding.socialTwitter || branding.socialInstagram || branding.socialLinkedIn || branding.socialYoutube ? `
Social Media:
${branding.socialFacebook ? `Facebook: ${branding.socialFacebook}` : ''}
${branding.socialTwitter ? `Twitter: ${branding.socialTwitter}` : ''}
${branding.socialInstagram ? `Instagram: ${branding.socialInstagram}` : ''}
${branding.socialLinkedIn ? `LinkedIn: ${branding.socialLinkedIn}` : ''}
${branding.socialYoutube ? `YouTube: ${branding.socialYoutube}` : ''}
` : ''}

---
${branding.platformName} - ${branding.platformDescription}
${branding.contactWebsite || process.env.NEXT_PUBLIC_APP_URL || 'https://visible-shelf.com'}
${branding.contactEmail || 'support@visible-shelf.com'}
    `;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'paid':
        return 'background-color: #d4edda; color: #155724;';
      case 'pending':
        return 'background-color: #fff3cd; color: #856404;';
      case 'overdue':
        return 'background-color: #f8d7da; color: #721c24;';
      case 'cancelled':
        return 'background-color: #f5c6cb; color: #721c24;';
      default:
        return 'background-color: #e2e3e5; color: #383d41;';
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'paid':
        return 'paid';
      case 'pending':
        return 'pending';
      case 'overdue':
        return 'overdue';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'receipt';
    }
  }
}
