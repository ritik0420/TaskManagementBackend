import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', authorize('admin', 'manager', 'user'), taskController.createTaskValidation, taskController.createTask);
router.patch('/:id', taskController.updateTaskValidation, taskController.updateTask);
router.post('/:id/move', taskController.moveTask);
router.delete('/:id', taskController.deleteTask);

export default router;
