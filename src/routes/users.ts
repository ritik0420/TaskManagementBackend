import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);

router.post('/', authorize('admin'), userController.createUserValidation, userController.createUser);
router.patch('/:id', authorize('admin'), userController.updateUserValidation, userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

export default router;
