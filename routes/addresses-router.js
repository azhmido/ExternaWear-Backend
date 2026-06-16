import express from 'express';
import {
  getAddresses, addAddress, updateAddress,
  deleteAddress, setDefaultAddress,
} from '../controller/addresses-controller.js';
import { verifyToken } from '../middleware/auth-middleware.js';

const router = express.Router();

router.get('/',            verifyToken, getAddresses);
router.post('/',           verifyToken, addAddress);
router.patch('/:id',       verifyToken, updateAddress);
router.patch('/:id/default', verifyToken, setDefaultAddress);
router.delete('/:id',      verifyToken, deleteAddress);

export default router;