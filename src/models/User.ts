import mongoose, { Schema, Document, Model } from 'mongoose';

export type Role = 'admin' | 'manager' | 'user';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: Role;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ deletedAt: 1 });
userSchema.index({ role: 1, deletedAt: 1 });

// Soft delete: exclude deleted by default
userSchema.pre(/^find/, function (this: mongoose.Query<unknown, IUser>) {
  this.where({ deletedAt: null });
});

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
