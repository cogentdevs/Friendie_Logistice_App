import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { isVerifiedPublicListing } from '../../listings/services/publicListingsService';
import { conversationReadResponseSchema } from '../types/chatRead.types';
import { validateMessageText } from './chatService';

// A session-scoped unresolved mutation remains held across dialog remounts.
// Only explicit server rejection releases it. Network/invalid-response outcomes
// cannot safely be treated as permission to POST again.
const submissions = new WeakMap<object, Map<number, 'pending' | 'unknown'>>();
export function conversationSubmissionState(listingId: number) {
  const user = useAuthStore.getState().user;
  return user ? submissions.get(user)?.get(listingId) : undefined;
}
export async function createOrReuseConversation(
  listing: { id: number },
  message: string,
  signal?: AbortSignal,
) {
  const session = useAuthStore.getState();
  const user = session.user;
  if (session.status !== 'authenticated' || !user || isUiPreviewActive())
    throw new ApiError('Sign in with a real account.', 'unauthorized', 401);
  if (!isVerifiedPublicListing(listing))
    throw new ApiError(
      'Messaging requires a real public listing.',
      'validation',
    );
  validateMessageText(message);
  let entries = submissions.get(user);
  if (!entries) {
    entries = new Map();
    submissions.set(user, entries);
  }
  if (entries.has(listing.id))
    throw new ApiError(
      'A previous submission is pending or its delivery is unknown. Check your Inbox before continuing.',
      'validation',
    );
  entries.set(listing.id, 'pending');
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === user;
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Session or screen changed.', 'cancelled');
  };
  let submitted = false;
  try {
    check();
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(token, current);
      check();
      if (removed) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    submitted = true;
    const response = await apiClient.post<unknown>(
      endpoints.conversations,
      { post_ads_id: listing.id, message },
      { signal, headers: { Authorization: `Bearer ${token}` } },
    );
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Session changed.', 'cancelled');
    check();
    const parsed = conversationReadResponseSchema.safeParse(response.data);
    if (
      ![200, 201].includes(response.status) ||
      !parsed.success ||
      parsed.data.data.listing.id !== listing.id
    )
      throw new ApiError(
        'Conversation delivery could not be confirmed. Check your Inbox.',
        'unknown',
      );
    entries.delete(listing.id);
    return { created: response.status === 201, conversation: parsed.data.data };
  } catch (error) {
    const rejected =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    if (!submitted || rejected) entries.delete(listing.id);
    else entries.set(listing.id, 'unknown');
    throw error;
  }
}
