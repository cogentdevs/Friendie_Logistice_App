import { isUiPreviewActive } from '../../../store/developmentStore';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiResponse, ApiError } from '../../../types/api';
import { loginSchema, LoginInput } from '../schemas/loginSchema';
import { sessionSchema, userSchema } from '../schemas/sessionSchema';
let loginController: AbortController | undefined;
let loginFlight: Promise<void> | undefined;
export function cancelLoginAttempt() {
  loginController?.abort();
}
export const authService = {
  login(input: LoginInput, signal?: AbortSignal): Promise<void> {
    if (loginFlight)
      return Promise.reject(
        new ApiError('Sign in is already in progress.', 'cancelled'),
      );
    const controller = new AbortController();
    loginController = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    if (signal?.aborted) controller.abort();
    const check = () => {
      if (controller.signal.aborted)
        throw new ApiError('Sign in cancelled.', 'cancelled');
    };
    const operation = (async () => {
      let stored = false;
      try {
        check();
        if (!appConfig.apiBaseUrl || !appConfig.authApiVerified)
          throw new ApiError(
            'Sign in is currently unavailable. Please try again later.',
            'unknown',
          );
        const { data } = await apiClient.post<unknown>(
          endpoints.login,
          loginSchema.parse(input),
          { signal: controller.signal },
        );
        check();
        const { token } = sessionSchema.parse(data);
        await secureStorage.setToken(token);
        stored = true;
        check();
        await authService.hydrate(controller.signal);
      } catch (error) {
        if (stored) {
          await secureStorage.removeToken();
          useAuthStore.getState().clear();
        }
        throw error;
      }
    })();
    loginFlight = operation;
    operation
      .finally(() => {
        signal?.removeEventListener('abort', abort);
        if (loginFlight === operation) {
          loginFlight = undefined;
          loginController = undefined;
        }
      })
      .catch(() => {});
    return operation;
  },
  async hydrate(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiResponse<unknown>>(endpoints.me, {
      signal,
    });
    if (signal?.aborted)
      throw new ApiError('Session restoration cancelled.', 'cancelled');
    useAuthStore.getState().setUser(userSchema.parse(data.data));
  },
  async restore(signal?: AbortSignal) {
    const token = await secureStorage.getToken();
    if (signal?.aborted)
      throw new ApiError('Session restoration cancelled.', 'cancelled');
    if (!token) {
      useAuthStore.getState().clear();
      return;
    }
    try {
      if (!appConfig.apiBaseUrl || !appConfig.authApiVerified)
        throw new ApiError(
          'Session validation is currently unavailable.',
          'unknown',
        );
      await authService.hydrate(signal);
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'unauthorized')
        useAuthStore.getState().clear();
      if (!(error instanceof ApiError && error.kind === 'unauthorized'))
        throw error;
    }
  },
  async logout() {
    cancelLoginAttempt();
    await loginFlight?.catch(() => {});
    if (
      (useAuthStore.getState().status === 'authenticated' ||
        !isUiPreviewActive()) &&
      appConfig.apiBaseUrl &&
      appConfig.authApiVerified
    ) {
      try {
        await apiClient.post(endpoints.logout);
      } catch {
        /* Local credentials still must be cleared when remote logout is unavailable. */
      }
    }
    await secureStorage.removeToken();
    useAuthStore.getState().clear();
  },
};
