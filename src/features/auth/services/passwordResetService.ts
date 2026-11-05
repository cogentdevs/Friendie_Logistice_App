import { ApiError } from '../../../types/api';
import {
  forgotPasswordSchema,
  ForgotPasswordValues,
} from '../schemas/forgotPasswordSchema';
export type ResetAcceptance = { accepted: true };
export const passwordResetService = {
  async request(input: ForgotPasswordValues): Promise<ResetAcceptance> {
    forgotPasswordSchema.parse(input);
    // No verified reset endpoint or response contract exists in this repository.
    // Keep the integration unavailable rather than guessing a Laravel URL or success shape.
    throw new ApiError(
      'Password reset is currently unavailable. Please try again later.',
      'unknown',
    );
  },
};
// Deliberately ignore backend messages/field text to avoid leaking account existence.
export function passwordResetError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'validation')
      return 'Check the email address format and try again.';
    if (error.kind === 'network')
      return 'Connection failed or timed out. Check your connection and try again.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'server')
      return 'Password reset is temporarily unavailable. Please try again later.';
  }
  return 'Password reset is currently unavailable. Please try again later.';
}
