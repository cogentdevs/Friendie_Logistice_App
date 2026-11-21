import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { loginSchema, LoginInput } from '../schemas/loginSchema';
import {
  loginResponseSchema,
  currentAccountResponseSchema,
} from '../schemas/sessionSchema';
import { uiTestingLogin } from '../development/uiTestingLogin';
import { logoutApiService } from './logoutApiService';
let loginController: AbortController | undefined;
let loginFlight: Promise<void> | undefined;
let logoutFlight: Promise<void> | undefined;
let sessionRevision = 0;
let restoreFlight: Promise<void> | undefined;
let restoreSignal: AbortSignal | undefined;
let pendingVerification = false;
export function cancelLoginAttempt() {
  loginController?.abort();
}
export const authService = {
  login(input: LoginInput, signal?: AbortSignal): Promise<void> {
    if (loginFlight || logoutFlight)
      return Promise.reject(
        new ApiError('Sign in is already in progress.', 'cancelled'),
      );
    sessionRevision++;
    pendingVerification = false;
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
  async hydrate(
    signal?: AbortSignal,
    expectedToken?: string,
    expectedId?: number,
  ) {
    const revision = sessionRevision;
    const owner = useAuthStore.getState().user;
    const token = expectedToken ?? (await secureStorage.getToken());
    const current = () =>
      !signal?.aborted &&
      revision === sessionRevision &&
      !logoutFlight &&
      !isUiPreviewActive() &&
      useAuthStore.getState().user === owner;
    if (!current())
      throw new ApiError('Session restoration cancelled.', 'cancelled');
    if (!token) throw new ApiError('No stored session.', 'unauthorized', 401);
    const response = await apiClient.get<unknown>(endpoints.me, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    const stored = await secureStorage.getToken();
    if (!current() || stored !== token)
      throw new ApiError('Session restoration cancelled.', 'cancelled');
    const parsed = currentAccountResponseSchema.safeParse(response.data);
    if (
      response.status !== 200 ||
      !parsed.success ||
      (expectedId !== undefined && parsed.data.data.id !== expectedId)
    )
      throw new ApiError('Invalid account response.', 'unknown');
    useAuthStore.getState().setUser(parsed.data.data);
  },
  restore(signal?: AbortSignal): Promise<void> {
    if (restoreFlight && !restoreSignal?.aborted) return restoreFlight;
    const revision = sessionRevision;
    const owner = useAuthStore.getState().user;
    const current = () =>
      !signal?.aborted &&
      revision === sessionRevision &&
      !logoutFlight &&
      useAuthStore.getState().user === owner;
    const operation = (async () => {
      if (logoutFlight || loginFlight || isUiPreviewActive()) return;
      const session = await secureStorage.getSession();
      if (!current()) {
        if (
          session?.token &&
          signal?.aborted &&
          revision === sessionRevision &&
          !logoutFlight &&
          useAuthStore.getState().user === owner
        )
          pendingVerification = true;
        throw new ApiError('Session restoration cancelled.', 'cancelled');
      }
      if (!session?.token) {
        pendingVerification = false;
        useAuthStore.getState().clear();
        return;
      }
      try {
        await authService.hydrate(signal, session.token, session.user.id);
        pendingVerification = false;
      } catch (error) {
        if (!current()) {
          // Startup's bounded cancellation leaves credentials unverified, not invalid.
          if (
            signal?.aborted &&
            revision === sessionRevision &&
            !logoutFlight &&
            useAuthStore.getState().user === owner
          )
            pendingVerification = true;
          throw new ApiError('Session restoration cancelled.', 'cancelled');
        }
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          await secureStorage.removeTokenIfCurrent(session.token, current);
          if (current()) useAuthStore.getState().clear();
          pendingVerification = false;
          return;
        }
        pendingVerification = !(
          error instanceof ApiError && error.kind === 'cancelled'
        );
        if (current()) useAuthStore.getState().clear();
        throw error;
      }
    })();
    restoreFlight = operation;
    restoreSignal = signal;
    operation
      .finally(() => {
        if (restoreFlight === operation) restoreFlight = undefined;
      })
      .catch(() => {});
    return operation;
  },
  async retryRestore() {
    if (
      pendingVerification &&
      !isUiPreviewActive() &&
      useAuthStore.getState().status === 'guest'
    )
      await authService.restore();
  },
  logout(): Promise<void> {
    if (logoutFlight) return logoutFlight;
    sessionRevision++;
    pendingVerification = false;
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
