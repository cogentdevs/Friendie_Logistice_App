import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { isVerifiedPublicListing } from '../../listings/services/publicListingsService';
import { receivedReviewResponseSchema } from '../types/visitorReview.types';

export type ReviewDraft = { rating: number | null; review: string };
export type SubmitReviewRequest = {
  post_ads_id: number;
  rating: number;
  review: string;
};
const responseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: receivedReviewResponseSchema.shape.data.shape.items.element,
});
export type SubmitReviewResponse = z.infer<typeof responseSchema>;
type Submission =
  | { state: 'pending' | 'unknown'; draft: ReviewDraft }
  | { state: 'confirmed' | 'duplicate' };
// Mutation coordination, not a second reviews dataset. Uncertain payloads are
// retained only for this session so remounting cannot silently resend them.
const submissions = new WeakMap<object, Map<number, Submission>>();
useAuthStore.subscribe((state, previous) => {
  if (
    previous.user &&
    (state.user !== previous.user || state.status !== 'authenticated')
  )
    submissions.delete(previous.user);
});
export function reviewSubmission(listingId: number) {
  const user = useAuthStore.getState().user;
  return user ? submissions.get(user)?.get(listingId) : undefined;
}
export function validateReviewDraft(draft: ReviewDraft) {
  if (
    typeof draft.rating !== 'number' ||
    !Number.isInteger(draft.rating) ||
    draft.rating < 0 ||
    draft.rating > 5
  )
    throw new ApiError('Select a rating from 0 to 5.', 'validation');
  if (
    typeof draft.review !== 'string' ||
    !draft.review.trim() ||
    draft.review.includes('\0')
  )
    throw new ApiError('Enter a nonempty review.', 'validation');
}
export async function submitReview(
  listing: { id: number; ownerId: number },
  draft: ReviewDraft,
  signal?: AbortSignal,
): Promise<SubmitReviewResponse> {
  const session = useAuthStore.getState(),
    user = session.user;
  if (session.status !== 'authenticated' || !user || isUiPreviewActive())
    throw new ApiError(
      'Sign in with a real account to submit a review.',
      'unauthorized',
      401,
    );
  if (!isVerifiedPublicListing(listing))
    throw new ApiError('Select a real public listing to review.', 'validation');
  const listingId = listing.id;
  if (listing.ownerId === user.id)
    throw new ApiError(
      'You cannot review your own listing.',
      'validation',
      422,
    );
  validateReviewDraft(draft);
  let entries = submissions.get(user);
  if (!entries) {
    entries = new Map();
    submissions.set(user, entries);
  }
  if (entries.has(listingId))
    throw new ApiError(
      'This review is already submitted, pending, or awaiting confirmation. Check Your Reviews before continuing.',
      'validation',
    );
  const submittedDraft = { ...draft };
  entries.set(listingId, { state: 'pending', draft: submittedDraft });
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === user;
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Review submission cancelled.', 'cancelled');
  };
  let posted = false;
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
    const payload: SubmitReviewRequest = {
      post_ads_id: listingId,
      rating: submittedDraft.rating!,
      review: submittedDraft.review,
    };
    posted = true;
    const response = await apiClient.post<unknown>(
      endpoints.submitReview,
      payload,
      { signal, headers: { Authorization: `Bearer ${token}` } },
    );
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Review session changed.', 'cancelled');
    check();
    const parsed = responseSchema.safeParse(response.data);
    if (
      response.status !== 201 ||
      !parsed.success ||
      parsed.data.data.listing.id !== listingId ||
      parsed.data.data.reviewer.id !== user.id ||
      parsed.data.data.reviewed_customer.id === user.id ||
      parsed.data.data.rating !== submittedDraft.rating ||
      !parsed.data.data.review?.trim()
    )
      throw new ApiError(
        'Review submission could not be confirmed.',
        'unknown',
      );
    entries.set(listingId, { state: 'confirmed' });
    return parsed.data;
  } catch (error) {
    const rejection =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    if (error instanceof ApiError && error.status === 409)
      entries.set(listingId, { state: 'duplicate' });
    else if (!posted || rejection) entries.delete(listingId);
    else entries.set(listingId, { state: 'unknown', draft: submittedDraft });
    throw error;
  }
}
export function submitReviewErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'You have already reviewed this listing.';
    if (error.status === 401) return 'Please sign in again.';
    if (error.status === 403)
      return 'You are not permitted to review this listing.';
    if (error.status === 404)
      return 'This listing is no longer available for review.';
    if (error.status === 429)
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'validation' && !error.status) return error.message;
    if (error.status === 422)
      return 'Check the rating and review. You cannot review your own listing.';
  }
  return 'Unable to submit your review. Please try again later.';
}
