import express from 'express';
import cors from 'cors';
import { ensureConnection } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';

const app = express();

// Normalize allowed origin (no trailing slash) so it matches browser's Origin header exactly
const allowedOrigin = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

// Ensure MongoDB is connected before any API handler (required for Vercel serverless)
app.use(async (_req, _res, next) => {
  try {
    await ensureConnection();
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/', (_req, res) => res.redirect(302, '/api/health'));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

export default app;
