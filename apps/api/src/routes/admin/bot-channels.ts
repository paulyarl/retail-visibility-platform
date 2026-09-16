/**
 * WhatsApp Channel Admin Routes (WHATSAPP_CHANNEL_INTEGRATION_SPEC §10)
 *
 * Platform admin CRUD for whatsapp_channels. Mounted under /api/admin/bot
 * alongside bot-platform (authenticateToken + requireAdmin applied at mount).
 *
 * GET    /api/admin/bot/channels            — list channels (token never returned)
 * POST   /api/admin/bot/channels            — create channel (token write-only)
 * PATCH  /api/admin/bot/channels/:id        — update display number / status
 * POST   /api/admin/bot/channels/:id/rotate-token — rotate the access token
 *
 * Token handling (§8.8): accepted write-only, encrypted immediately via the
 * WhatsApp-scoped crypto wrapper (fails closed if OAUTH_ENCRYPTION_KEY is
 * missing/invalid), never returned. A last-4 fingerprint is returned for
 * operator verification only.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import WhatsAppChannelService, { toPublicChannel } from '../../services/whatsapp/WhatsAppChannelService';
import { audit } from '../../audit';
import { logger } from '../../logger';

const router = Router({ mergeParams: true });
const channelService = WhatsAppChannelService.getInstance();

const createChannelSchema = z.object({
  tenantId: z.string().min(1).max(255),
  phoneNumberId: z.string().min(1).max(64),
  displayPhoneNumber: z.string().max(32).optional(),
  accessToken: z.string().min(1).max(2048),
});

const updateChannelSchema = z.object({
  displayPhoneNumber: z.string().max(32).nullable().optional(),
  status: z.enum(['active', 'disabled', 'revoked']).optional(),
});

const rotateTokenSchema = z.object({
  accessToken: z.string().min(1).max(2048),
});

function tokenFingerprint(token: string): string {
  return `…${token.slice(-4)}`;
}

function logErr(msg: string, req: Request, error: unknown) {
  logger.error(msg, req.ctx, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
}

// GET /channels — list all channels (public view; no tokens)
router.get('/channels', async (_req: Request, res: Response) => {
  try {
    const channels = await channelService.listChannels();
    res.json({ success: true, data: channels.map(toPublicChannel) });
  } catch (error) {
    logErr('[BotChannels] Error listing channels:', _req, error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to list channels' });
  }
});

// POST /channels — create a channel
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const validation = createChannelSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid channel data', details: validation.error.issues });
    }
    const { tenantId, phoneNumberId, displayPhoneNumber, accessToken } = validation.data;

    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Tenant not found' });
    }

    const channel = await channelService.createChannel({
      tenantId,
      phoneNumberId,
      displayPhoneNumber,
      accessToken,
      createdBy: (req as any).user?.userId || 'admin',
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'create',
      payload: {
        entity_type: 'whatsapp_channel',
        id: channel.id,
        tenant_id: tenantId,
        phone_number_id: phoneNumberId,
        token_fingerprint: tokenFingerprint(accessToken),
      },
    });

    res.status(201).json({
      success: true,
      data: { ...toPublicChannel(channel), tokenFingerprint: tokenFingerprint(accessToken) },
    });
  } catch (error: any) {
    if (error?.code === 'duplicate_phone_number_id' || error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'conflict', message: 'phone_number_id already registered' });
    }
    logErr('[BotChannels] Error creating channel:', req, error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to create channel' });
  }
});

// PATCH+PUT /channels/:id — update display number / status
async function updateChannelHandler(req: Request, res: Response) {
  try {
    const validation = updateChannelSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid channel data', details: validation.error.issues });
    }

    const existing = await channelService.getChannel(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Channel not found' });
    }

    const channel = await channelService.updateChannel(req.params.id, {
      displayPhoneNumber: validation.data.displayPhoneNumber ?? undefined,
      status: validation.data.status,
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'update',
      payload: { entity_type: 'whatsapp_channel', id: channel.id, ...validation.data },
    });

    res.json({ success: true, data: toPublicChannel(channel) });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Channel not found' });
    }
    logErr('[BotChannels] Error updating channel:', req, error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update channel' });
  }
}
router.patch('/channels/:id', updateChannelHandler);
router.put('/channels/:id', updateChannelHandler);

// DELETE /channels/:id — soft deactivate (status → revoked; row + token kept for audit).
router.delete('/channels/:id', async (req: Request, res: Response) => {
  try {
    const existing = await channelService.getChannel(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Channel not found' });
    }

    const channel = await channelService.updateChannel(req.params.id, { status: 'revoked' });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'delete',
      payload: { entity_type: 'whatsapp_channel', id: channel.id, action_detail: 'revoke' },
    });

    res.json({ success: true, data: toPublicChannel(channel) });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Channel not found' });
    }
    logErr('[BotChannels] Error revoking channel:', req, error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to revoke channel' });
  }
});

// POST /channels/:id/rotate-token — rotate the access token (write-only)
router.post('/channels/:id/rotate-token', async (req: Request, res: Response) => {
  try {
    const validation = rotateTokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid request', details: validation.error.issues });
    }

    const existing = await channelService.getChannel(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Channel not found' });
    }

    const channel = await channelService.updateChannel(req.params.id, {
      accessToken: validation.data.accessToken,
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'update',
      payload: {
        entity_type: 'whatsapp_channel',
        id: channel.id,
        action_detail: 'rotate_token',
        token_fingerprint: tokenFingerprint(validation.data.accessToken),
      },
    });

    res.json({
      success: true,
      data: { ...toPublicChannel(channel), tokenFingerprint: tokenFingerprint(validation.data.accessToken) },
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Channel not found' });
    }
    logErr('[BotChannels] Error rotating token:', req, error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to rotate token' });
  }
});

export default router;
