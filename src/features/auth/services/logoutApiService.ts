import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';

const logoutResponseSchema = z.object({
  success: z.literal(true),
  message: z.literal('Logout successful.'),
  data: z.object({}).strict(),
});

export type LogoutServerResult = 'revoked' | 'already-invalid';

export const logoutApiService = {
  async revoke(token: string): Promise<LogoutServerResult> {
    try {
      const response = await apiClient.post<unknown>(
        endpoints.logout,
        undefined,
        {
          headers: { Authorization: `Bearer ${token}` },
          // Handle this endpoint's 401 in the coordinated logout cleanup, not midway
          // through the generic interceptor's session-expiry cleanup.
          validateStatus: status => status === 200 || status === 401,
        },
      );
      if (response.status === 401) return 'already-invalid';
      if (!logoutResponseSchema.safeParse(response.data).success)
        throw new ApiError(
          'The server did not confirm logout. Please try Logout again.',
          'unknown',
        );
      return 'revoked';
    } catch (error) {
      if (!(error instanceof ApiError))
        throw new ApiError(
          'Unable to sign out. Please try Logout again.',
          'unknown',
        );
      const messages = {
        network:
          'Unable to reach the server. You are still signed in. Check your connection and try Logout again.',
        forbidden:
          'The server did not allow logout. You are still signed in. Please try again or contact support.',
        'rate-limit':
          'Too many attempts. You are still signed in. Please wait before trying Logout again.',
        server:
          'Logout is temporarily unavailable. You are still signed in. Please try again later.',
      };
      throw new ApiError(
        messages[error.kind as keyof typeof messages] ??
          'The server did not confirm logout. Please try Logout again.',
        error.kind,
        error.status,
      );
    }
  },
};

export function logoutErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Could not clear your secure session. Please try Logout again.';
}
