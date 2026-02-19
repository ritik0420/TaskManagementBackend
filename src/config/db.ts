import mongoose from 'mongoose';

let connectionPromise: Promise<void> | null = null;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) return connectionPromise;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-management';
  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    bufferCommands: false,
  });
  await connectionPromise;
}

/** Call before handling requests (e.g. in middleware). Ensures DB is connected on serverless. */
export async function ensureConnection(): Promise<void> {
  await connectDB();
}
