import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { inboxResponseSchema } from '../types/inbox.types';

export async function getInboxPage(
  page = 1,
  signal?: AbortSignal,
  perPage = 20,
) {
  const session = useAuthStore.getState();
  if (session.status !== 'authenticated' || !session.user)
    throw new ApiError('Sign in to view your messages.', 'unauthorized', 401);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 50
  )
    throw new ApiError('Invalid inbox pagination.', 'validation');
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === session.user;
  const check = () => {
    if (signal?.aborted || !current())
      throw new ApiError('Inbox request cancelled.', 'cancelled');
  };
  check();
  const token = await secureStorage.getToken();
  check();
  if (!token || !/^\S+$/.test(token)) {
    const removed = await secureStorage.removeTokenIfCurrent(token, current);
    check();
    if (!removed) throw new ApiError('Inbox session changed.', 'cancelled');
    useAuthStore.getState().clear();
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  }
  const response = await apiClient.get<unknown>(endpoints.conversations, {
    signal,
    params: { page, per_page: perPage },
    headers: { Authorization: `Bearer ${token}` },
  });
  check();
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Inbox session changed.', 'cancelled');
  check();
  const parsed = inboxResponseSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError(
      'Unable to read your conversations. Please try again.',
      'unknown',
    );
  const result = parsed.data.data;
  if (
    result.pagination.current_page !== page ||
    result.pagination.per_page !== perPage ||
    result.items.length > perPage ||
    new Set(result.items.map(item => item.id)).size !== result.items.length ||
    result.items.some(item => item.other_participant.id === session.user!.id)
  )
    throw new ApiError('Invalid inbox response.', 'unknown');
  return result;
}

export function inboxErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'Please sign in again.';
    if (error.kind === 'forbidden')
      return 'Unable to access your conversations.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'network')
      return 'Unable to connect or request timed out. Please try again.';
  }
  return 'Messages are temporarily unavailable. Please try again.';
}
