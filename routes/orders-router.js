import express from 'express';
import {
  getStats, getAllOrders, getMyOrders, getOrderById,
  createOrder, cancelOrder, updateOrderStatus, deleteOrder,
  xenditWebhook,
} from '../controller/orders-controller.js';
import { verifyToken, verifyAdmin } from '../middleware/auth-middleware.js';

const router = express.Router();

router.post('/xendit-webhook', xenditWebhook);
router.get('/stats',          verifyAdmin, getStats);
router.get('/',               verifyAdmin, getAllOrders);
router.patch('/:id/status',   verifyAdmin, updateOrderStatus);
router.delete('/:id',         verifyAdmin, deleteOrder);
router.get('/mine',           verifyToken, getMyOrders);
router.get('/:id',            verifyToken, getOrderById);
router.post('/',              verifyToken, createOrder);
router.patch('/:id/cancel',   verifyToken, cancelOrder);

export default router;