/**
 * ContactService — Outreach pitch contact (optional footer) variants
 *
 * Simplest of the pitch component services — no AI generation, no quality
 * gate. Contact is free-text operator footer, optional per pitch. Stored as
 * a variant so the operator can save standard footer(s) and reuse across
 * pitches, and so split-testing can compare "with contact" vs "without
 * contact" reply rates.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §5.3, §3.3
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { NotFoundError } from '../../middleware/errorHandler';
import { generateOutreachContactId } from '../../lib/id-generator';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CreateContactInput {
  campaignId: string;
  contactText: string;
  label?: string;
  createdBy?: string;
}

export interface UpdateContactInput {
  contactText?: string;
  label?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class ContactService extends BaseService {
  private static instance: ContactService;

  private constructor() {
    super();
  }

  static getInstance(): ContactService {
    if (!ContactService.instance) {
      ContactService.instance = new ContactService();
    }
    return ContactService.instance;
  }

  // ====================
  // CREATE
  // ====================

  async createContact(input: CreateContactInput, ctx?: RequestCtx): Promise<any> {
    const contactText = input.contactText.trim();
    if (!contactText) {
      throw new Error('Contact text cannot be empty');
    }

    try {
      const contact = await this.prisma.mkt_outreach_contacts_list.create({
        data: {
          id: generateOutreachContactId(),
          campaign_id: input.campaignId,
          contact_text: contactText,
          label: input.label?.trim() || null,
          created_by: input.createdBy || null,
        },
      });

      logger.info('Outreach contact created', ctx, {
        contactId: contact.id,
        campaignId: input.campaignId,
        label: input.label,
      });

      return contact;
    } catch (error) {
      logger.error('Failed to create outreach contact', ctx, {
        error: (error as Error).message,
        campaignId: input.campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // UPDATE
  // ====================

  async updateContact(id: string, input: UpdateContactInput, ctx?: RequestCtx): Promise<any> {
    try {
      const existing = await this.prisma.mkt_outreach_contacts_list.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Contact not found');

      const data: any = {};
      if (input.contactText !== undefined) {
        const trimmed = input.contactText.trim();
        if (!trimmed) throw new Error('Contact text cannot be empty');
        data.contact_text = trimmed;
      }
      if (input.label !== undefined) {
        data.label = input.label.trim() || null;
      }

      const contact = await this.prisma.mkt_outreach_contacts_list.update({
        where: { id },
        data,
      });

      logger.info('Outreach contact updated', ctx, { contactId: id });
      return contact;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to update outreach contact', ctx, {
        error: (error as Error).message,
        contactId: id,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // DELETE
  // ====================

  async deleteContact(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      const existing = await this.prisma.mkt_outreach_contacts_list.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Contact not found');

      await this.prisma.mkt_outreach_contacts_list.delete({ where: { id } });
      logger.info('Outreach contact deleted', ctx, { contactId: id });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to delete outreach contact', ctx, {
        error: (error as Error).message,
        contactId: id,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // READ
  // ====================

  async listContacts(campaignId?: string, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (campaignId) where.campaign_id = campaignId;
    try {
      return await this.prisma.mkt_outreach_contacts_list.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list outreach contacts', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async getContact(id: string, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_outreach_contacts_list.findUnique({ where: { id } });
    } catch (error) {
      logger.error('Failed to get outreach contact', ctx, {
        error: (error as Error).message,
        contactId: id,
      });
      throw this.handleError(error, ctx);
    }
  }
}

export default ContactService.getInstance();
