import { z } from 'zod';
export type PasswordPolicy = {
  minimumLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
  rejectCurrentPassword?: boolean;
};
export function createChangePasswordSchema(policy: PasswordPolicy | null) {
  return z
    .object({
      currentPassword: z.string().min(1, 'Enter your current password'),
      newPassword: z.string().min(1, 'Enter a new password'),
      confirmPassword: z.string().min(1, 'Confirm your new password'),
    })
    .superRefine((value, ctx) => {
      const invalid = (message: string) =>
        ctx.addIssue({ code: 'custom', path: ['newPassword'], message });
      if (value.newPassword !== value.confirmPassword)
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'Passwords do not match',
        });
      if (
        policy?.minimumLength &&
        value.newPassword.length < policy.minimumLength
      )
        invalid(`Use at least ${policy.minimumLength} characters`);
      if (policy?.requireUppercase && !/[A-Z]/.test(value.newPassword))
        invalid('Include an uppercase letter');
      if (policy?.requireLowercase && !/[a-z]/.test(value.newPassword))
        invalid('Include a lowercase letter');
      if (policy?.requireNumber && !/\d/.test(value.newPassword))
        invalid('Include a number');
      if (policy?.requireSymbol && !/[^A-Za-z0-9\s]/.test(value.newPassword))
        invalid('Include a symbol');
      if (
        policy?.rejectCurrentPassword &&
        value.currentPassword === value.newPassword
      )
        invalid('Choose a password different from your current password');
    });
}
export type ChangePasswordValues = z.infer<
  ReturnType<typeof createChangePasswordSchema>
>;
export const passwordChangeResultSchema = z.object({
  updated: z.literal(true),
  session: z.enum(['retained', 'revoked']),
});
export type PasswordChangeResult = z.infer<typeof passwordChangeResultSchema>;
