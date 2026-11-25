import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { authenticatedDealSession, getDeal } from '../../deals/dealsService';
import { receivedReviewResponseSchema } from '../types/visitorReview.types';
import { ReviewDraft, validateReviewDraft } from './submitReviewService';
const id = z.number().int().positive();
const entry = receivedReviewResponseSchema.shape.data.shape.items.element;
const publicEntry = entry.omit({
  listing: true,
  reviewed_customer: true,
  deal_id: true,
});
const publicPage = z.object({
  success: z.literal(true),
  data: z.object({
    listing_id: id,
    average_rating: z.number().min(0).max(5).nullable(),
    review_count: z.number().int().nonnegative(),
    items: z.array(publicEntry),
    pagination: receivedReviewResponseSchema.shape.data.shape.pagination,
  }),
});
export async function getListingReviews(
  listingId: number,
  page = 1,
  signal?: AbortSignal,
) {
  id.parse(listingId);
  id.max(100000).parse(page);
  const response = await apiClient.get('/listings/' + listingId + '/reviews', {
    signal,
    headers: { Authorization: false },
    params: { page, per_page: 20 },
  });
  const parsed = publicPage.safeParse(response.data);
  if (
    response.status !== 200 ||
    !parsed.success ||
    parsed.data.data.listing_id !== listingId ||
    parsed.data.data.pagination.current_page !== page ||
    parsed.data.data.pagination.per_page !== 20
  )
    throw new ApiError('Invalid public reviews.', 'unknown');
  return parsed.data.data;
}
const holds = new WeakMap<
  object,
  Map<number, 'pending' | 'unknown' | 'confirmed' | 'duplicate'>
>();
useAuthStore.subscribe((state, previous) => {
  if (
    previous.user &&
    (state.user !== previous.user || state.status !== previous.status)
  )
    holds.delete(previous.user);
});
export function dealReviewState(dealId: number) {
  const user = useAuthStore.getState().user;
  return user ? holds.get(user)?.get(dealId) : undefined;
}
export async function submitDealReview(
  dealId: number,
  draft: ReviewDraft,
  signal?: AbortSignal,
) {
  id.parse(dealId);
  validateReviewDraft(draft);
  const auth = await authenticatedDealSession(signal);
  let entries = holds.get(auth.user);
  if (!entries) {
    entries = new Map();
    holds.set(auth.user, entries);
  }
  if (entries.has(dealId))
    throw new ApiError(
      'Review already submitted or awaiting confirmation.',
      'validation',
    );
  entries.set(dealId, 'pending');
  let dispatched = false;
  try {
    const deal = await getDeal(dealId, signal);
    await auth.check();
    if (deal.status !== 'completed')
      throw new ApiError('A completed deal is required.', 'validation');
    const sender = auth.user.id === deal.sender_user_id;
    const recipient = sender ? deal.carrier_user_id : deal.sender_user_id;
    const listing = sender ? deal.carrier_listing_id : deal.sender_listing_id;
    dispatched = true;
    const response = await apiClient.post(
      endpoints.submitReview,
      { deal_id: dealId, rating: draft.rating, review: draft.review },
      auth.config,
    );
    await auth.check();
    const parsed = z
      .object({ success: z.literal(true), data: entry })
      .safeParse(response.data);
    if (
      response.status !== 201 ||
      !parsed.success ||
      parsed.data.data.deal_id !== dealId ||
      parsed.data.data.reviewer.id !== auth.user.id ||
      parsed.data.data.reviewed_customer.id !== recipient ||
      parsed.data.data.listing.id !== listing ||
      parsed.data.data.rating !== draft.rating ||
      parsed.data.data.review !== draft.review
    )
      throw new ApiError('Review confirmation unavailable.', 'unknown');
    entries.set(dealId, 'confirmed');
    return parsed.data.data;
  } catch (error) {
    const definite =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    if (error instanceof ApiError && error.status === 409)
      entries.set(dealId, 'duplicate');
    else if (!dispatched || definite) entries.delete(dealId);
    else entries.set(dealId, 'unknown');
    throw error;
  }
}
