import express from 'express';
import {
  getRates, addRate, updateRate, deleteRate,
} from '../controller/shipping-controller.js';
import { verifyToken, verifyAdmin } from '../middleware/auth-middleware.js';

const router = express.Router();

router.get('/',             getRates);
router.post('/',            verifyAdmin, addRate);
router.patch('/:id',        verifyAdmin, updateRate);
router.delete('/:id',       verifyAdmin, deleteRate);

export default router;