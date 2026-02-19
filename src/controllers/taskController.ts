import { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Task } from '../models/Task.js';
import { getIO } from '../socket/index.js';
import { AuthRequest } from '../middleware/auth.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildTaskQuery(req: AuthRequest): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  const role = req.user!.role;
  if (role === 'user') {
    q.$or = [
      { createdBy: req.user!._id },
      { assignedTo: req.user!._id },
    ];
  }
  if (req.query.status) q.status = req.query.status;
  if (req.query.assignedTo) q.assignedTo = req.query.assignedTo;
  if (req.query.priority) q.priority = req.query.priority;
  return q;
}

export const createTaskValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignedTo').optional().isMongoId(),
  body('dueDate').optional().isISO8601(),
];

export async function createTask(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return;
  }
  const { title, description, status, priority, assignedTo, dueDate } = req.body;
  const count = await Task.countDocuments();
  const task = await Task.create({
    title,
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
    createdBy: req.user!._id,
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    order: count,
  });
  const populated = await Task.findById(task._id).populate('createdBy assignedTo', 'name email');
  getIO().to('tasks').emit('task:created', { task: populated });
  res.status(201).json({ success: true, task: populated });
}

export const updateTaskValidation = [
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignedTo').optional().isMongoId(),
  body('dueDate').optional().isISO8601(),
  body('order').optional().isInt({ min: 0 }),
];

export async function updateTask(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg });
    return;
  }
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }
  const canEdit = req.user!.role === 'admin' || req.user!.role === 'manager' || task.createdBy.equals(req.user!._id) || task.assignedTo?.equals(req.user!._id);
  if (!canEdit) {
    res.status(403).json({ success: false, message: 'Cannot edit this task' });
    return;
  }
  const { title, description, status, priority, assignedTo, dueDate, order } = req.body;
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (order !== undefined) task.order = order;
  await task.save();
  const populated = await Task.findById(task._id).populate('createdBy assignedTo', 'name email');
  getIO().to('tasks').emit('task:updated', { task: populated });
  res.json({ success: true, task: populated });
}

export async function getTasks(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page), 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit), 10) || DEFAULT_LIMIT));
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

  const filter = buildTaskQuery(req);
  const [tasks, total] = await Promise.all([
    Task.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('createdBy assignedTo', 'name email'),
    Task.countDocuments(filter),
  ]);
  res.json({
    success: true,
    tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getTaskById(req: AuthRequest, res: Response): Promise<void> {
  const task = await Task.findById(req.params.id).populate('createdBy assignedTo', 'name email');
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }
  const canView = req.user!.role === 'admin' || req.user!.role === 'manager' || task.createdBy.equals(req.user!._id) || task.assignedTo?.equals(req.user!._id);
  if (!canView) {
    res.status(403).json({ success: false, message: 'Cannot view this task' });
    return;
  }
  res.json({ success: true, task });
}

export async function deleteTask(req: AuthRequest, res: Response): Promise<void> {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }
  const canDelete = req.user!.role === 'admin' || req.user!.role === 'manager' || task.createdBy.equals(req.user!._id);
  if (!canDelete) {
    res.status(403).json({ success: false, message: 'Cannot delete this task' });
    return;
  }
  await Task.updateOne({ _id: task._id }, { deletedAt: new Date() });
  getIO().to('tasks').emit('task:deleted', { taskId: task._id });
  res.json({ success: true, message: 'Task deleted' });
}

export async function moveTask(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, order } = req.body;
  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }
  const canEdit = req.user!.role === 'admin' || req.user!.role === 'manager' || task.createdBy.equals(req.user!._id) || task.assignedTo?.equals(req.user!._id);
  if (!canEdit) {
    res.status(403).json({ success: false, message: 'Cannot move this task' });
    return;
  }
  if (status) task.status = status;
  if (typeof order === 'number') task.order = order;
  await task.save();
  const populated = await Task.findById(task._id).populate('createdBy assignedTo', 'name email');
  getIO().to('tasks').emit('task:moved', { task: populated });
  res.json({ success: true, task: populated });
}
