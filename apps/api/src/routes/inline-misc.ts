import { Router } from 'express';
import { getAlertStatus } from '../services/alerting';
import { dailyRatesJob } from '../jobs/rates';
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();

const healthRoutes = (req: any, res: any) => {
  const alertStatus = getAlertStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: unifiedConfig.nodeEnv,
    version: unifiedConfig.appVersion,
    alerts: alertStatus,
    memory: process.memoryUsage(),
  });
};

router.use('/health', healthRoutes);
router.use('/api/health', healthRoutes);

router.get('/__routes', (_req, res) => {
  const out: any[] = [];
  out.push({ methods: ['GET'], path: '/health' });
  out.push({ methods: ['GET'], path: '/__ping' });
  function collect(stack: any[], base = '') {
    stack?.forEach((layer: any) => {
      if (layer.route && layer.route.path) {
        const methods = layer.route.methods
          ? Array.isArray(layer.route.methods)
            ? layer.route.methods
            : Object.keys(layer.route.methods)
          : [];
        const path = base + layer.route.path;
        out.push({ methods: methods.map((m: string) => m.toUpperCase()), path });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const match = layer.regexp && layer.regexp.fast_slash ? '' : (layer.regexp?.source || '');
        collect(layer.handle.stack, base);
      }
    });
  }
  const app = (router as any).app || (global as any).__app;
  if (app) {
    const stack = (app as any)._router?.stack || [];
    collect(stack);
  }
  res.json(out);
});

router.get('/__ping', (req, res) => {
  console.log('PING from', req.ip, 'at', new Date().toISOString());
  res.json({ ok: true, when: new Date().toISOString() });
});

router.post('/jobs/rates/daily', dailyRatesJob);

export default router;
