import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET!;

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await User.findById(decoded.userId).select('_id role');
      if (!user) return next(new Error('User not found'));
      (socket as any).user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    socket.join(`user:${user._id}`);
    socket.join('tasks'); // room for task updates

    socket.on('disconnect', () => {});
  });

  return io;
}

let ioInstance: Server | null = null;

export function setIO(io: Server): void {
  ioInstance = io;
}

export function getIO(): Server {
  if (!ioInstance) throw new Error('Socket not initialized');
  return ioInstance;
}

export function emitTaskUpdate(io: Server, event: 'task:created' | 'task:updated' | 'task:deleted' | 'task:moved', payload: object): void {
  io.to('tasks').emit(event, payload);
}
