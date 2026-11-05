import { z } from 'zod';
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
  device_name: z.string().default('Friendie mobile'),
});
export type LoginInput = z.input<typeof loginSchema>;
