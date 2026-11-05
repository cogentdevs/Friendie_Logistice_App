import { z } from 'zod';
import { User } from '../../../types/user';
export const sessionSchema = z.object({ token: z.string().min(1) });
// Confirm/map this DTO against the real Laravel profile contract before integration.
export const userSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.email(),
  avatarUrl: z.string().optional(),
  verified: z.boolean().optional(),
}) satisfies z.ZodType<User>;
