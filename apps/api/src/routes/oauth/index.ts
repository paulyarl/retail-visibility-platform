import { Router } from 'express';
import paypalRouter from './paypal';
import squareRouter from './square';

const router = Router();

// Mount OAuth routes
router.use('/paypal', paypalRouter);
router.use('/square', squareRouter);

export default router;
