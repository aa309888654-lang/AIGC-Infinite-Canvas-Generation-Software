import { z } from 'zod';
import { TaskStatus } from '../constants';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[]{};':"\\|,.<>\x2F?]).{12,}$/;

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(strongPasswordRegex, 
      'Password must contain:\n' +
      '  • At least 12 characters\n' +
      '  • At least one uppercase letter (A-Z)\n' +
      '  • At least one lowercase letter (a-z)\n' +
      '  • At least one number (0-9)\n' +
      '  • At least one special character (!@#$%^&*...)'
    ),
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const apiKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().optional(),
  endpoint: z.string().url().optional(),
});

export const taskQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum([
    TaskStatus.PENDING,
    TaskStatus.PROCESSING,
    TaskStatus.PAUSED,
    TaskStatus.COMPLETED,
    TaskStatus.FAILED,
    TaskStatus.TIMEOUT,
    TaskStatus.CANCELLED,
  ]).optional(),
  taskType: z.enum(['video', 'image']).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
