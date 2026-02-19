import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, query, validationResult } from 'express-validator';
import { User } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const SALT_ROUNDS = 12;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const createUserValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty(),
  body('role').isIn(['admin', 'manager', 'user']),
];

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return;
  }
  const { email, password, name, role } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ success: false, message: 'Email already registered' });
    return;
  }
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, password: hashed, name, role });
  res.status(201).json({
    success: true,
    user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
  });
}

export const updateUserValidation = [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'manager', 'user']),
  body('password').optional().isLength({ min: 8 }),
];

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  const { name, role, password } = req.body;
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (password) user.password = await bcrypt.hash(password, SALT_ROUNDS);
  await user.save();
  res.json({
    success: true,
    user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
  });
}

export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page), 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
  const search = (req.query.search as string) || '';
  const role = req.query.role as string | undefined;
  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { email: new RegExp(search, 'i') },
      { name: new RegExp(search, 'i') },
    ];
  }
  if (role) filter.role = role;
  const [docs, total] = await Promise.all([
    User.find(filter).select('-password').skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);
  const users = docs.map((u) => ({ id: u._id.toString(), email: u.email, name: u.name, role: u.role }));
  res.json({
    success: true,
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  res.json({ success: true, user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role } });
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  if (user._id.equals(req.user!._id)) {
    res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    return;
  }
  await User.updateOne({ _id: user._id }, { deletedAt: new Date() });
  res.json({ success: true, message: 'User deleted' });
}
