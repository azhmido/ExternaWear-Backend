import express from 'express';
import {
  registerUser, registerAdmin, login, logout,
  getMe, changePassword, updateProfile, deleteAccount,
} from '../controller/users-controller.js';
import { verifyToken } from '../middleware/auth-middleware.js';

const router = express.Router();

//publik
router.post('/register/user',  registerUser);
router.post('/register/admin', registerAdmin);
router.post('/login',  login);
router.post('/logout', logout);

//harus login untuk akses endpoint di bawah
router.get('/me',                 verifyToken, getMe);
router.patch('/profile',          verifyToken, updateProfile);
router.patch('/profile/password', verifyToken, changePassword);
router.delete('/account',         verifyToken, deleteAccount);

export default router;