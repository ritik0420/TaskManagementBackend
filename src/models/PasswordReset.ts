import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPasswordReset extends Document {
  token: string;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  usedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    token: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

passwordResetSchema.index({ token: 1 }, { unique: true });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset: Model<IPasswordReset> = mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);
