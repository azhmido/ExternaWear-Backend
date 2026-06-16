import express from 'express';
import {
  getAllCategories, createCategory, updateCategory, deleteCategory,
} from '../controller/categories-controller.js';
import { verifyAdmin } from '../middleware/auth-middleware.js';

const router = express.Router();

router.get('/',             getAllCategories);
router.post('/',            verifyAdmin, createCategory);
router.patch('/:id',        verifyAdmin, updateCategory);
router.delete('/:id',       verifyAdmin, deleteCategory);

export default router;