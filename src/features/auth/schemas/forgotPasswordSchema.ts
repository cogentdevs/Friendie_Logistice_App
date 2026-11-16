import { z } from 'zod';
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .max(255, 'Email must be 255 characters or fewer')
    .toLowerCase()
    .pipe(z.email('Enter a valid email address')),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
// Internal result contract. Only a verified adapter may return acceptance.
export const resetAcceptanceSchema = z.object({ accepted: z.literal(true) });
