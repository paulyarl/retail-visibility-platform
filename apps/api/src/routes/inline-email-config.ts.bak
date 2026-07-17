import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

router.get('/admin/email-config', async (_req, res) => {
  try {
    const configs = await prisma.email_configuration_list.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(configs);
  } catch (error) {
    console.error('[GET /admin/email-config] Error:', error);
    res.status(500).json({ error: 'failed_to_get_email_config' });
  }
});

router.put('/admin/email-config', async (req, res) => {
  try {
    const schema = z.object({
      configs: z.array(z.object({
        category: z.string(),
        email: z.string().email()
      }))
    });

    const { configs } = schema.parse(req.body);

    const results = await Promise.all(
      configs.map(config =>
        Promise.resolve({ category: config.category, email: config.email })
      )
    );

    res.json({ success: true, configs: results });
  } catch (error) {
    console.error('[PUT /admin/email-config] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'invalid_request', details: error.issues });
    }
    res.status(500).json({ error: 'failed_to_update_email_config' });
  }
});

export default router;
