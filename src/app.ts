import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';

const app = express();

// Normalize allowed origin (no trailing slash) so it matches browser's Origin header exactly
const allowedOrigin = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

export default app;
