import express from 'express';
import {
  getAllProducts, getProductById, getRelatedProducts,
  createProduct, updateProduct, deleteProduct,
} from '../controller/products-controller.js';
import { verifyAdmin } from '../middleware/auth-middleware.js';

const router = express.Router();

router.get('/',             getAllProducts);
router.get('/:id',          getProductById);
router.get('/:id/related',  getRelatedProducts);
router.post('/',            verifyAdmin, createProduct);
router.patch('/:id',        verifyAdmin, updateProduct);
router.delete('/:id',       verifyAdmin, deleteProduct);

export default router;