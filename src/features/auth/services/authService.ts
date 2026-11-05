import { isUiPreviewActive } from '../../../store/developmentStore';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiResponse, ApiError } from '../../../types/api';
import { loginSchema, LoginInput } from '../schemas/loginSchema';
import { sessionSchema, userSchema } from '../schemas/sessionSchema';
export const authService = {
  async login(input: LoginInput) {
    if (!appConfig.apiBaseUrl || !appConfig.authApiVerified) {
      throw new ApiError(
        'Sign in is currently unavailable. Please try again later.',
        'unknown',
      );
    }
    const { data } = await apiClient.post<unknown>(
      endpoints.login,
      loginSchema.parse(input),
    );
    const { token } = sessionSchema.parse(data);
    await secureStorage.setToken(token);
    try {
      await authService.hydrate();
    } catch (error) {
      await secureStorage.removeToken();
      useAuthStore.getState().clear();
      throw error;
    }
  },
  async hydrate(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiResponse<unknown>>(endpoints.me, {
      signal,
    });
    useAuthStore.getState().setUser(userSchema.parse(data.data));
  },
  async restore() {
    if (!(await secureStorage.getToken())) {
      useAuthStore.getState().clear();
      return;
    }
    try {
      await authService.hydrate();
    } catch (error) {
      if (!(error instanceof ApiError && error.kind === 'unauthorized'))
        throw error;
    }
  },
  async logout() {
    if (
      !isUiPreviewActive() &&
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
