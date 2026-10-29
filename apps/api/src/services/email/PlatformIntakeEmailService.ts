/**
 * Platform Intake Email Service
 *
 * Mirrors a platform-scoped Requests-Hub ticket (PLATFORM_CRM_PROJECT_ID)
 * to the catch-all admin inbox — the CRM ticket is the operator alert,
 * this is the email copy that arrives through the same path. Covers every
 * intake that files to the project: directory lead-gen, owner submissions,
 * claim tickets, and anything added later.
 *
 * Fire-and-forget — callers treat the result as advisory; a send failure
 * must never fail the intake (the ticket is already filed).
 *
 * Recipient resolution ("the catch-all"), first hit wins:
 *   1. PLATFORM_INTAKE_EMAIL env — explicit override
 *   2. email_configuration_list 'intake' category — admin-configurable
 *   3. email_configuration_list 'general' category — platform catch-all
 *   4. PLATFORM_ADMIN_EMAIL env → unifiedConfig.emailAdmin fallback
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';

export interface PlatformIntakeTicketNotification {
  ticketId: string;
  /** What the record is — 'Ticket' (default) or 'Inquiry'. Used as the
   *  reference label in the email body. */
  kind?: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  inquiryId?: string | null;
  /** Requestor's email — becomes the message Reply-To so answering the
   *  catch-all email replies straight to the submitter. */
  replyTo?: string | null;
}

class PlatformIntakeEmailService {
  /**
   * Email the catch-all about a newly filed intake ticket.
   * Returns { success } — never throws.
   */
  async notifyIntakeTicket(ticket: PlatformIntakeTicketNotification): Promise<{ success: boolean; error?: string }> {
    try {
      const to = await this.resolveCatchAllRecipient();
      if (!to) {
        logger.warn('[PlatformIntakeEmail] No catch-all recipient configured', undefined, {
          ticketId: ticket.ticketId,
        });
        return { success: false, error: 'no_recipient' };
      }

      const { emailService } = await import('../email-service');

      const webUrl = unifiedConfig.webUrl.replace(/\/$/, '');
      const requestsHubUrl = `${webUrl}/settings/admin/crm/requests`;
      const categoryLabel = (ticket.category || 'intake').replace(/_/g, ' ');
      const subject = `[Intake] ${ticket.title}`;
      const description = ticket.description?.trim() || '';

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
    <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Platform intake — ${this.escape(categoryLabel)}</p>
    <h1 style="color: #111827; margin: 0 0 16px; font-size: 22px;">${this.escape(ticket.title)}</h1>

    ${description ? `<div style="background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px; white-space: pre-wrap; color: #374151; font-size: 14px;">${this.escape(description)}</div>` : ''}

    <p style="margin: 0 0 24px; color: #6b7280; font-size: 13px;">
      ${this.escape(ticket.kind || 'Ticket')} ${this.escape(ticket.ticketId)}${ticket.priority ? ` · priority ${this.escape(ticket.priority)}` : ''}
    </p>

    <p style="margin: 0;">
      <a href="${requestsHubUrl}"
         style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Open Requests Hub
      </a>
    </p>
  </div>
</body>
</html>`;

      const text = `New platform intake (${categoryLabel})

${ticket.title}

${description ? `${description}\n\n` : ''}${ticket.kind || 'Ticket'}: ${ticket.ticketId}${ticket.priority ? ` · priority ${ticket.priority}` : ''}

Requests Hub: ${requestsHubUrl}`;

      const result = await emailService.sendEmail({
        to,
        from: unifiedConfig.emailAdmin,
        fromName: 'Intake',
        // Replying to the catch-all email should reach the requestor, not
        // support@ — explicit replyTo wins, else parse the submitter's
        // address out of the ticket description (<email> or `Email:` line).
        replyTo: ticket.replyTo || this.extractRequestorEmail(description) || unifiedConfig.emailSupport,
        subject,
        html,
        text,
      });

      if (!result.success) {
        logger.warn('[PlatformIntakeEmail] Intake notification send failed', undefined, {
          error: result.error,
          ticketId: ticket.ticketId,
          to,
        });
      }
      return { success: result.success, error: result.error };
    } catch (error: any) {
      logger.error('[PlatformIntakeEmail] Intake notification error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
        ticketId: ticket.ticketId,
      });
      return { success: false, error: error?.message || 'send_failed' };
    }
  }

  /**
   * Resolve the catch-all recipient. DB-configured categories let operators
   * repoint the address without a deploy; env vars override for environments
   * where the intake mail should go somewhere else entirely.
   */
  private async resolveCatchAllRecipient(): Promise<string | null> {
    if (unifiedConfig.emailIntake) return unifiedConfig.emailIntake;

    try {
      const rows = await prisma.email_configuration_list.findMany({
        where: { category: { in: ['intake', 'general'] } },
        select: { category: true, email: true },
      });
      const intake = rows.find((r) => r.category === 'intake' && r.email?.includes('@'));
      if (intake) return intake.email;
      const general = rows.find((r) => r.category === 'general' && r.email?.includes('@'));
      if (general) return general.email;
    } catch (err) {
      logger.warn('[PlatformIntakeEmail] email_configuration_list lookup failed', undefined, {
        error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err) },
      });
    }

    return process.env.PLATFORM_ADMIN_EMAIL || unifiedConfig.emailAdmin || null;
  }

  /**
   * Pull the submitter's address out of a ticket description. Intake
   * descriptions carry it either as `<email>` (lead-gen Contact / owner
   * submission Owner lines) or as a bare `Email:` line (claim tickets).
   */
  private extractRequestorEmail(description?: string | null): string | null {
    if (!description) return null;
    const angle = description.match(/<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/);
    if (angle) return angle[1];
    const bare = description.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return bare ? bare[0] : null;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default new PlatformIntakeEmailService();
