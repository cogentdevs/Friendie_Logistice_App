import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import {
  ChangePasswordValues,
  createChangePasswordSchema,
  PasswordChangeResult,
  PasswordPolicy,
} from '../schemas/changePasswordSchema';
// Verified CustomerController::changePassword: Laravel defaults and non-reuse.
export const passwordChangePolicy: PasswordPolicy = {
  minimumLength: 8,
  rejectCurrentPassword: true,
};
const responseSchema = z.object({
  success: z.literal(true),
  message: z.literal('Password changed successfully. Sign in again.'),
  data: z.object({ reauthentication_required: z.literal(true) }),
});
let busy = false;
export class PasswordSessionCleanupError extends ApiError {
  constructor() {
    super(
      'Password changed, but secure local sign-out needs to be retried.',
      'unknown',
    );
  }
}
export async function finishPasswordSession(
  owner: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
  capturedToken?: string,
) {
  const token = capturedToken ?? (await secureStorage.getToken());
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === owner;
  if (!current()) throw new ApiError('Password update cancelled.', 'cancelled');
  try {
    const removed = await secureStorage.removeTokenIfCurrent(token, current);
    if (!removed || !current())
      throw new ApiError('Password update cancelled.', 'cancelled');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new PasswordSessionCleanupError();
  }
  useAuthStore.getState().clear();
}
export const changePasswordService = {
  async update(
    values: ChangePasswordValues,
    signal?: AbortSignal,
  ): Promise<PasswordChangeResult> {
    if (busy)
      throw new ApiError('Password update already in progress.', 'cancelled');
    const session = useAuthStore.getState();
    if (session.status !== 'authenticated' || !session.user)
      throw new ApiError(
        'Sign in with a real account to change your password.',
        'unauthorized',
        401,
      );
    const current = () =>
      useAuthStore.getState().status === 'authenticated' &&
      useAuthStore.getState().user === session.user;
    const check = () => {
      if (!current() || signal?.aborted)
        throw new ApiError('Password update cancelled.', 'cancelled');
    };
    busy = true;
    try {
      const input =
        createChangePasswordSchema(passwordChangePolicy).parse(values);
      const token = await secureStorage.getToken();
      check();
      if (!token || !/^\S+$/.test(token))
        throw new ApiError('Please sign in again.', 'unauthorized', 401);
      const response = await apiClient.post<unknown>(
        endpoints.changePassword,
        {
          current_password: input.currentPassword,
          password: input.newPassword,
          password_confirmation: input.confirmPassword,
        },
        { signal, headers: { Authorization: `Bearer ${token}` } },
      );
      check();
      if (
        response.status !== 200 ||
        !responseSchema.safeParse(response.data).success
      )
        throw new ApiError(
          'The server did not confirm the password update.',
          'unknown',
        );
      // All tokens are already revoked by Laravel. Do not call Logout API.
      await finishPasswordSession(session.user, token);
      return { updated: true, session: 'revoked' };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof z.ZodError)
        throw new ApiError(
          'Check the password fields and try again.',
          'validation',
        );
      throw new ApiError(
        'Unable to complete the password update. Please try again.',
        'unknown',
      );
    } finally {
      busy = false;
    }
  },
};
export function changePasswordErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Unable to confirm the password update. Please try again.';
  const messages = {
    unauthorized: 'Please sign in with a real account to change your password.',
    forbidden: 'Your account cannot change its password right now.',
    validation: 'Check the password fields and try again.',
    'rate-limit': 'Too many attempts. Please wait before trying again.',
    network: 'Unable to connect or request timed out. Please try again.',
    server:
      'Password updates are temporarily unavailable. Please try again later.',
  };
  return (
    messages[error.kind as keyof typeof messages] ??
    'Unable to confirm the password update. Please try again.'
  );
}
