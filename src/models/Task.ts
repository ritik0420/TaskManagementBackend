import mongoose, { Schema, Document, Model } from 'mongoose';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface ITask extends Document {
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  createdBy: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  order: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for filtering, sorting, pagination
taskSchema.index({ deletedAt: 1 });
taskSchema.index({ status: 1, deletedAt: 1 });
taskSchema.index({ createdBy: 1, deletedAt: 1 });
taskSchema.index({ assignedTo: 1, deletedAt: 1 });
taskSchema.index({ dueDate: 1, deletedAt: 1 });
taskSchema.index({ createdAt: -1 });

// Soft delete
taskSchema.pre(/^find/, function (this: mongoose.Query<unknown, ITask>) {
  this.where({ deletedAt: null });
});

export const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);
