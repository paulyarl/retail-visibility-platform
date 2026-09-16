/**
 * WhatsApp Channel Service
 *
 * Owns the `whatsapp_channels` table (migration 275). Tenant routing key is
 * `phone_number_id` (Meta WABA phone number id); sprint scope is a single
 * platform-owned number, per-tenant numbers are just more rows later.
 *
 * Credentials: the channel row's `access_token_encrypted` is the ONLY send
 * credential (spec §8.8 — no global WHATSAPP_ACCESS_TOKEN fallback). Tokens
 * are write-only: accepted on create/rotate, encrypted immediately via the
 * WhatsApp-scoped crypto wrapper, never returned by any read path.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { generateWhatsAppChannelId } from '../../lib/id-generator';
import { encryptChannelToken, decryptChannelToken } from './crypto';

export interface WhatsAppChannel {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  accessTokenEncrypted: string;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toChannel(row: any): WhatsAppChannel {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    phoneNumberId: row.phone_number_id,
    displayPhoneNumber: row.display_phone_number,
    accessTokenEncrypted: row.access_token_encrypted,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public/admin channel view — never includes the encrypted token. */
export function toPublicChannel(channel: WhatsAppChannel) {
  return {
    id: channel.id,
    tenantId: channel.tenantId,
    phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber,
    status: channel.status,
    createdBy: channel.createdBy,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

const VALID_STATUSES = new Set(['active', 'disabled', 'revoked']);

export class WhatsAppChannelService {
  private static instance: WhatsAppChannelService;

  static getInstance(): WhatsAppChannelService {
    if (!this.instance) this.instance = new WhatsAppChannelService();
    return this.instance;
  }

  /** Resolve the active channel for a WABA phone_number_id (tenant routing key). */
  async resolveChannel(phoneNumberId: string): Promise<WhatsAppChannel | null> {
    const row = await prisma.whatsapp_channels.findFirst({
      where: { phone_number_id: phoneNumberId, status: 'active' },
    });
    return row ? toChannel(row) : null;
  }

  /** Decrypt the channel's send credential. Asserts the encryption key (§4.3). */
  getAccessToken(channel: WhatsAppChannel): string {
    return decryptChannelToken(channel.accessTokenEncrypted);
  }

  async listChannels(): Promise<WhatsAppChannel[]> {
    const rows = await prisma.whatsapp_channels.findMany({
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toChannel);
  }

  async getChannel(id: string): Promise<WhatsAppChannel | null> {
    const row = await prisma.whatsapp_channels.findUnique({ where: { id } });
    return row ? toChannel(row) : null;
  }

  async createChannel(params: {
    tenantId: string;
    phoneNumberId: string;
    displayPhoneNumber?: string;
    accessToken: string;
    createdBy?: string;
  }): Promise<WhatsAppChannel> {
    const existing = await prisma.whatsapp_channels.findUnique({
      where: { phone_number_id: params.phoneNumberId },
    });
    if (existing) {
      const err: any = new Error('phone_number_id already registered');
      err.code = 'duplicate_phone_number_id';
      throw err;
    }

    const row = await prisma.whatsapp_channels.create({
      data: {
        id: generateWhatsAppChannelId(params.tenantId),
        tenant_id: params.tenantId,
        phone_number_id: params.phoneNumberId,
        display_phone_number: params.displayPhoneNumber || null,
        access_token_encrypted: encryptChannelToken(params.accessToken),
        status: 'active',
        created_by: params.createdBy || null,
      },
    });
    logger.info('[WhatsAppChannel] Created channel', undefined, {
      channelId: row.id,
      tenantId: params.tenantId,
    });
    return toChannel(row);
  }

  async updateChannel(
    id: string,
    params: {
      displayPhoneNumber?: string;
      status?: string;
      accessToken?: string; // rotate token — write-only
    }
  ): Promise<WhatsAppChannel> {
    if (params.status && !VALID_STATUSES.has(params.status)) {
      const err: any = new Error(`Invalid status: ${params.status}`);
      err.code = 'invalid_status';
      throw err;
    }

    const data: any = { updated_at: new Date() };
    if (params.displayPhoneNumber !== undefined) data.display_phone_number = params.displayPhoneNumber || null;
    if (params.status !== undefined) data.status = params.status;
    if (params.accessToken !== undefined) data.access_token_encrypted = encryptChannelToken(params.accessToken);

    const row = await prisma.whatsapp_channels.update({ where: { id }, data });
    logger.info('[WhatsAppChannel] Updated channel', undefined, {
      channelId: id,
      status: params.status,
      tokenRotated: params.accessToken !== undefined,
    });
    return toChannel(row);
  }
}

export default WhatsAppChannelService;
