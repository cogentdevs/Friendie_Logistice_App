import axios, { AxiosInstance } from 'axios';
import { ApiError, ApiErrorKind } from '../../types/api';
import { secureStorage } from '../storage/secureStorage';
import { useAuthStore } from '../../store/authStore';
export function installInterceptors(client: AxiosInstance) {
  client.interceptors.request.use(async config => {
    if (!config.baseURL)
      throw new ApiError(
        'Configure API_BASE_URL before connecting.',
        'unknown',
      );
    const token = await secureStorage.getToken();
    if (token) config.headers.Authorization = 'Bearer ' + token;
    return config;
  });
  client.interceptors.response.use(
    response => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) throw error;
      if (axios.isCancel(error))
        throw new ApiError('Request cancelled.', 'cancelled');
      const status = error.response?.status;
      if (status === 401) {
        try {
          await secureStorage.removeToken();
        } finally {
          useAuthStore.getState().clear();
        }
      }
      const kinds: Record<number, ApiErrorKind> = {
        401: 'unauthorized',
        403: 'forbidden',
        404: 'not-found',
        422: 'validation',
        429: 'rate-limit',
      };
      const kind = status
        ? kinds[status] ?? (status >= 500 ? 'server' : 'unknown')
        : 'network';
      const data = error.response?.data as
        | { message?: string; errors?: Record<string, string[]> }
        | undefined;
      throw new ApiError(
        data?.message ||
          (kind === 'network'
            ? 'Unable to connect. Check your connection.'
            : 'Request failed. Please try again.'),
        kind,
        status,
        data?.errors,
      );
    },
  );
}
