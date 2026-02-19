import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, generateResetToken } from '../utils/jwt.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const SALT_ROUNDS = 12;

export const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').optional().isIn(['admin', 'manager', 'user']).withMessage('Invalid role'),
];

export async function signup(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    return;
  }
  const { email, password, name, role } = req.body;
  const existing = await User.findOne({ email }).select('+password');
  if (existing) {
    res.status(409).json({ success: false, message: 'Email already registered' });
    return;
  }
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, password: hashed, name, role: role || 'user' });
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ token: refreshToken, user: user._id, expiresAt });
  res.status(201).json({
    success: true,
    user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
    expiresIn: 900,
  });
}

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Invalid email or password' });
    return;
  }
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ success: false, message: 'Invalid email or password' });
    return;
  }
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ token: refreshToken, user: user._id, expiresAt });
  res.json({
    success: true,
    user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
    expiresIn: 900,
  });
}

export async function refresh(req: AuthRequest, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ success: false, message: 'Refresh token required' });
    return;
  }
  try {
    const { userId } = verifyRefreshToken(refreshToken);
    const stored = await RefreshToken.findOne({ token: refreshToken }).catch(() => null);
    if (!stored) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    await RefreshToken.updateOne({ _id: stored._id }, { deletedAt: new Date() });
    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }
    const newAccess = signAccessToken(userId);
    const newRefresh = signRefreshToken(userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({ token: newRefresh, user: userId, expiresAt });
    res.json({
      success: true,
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiresIn: 900,
    });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
}

export const forgotPasswordValidation = [body('email').isEmail().normalizeEmail()];

export async function forgotPassword(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Valid email required' });
    return;
  }
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
    return;
  }
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await PasswordReset.create({ token, user: user._id, expiresAt });
  // In production: send email with link containing token (e.g. CLIENT_URL/reset-password?token=...)
  res.json({
    success: true,
    message: 'If the email exists, a reset link will be sent',
    resetToken: process.env.NODE_ENV === 'development' ? token : undefined,
  });
}

export const resetPasswordValidation = [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

export async function resetPassword(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return;
  }
  const { token, password } = req.body;
  const pr = await PasswordReset.findOne({ token });
  if (!pr || pr.expiresAt < new Date() || pr.usedAt) {
    res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    return;
  }
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  await User.updateOne({ _id: pr.user }, { password: hashed });
  await PasswordReset.updateOne({ _id: pr._id }, { usedAt: new Date() });
  res.json({ success: true, message: 'Password reset successful' });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Not authenticated', 401);
  res.json({
    success: true,
    user: { id: req.user._id.toString(), email: req.user.email, name: req.user.name, role: req.user.role },
  });
}
