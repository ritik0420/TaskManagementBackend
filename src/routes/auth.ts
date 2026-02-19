import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/signup', authController.signupValidation, authController.signup);
router.post('/login', authController.loginValidation, authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', authController.resetPasswordValidation, authController.resetPassword);
router.get('/me', authenticate, authController.me);

export default router;
