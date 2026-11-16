import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiResponse, ApiError } from '../../../types/api';
import { loginSchema, LoginInput } from '../schemas/loginSchema';
import { loginResponseSchema, userSchema } from '../schemas/sessionSchema';
import { uiTestingLogin } from '../development/uiTestingLogin';
import { logoutApiService } from './logoutApiService';
let loginController: AbortController | undefined;
let loginFlight: Promise<void> | undefined;
let logoutFlight: Promise<void> | undefined;
let sessionRevision = 0;
export function cancelLoginAttempt() {
  loginController?.abort();
}
export const authService = {
  login(input: LoginInput, signal?: AbortSignal): Promise<void> {
    if (loginFlight || logoutFlight)
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
        if (!appConfig.apiBaseUrl || !appConfig.loginApiEnabled)
          throw new ApiError(
            'Sign in is currently unavailable. Please try again later.',
            'unknown',
          );
        const { email, password } = loginSchema.parse(input);
        if (email === uiTestingLogin.email)
          throw new ApiError(
            'Demo sign in is available only in supported testing previews.',
            'forbidden',
          );
        const response = await apiClient.post<unknown>(
          endpoints.login,
          { email, password },
          { signal: controller.signal, headers: { Authorization: false } },
        );
        check();
        const parsed = loginResponseSchema.safeParse(response.data);
        if (response.status !== 200 || !parsed.success)
          throw new ApiError(
            'The server returned an invalid sign-in response. Please try again.',
            'unknown',
          );
        const { token, user } = parsed.data.data;
        await secureStorage.setSession(token, user);
        stored = true;
        check();
        useAuthStore.getState().setUser(user);
      } catch (error) {
        if (stored) {
          await secureStorage.removeToken();
          useAuthStore.getState().clear();
        }
        if (error instanceof ApiError && error.kind !== 'cancelled') {
          const messages = {
            unauthorized:
              'Invalid credentials. Check your details; your account must be active and email verified.',
            forbidden:
              'This account is not permitted to sign in. Check account verification or contact support.',
            network: 'Unable to connect. Check your connection and try again.',
            server:
              'Sign in is temporarily unavailable. Please try again later.',
            'rate-limit':
              'Too many sign-in attempts. Please wait before trying again.',
          };
          const fields: Record<string, string[]> = {};
          for (const key of ['email', 'password']) {
            const values = error.fields?.[key];
            if (Array.isArray(values))
              fields[key] = values.filter(
                (value): value is string => typeof value === 'string',
              );
          }
          throw new ApiError(
            messages[error.kind as keyof typeof messages] ??
              (error.kind === 'validation'
                ? 'Please check the highlighted fields.'
                : 'Unable to sign in securely. Please try again.'),
            error.kind,
            error.status,
            fields,
          );
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
    const revision = sessionRevision;
    const { data } = await apiClient.get<ApiResponse<unknown>>(endpoints.me, {
      signal,
    });
    if (signal?.aborted || revision !== sessionRevision || logoutFlight)
      throw new ApiError('Session restoration cancelled.', 'cancelled');
    useAuthStore.getState().setUser(userSchema.parse(data.data));
  },
  async restore(signal?: AbortSignal) {
    const revision = sessionRevision;
    if (logoutFlight) return;
    if (appConfig.loginApiEnabled) {
      // Restore a previously server-established session, not a fresh server validation.
      // No /me endpoint is integrated in this phase; protected API 401s invalidate it.
      const session = await secureStorage.getSession();
      if (signal?.aborted || revision !== sessionRevision || logoutFlight)
        throw new ApiError('Session restoration cancelled.', 'cancelled');
      if (session?.token) useAuthStore.getState().setUser(session.user);
      else useAuthStore.getState().clear();
      return;
    }
    const token = await secureStorage.getToken();
    if (signal?.aborted || revision !== sessionRevision || logoutFlight)
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
  logout(): Promise<void> {
    if (logoutFlight) return logoutFlight;
    sessionRevision++;
    cancelLoginAttempt();
    const operation = (async () => {
      await loginFlight?.catch(() => {});
      const owner = useAuthStore.getState().user;
      const isCurrent = () => useAuthStore.getState().user === owner;
      const authenticated = useAuthStore.getState().status === 'authenticated';
      const token = await secureStorage.getToken();
      if (!isCurrent())
        throw new ApiError(
          'Session changed. Please try Logout again.',
          'cancelled',
        );
      // UI preview has no backend session and never sends a logout request.
      if (authenticated && token) await logoutApiService.revoke(token);
      if (!isCurrent())
        throw new ApiError(
          'Session changed. Please try Logout again.',
          'cancelled',
        );
      const removed = await secureStorage.removeTokenIfCurrent(
        token,
        isCurrent,
      );
      if (!removed && (await secureStorage.getToken()))
        throw new ApiError(
          'Session changed. Please try Logout again.',
          'cancelled',
        );
      if (!isCurrent())
        throw new ApiError(
          'Session changed. Please try Logout again.',
          'cancelled',
        );
      useAuthStore.getState().clear();
    })();
    logoutFlight = operation;
    operation
      .finally(() => {
        if (logoutFlight === operation) logoutFlight = undefined;
      })
      .catch(() => {});
    return operation;
  },
};
