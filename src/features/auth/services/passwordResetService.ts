import { ApiError } from '../../../types/api';
import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { uiTestingLogin } from '../development/uiTestingLogin';
import {
  forgotPasswordSchema,
  ForgotPasswordValues,
} from '../schemas/forgotPasswordSchema';
export type ResetAcceptance = { accepted: true };
export interface ForgotPasswordRequest {
  email: string;
}
const recoveryResponseSchema = z.object({
  success: z.literal(true),
  message: z.literal(
    'If an eligible account matches that email, a link will be sent. Please check your inbox and spam folder.',
  ),
  data: z.object({}).strict(),
});
const demoRecoveryUnavailable =
  'Password recovery is unavailable for the UI testing account. Use your real account email address.';
const safeEmailErrors = new Set([
  'The email field is required.',
  'The email must be a valid email address.',
  'The email field must be a valid email address.',
  'The email must not be greater than 255 characters.',
  'The email field must not be greater than 255 characters.',
]);
export const passwordResetService = {
  async request(input: ForgotPasswordValues): Promise<ResetAcceptance> {
    const payload: ForgotPasswordRequest = forgotPasswordSchema.parse(input);
    if (payload.email === uiTestingLogin.email)
      throw new ApiError(demoRecoveryUnavailable, 'unknown');
    try {
      const response = await apiClient.post<unknown>(
        endpoints.forgotPassword,
        payload,
        {
          headers: { Authorization: false },
        },
      );
      if (
        response.status !== 200 ||
        !recoveryResponseSchema.safeParse(response.data).success
      )
        throw new ApiError('Invalid recovery response.', 'unknown');
      // Acceptance is not proof of account existence, mail delivery, or password change.
      return { accepted: true };
    } catch (error) {
      const message = passwordResetError(error);
      throw new ApiError(
        message,
        error instanceof ApiError ? error.kind : 'unknown',
        error instanceof ApiError ? error.status : undefined,
        error instanceof ApiError && error.kind === 'validation'
          ? { email: [message] }
          : undefined,
      );
    }
  },
};
// Only known format/length errors may be shown verbatim; account lookup details stay private.
export function passwordResetError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === demoRecoveryUnavailable)
      return demoRecoveryUnavailable;
    if (error.kind === 'validation') {
      const emailError = error.fields?.email?.[0];
      return typeof emailError === 'string' && safeEmailErrors.has(emailError)
        ? emailError
        : 'Check the email address format and try again.';
    }
    if (error.kind === 'network')
      return 'Connection failed or timed out. Check your connection and try again.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'server')
      return 'Password reset is temporarily unavailable. Please try again later.';
  }
  return 'Password reset is currently unavailable. Please try again later.';
}
